import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import axios from 'axios';
import FormData from 'form-data';

function getConsumptionPeriod(hour: number) {
  if (hour >= 5 && hour < 11) {
    return 'MORNING';
  }

  if (hour >= 11 && hour < 15) {
    return 'AFTERNOON';
  }

  if (hour >= 15 && hour < 19) {
    return 'EVENING';
  }

  return 'NIGHT';
}

@Injectable()
export class NutritionService {
  constructor(private prisma: PrismaService) {}

  // ======================================================
  // SCAN NUTRITION
  // ======================================================

  async scanNutrition(userId: string, dto: any, file: Express.Multer.File) {
    console.log('FILE =', file);

    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    // const today = new Date().toISOString().split('T')[0];
    const today = new Date().toLocaleDateString('en-CA');

    const totalToday = await this.prisma.nutritionScan.count({
      where: {
        userId,
        dayKey: today,
      },
    });

    const subscription = await this.prisma.subscription.findUnique({
      where: {
        userId,
      },
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

    // ======================================================
    // DTO
    // ======================================================

    const productName = dto.productName || 'Unknown Product';

    const manualSugar = dto.sugar || null;

    // ======================================================
    // IF USER INPUT MANUAL
    // ======================================================

    if (manualSugar) {
      let sugarStatus = 'Low Sugar';

      let sugarGrade = 'A';

      if (manualSugar >= 20) {
        sugarStatus = 'High Sugar';

        sugarGrade = 'D';
      } else if (manualSugar >= 10) {
        sugarStatus = 'Medium Sugar';

        sugarGrade = 'B';
      }

      const nutrition = await this.prisma.nutritionScan.create({
        data: {
          userId,

          productName,

          sugar: manualSugar,

          sugarStatus,

          sugarGrade,

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

    if (!file) {
      throw new BadRequestException('File not uploaded');
    }

    console.log('FILE =', file);

    const formData = new FormData();

    formData.append('file', file.buffer, file.originalname);

    const ocrResponse = await axios.post(
      `${process.env.OCR_URL}/ocr`,
      formData,
      {
        headers: formData.getHeaders(),
      },
    );

    const extractedText = ocrResponse.data.text || '';

    console.log('=========== OCR RESULT ===========');

    console.log(extractedText);

    // ======================================================
    // SPLIT TEXT
    // ======================================================

    const lines = extractedText
      .split('\n')
      .map((line: string) => line.trim().toLowerCase())
      .filter((line: string) => line.length > 0);

    // ======================================================
    // FIND SUGAR
    // ======================================================

    let sugar = 0;

    let sugarDetected = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      console.log('CHECK LINE:', line);

      // ======================================================
      // DETECT SUGAR LABEL
      // ======================================================

      if (
        line.includes('sugar') ||
        line.includes('sugars') ||
        line.includes('gula')
      ) {
        console.log('SUGAR LABEL FOUND');

        // ======================================================
        // CASE 1
        // NUMBER IN SAME LINE
        // ======================================================

        const sameLineMatch = line.match(/(\d+(\.\d+)?)\s*(g|mg)/i);

        if (sameLineMatch) {
          let value = parseFloat(sameLineMatch[1]);

          const unit = sameLineMatch[3];

          // mg -> g
          if (unit === 'mg') {
            value = value / 1000;
          }

          sugar = value;

          sugarDetected = true;

          console.log('SUGAR FOUND SAME LINE:', sugar);

          break;
        }

        // ======================================================
        // CASE 2
        // NUMBER IN NEXT LINE
        // ======================================================

        const nextLine = lines[i + 1] || '';

        console.log('NEXT LINE:', nextLine);

        const nextMatch = nextLine.match(/(\d+(\.\d+)?)\s*(g|mg)/i);

        if (nextMatch) {
          let value = parseFloat(nextMatch[1]);

          const unit = nextMatch[3];

          // mg -> g
          if (unit === 'mg') {
            value = value / 1000;
          }

          sugar = value;

          sugarDetected = true;

          console.log('SUGAR FOUND NEXT LINE:', sugar);

          break;
        }
      }
    }

    // ======================================================
    // VALIDATION
    // ======================================================

    if (isNaN(sugar) || sugar < 0 || sugar > 100) {
      sugar = 0;
    }

    // ======================================================
    // IF OCR FAILED
    // ======================================================

    if (!sugarDetected) {
      return {
        success: false,

        needsManualInput: true,

        message: 'Sugar tidak terdeteksi',

        options: ['scan_again', 'manual_input'],

        extractedText,
      };
    }

    // ======================================================
    // SUGAR STATUS
    // ======================================================

    let sugarStatus = 'Low Sugar';

    let sugarGrade = 'A';

    if (sugar >= 20) {
      sugarStatus = 'High Sugar';

      sugarGrade = 'D';
    } else if (sugar >= 10) {
      sugarStatus = 'Medium Sugar';

      sugarGrade = 'B';
    }

    // ======================================================
    // SAVE TO DATABASE
    // ======================================================

    console.log({
      sugar,
      sugarStatus,
      sugarGrade,
    });

    const now = new Date();

    const hour = now.getHours();

    // const dayKey = now.toISOString().split('T')[0];
    const dayKey = now.toLocaleDateString('en-CA');

    const monthKey = `${now.getFullYear()}-${String(
      now.getMonth() + 1,
    ).padStart(2, '0')}`;

    const yearKey = `${now.getFullYear()}`;

    const weekKey = `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`;

    const consumptionPeriod = getConsumptionPeriod(hour);

    const nutrition = await this.prisma.nutritionScan.create({
      data: {
        userId,

        productName,

        sugar,

        sugarStatus,

        sugarGrade,

        consumedAt: now,

        consumptionPeriod,

        dayKey,

        weekKey,

        monthKey,

        yearKey,

        aiSummary: `This product contains ${sugar}g sugar and is classified as ${sugarStatus}.`,
      },
    });
    // ======================================================
    // RETURN
    // ======================================================

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
      where: {
        userId,
      },

      orderBy: {
        consumedAt: 'desc',
      },
    });

    if (!lastScan) {
      return {
        message: 'No consumption yet',
      };
    }

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
      where: {
        userId,
        dayKey: date,
      },
    });

    const totalSugar = scans.reduce(
      (sum, item) => sum + Number(item.sugar || 0),
      0,
    );

    return {
      date,

      totalScans: scans.length,

      totalSugar,

      scans,
    };
  }

  // ======================================================
  // WEEKLY STATS
  // ======================================================

  async getWeeklyStats(userId: string) {
    const scans = await this.prisma.nutritionScan.findMany({
      where: {
        userId,
      },

      orderBy: {
        consumedAt: 'asc',
      },
    });

    const grouped = {};

    scans.forEach((scan) => {
      const key = scan.weekKey || 'UNKNOWN';

      if (!grouped[key]) {
        grouped[key] = 0;
      }

      grouped[key] += Number(scan.sugar || 0);
    });

    return grouped;
  }

  // ======================================================
  // MONTHLY STATS
  // ======================================================

  async getMonthlyStats(userId: string) {
    const scans = await this.prisma.nutritionScan.findMany({
      where: {
        userId,
      },
    });

    const grouped = {};

    scans.forEach((scan) => {
      const key = scan.monthKey || 'UNKNOWN';

      if (!grouped[key]) {
        grouped[key] = 0;
      }

      grouped[key] += Number(scan.sugar || 0);
    });

    return grouped;
  }

  // ======================================================
  // YEARLY STATS
  // ======================================================

  async getYearlyStats(userId: string) {
    const scans = await this.prisma.nutritionScan.findMany({
      where: {
        userId,
      },
    });

    const grouped = {};

    scans.forEach((scan) => {
      const key = scan.yearKey || 'UNKNOWN';

      if (!grouped[key]) {
        grouped[key] = 0;
      }

      grouped[key] += Number(scan.sugar || 0);
    });

    return grouped;
  }

  // ======================================================
  // POLA KONSUMSI
  // ======================================================

  async getConsumptionPattern(userId: string) {
    const scans = await this.prisma.nutritionScan.findMany({
      where: {
        userId,
      },
    });

    const stats = {
      MORNING: 0,

      AFTERNOON: 0,

      EVENING: 0,

      NIGHT: 0,
    };

    scans.forEach((scan) => {
      const period = scan.consumptionPeriod;

      if (period) {
        stats[period]++;
      }
    });

    return stats;
  }

  // ======================================================
  // HISTORY
  // ======================================================

  async getHistory(userId: string, date?: string) {
    console.log('LOGIN USER:', userId);

    const targetDate = date || new Date().toLocaleDateString('en-CA');

    console.log('TARGET DATE:', targetDate);

    // TEST 1
    const allByDate = await this.prisma.nutritionScan.findMany({
      where: {
        dayKey: targetDate,
      },
    });

    console.log('ALL BY DATE:', allByDate.length);

    // TEST 2
    const allByUser = await this.prisma.nutritionScan.findMany({
      where: {
        userId,
      },
    });

    console.log('ALL BY USER:', allByUser.length);

    // TEST 3
    const finalData = await this.prisma.nutritionScan.findMany({
      where: {
        userId,
        dayKey: targetDate,
      },
    });

    console.log('FINAL:', finalData.length);

    return finalData;
  }
  // ======================================================
  // DAILY SUMMARY
  // ======================================================

  async getDailySummary(userId: string) {
    const scans = await this.prisma.nutritionScan.findMany({
      where: {
        userId,
      },
    });

    const totalSugar = scans.reduce(
      (sum, item) => sum + Number(item.sugar || 0),

      0,
    );

    return {
      totalScans: scans.length,

      totalSugar,
    };
  }
}
