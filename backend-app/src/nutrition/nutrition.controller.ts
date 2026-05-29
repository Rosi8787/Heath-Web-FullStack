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
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { FileInterceptor } from '@nestjs/platform-express';

import { memoryStorage } from 'multer';

import { NutritionService } from './nutrition.service';

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
    console.log('MASUK CONTROLLER');

    const userId = req.user.id;
    console.log(req.user);
    console.log('USER ID:', req.user.id);

    return this.nutritionService.scanNutrition(userId, dto, file);
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
}
