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

  private parseGrams(
    text: string,
  ): number | null {

    if (!text) {
      return null;
    }

    // =====================
    // MATCH GRAM
    // =====================

    const gramMatch = text.match(
      /(?<![a-z])(\d+(?:[.,]\d+)?)\s*(?:gram|gr|g)(?![a-z])/i,
    );

    if (gramMatch) {

      const value = parseFloat(
        gramMatch[1].replace(',', '.'),
      );

      if (!isNaN(value)) {
        return value;
      }
    }

    // =====================
    // MATCH MG
    // =====================

    const mgMatch = text.match(
      /(\d+(?:[.,]\d+)?)\s*mg(?![a-z])/i,
    );

    if (mgMatch) {

      const value = parseFloat(
        mgMatch[1].replace(',', '.'),
      );

      if (!isNaN(value)) {

        // convert mg -> g
        return Math.round(
          (value / 1000) * 100,
        ) / 100;
      }
    }

    return null;
  }

  // =========================
  // MATCH LABEL
  // =========================

  private matchesLabel(
    text: string,
    labels: string[],
  ): boolean {

    if (!text) {
      return false;
    }

    const lower =
      text.toLowerCase().trim();

    return labels.some((label) =>
      lower.includes(label),
    );
  }

  // =========================
  // IS CARB LINE
  // =========================

  private isCarbLine(
    text: string,
  ): boolean {

    if (!text) {
      return false;
    }

    const lower =
      text.toLowerCase();

    return (
      lower.includes('carbohydrate') ||
      lower.includes('karbohidrat') ||
      lower.includes('carb')
    );
  }

  // =========================
  // VALID VALUE
  // =========================

  private isNutritionValue(
    value: number,
  ): boolean {

    return (
      value >= 0 &&
      value <= 100
    );
  }

  // =========================
  // EXTRACT SUGAR
  // =========================

  private extractSugarGrams(
    ocrData: Array<{
      text: string;
      score: number;
    }>,
  ): number {

    // =====================
    // PASS 1
    // DIRECT SUGAR
    // =====================

    for (let i = 0; i < ocrData.length; i++) {

      const currentText =
        ocrData[i]?.text || '';

      if (
        this.matchesLabel(
          currentText,
          this.SUGAR_LABELS,
        ) &&
        !this.isCarbLine(currentText)
      ) {

        console.log(
          'SUGAR LABEL FOUND:',
          currentText,
        );

        // =====================
        // INLINE VALUE
        // =====================

        const inlineGrams =
          this.parseGrams(currentText);

        if (
          inlineGrams !== null &&
          this.isNutritionValue(
            inlineGrams,
          )
        ) {

          console.log(
            'SUGAR INLINE:',
            inlineGrams,
          );

          return inlineGrams;
        }

        // =====================
        // NEXT LINES
        // =====================

        const candidates: number[] = [];

        for (
          let offset = 1;
          offset <= 5;
          offset++
        ) {

          const next =
            ocrData[i + offset];

          if (!next) {
            break;
          }

          const value =
            this.parseGrams(
              next.text,
            );

          if (
            value !== null &&
            this.isNutritionValue(
              value,
            )
          ) {

            candidates.push(value);

            console.log(
              `SUGAR NEXT[${offset}] =`,
              value,
            );
          }
        }

        if (
          candidates.length > 0
        ) {

          // sugar biasanya 1g - 40g
          const estimated =
            candidates.find(
              (v) =>
                v >= 1 &&
                v <= 40,
            ) ||
            candidates[0];

          return estimated;
        }
      }
    }

    // =====================
    // PASS 2
    // FALLBACK CARB
    // =====================

    for (let i = 0; i < ocrData.length; i++) {

      const currentText =
        ocrData[i]?.text || '';

      if (
        this.matchesLabel(
          currentText,
          this.CARB_LABELS,
        )
      ) {

        console.log(
          'CARBOHYDRATE FOUND:',
          currentText,
        );

        const candidates: number[] = [];

        // =====================
        // INLINE
        // =====================

        const inlineGrams =
          this.parseGrams(
            currentText,
          );

        if (
          inlineGrams !== null &&
          this.isNutritionValue(
            inlineGrams,
          )
        ) {

          candidates.push(
            inlineGrams,
          );
        }

        // =====================
        // NEARBY VALUES
        // =====================

        for (
          let offset = 1;
          offset <= 5;
          offset++
        ) {

          const next =
            ocrData[i + offset];

          if (!next) {
            break;
          }

          const value =
            this.parseGrams(
              next.text,
            );

          if (
            value !== null &&
            this.isNutritionValue(
              value,
            )
          ) {

            candidates.push(
              value,
            );
          }
        }

        console.log(
          'CARB CANDIDATES:',
          candidates,
        );

        if (
          candidates.length > 0
        ) {

          const estimated =
            candidates.find(
              (v) =>
                v >= 1 &&
                v <= 40,
            ) ||
            candidates[0];

          console.log(
            'ESTIMATED SUGAR:',
            estimated,
          );

          return estimated;
        }
      }
    }

    return 0;
  }

  // =========================
  // ROUND SUGAR
  // =========================

  private roundSugar(
    value: number,
  ): number {

    return (
      Math.round(value * 10) / 10
    );
  }

  // =========================
  // PRODUCT NAME
  // =========================

  private extractProductName(
    text: string,
  ): string {

    const SKIP_KEYWORDS = [
      'nutrition',
      'nutritional',
      'informasi',
      'nilai gizi',
      'carbohydrate',
      'karbohidrat',
      'carb',
      'protein',
      'sugar',
      'sugars',
      'gula',
      'fat',
      'lemak',
      'sodium',
      'natrium',
      'calories',
      'kalori',
      'energi',
      'energy',
      'serving',
      'porsi',
      'sajian',
      'daily',
      'value',
      'amount',
      'total',
      'vitamin',
      'mineral',
      'zinc',
      'calcium',
      'iron',
      'percent',
      'persen',
      '%akg',
      '%dv',
    ];

    const lines =
      text.split('\n');

    for (const line of lines) {

      const trimmed =
        line.trim();

      const lower =
        trimmed.toLowerCase();

      if (
        trimmed.length > 3 &&
        trimmed.length < 50 &&
        !SKIP_KEYWORDS.some(
          (kw) =>
            lower.includes(kw),
        ) &&
        !/^[\d\s.,g%mlkj]+$/i.test(
          trimmed,
        )
      ) {

        return trimmed;
      }
    }

    return 'Unknown Product';
  }

  // =========================
  // STATUS
  // =========================

  private getSugarStatus(
    sugar: number,
  ): string {

    if (sugar <= 5) {
      return 'Low Sugar';
    }

    if (sugar <= 15) {
      return 'Medium Sugar';
    }

    return 'High Sugar';
  }

  // =========================
  // GRADE
  // =========================

  private getSugarGrade(
    sugar: number,
  ): {
    grade: string;
    description: string;
  } {

    if (sugar < 1) {

      return {
        grade: 'A',
        description:
          'Minuman dengan kandungan gula sangat rendah (<1g per sajian).',
      };
    }

    if (sugar < 5) {

      return {
        grade: 'B',
        description:
          'Minuman rendah gula dan masih direkomendasikan.',
      };
    }

    if (sugar <= 10) {

      return {
        grade: 'C',
        description:
          'Minuman dengan kandungan gula cukup tinggi dan sebaiknya dibatasi.',
      };
    }

    return {
      grade: 'D',
      description:
        'Minuman dengan kandungan gula sangat tinggi.',
    };
  }

  // =========================
  // MAIN ANALYZE
  // =========================

  async analyzeNutritionImage(
    file: Express.Multer.File,
  ) {

    try {

      // =====================
      // FORM DATA
      // =====================

      const formData =
        new FormData();

      formData.append(
        'file',
        file.buffer,
        file.originalname,
      );

      // =====================
      // OCR REQUEST
      // =====================

      const response =
        await axios.post(
          'http://127.0.0.1:8000/ocr',
          formData,
          {
            headers:
              formData.getHeaders(),
            maxBodyLength:
              Infinity,
          },
        );

      // =====================
      // OCR TEXT
      // =====================

      const text: string =
        response.data.text || '';

      // =====================
      // RAW OCR
      // =====================

      const rawOcr =
        response.data.ocr_data || [];

      // =====================
      // NORMALIZE OCR
      // =====================

      const ocrData: Array<{
        text: string;
        score: number;
      }> = [];

      for (const block of rawOcr) {

        for (const item of block) {

          try {

            const text =
              item?.[1]?.[0] || '';

            const score =
              item?.[1]?.[1] || 0;

            if (text) {

              ocrData.push({
                text,
                score,
              });
            }

          } catch (err) {

            console.log(
              'OCR PARSE ERROR:',
              err,
            );
          }
        }
      }

      // =====================
      // DEBUG
      // =====================

      console.log(
        '=========== OCR TEXT ===========',
      );

      console.log(text);

      console.log(
        '=========== OCR DATA ===========',
      );

      ocrData.forEach(
        (item, idx) => {

          console.log(
            `[${idx}]`,
            item.text,
          );
        },
      );

      // =====================
      // EXTRACT SUGAR
      // =====================

      let sugar =
        this.extractSugarGrams(
          ocrData,
        );

      sugar =
        this.roundSugar(
          sugar,
        );

      // =====================
      // SANITY CHECK
      // =====================

      if (
        isNaN(sugar) ||
        sugar < 0 ||
        sugar > 200
      ) {

        sugar = 0;
      }

      // =====================
      // PRODUCT NAME
      // =====================

      const productName =
        this.extractProductName(
          text,
        );

      // =====================
      // STATUS
      // =====================

      const sugarStatus =
        this.getSugarStatus(
          sugar,
        );

      // =====================
      // GRADE
      // =====================

      const gradeData =
        this.getSugarGrade(
          sugar,
        );

      // =====================
      // RESPONSE
      // =====================

      return {

        success: true,

        extractedText: text,

        productName,

        sugar,

        sugarUnit: 'g',

        sugarStatus,

        sugarGrade:
          gradeData.grade,

        gradeDescription:
          gradeData.description,

        aiSummary:
          `Produk ini mengandung ${sugar}g gula dan masuk kategori grade ${gradeData.grade}. ${gradeData.description}`,
      };

    } catch (error: any) {

      console.log(
        'OCR ANALYZE ERROR:',
      );

      console.log(error);

      return {

        success: false,

        message:
          'Failed analyze nutrition image',

        error:
          error?.message ||
          'Unknown error',
      };
    }
  }
}