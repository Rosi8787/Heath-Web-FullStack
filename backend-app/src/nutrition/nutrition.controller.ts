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

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { FileInterceptor } from '@nestjs/platform-express';

import { memoryStorage } from 'multer';

import { NutritionService } from './nutrition.service';
import { ScanNutritionDto } from './dto/scan-nutrition.dto';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/helper/basic-auth';

@Controller('nutrition')
export class NutritionController {
  constructor(private nutritionService: NutritionService) {}

  @Post('scan')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
    }),
  )
  async scanNutrition(
    @UploadedFile()
    file: Express.Multer.File,

    @Body()
    dto: any,

    @Req() req: any,
  ) {
    console.log(req.headers['content-type']);
    console.log('FILE =', file);
    console.log('MASUK CONTROLLER');

    const userId = req.user.id;
    console.log(req.user);
    console.log('USER ID:', req.user.id);

    return this.nutritionService.scanNutrition(userId, dto, file);
  }

  @Post('manual')
  @UseGuards(AuthGuard('jwt')) // 🔐 Wajib pakai guard
  async manualInput(@Req() req, @Body() dto: ScanNutritionDto) {
    // req.user akan terisi oleh JwtStrategy.validate()
    const userId = req.user.id; // karena payload pakai id
    return this.nutritionService.addManualNutrition(userId, dto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(
    @Req() req: any,

    @Query('date')
    date?: string,
  ) {
    const userId = req.user.id;

    return this.nutritionService.getHistory(userId, date);
  }

  // @UseGuards(JwtAuthGuard)
  // @Get('daily')
  // async getDailyStats(@Req() req: any) {
  //   const userId = req.user?.id || 'test-user';

  //   return this.nutritionService.getDailySummary(userId);
  // }

  // ======================================================
  // CALL STATS
  // ======================================================

  @Get('last-consumption')
  @UseGuards(JwtAuthGuard)
  async getLastConsumption(@Req() req: any) {
    return this.nutritionService.getLastConsumption(req.user.id);
  }

  @Get('daily/:date')
  @UseGuards(JwtAuthGuard)
  async getDailyStats(@Req() req: any, @Param('date') date: string) {
    return this.nutritionService.getDailyStats(req.user.id, date);
  }

  @Get('weekly')
  @UseGuards(JwtAuthGuard)
  async getWeeklyStats(@Req() req: any) {
    return this.nutritionService.getWeeklyStats(req.user.id);
  }

  @Get('monthly')
  @UseGuards(JwtAuthGuard)
  async getMonthlyStats(@Req() req: any) {
    return this.nutritionService.getMonthlyStats(req.user.id);
  }

  @Get('yearly')
  @UseGuards(JwtAuthGuard)
  async getYearlyStats(@Req() req: any) {
    return this.nutritionService.getYearlyStats(req.user.id);
  }

  @Get('pattern')
  @UseGuards(JwtAuthGuard)
  async getPattern(@Req() req: any) {
    return this.nutritionService.getConsumptionPattern(req.user.id);
  }

  // ======================================================
  // CHART ENDPOINTS (Daily, Weekly, Monthly, Yearly)
  // ======================================================

  @Get('chart/daily')
  @UseGuards(JwtAuthGuard)
  async getDailyChart(
    @Req() req: any,
    @Query('mode') mode: 'all' | 'week',
    @Query('year') year?: string,
    @Query('week') week?: string,
  ) {
    const userId = req.user.id;
    if (mode === 'week') {
      if (!year || !week) {
        throw new BadRequestException(
          'year and week are required for week mode',
        );
      }
      return this.nutritionService.getDailyChartWeek(
        userId,
        parseInt(year),
        parseInt(week),
      );
    }
    // default mode = all
    return this.nutritionService.getDailyChartAll(userId);
  }

@Get('chart/weekly')
@UseGuards(JwtAuthGuard)
async getWeeklyChart(
  @Req() req: any,
  @Query('mode') mode: 'all' | 'month' = 'all',
  @Query('year') year?: string,
  @Query('month') month?: string,
) {
  const userId = req.user.id;
  if (mode === 'month') {
    if (!year || !month) {
      throw new BadRequestException('year and month are required for month mode');
    }
    return this.nutritionService.getWeeklyChartMonth(
      userId,
      parseInt(year),
      parseInt(month),
    );
  }
  // default mode = all
  return this.nutritionService.getWeeklyChartAll(userId);
}

  @Get('chart/monthly')
  @UseGuards(JwtAuthGuard)
  async getMonthlyChart(
    @Req() req: any,
    @Query('mode') mode: 'all' | 'month',
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const userId = req.user.id;
    if (mode === 'month') {
      if (!year || !month) {
        throw new BadRequestException(
          'year and month are required for month mode',
        );
      }
      return this.nutritionService.getMonthlyChartMonth(
        userId,
        parseInt(year),
        parseInt(month),
      );
    }
    return this.nutritionService.getMonthlyChartAll(userId);
  }

  @Get('chart/yearly')
  @UseGuards(JwtAuthGuard)
  async getYearlyChart(@Req() req: any, @Query('mode') mode: 'all' = 'all') {
    const userId = req.user.id;
    return this.nutritionService.getYearlyChartAll(userId);
  }
}
