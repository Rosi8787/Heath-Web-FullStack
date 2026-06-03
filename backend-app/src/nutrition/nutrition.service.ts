import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import FormData from 'form-data';
import { ScanNutritionDto } from './dto/scan-nutrition.dto';
import moment from 'moment-timezone';

// ======================================================
// HELPER FUNCTIONS
// ======================================================

function getJakartaMoment(date?: Date | string) {
  if (date) {
    return moment(date).tz('Asia/Jakarta');
  }
  return moment().tz('Asia/Jakarta');
}

function getJakartaDateKey(): string {
  return getJakartaMoment().format('YYYY-MM-DD');
}

function getJakartaHour(): number {
  return getJakartaMoment().hour();
}

// function getJakartaWeekKey(): string {
//   const jakarta = getJakartaMoment();
//   return `${jakarta.year()}-W${jakarta.week()}`;
// }

// Ganti fungsi ini
function getJakartaWeekKey(): string {
  const now = getJakartaMoment();
  const startOfMonth = now.clone().startOf('month');
  const dayOfMonth = now.date();
  const startDayOfWeek = startOfMonth.day(); // 0 Minggu, 1 Senin, ...
  let weekNumber = Math.ceil((dayOfMonth + startDayOfWeek) / 7);
  weekNumber = Math.max(1, weekNumber);
  return `W${weekNumber}`;
}

function getJakartaMonthKey(): string {
  return getJakartaMoment().format('YYYY-MM');
}

function getJakartaYearKey(): string {
  return getJakartaMoment().format('YYYY');
}

function getConsumptionPeriod(hour: number) {
  if (hour >= 5 && hour < 11) return 'MORNING';
  if (hour >= 11 && hour < 15) return 'AFTERNOON';
  if (hour >= 15 && hour < 19) return 'EVENING';
  return 'NIGHT';
}

function formatToWIB(date: Date): string {
  return moment(date).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
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
  // EXTRACT SUGAR FROM RAW TEXT
  // ======================================================
  private extractSugarFromText(text: string): number {
    if (!text) return 0;

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

    const parseGrams = (str: string): number | null => {
      if (!str) return null;
      const gramMatch = str.match(
        /(\d+(?:[.,]\d+)?)\s*(?:gram|gr|g)(?![a-z])/i,
      );
      if (gramMatch) {
        const val = parseFloat(gramMatch[1].replace(',', '.'));
        if (!isNaN(val)) return val;
      }
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

    // PASS 1: label gula langsung
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!matchesSugar(line)) continue;
      if (matchesCarb(line)) continue;

      console.log('🍬 SUGAR LINE:', line);

      const inline = parseGrams(line);
      if (inline !== null) {
        console.log('✅ INLINE SUGAR:', inline);
        return inline;
      }

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

    // PASS 2: fallback karbohidrat
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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new BadRequestException(
        'User tidak ditemukan. Silakan login kembali.',
      );
    }

    const todayKey = getJakartaDateKey();
    const totalToday = await this.prisma.nutritionScan.count({
      where: { userId, dayKey: todayKey },
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

    // MANUAL INPUT
    if (manualSugar !== null) {
      const sugarStatus = getSugarStatus(manualSugar);
      const gradeData = getSugarGrade(manualSugar);
      const nowJakarta = getJakartaMoment();
      const nutrition = await this.prisma.nutritionScan.create({
        data: {
          userId,
          productName,
          sugar: manualSugar,
          sugarStatus,
          sugarGrade: gradeData.grade,
          aiSummary: `This product contains ${manualSugar}g sugar and is classified as ${sugarStatus}.`,
          consumedAt: new Date(),
          consumptionPeriod: getConsumptionPeriod(nowJakarta.hour()),
          dayKey: nowJakarta.format('YYYY-MM-DD'),
          weekKey: getJakartaWeekKey(),
          monthKey: getJakartaMonthKey(),
          yearKey: getJakartaYearKey(),
        },
      });

      return {
        success: true,
        message: 'Manual nutrition input success',
        data: {
          ...nutrition,
          consumedAt: formatToWIB(nutrition.consumedAt),
        },
      };
    }

    // OCR
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

      const nowJakarta = getJakartaMoment();
      const hour = nowJakarta.hour();
      const dayKey = nowJakarta.format('YYYY-MM-DD');
      const monthKey = nowJakarta.format('YYYY-MM');
      const yearKey = nowJakarta.format('YYYY');
      const weekKey = getJakartaWeekKey();
      const consumptionPeriod = getConsumptionPeriod(hour);

      const nutrition = await this.prisma.nutritionScan.create({
        data: {
          userId,
          productName,
          sugar,
          sugarStatus,
          sugarGrade: gradeData.grade,
          consumedAt: new Date(),
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
        data: {
          ...nutrition,
          consumedAt: formatToWIB(nutrition.consumedAt),
        },
        extractedText,
      };
    } catch (processingError: any) {
      console.error('❌ PROCESSING ERROR:', processingError);
      if (
        processingError instanceof Prisma.PrismaClientKnownRequestError &&
        processingError.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Gagal menyimpan data: User tidak valid atau tidak ditemukan.',
        );
      }
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
      consumedAt: formatToWIB(lastScan.consumedAt),
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
    const targetDate = date || getJakartaDateKey();
    console.log('USER:', userId, '| DATE:', targetDate);
    const finalData = await this.prisma.nutritionScan.findMany({
      where: { userId, dayKey: targetDate },
    });
    console.log('HISTORY COUNT:', finalData.length);
    const dataWithLocalTime = finalData.map((item) => ({
      ...item,
      consumedAt: formatToWIB(item.consumedAt),
    }));
    return dataWithLocalTime;
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

  // ======================================================
  // MANUAL INPUT
  // ======================================================
  async addManualNutrition(userId: string, dto: ScanNutritionDto) {
    if (!dto.productName || dto.sugar === undefined || dto.sugar === null) {
      throw new BadRequestException('productName and sugar are required');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const todayKey = getJakartaDateKey();
    const totalToday = await this.prisma.nutritionScan.count({
      where: { userId, dayKey: todayKey },
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

    const productName = dto.productName.trim();
    const sugar = dto.sugar;
    const sugarStatus = getSugarStatus(sugar);
    const gradeData = getSugarGrade(sugar);
    const nowJakarta = getJakartaMoment();

    const nutrition = await this.prisma.nutritionScan.create({
      data: {
        userId,
        productName,
        sugar,
        sugarStatus,
        sugarGrade: gradeData.grade,
        aiSummary: `Manual entry: This product contains ${sugar}g sugar and is classified as ${sugarStatus}.`,
        consumedAt: new Date(),
        consumptionPeriod: getConsumptionPeriod(nowJakarta.hour()),
        dayKey: nowJakarta.format('YYYY-MM-DD'),
        weekKey: getJakartaWeekKey(),
        monthKey: getJakartaMonthKey(),
        yearKey: getJakartaYearKey(),
      },
    });

    return {
      success: true,
      message: 'Manual nutrition entry saved successfully',
      data: {
        ...nutrition,
        consumedAt: formatToWIB(nutrition.consumedAt),
      },
    };
  }

  // ======================================================
  // CHART DATA FOR FRONTEND
  // ======================================================

  async getDailyChartAll(userId: string) {
    const endDate = getJakartaMoment();
    const startDate = endDate.clone().subtract(29, 'days');

    const scans = await this.prisma.nutritionScan.findMany({
      where: {
        userId,
        dayKey: {
          gte: startDate.format('YYYY-MM-DD'),
          lte: endDate.format('YYYY-MM-DD'),
        },
      },
      orderBy: { dayKey: 'asc' },
    });

    const dailyData: Record<string, number> = {};
    scans.forEach((scan) => {
      if (scan.dayKey) {
        dailyData[scan.dayKey] =
          (dailyData[scan.dayKey] || 0) + Number(scan.sugar);
      }
    });

    const result: { date: string; sugar: number }[] = [];
    let current = startDate.clone();
    while (current <= endDate) {
      const dateKey = current.format('YYYY-MM-DD');
      result.push({
        date: dateKey,
        sugar: dailyData[dateKey] || 0,
      });
      current.add(1, 'day');
    }

    return {
      view: 'daily',
      mode: 'all',
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
      data: result,
    };
  }

  async getDailyChartWeek(userId: string, year: number, week: number) {
    const startOfWeek = moment()
      .tz('Asia/Jakarta')
      .year(year)
      .week(week)
      .startOf('week');
    const endOfWeek = startOfWeek.clone().endOf('week');

    const scans = await this.prisma.nutritionScan.findMany({
      where: {
        userId,
        dayKey: {
          gte: startOfWeek.format('YYYY-MM-DD'),
          lte: endOfWeek.format('YYYY-MM-DD'),
        },
      },
      orderBy: { dayKey: 'asc' },
    });

    const dailyData: Record<string, number> = {};
    scans.forEach((scan) => {
      if (scan.dayKey) {
        dailyData[scan.dayKey] =
          (dailyData[scan.dayKey] || 0) + Number(scan.sugar);
      }
    });

    const result: { date: string; sugar: number }[] = [];
    let current = startOfWeek.clone();
    while (current <= endOfWeek) {
      const dateKey = current.format('YYYY-MM-DD');
      result.push({
        date: dateKey,
        sugar: dailyData[dateKey] || 0,
      });
      current.add(1, 'day');
    }

    return {
      view: 'daily',
      mode: 'week',
      year,
      week,
      startDate: startOfWeek.format('YYYY-MM-DD'),
      endDate: endOfWeek.format('YYYY-MM-DD'),
      data: result,
    };
  }

  async getWeeklyChartAll(userId: string) {
    const currentYear = getJakartaMoment().year();
    const startOfYear = moment()
      .tz('Asia/Jakarta')
      .year(currentYear)
      .startOf('year');
    const endOfYear = moment()
      .tz('Asia/Jakarta')
      .year(currentYear)
      .endOf('year');

    const scans = await this.prisma.nutritionScan.findMany({
      where: {
        userId,
        consumedAt: {
          gte: startOfYear.toDate(),
          lte: endOfYear.toDate(),
        },
      },
    });

    const weeklyData: Record<string, number> = {};
    scans.forEach((scan) => {
      if (scan.weekKey) {
        weeklyData[scan.weekKey] =
          (weeklyData[scan.weekKey] || 0) + Number(scan.sugar);
      }
    });

    const sortedWeeks = Object.keys(weeklyData).sort();
    const data = sortedWeeks.map((weekKey) => ({
      week: weekKey,
      sugar: weeklyData[weekKey],
    }));

    return {
      view: 'weekly',
      mode: 'all',
      year: currentYear,
      data,
    };
  }

  async getWeeklyChartMonth(userId: string, year: number, month: number) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    // Ambil semua scan dalam bulan tersebut, urutkan berdasarkan tanggal
    const scans = await this.prisma.nutritionScan.findMany({
      where: { userId, monthKey },
      orderBy: { consumedAt: 'asc' },
    });

    if (scans.length === 0) {
      return {
        view: 'weekly',
        mode: 'month',
        year,
        month,
        data: [],
      };
    }

    // Kelompokkan berdasarkan minggu (relatif terhadap bulan)
    // Kita akan assign nomor minggu 1,2,3,... berdasarkan urutan minggu yang muncul
    const weekMap = new Map<string, number>(); // key: 'YYYY-Www' -> nomor urut
    const weeklySugar: {
      weekNumber: number;
      sugar: number;
      weekKeys: string[];
    }[] = [];

    let currentWeekNumber = 0;
    let lastWeekKey = '';

    scans.forEach((scan) => {
      const weekKey = scan.weekKey; // asli, misal '2026-W23'
      if (!weekKey) return;

      if (weekKey !== lastWeekKey) {
        // Minggu baru
        currentWeekNumber++;
        lastWeekKey = weekKey;
        weekMap.set(weekKey, currentWeekNumber);
        weeklySugar.push({
          weekNumber: currentWeekNumber,
          sugar: Number(scan.sugar),
          weekKeys: [weekKey],
        });
      } else {
        // Minggu yang sama, tambahkan sugar
        const existing = weeklySugar.find(
          (w) => w.weekNumber === currentWeekNumber,
        );
        if (existing) {
          existing.sugar += Number(scan.sugar);
          existing.weekKeys.push(weekKey);
        }
      }
    });

    // Format output sesuai permintaan: { week: "W1", sugar: ... }
    const data = weeklySugar.map((item) => ({
      week: `W${item.weekNumber}`,
      sugar: item.sugar,
    }));

    return {
      view: 'weekly',
      mode: 'month',
      year,
      month,
      data,
    };
  }

  async getMonthlyChartAll(userId: string) {
    const currentYear = getJakartaMoment().year();
    const scans = await this.prisma.nutritionScan.findMany({
      where: {
        userId,
        yearKey: String(currentYear),
      },
    });

    const monthlyData: Record<string, number> = {};
    scans.forEach((scan) => {
      if (scan.monthKey) {
        monthlyData[scan.monthKey] =
          (monthlyData[scan.monthKey] || 0) + Number(scan.sugar);
      }
    });

    const months: { month: string; sugar: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${currentYear}-${String(m).padStart(2, '0')}`;
      months.push({
        month: monthKey,
        sugar: monthlyData[monthKey] || 0,
      });
    }

    return {
      view: 'monthly',
      mode: 'all',
      year: currentYear,
      data: months,
    };
  }

  async getMonthlyChartMonth(userId: string, year: number, month: number) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const scans = await this.prisma.nutritionScan.findMany({
      where: {
        userId,
        monthKey,
      },
    });

    const weeklyData: Record<string, number> = {};
    scans.forEach((scan) => {
      if (scan.weekKey) {
        weeklyData[scan.weekKey] =
          (weeklyData[scan.weekKey] || 0) + Number(scan.sugar);
      }
    });

    const sortedWeeks = Object.keys(weeklyData).sort();
    const data = sortedWeeks.map((weekKey) => ({
      week: weekKey,
      sugar: weeklyData[weekKey],
    }));

    return {
      view: 'monthly',
      mode: 'month',
      year,
      month,
      data,
    };
  }

  async getYearlyChartAll(userId: string) {
    const scans = await this.prisma.nutritionScan.findMany({
      where: { userId },
    });

    const yearlyData: Record<string, number> = {};
    scans.forEach((scan) => {
      if (scan.yearKey) {
        yearlyData[scan.yearKey] =
          (yearlyData[scan.yearKey] || 0) + Number(scan.sugar);
      }
    });

    const sortedYears = Object.keys(yearlyData).sort();
    const data = sortedYears.map((year) => ({
      year,
      sugar: yearlyData[year],
    }));

    return {
      view: 'yearly',
      mode: 'all',
      data,
    };
  }
}
