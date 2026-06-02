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
  // Sugar labels with common OCR typos
  private readonly SUGAR_PATTERNS = [
    /gula/i, /sugar/i, /sugars?/i, /sukrosa/i, /fructose/i,
    /gu1a/i, /sugzr/i, /gu[a-z0-9]*/i, /sug[a-z0-9]*/i
  ];

  // ------------------------------------------------------------------
  // Fuzzy match: check if text is similar to any sugar label
  // ------------------------------------------------------------------
  private isSugarLabel(text: string): boolean {
    const lower = text.toLowerCase();
    return this.SUGAR_PATTERNS.some(pattern => pattern.test(lower));
  }

  // ------------------------------------------------------------------
  // Parse grams from any string (extremely robust)
  // ------------------------------------------------------------------
  private parseGrams(text: string): number | null {
    if (!text) return null;
    let cleaned = text.replace(/,(\d{3})/g, '$1');
    cleaned = cleaned.replace(/,(\d+)/g, '.$1');

    // Look for number + optional unit (g, gr, gram, mg)
    const patterns = [
      /(\d+(?:\.\d+)?)\s*(?:gram|grams|gr|g)(?![a-z])/i,
      /(\d+(?:\.\d+)?)\s*mg(?![a-z])/i,
      /(\d+(?:\.\d+)?)\s*g(?![a-z])/i,
      /(\d+(?:\.\d+)?)\s*$/  // just a number (maybe sugar value)
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let value = parseFloat(match[1]);
        if (!isNaN(value)) {
          if (pattern.source.includes('mg')) value = value / 1000;
          if (value >= 0 && value <= 100) return Math.round(value * 10) / 10;
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Spatial search (label + number to right or below)
  // ------------------------------------------------------------------
  private groupWordsByLine(words: Word[], yTol = 15): Word[][] {
    if (!words.length) return [];
    const sorted = [...words].sort((a,b) => (a.bbox?.y||0) - (b.bbox?.y||0));
    const lines: Word[][] = [];
    let curLine: Word[] = [sorted[0]];
    let curY = sorted[0].bbox?.y || 0;
    for (let i=1; i<sorted.length; i++) {
      const y = sorted[i].bbox?.y || 0;
      if (Math.abs(y - curY) <= yTol) curLine.push(sorted[i]);
      else {
        lines.push(curLine.sort((a,b) => (a.bbox?.x||0) - (b.bbox?.x||0)));
        curLine = [sorted[i]];
        curY = y;
      }
    }
    if (curLine.length) lines.push(curLine);
    return lines;
  }

  private extractSugarSpatial(words: Word[]): number | null {
    const lines = this.groupWordsByLine(words);
    // Same line
    for (const line of lines) {
      for (let i=0; i<line.length; i++) {
        if (this.isSugarLabel(line[i].text)) {
          for (let j=i+1; j<=i+4 && j<line.length; j++) {
            const grams = this.parseGrams(line[j].text);
            if (grams !== null && grams >=0 && grams <= 100) return grams;
          }
        }
      }
    }
    // Next line
    for (let i=0; i<lines.length-1; i++) {
      for (const word of lines[i]) {
        if (this.isSugarLabel(word.text)) {
          for (const nextWord of lines[i+1]) {
            const grams = this.parseGrams(nextWord.text);
            if (grams !== null && grams >=0 && grams <= 100) return grams;
          }
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Direct regex on full text (most reliable)
  // ------------------------------------------------------------------
  private extractSugarFromFullText(text: string): number | null {
    // Look for patterns like "gula 5g", "sugar:5g", "gula tambahan 2g"
    const patterns = [
      /(?:gula|sugar|sukrosa|fructose)[:\s]*(\d+(?:[.,]\d+)?)\s*g/i,
      /(?:gula|sugar)[:\s]*(\d+(?:[.,]\d+)?)\s*(?:gram|gr)?/i,
      /(\d+(?:[.,]\d+)?)\s*g\s+(?:gula|sugar)/i
    ];
    for (const pat of patterns) {
      const match = text.match(pat);
      if (match) {
        let val = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(val) && val >=0 && val <= 100) return val;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Keyword fallback (no bbox)
  // ------------------------------------------------------------------
  private extractSugarKeyword(words: Word[]): number {
    for (let i=0; i<words.length; i++) {
      if (this.isSugarLabel(words[i].text)) {
        const inline = this.parseGrams(words[i].text);
        if (inline !== null) return inline;
        for (let off=1; off<=5; off++) {
          const val = this.parseGrams(words[i+off]?.text);
          if (val !== null) return val;
        }
      }
    }
    // Last resort: look for any small number near "karbohidrat"
    for (let i=0; i<words.length; i++) {
      if (/karbohidrat|carbohydrate/i.test(words[i].text)) {
        for (let off=1; off<=5; off++) {
          const val = this.parseGrams(words[i+off]?.text);
          if (val !== null && val >=0 && val <= 50) return val;
        }
      }
    }
    return 0;
  }

  // ------------------------------------------------------------------
  // Main analysis
  // ------------------------------------------------------------------
  async analyzeNutritionImage(file: Express.Multer.File) {
    try {
      const formData = new FormData();
      formData.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });

      const OCR_URL = process.env.OCR_URL?.replace(/\/+$/, '');
      const response = await axios.post<OcrResponse>(`${OCR_URL}/ocr`, formData, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 60000,
      });

      const fullText = response.data.text || '';
      const words = response.data.words || [];

      let sugar: number | null = null;

      // 1. Try direct regex on full text (best)
      sugar = this.extractSugarFromFullText(fullText);
      if (sugar !== null) {
        console.log('✅ Found via full‑text regex:', sugar);
      } else if (words.length && words[0].bbox) {
        // 2. Spatial analysis (if bbox present)
        sugar = this.extractSugarSpatial(words);
        if (sugar !== null) console.log('✅ Found via spatial:', sugar);
        else sugar = this.extractSugarKeyword(words);
      } else {
        sugar = this.extractSugarKeyword(words);
      }

      sugar = sugar !== null ? Math.round(sugar * 10) / 10 : 0;
      if (isNaN(sugar) || sugar < 0) sugar = 0;

      // Product name extraction (improved)
      const productName = this.extractProductName(fullText);
      const sugarStatus = sugar <= 5 ? 'Low Sugar' : (sugar <= 15 ? 'Medium Sugar' : 'High Sugar');
      const gradeData = sugar < 1 ? { grade: 'A', description: 'Gula sangat rendah (<1g)' } :
                         sugar < 5 ? { grade: 'B', description: 'Rendah gula' } :
                         sugar <= 10 ? { grade: 'C', description: 'Cukup tinggi, batasi' } :
                         { grade: 'D', description: 'Sangat tinggi, hindari' };

      return {
        success: true,
        extractedText: fullText,
        productName,
        sugar,
        sugarUnit: 'g',
        sugarStatus,
        sugarGrade: gradeData.grade,
        gradeDescription: gradeData.description,
        aiSummary: `Produk ini mengandung ${sugar}g gula (grade ${gradeData.grade}). ${gradeData.description}`
      };
    } catch (error: any) {
      console.error('OCR Error:', error.message);
      return { success: false, message: 'Failed to analyze', error: error.message };
    }
  }

  private extractProductName(text: string): string {
    const skip = /(nutrition|gizi|calories|kalori|sugar|gula|fat|lemak|protein|karbohidrat|carbohydrate|serving|porsi|sodium|vitamin)/i;
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 3 && trimmed.length < 60 && !skip.test(trimmed) && !/^[\d\s.,g%ml]+$/.test(trimmed)) {
        return trimmed;
      }
    }
    return 'Produk';
  }
}