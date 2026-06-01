import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import axios from 'axios';
import FormData from 'form-data';

function getConsumptionPeriod(hour: number) {
  if (hour >= 5 && hour < 11) return 'MORNING';
  if (hour >= 11 && hour < 15) return 'AFTERNOON';
  if (hour >= 15 && hour < 19) return 'EVENING';
  return 'NIGHT';
}

// =========================
// SUGAR LABELS
// =========================
const SUGAR_LABELS = [
  'total sugars',
  'added sugars',
  'gula total',
  'gula tambahan',
  'sugars',
  'sugar',
  'gula',
  'sug',
];

const CARB_LABELS = [
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
function parseGrams(text: string): number | null {
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

function matchesLabel(text: string, labels: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  return labels.some((label) => lower.includes(label));
}

function isCarbLine(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('carbohydrate') ||
    lower.includes('karbohidrat') ||
    lower.includes('carb')
  );
}

function isNutritionValue(value: number): boolean {
  return value >= 0 && value <= 100;
}

// =========================
// EXTRACT SUGAR dari flat ocr_data
// Format baru PaddleOCR v3: [{ text: string, score: number }]
// =========================
function extractSugarGrams(
  ocrData: Array<{ text: string; score: number }>,
): number {
  // PASS 1: cari label sugar langsung
  for (let i = 0; i < ocrData.length; i++) {
    const currentText = ocrData[i]?.text || '';

    if (
      matchesLabel(currentText, SUGAR_LABELS) &&
      !isCarbLine(currentText)
    ) {
      console.log('SUGAR LABEL FOUND:', currentText);

      const inlineGrams = parseGrams(currentText);
      if (inlineGrams !== null && isNutritionValue(inlineGrams)) {
        console.log('SUGAR INLINE:', inlineGrams);
        return inlineGrams;
      }

      const candidates: number[] = [];
      for (let offset = 1; offset <= 5; offset++) {
        const next = ocrData[i + offset];
        if (!next) break;

        const value = parseGrams(next.text);
        if (value !== null && isNutritionValue(value)) {
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

    if (matchesLabel(currentText, CARB_LABELS)) {
      console.log('CARBOHYDRATE FOUND:', currentText);

      const candidates: number[] = [];
      const inlineGrams = parseGrams(currentText);
      if (inlineGrams !== null && isNutritionValue(inlineGrams)) {
        candidates.push(inlineGrams);
      }

      for (let offset = 1; offset <= 5; offset++) {
        const next = ocrData[i + offset];
        if (!next) break;

        const value = parseGrams(next.text);
        if (value !== null && isNutritionValue(value)) {
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

function getSugarStatus(sugar: number): string {
  if (sugar <= 5) return 'Low Sugar';
  if (sugar <= 15) return 'Medium Sugar';
  return 'High Sugar';
}

function getSugarGrade(sugar: number): { grade: string; description: string } {
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

@Injectable()
export class NutritionService {
  constructor(private prisma: PrismaService) {}

  // ======================================================
  // SCAN NUTRITION
  // ======================================================

  async scanNutrition(userId: string, dto: any, file: Express.Multer.File) {
    console.log('FILE =', file?.originalname);

    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const today = new Date().toLocaleDateString('en-CA');

    const totalToday = await this.prisma.nutritionScan.count({
      where: { userId, dayKey: today },
    });

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    const isPremium =
      subscription &&
      subscription.status === 'ACTIVE' &&
      subscription.expiresAt > new Date();

    if (!isPremium && totalToday >= 10) {
      throw new BadRequestException('Free users can only scan 10 times per day');
    }

    const productName = dto.productName || 'Unknown Product';
    const manualSugar = dto.sugar ? parseFloat(dto.sugar) : null;

    // ======================================================
    // IF USER INPUT MANUAL
    // ======================================================

    if (manualSugar !== null) {
      const sugarStatus = getSugarStatus(manualSugar);
      const gradeData = getSugarGrade(manualSugar);

      const nutrition = await this.prisma.nutritionScan.create({
        data: {
          userId,
          productName,
          sugar: manualSugar,
          sugarStatus,
          sugarGrade: gradeData.grade,
          aiSummary: `This product contains ${manualSugar}g sugar and is classified as ${sugarStatus}.`,
        },
      });

      return {
        success: true,
        message: 'Manual nutrition input success',
        data: nutrition,
      };
    }

    // ======================================================
    // SEND IMAGE TO OCR
    // ======================================================

    console.log('Sending image to OCR service...');

    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const OCR_URL = process.env.OCR_URL?.replace(/\/+$/, '');
    console.log('OCR_URL =', OCR_URL);

    let ocrResponse: any;
    try {
      ocrResponse = await axios.post(`${OCR_URL}/ocr`, formData, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 60000, // 60 detik timeout karena OCR bisa lambat
      });
    } catch (err: any) {
      console.error('OCR REQUEST FAILED:', err.message);
      throw new BadRequestException(
        `OCR service error: ${err.message || 'Unknown error'}`,
      );
    }

    const extractedText: string = ocrResponse.data.text || '';

    // =======================================================
    // PARSE OCR DATA
    // Format PaddleOCR v3 (paddleocr==3.5.0):
    // ocrResponse.data.ocr_data = [{ text: string, score: number }]
    // =======================================================

    const rawOcr = ocrResponse.data.ocr_data || [];

    console.log('=========== OCR TEXT ===========');
    console.log(extractedText);
    console.log('=========== OCR DATA ===========');
    console.log(JSON.stringify(rawOcr, null, 2));

    // ✅ Flatten/normalize ocr_data ke format standar { text, score }
    const ocrData: Array<{ text: string; score: number }> = [];

    for (const item of rawOcr) {
      // Format baru (flat): { text: string, score: number }
      if (typeof item === 'object' && item !== null && 'text' in item) {
        if (item.text) {
          ocrData.push({ text: item.text, score: item.score || 0 });
        }
      }
      // Format lama (nested): [[text, score], ...]
      else if (Array.isArray(item)) {
        for (const subItem of item) {
          try {
            const text = subItem?.[1]?.[0] || '';
            const score = subItem?.[1]?.[1] || 0;
            if (text) ocrData.push({ text, score });
          } catch (_) {}
        }
      }
    }

    console.log('=========== NORMALIZED OCR DATA ===========');
    ocrData.forEach((item, idx) => console.log(`[${idx}]`, item.text));

    // ======================================================
    // EXTRACT SUGAR
    // ======================================================

    let sugar = extractSugarGrams(ocrData);
    sugar = Math.round(sugar * 10) / 10;

    if (isNaN(sugar) || sugar < 0 || sugar > 200) {
      sugar = 0;
    }

    const sugarDetected = sugar > 0 || ocrData.length > 0;

    // ======================================================
    // IF OCR FAILED / SUGAR NOT FOUND
    // ======================================================

    if (!sugarDetected || ocrData.length === 0) {
      return {
        success: false,
        needsManualInput: true,
        message: 'Sugar tidak terdeteksi',
        options: ['scan_again', 'manual_input'],
        extractedText,
      };
    }

    // ======================================================
    // SUGAR STATUS & GRADE
    // ======================================================

    const sugarStatus = getSugarStatus(sugar);
    const gradeData = getSugarGrade(sugar);

    // ======================================================
    // SAVE TO DATABASE
    // ======================================================

    console.log({ sugar, sugarStatus, sugarGrade: gradeData.grade });

    const now = new Date();
    const hour = now.getHours();
    const dayKey = now.toLocaleDateString('en-CA');
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const yearKey = `${now.getFullYear()}`;
    const weekKey = `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`;
    const consumptionPeriod = getConsumptionPeriod(hour);

    const nutrition = await this.prisma.nutritionScan.create({
      data: {
        userId,
        productName,
        sugar,
        sugarStatus,
        sugarGrade: gradeData.grade,
        consumedAt: now,
        consumptionPeriod,
        dayKey,
        weekKey,
        monthKey,
        yearKey,
        aiSummary: `Produk ini mengandung ${sugar}g gula dan masuk kategori grade ${gradeData.grade}. ${gradeData.description}`,
      },
    });

    return {
      success: true,
      message: 'Nutrition scanned successfully',
      data: nutrition,
      extractedText,
    };
  }

  // ======================================================
  // TIMER TERAKHIR KONSUMSI
  // ======================================================

  async getLastConsumption(userId: string) {
    const lastScan = await this.prisma.nutritionScan.findFirst({
      where: { userId },
      orderBy: { consumedAt: 'desc' },
    });

    if (!lastScan) return { message: 'No consumption yet' };

    const now = new Date();
    const diffMs = now.getTime() - new Date(lastScan.consumedAt).getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      lastProduct: lastScan.productName,
      lastSugar: lastScan.sugar,
      consumedAt: lastScan.consumedAt,
      elapsed: `${hours}h ${minutes}m ago`,
    };
  }

  // ======================================================
  // DAILY STATS
  // ======================================================

  async getDailyStats(userId: string, date: string) {
    const scans = await this.prisma.nutritionScan.findMany({
      where: { userId, dayKey: date },
    });

    const totalSugar = scans.reduce(
      (sum, item) => sum + Number(item.sugar || 0),
      0,
    );

    return { date, totalScans: scans.length, totalSugar, scans };
  }

  // ======================================================
  // WEEKLY STATS
  // ======================================================

  async getWeeklyStats(userId: string) {
    const scans = await this.prisma.nutritionScan.findMany({
      where: { userId },
      orderBy: { consumedAt: 'asc' },
    });

    const grouped: Record<string, number> = {};
    scans.forEach((scan) => {
      const key = scan.weekKey || 'UNKNOWN';
      grouped[key] = (grouped[key] || 0) + Number(scan.sugar || 0);
    });

    return grouped;
  }

  // ======================================================
  // MONTHLY STATS
  // ======================================================

  async getMonthlyStats(userId: string) {
    const scans = await this.prisma.nutritionScan.findMany({ where: { userId } });

    const grouped: Record<string, number> = {};
    scans.forEach((scan) => {
      const key = scan.monthKey || 'UNKNOWN';
      grouped[key] = (grouped[key] || 0) + Number(scan.sugar || 0);
    });

    return grouped;
  }

  // ======================================================
  // YEARLY STATS
  // ======================================================

  async getYearlyStats(userId: string) {
    const scans = await this.prisma.nutritionScan.findMany({ where: { userId } });

    const grouped: Record<string, number> = {};
    scans.forEach((scan) => {
      const key = scan.yearKey || 'UNKNOWN';
      grouped[key] = (grouped[key] || 0) + Number(scan.sugar || 0);
    });

    return grouped;
  }

  // ======================================================
  // POLA KONSUMSI
  // ======================================================

  async getConsumptionPattern(userId: string) {
    const scans = await this.prisma.nutritionScan.findMany({ where: { userId } });

    const stats = { MORNING: 0, AFTERNOON: 0, EVENING: 0, NIGHT: 0 };

    scans.forEach((scan) => {
      const period = scan.consumptionPeriod as keyof typeof stats;
      if (period && period in stats) stats[period]++;
    });

    return stats;
  }

  // ======================================================
  // HISTORY
  // ======================================================

  async getHistory(userId: string, date?: string) {
    const targetDate = date || new Date().toLocaleDateString('en-CA');
    console.log('USER:', userId, '| DATE:', targetDate);

    const finalData = await this.prisma.nutritionScan.findMany({
      where: { userId, dayKey: targetDate },
    });

    console.log('HISTORY COUNT:', finalData.length);

    return finalData;
  }

  // ======================================================
  // DAILY SUMMARY
  // ======================================================

  async getDailySummary(userId: string) {
    const scans = await this.prisma.nutritionScan.findMany({ where: { userId } });

    const totalSugar = scans.reduce(
      (sum, item) => sum + Number(item.sugar || 0),
      0,
    );

    return { totalScans: scans.length, totalSugar };
  }
}