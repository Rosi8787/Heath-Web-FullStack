import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import axios from 'axios';
import FormData from 'form-data';

// ======================================================
// HELPER FUNCTIONS (tetap sebagai pure function)
// ======================================================

function getConsumptionPeriod(hour: number) {
  if (hour >= 5 && hour < 11) return 'MORNING';
  if (hour >= 11 && hour < 15) return 'AFTERNOON';
  if (hour >= 15 && hour < 19) return 'EVENING';
  return 'NIGHT';
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
      description:
        'Minuman dengan kandungan gula sangat rendah (<1g per sajian).',
    };
  if (sugar < 5)
    return {
      grade: 'B',
      description: 'Minuman rendah gula dan masih direkomendasikan.',
    };
  if (sugar <= 10)
    return {
      grade: 'C',
      description:
        'Minuman dengan kandungan gula cukup tinggi dan sebaiknya dibatasi.',
    };
  return {
    grade: 'D',
    description: 'Minuman dengan kandungan gula sangat tinggi.',
  };
}

// ======================================================
// NUTRITION SERVICE
// ======================================================

@Injectable()
export class NutritionService {
  constructor(private prisma: PrismaService) {}

  // ======================================================
  // EXTRACT SUGAR FROM RAW TEXT (Pintar & Robust)
  // ======================================================
  private extractSugarFromText(text: string): number {
    if (!text) return 0;

    const SUGAR_LABELS = [
      'total sugars', 'added sugars', 'gula total', 'gula tambahan',
      'sugars', 'sugar', 'gula', 'sug',
    ];
    const CARB_LABELS = [
      'total carbohydrate', 'total carb', 'karbohidrat total',
      'carbohydrate', 'karbohidrat', 'carb',
    ];

    const parseGrams = (str: string): number | null => {
      if (!str) return null;
      // 1) Angka + satuan gram (g, gram, gr)
      const gramMatch = str.match(/(\d+(?:[.,]\d+)?)\s*(?:gram|gr|g)(?![a-z])/i);
      if (gramMatch) {
        const val = parseFloat(gramMatch[1].replace(',', '.'));
        if (!isNaN(val)) return val;
      }
      // 2) Angka + mg → konversi ke gram
      const mgMatch = str.match(/(\d+(?:[.,]\d+)?)\s*mg(?![a-z])/i);
      if (mgMatch) {
        const val = parseFloat(mgMatch[1].replace(',', '.'));
        if (!isNaN(val)) return Math.round((val / 1000) * 100) / 100;
      }
      return null;
    };

    const matchesSugar = (str: string) =>
      SUGAR_LABELS.some((label) => str.toLowerCase().includes(label));
    const matchesCarb = (str: string) =>
      CARB_LABELS.some((label) => str.toLowerCase().includes(label));

    const lines = text.split('\n');

    // ---- PASS 1: cari baris dengan label gula ----
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!matchesSugar(line)) continue;
      if (matchesCarb(line)) continue;

      console.log('🍬 SUGAR LINE:', line);

      // Coba inline dulu
      const inline = parseGrams(line);
      if (inline !== null) {
        console.log('✅ INLINE SUGAR:', inline);
        return inline;
      }

      // Cari angka di 3 baris berikutnya
      for (let offset = 1; offset <= 3; offset++) {
        const nextLine = lines[i + offset]?.trim();
        if (!nextLine) break;
        const value = parseGrams(nextLine);
        if (value !== null) {
          console.log(`✅ NEXT SUGAR (offset ${offset}):`, value);
          return value;
        }
      }
    }

    // ---- PASS 2: fallback karbohidrat ----
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!matchesCarb(line)) continue;

      console.log('🍞 CARB LINE (fallback):', line);

      const inline = parseGrams(line);
      if (inline !== null) {
        console.log('✅ INLINE CARB (estimated sugar):', inline);
        return inline;
      }
      for (let offset = 1; offset <= 3; offset++) {
        const nextLine = lines[i + offset]?.trim();
        if (!nextLine) break;
        const value = parseGrams(nextLine);
        if (value !== null) {
          console.log(`✅ NEXT CARB (offset ${offset}):`, value);
          return value;
        }
      }
    }

    console.log('❌ No sugar found');
    return 0;
  }

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
      throw new BadRequestException(
        'Free users can only scan 10 times per day',
      );
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
        timeout: 60000,
      });
    } catch (err: any) {
      console.error('OCR REQUEST FAILED:', err.message);
      throw new BadRequestException(
        `OCR service error: ${err.message || 'Unknown error'}`,
      );
    }

    if (ocrResponse.data.error) {
      return {
        success: false,
        needsManualInput: true,
        message: `OCR error: ${ocrResponse.data.error}`,
      };
    }

    const extractedText: string = ocrResponse.data.text || '';

    console.log('=========== OCR TEXT ===========');
    console.log(extractedText);

    // ======================================================
    // PROCESSING (WRAPPED IN TRY-CATCH)
    // ======================================================
    try {
      let sugar = this.extractSugarFromText(extractedText);
      sugar = Math.round(sugar * 10) / 10;

      if (isNaN(sugar) || sugar < 0 || sugar > 200) {
        sugar = 0;
      }

      const sugarDetected = sugar > 0;

      if (!sugarDetected) {
        return {
          success: false,
          needsManualInput: true,
          message: 'Sugar tidak terdeteksi',
          options: ['scan_again', 'manual_input'],
          extractedText,
        };
      }

      const sugarStatus = getSugarStatus(sugar);
      const gradeData = getSugarGrade(sugar);

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
    } catch (processingError: any) {
      console.error('❌ PROCESSING ERROR:', processingError);
      throw new BadRequestException(
        `Gagal memproses hasil scan: ${processingError.message || 'Unknown error'}`,
      );
    }
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
    const scans = await this.prisma.nutritionScan.findMany({
      where: { userId },
    });

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
    const scans = await this.prisma.nutritionScan.findMany({
      where: { userId },
    });

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
    const scans = await this.prisma.nutritionScan.findMany({
      where: { userId },
    });

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
    const scans = await this.prisma.nutritionScan.findMany({
      where: { userId },
    });

    const totalSugar = scans.reduce(
      (sum, item) => sum + Number(item.sugar || 0),
      0,
    );

    return { totalScans: scans.length, totalSugar };
  }
}