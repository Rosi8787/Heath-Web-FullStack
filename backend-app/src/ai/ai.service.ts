import { Injectable } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

@Injectable()
export class AiService {
  // =========================
  // SUGAR LABELS
  // =========================

  private readonly SUGAR_LABELS = [
    'total sugars',
    'added sugars',
    'gula total',
    'gula tambahan',
    'sugars',
    'sugar',
    'gula',
    'sug',
  ];

  // =========================
  // CARBOHYDRATE LABELS
  // =========================

  private readonly CARB_LABELS = [
    'total carbohydrate',
    'total carb',
    'karbohidrat total',
    'carbohydrate',
    'karbohidrat',
    'carb',
  ];

  // =========================
  // PARSE GRAMS
  // =========================

  private parseGrams(text: string): number | null {
    if (!text) return null;

    const gramMatch = text.match(
      /(?<![a-z])(\d+(?:[.,]\d+)?)\s*(?:gram|gr|g)(?![a-z])/i,
    );
    if (gramMatch) {
      const value = parseFloat(gramMatch[1].replace(',', '.'));
      if (!isNaN(value)) return value;
    }

    const mgMatch = text.match(/(\d+(?:[.,]\d+)?)\s*mg(?![a-z])/i);
    if (mgMatch) {
      const value = parseFloat(mgMatch[1].replace(',', '.'));
      if (!isNaN(value)) return Math.round((value / 1000) * 100) / 100;
    }

    return null;
  }

  private matchesLabel(text: string, labels: string[]): boolean {
    if (!text) return false;
    return labels.some((label) => text.toLowerCase().trim().includes(label));
  }

  private isCarbLine(text: string): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      lower.includes('carbohydrate') ||
      lower.includes('karbohidrat') ||
      lower.includes('carb')
    );
  }

  private isNutritionValue(value: number): boolean {
    return value >= 0 && value <= 100;
  }

  // =========================
  // NORMALIZE OCR DATA
  // Handles both PaddleOCR v2 (nested) and v3 (flat) formats
  // =========================

  private normalizeOcrData(
    rawOcr: any,
  ): Array<{ text: string; score: number }> {
    const result: Array<{ text: string; score: number }> = [];

    if (!rawOcr || !Array.isArray(rawOcr)) return result;

    for (const item of rawOcr) {
      // ✅ Format baru PaddleOCR v3 (flat): { text: string, score: number }
      if (typeof item === 'object' && item !== null && 'text' in item) {
        if (item.text) {
          result.push({ text: String(item.text), score: item.score || 0 });
        }
      }
      // Format lama PaddleOCR v2 (nested block)
      else if (Array.isArray(item)) {
        for (const subItem of item) {
          try {
            const text = subItem?.[1]?.[0] || '';
            const score = subItem?.[1]?.[1] || 0;
            if (text) result.push({ text: String(text), score });
          } catch (_) {}
        }
      }
    }

    return result;
  }

  // =========================
  // EXTRACT SUGAR
  // =========================

  private extractSugarGrams(
    ocrData: Array<{ text: string; score: number }>,
  ): number {
    // PASS 1: direct sugar label
    for (let i = 0; i < ocrData.length; i++) {
      const currentText = ocrData[i]?.text || '';

      if (
        this.matchesLabel(currentText, this.SUGAR_LABELS) &&
        !this.isCarbLine(currentText)
      ) {
        console.log('SUGAR LABEL FOUND:', currentText);

        const inlineGrams = this.parseGrams(currentText);
        if (inlineGrams !== null && this.isNutritionValue(inlineGrams)) {
          console.log('SUGAR INLINE:', inlineGrams);
          return inlineGrams;
        }

        const candidates: number[] = [];
        for (let offset = 1; offset <= 5; offset++) {
          const next = ocrData[i + offset];
          if (!next) break;

          const value = this.parseGrams(next.text);
          if (value !== null && this.isNutritionValue(value)) {
            candidates.push(value);
            console.log(`SUGAR NEXT[${offset}] =`, value);
          }
        }

        if (candidates.length > 0) {
          return candidates.find((v) => v >= 1 && v <= 40) || candidates[0];
        }
      }
    }

    // PASS 2: fallback carb
    for (let i = 0; i < ocrData.length; i++) {
      const currentText = ocrData[i]?.text || '';

      if (this.matchesLabel(currentText, this.CARB_LABELS)) {
        console.log('CARBOHYDRATE FOUND:', currentText);

        const candidates: number[] = [];
        const inlineGrams = this.parseGrams(currentText);
        if (inlineGrams !== null && this.isNutritionValue(inlineGrams)) {
          candidates.push(inlineGrams);
        }

        for (let offset = 1; offset <= 5; offset++) {
          const next = ocrData[i + offset];
          if (!next) break;

          const value = this.parseGrams(next.text);
          if (value !== null && this.isNutritionValue(value)) {
            candidates.push(value);
          }
        }

        console.log('CARB CANDIDATES:', candidates);
        if (candidates.length > 0) {
          const estimated =
            candidates.find((v) => v >= 1 && v <= 40) || candidates[0];
          console.log('ESTIMATED SUGAR:', estimated);
          return estimated;
        }
      }
    }

    return 0;
  }

  private roundSugar(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private extractProductName(text: string): string {
    const SKIP_KEYWORDS = [
      'nutrition', 'nutritional', 'informasi', 'nilai gizi',
      'carbohydrate', 'karbohidrat', 'carb', 'protein',
      'sugar', 'sugars', 'gula', 'fat', 'lemak',
      'sodium', 'natrium', 'calories', 'kalori',
      'energi', 'energy', 'serving', 'porsi', 'sajian',
      'daily', 'value', 'amount', 'total', 'vitamin',
      'mineral', 'zinc', 'calcium', 'iron', 'percent',
      'persen', '%akg', '%dv',
    ];

    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      const lower = trimmed.toLowerCase();

      if (
        trimmed.length > 3 &&
        trimmed.length < 50 &&
        !SKIP_KEYWORDS.some((kw) => lower.includes(kw)) &&
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
    if (sugar < 1)
      return {
        grade: 'A',
        description: 'Minuman dengan kandungan gula sangat rendah (<1g per sajian).',
      };
    if (sugar < 5)
      return {
        grade: 'B',
        description: 'Minuman rendah gula dan masih direkomendasikan.',
      };
    if (sugar <= 10)
      return {
        grade: 'C',
        description: 'Minuman dengan kandungan gula cukup tinggi dan sebaiknya dibatasi.',
      };
    return {
      grade: 'D',
      description: 'Minuman dengan kandungan gula sangat tinggi.',
    };
  }

  // =========================
  // MAIN ANALYZE
  // =========================

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

      const response = await axios.post(`${OCR_URL}/ocr`, formData, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 60000,
      });

      const text: string = response.data.text || '';
      const rawOcr = response.data.ocr_data || [];

      // ✅ Normalize ke format standar { text, score }
      const ocrData = this.normalizeOcrData(rawOcr);

      console.log('=========== OCR TEXT ===========');
      console.log(text);
      console.log('=========== OCR DATA ===========');
      ocrData.forEach((item, idx) => console.log(`[${idx}]`, item.text));

      let sugar = this.extractSugarGrams(ocrData);
      sugar = this.roundSugar(sugar);

      if (isNaN(sugar) || sugar < 0 || sugar > 200) sugar = 0;

      const productName = this.extractProductName(text);
      const sugarStatus = this.getSugarStatus(sugar);
      const gradeData = this.getSugarGrade(sugar);

      return {
        success: true,
        extractedText: text,
        productName,
        sugar,
        sugarUnit: 'g',
        sugarStatus,
        sugarGrade: gradeData.grade,
        gradeDescription: gradeData.description,
        aiSummary: `Produk ini mengandung ${sugar}g gula dan masuk kategori grade ${gradeData.grade}. ${gradeData.description}`,
      };
    } catch (error: any) {
      console.log('OCR ANALYZE ERROR:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      return {
        success: false,
        message: 'Failed analyze nutrition image',
        error: error?.message || 'Unknown error',
      };
    }
  }
}