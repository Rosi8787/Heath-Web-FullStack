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
  sugar_grams?: number | null;
}

@Injectable()
export class AiService {
  // Daftar label gula (termasuk kemungkinan typo)
  private readonly SUGAR_KEYWORDS = [
    'gula', 'sugar', 'sugars', 'sukrosa', 'fructose', 'glukosa',
    'gul', 'sug', 'gu1a', 'sugzr', 'gula tambahan', 'added sugar'
  ];

  // ------------------------------------------------------------------
  // Ekstraksi langsung dari field sugar_grams (hasil crop cerdas)
  // ------------------------------------------------------------------
  async analyzeNutritionImage(file: Express.Multer.File) {
    try {
      const formData = new FormData();
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const OCR_URL = process.env.OCR_URL?.replace(/\/+$/, '');
      const response = await axios.post<OcrResponse>(`${OCR_URL}/ocr`, formData, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 60000,
      });

      // 1. Gunakan nilai sugar_grams dari FastAPI (paling akurat)
      let sugar = response.data.sugar_grams ?? null;
      const fullText = response.data.text || '';

      // 2. Jika null, coba ekstrak manual dari fullText dengan regex lebih kuat
      if (sugar === null) {
        const patterns = [
          /(?:gula|sugar)[:\s]*(\d+(?:[.,]\d+)?)\s*g/i,
          /(\d+(?:[.,]\d+)?)\s*g\s+(?:gula|sugar)/i,
          /sugars?\s*(\d+(?:[.,]\d+)?)/i,
          /karbohidrat total[^\d]*(\d+(?:[.,]\d+)?)/i  // fallback ke karbohidrat
        ];
        for (const pat of patterns) {
          const match = fullText.match(pat);
          if (match) {
            sugar = parseFloat(match[1].replace(',', '.'));
            if (!isNaN(sugar) && sugar >= 0 && sugar <= 100) break;
            else sugar = null;
          }
        }
      }

      // 3. Jika masih null, cari kata yang mirip "gula" lalu ambil angka di sekitarnya
      if (sugar === null && response.data.words) {
        const words = response.data.words;
        for (let i = 0; i < words.length; i++) {
          const word = words[i].text.toLowerCase();
          if (this.SUGAR_KEYWORDS.some(kw => word.includes(kw))) {
            // Cek kata berikutnya
            for (let j = i+1; j <= i+3 && j < words.length; j++) {
              const numMatch = words[j].text.match(/(\d+(?:[.,]\d+)?)/);
              if (numMatch) {
                const val = parseFloat(numMatch[1].replace(',', '.'));
                if (val >= 0 && val <= 100) {
                  sugar = val;
                  break;
                }
              }
            }
            if (sugar !== null) break;
          }
        }
      }

      sugar = sugar !== null ? Math.round(sugar * 10) / 10 : 0;
      if (isNaN(sugar) || sugar < 0) sugar = 0;

      const productName = this.extractProductName(fullText);
      const sugarStatus = sugar <= 5 ? 'Low Sugar' : (sugar <= 15 ? 'Medium Sugar' : 'High Sugar');
      const gradeData = sugar < 1 ? { grade: 'A', description: 'Gula sangat rendah (<1g)' } :
                         sugar < 5 ? { grade: 'B', description: 'Rendah gula' } :
                         sugar <= 10 ? { grade: 'C', description: 'Cukup tinggi, batasi' } :
                         { grade: 'D', description: 'Sangat tinggi, hindari' };

      return {
        success: true,
        extractedText: fullText.slice(0, 500), // preview saja
        productName,
        sugar,
        sugarUnit: 'g',
        sugarStatus,
        sugarGrade: gradeData.grade,
        gradeDescription: gradeData.description,
        aiSummary: `Kandungan gula: ${sugar}g (${gradeData.grade}) – ${gradeData.description}`,
      };
    } catch (error: any) {
      console.error('OCR Error:', error.message);
      return {
        success: false,
        needsManualInput: true,
        message: 'Sugar tidak terdeteksi',
        options: ['scan_again', 'manual_input'],
        error: error.message,
      };
    }
  }

  private extractProductName(text: string): string {
    const skip = /(nutrition|gizi|calories|kalori|sugar|gula|fat|lemak|protein|carbohydrate|karbohidrat|serving|porsi|sodium|vitamin)/i;
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