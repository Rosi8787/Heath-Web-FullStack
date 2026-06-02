import { Injectable } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

interface Word {
  text: string;
  score: number;
  bbox?: { x: number; y: number; w: number; h: number };
}

interface OcrResponse {
  text: string;
  words: Word[];
}

@Injectable()
export class AiService {
  // Extended sugar labels (Indonesian & English)
  private readonly SUGAR_LABELS = [
    'total sugars', 'added sugars', 'gula total', 'gula tambahan',
    'sugars', 'sugar', 'gula', 'sug', 'sukrosa', 'fructose',
    'glucose', 'gula pasir', 'gula merah', 'cane sugar', 'palm sugar'
  ];

  private readonly CARB_LABELS = [
    'total carbohydrate', 'total carb', 'karbohidrat total',
    'carbohydrate', 'karbohidrat', 'carb'
  ];

  // ------------------------------------------------------------------
  // Helper: parse grams from any string (supports "12g", "12.5 g", "12,5gr", "12 gram")
  // ------------------------------------------------------------------
  private parseGrams(text: string): number | null {
    if (!text) return null;
    // Remove commas used as thousand separators (e.g., "1,000" -> "1000")
    let cleaned = text.replace(/,(\d{3})/g, '$1');
    // Replace decimal comma with dot
    cleaned = cleaned.replace(/,(\d+)/g, '.$1');

    const patterns = [
      /(\d+(?:\.\d+)?)\s*(?:gram|grams|gr|g)(?![a-z])/i,
      /(\d+(?:\.\d+)?)\s*mg(?![a-z])/i,
      /(\d+(?:\.\d+)?)\s*g(?![a-z])/i
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let value = parseFloat(match[1]);
        if (!isNaN(value)) {
          if (pattern.source.includes('mg')) {
            value = Math.round((value / 1000) * 100) / 100;
          }
          return value;
        }
      }
    }
    return null;
  }

  private isNutritionValue(value: number): boolean {
    return value >= 0 && value <= 100;
  }

  // ------------------------------------------------------------------
  // Spatial analysis: group words by line (based on y‑coordinate overlap)
  // ------------------------------------------------------------------
  private groupWordsByLine(words: Word[], yTolerance = 10): Word[][] {
    if (!words.length) return [];
    const sorted = [...words].sort((a, b) => (a.bbox?.y || 0) - (b.bbox?.y || 0));
    const lines: Word[][] = [];
    let currentLine: Word[] = [sorted[0]];
    let currentY = sorted[0].bbox?.y || 0;

    for (let i = 1; i < sorted.length; i++) {
      const y = sorted[i].bbox?.y || 0;
      if (Math.abs(y - currentY) <= yTolerance) {
        currentLine.push(sorted[i]);
      } else {
        lines.push(currentLine);
        currentLine = [sorted[i]];
        currentY = y;
      }
    }
    if (currentLine.length) lines.push(currentLine);
    // Sort words inside each line by x
    return lines.map(line => line.sort((a, b) => (a.bbox?.x || 0) - (b.bbox?.x || 0)));
  }

  // ------------------------------------------------------------------
  // Extract sugar using spatial proximity (label + nearby number with 'g')
  // ------------------------------------------------------------------
  private extractSugarSpatial(words: Word[]): number | null {
    const lines = this.groupWordsByLine(words);
    // First pass: same line, label and number to the right (within 5 words)
    for (const line of lines) {
      for (let i = 0; i < line.length; i++) {
        const currentText = line[i].text.toLowerCase();
        if (this.SUGAR_LABELS.some(label => currentText.includes(label))) {
          // Look ahead up to 5 words on the same line
          for (let offset = 1; offset <= 5 && i + offset < line.length; offset++) {
            const grams = this.parseGrams(line[i + offset].text);
            if (grams !== null && this.isNutritionValue(grams)) {
              console.log(`[SPATIAL] Sugar label '${line[i].text}' → grams = ${grams}`);
              return grams;
            }
          }
        }
      }
    }

    // Second pass: label on one line, value on next line (directly below)
    for (let lineIdx = 0; lineIdx < lines.length - 1; lineIdx++) {
      const currentLine = lines[lineIdx];
      const nextLine = lines[lineIdx + 1];
      for (const word of currentLine) {
        if (this.SUGAR_LABELS.some(label => word.text.toLowerCase().includes(label))) {
          for (const nextWord of nextLine) {
            const grams = this.parseGrams(nextWord.text);
            if (grams !== null && this.isNutritionValue(grams)) {
              console.log(`[SPATIAL] Sugar label '${word.text}' → value on next line = ${grams}`);
              return grams;
            }
          }
        }
      }
    }

    return null;
  }

  // ------------------------------------------------------------------
  // Fallback: old keyword + adjacent look‑up (without spatial data)
  // ------------------------------------------------------------------
  private extractSugarKeyword(ocrData: Word[]): number {
    // Fallback when no bbox or spatial fails
    for (let i = 0; i < ocrData.length; i++) {
      const currentText = ocrData[i]?.text || '';
      if (this.SUGAR_LABELS.some(label => currentText.toLowerCase().includes(label))) {
        const inline = this.parseGrams(currentText);
        if (inline !== null && this.isNutritionValue(inline)) return inline;

        for (let offset = 1; offset <= 5; offset++) {
          const next = ocrData[i + offset];
          if (!next) break;
          const value = this.parseGrams(next.text);
          if (value !== null && this.isNutritionValue(value)) return value;
        }
      }
    }

    // Fallback to carbohydrate line (estimate sugar as ~10% of carbs? Not ideal, but better than 0)
    for (let i = 0; i < ocrData.length; i++) {
      const currentText = ocrData[i]?.text || '';
      if (this.CARB_LABELS.some(label => currentText.toLowerCase().includes(label))) {
        for (let offset = 1; offset <= 5; offset++) {
          const next = ocrData[i + offset];
          if (!next) break;
          const value = this.parseGrams(next.text);
          if (value !== null && this.isNutritionValue(value)) {
            console.log(`[FALLBACK] Using carbohydrate value as sugar estimate: ${value}`);
            return value;
          }
        }
      }
    }
    return 0;
  }

  // ------------------------------------------------------------------
  // Round sugar to 1 decimal
  // ------------------------------------------------------------------
  private roundSugar(value: number): number {
    return Math.round(value * 10) / 10;
  }

  // ------------------------------------------------------------------
  // Extract product name (skip nutrition keywords)
  // ------------------------------------------------------------------
  private extractProductName(text: string): string {
    const SKIP_KEYWORDS = [
      'nutrition', 'nutritional', 'informasi gizi', 'nilai gizi',
      'carbohydrate', 'karbohidrat', 'protein', 'sugar', 'gula',
      'fat', 'lemak', 'sodium', 'natrium', 'calories', 'kalori',
      'energi', 'serving', 'porsi', 'sajian', 'daily value', 'akg',
      'vitamin', 'mineral', 'percent', 'persen'
    ];
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      const lower = trimmed.toLowerCase();
      if (
        trimmed.length > 3 && trimmed.length < 60 &&
        !SKIP_KEYWORDS.some(kw => lower.includes(kw)) &&
        !/^[\d\s.,g%mlkj]+$/i.test(trimmed)
      ) {
        return trimmed;
      }
    }
    return 'Unknown Product';
  }

  private getSugarStatus(sugar: number): string {
    if (sugar <= 5) return 'Low Sugar';
    if (sugar <= 15) return 'Medium Sugar';
    return 'High Sugar';
  }

  private getSugarGrade(sugar: number): { grade: string; description: string } {
    if (sugar < 1) return { grade: 'A', description: 'Minuman dengan kandungan gula sangat rendah (<1g per sajian).' };
    if (sugar < 5) return { grade: 'B', description: 'Minuman rendah gula dan masih direkomendasikan.' };
    if (sugar <= 10) return { grade: 'C', description: 'Minuman dengan kandungan gula cukup tinggi dan sebaiknya dibatasi.' };
    return { grade: 'D', description: 'Minuman dengan kandungan gula sangat tinggi.' };
  }

  // ------------------------------------------------------------------
  // Main analysis method
  // ------------------------------------------------------------------
  async analyzeNutritionImage(file: Express.Multer.File) {
    console.log('🔥 ANALYZE NUTRITION DIPANGGIL');

    try {
      const formData = new FormData();
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const OCR_URL = process.env.OCR_URL?.replace(/\/+$/, '');
      console.log('OCR_URL =', OCR_URL);

      const response = await axios.post<OcrResponse>(`${OCR_URL}/ocr`, formData, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 60000,
      });

      const fullText = response.data.text || '';
      let words: Word[] = response.data.words || [];

      // Ensure each word has a bbox (for spatial analysis)
      const hasSpatialData = words.length > 0 && words[0].bbox !== undefined;

      let sugar = 0;

      if (hasSpatialData) {
        const spatialSugar = this.extractSugarSpatial(words);
        if (spatialSugar !== null) {
          sugar = spatialSugar;
        } else {
          // Fallback to keyword-based if spatial didn't find anything
          sugar = this.extractSugarKeyword(words);
        }
      } else {
        // Old OCR response without bbox – use keyword method
        sugar = this.extractSugarKeyword(words);
      }

      sugar = this.roundSugar(sugar);
      if (isNaN(sugar) || sugar < 0 || sugar > 200) sugar = 0;

      const productName = this.extractProductName(fullText);
      const sugarStatus = this.getSugarStatus(sugar);
      const gradeData = this.getSugarGrade(sugar);

      return {
        success: true,
        extractedText: fullText,
        productName,
        sugar,
        sugarUnit: 'g',
        sugarStatus,
        sugarGrade: gradeData.grade,
        gradeDescription: gradeData.description,
        aiSummary: `Produk ini mengandung ${sugar}g gula dan masuk kategori grade ${gradeData.grade}. ${gradeData.description}`,
      };
    } catch (error: any) {
      console.error('OCR ANALYZE ERROR:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      return {
        success: false,
        message: 'Failed to analyze nutrition image',
        error: error?.message || 'Unknown error',
      };
    }
  }
}