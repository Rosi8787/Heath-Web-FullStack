import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Req,
  Get,
  UseGuards,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { NutritionService } from './nutrition.service';
import { ScanNutritionDto } from './dto/scan-nutrition.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Nutrition')
@ApiBearerAuth()
@Controller('nutrition')
export class NutritionController {
  constructor(private nutritionService: NutritionService) {}

  // ==========================================
  // POST /scan
  // ==========================================
  @Post('scan')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Scan gambar produk (OCR) - upload file image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary', description: 'File gambar produk' },
        productName: { type: 'string', example: 'Coca Cola', description: 'Opsional' },
        sugar: { type: 'number', example: 12.5, description: 'Opsional (isi untuk bypass OCR)' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Scan berhasil' })
  async scanNutrition(@UploadedFile() file: Express.Multer.File, @Body() dto: any, @Req() req: any) {
    const userId = req.user.id;
    return this.nutritionService.scanNutrition(userId, dto, file);
  }

  // ==========================================
  // POST /manual
  // ==========================================
  @Post('manual')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Input manual produk dan gula (JSON body)' })
  @ApiBody({ type: ScanNutritionDto })
  @ApiResponse({ status: 200, description: 'Data tersimpan' })
  async manualInput(@Req() req: any, @Body() dto: ScanNutritionDto) {
    const userId = req.user.id;
    return this.nutritionService.addManualNutrition(userId, dto);
  }

  // ==========================================
  // GET /history
  // ==========================================
  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Riwayat scan per tanggal (default hari ini WIB)' })
  @ApiQuery({ name: 'date', required: false, example: '2026-06-03', description: 'Format YYYY-MM-DD' })
  async getHistory(@Req() req: any, @Query('date') date?: string) {
    return this.nutritionService.getHistory(req.user.id, date);
  }

  // ==========================================
  // GET /last-consumption
  // ==========================================
  @Get('last-consumption')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Data konsumsi terakhir user' })
  async getLastConsumption(@Req() req: any) {
    return this.nutritionService.getLastConsumption(req.user.id);
  }

  // ==========================================
  // GET /daily/:date
  // ==========================================
  @Get('daily/:date')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Statistik harian berdasarkan tanggal' })
  @ApiParam({ name: 'date', example: '2026-06-03', description: 'Format YYYY-MM-DD' })
  async getDailyStats(@Req() req: any, @Param('date') date: string) {
    return this.nutritionService.getDailyStats(req.user.id, date);
  }

  // ==========================================
  // GET /weekly
  // ==========================================
  @Get('weekly')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Statistik mingguan (agregasi global)' })
  async getWeeklyStats(@Req() req: any) {
    return this.nutritionService.getWeeklyStats(req.user.id);
  }

  // ==========================================
  // GET /monthly
  // ==========================================
  @Get('monthly')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Statistik bulanan (agregasi global)' })
  async getMonthlyStats(@Req() req: any) {
    return this.nutritionService.getMonthlyStats(req.user.id);
  }

  // ==========================================
  // GET /yearly
  // ==========================================
  @Get('yearly')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Statistik tahunan (agregasi global)' })
  async getYearlyStats(@Req() req: any) {
    return this.nutritionService.getYearlyStats(req.user.id);
  }

  // ==========================================
  // GET /pattern
  // ==========================================
  @Get('pattern')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Pola konsumsi (pagi, siang, sore, malam)' })
  async getPattern(@Req() req: any) {
    return this.nutritionService.getConsumptionPattern(req.user.id);
  }

  // ==========================================
  // GET /chart/daily
  // ==========================================
  @Get('chart/daily')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Daily chart: all (30 hari) atau week (7 hari)' })
  @ApiQuery({ name: 'mode', enum: ['all', 'week'], required: false, default: 'all' })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  @ApiQuery({ name: 'week', required: false, example: 23 })
  async getDailyChart(
    @Req() req: any,
    @Query('mode') mode: 'all' | 'week' = 'all',
    @Query('year') year?: string,
    @Query('week') week?: string,
  ) {
    const userId = req.user.id;
    if (mode === 'week') {
      if (!year || !week) throw new BadRequestException('year and week required');
      return this.nutritionService.getDailyChartWeek(userId, parseInt(year), parseInt(week));
    }
    return this.nutritionService.getDailyChartAll(userId);
  }

  // ==========================================
  // GET /chart/weekly
  // ==========================================
  @Get('chart/weekly')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Weekly chart: all (bulan berjalan) atau month (bulan spesifik)' })
  @ApiQuery({ name: 'mode', enum: ['all', 'month'], required: false, default: 'all' })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  @ApiQuery({ name: 'month', required: false, example: 6 })
  async getWeeklyChart(
    @Req() req: any,
    @Query('mode') mode: 'all' | 'month' = 'all',
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const userId = req.user.id;
    if (mode === 'month') {
      if (!year || !month) throw new BadRequestException('year and month required');
      return this.nutritionService.getWeeklyChartMonth(userId, parseInt(year), parseInt(month));
    }
    return this.nutritionService.getWeeklyChartAll(userId);
  }

  // ==========================================
  // GET /chart/monthly
  // ==========================================
  @Get('chart/monthly')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Monthly chart: all (semua bulan tahun ini) atau month (detail per minggu)' })
  @ApiQuery({ name: 'mode', enum: ['all', 'month'], required: false, default: 'all' })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  @ApiQuery({ name: 'month', required: false, example: 6 })
  async getMonthlyChart(
    @Req() req: any,
    @Query('mode') mode: 'all' | 'month' = 'all',
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const userId = req.user.id;
    if (mode === 'month') {
      if (!year || !month) throw new BadRequestException('year and month required');
      return this.nutritionService.getMonthlyChartMonth(userId, parseInt(year), parseInt(month));
    }
    return this.nutritionService.getMonthlyChartAll(userId);
  }

  // ==========================================
  // GET /chart/yearly
  // ==========================================
  @Get('chart/yearly')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Yearly chart: total gula per tahun' })
  @ApiQuery({ name: 'mode', enum: ['all'], required: false, default: 'all' })
  async getYearlyChart(@Req() req: any, @Query('mode') mode: 'all' = 'all') {
    return this.nutritionService.getYearlyChartAll(req.user.id);
  }
}