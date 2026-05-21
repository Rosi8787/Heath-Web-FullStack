// src/nutrition/nutrition.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class NutritionService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async scanNutrition(userId: string, file: Express.Multer.File) {
    // OCR ANALYZE
    const aiResult = await this.aiService.analyzeNutritionImage(file);

    // SAVE DATABASE
    const nutrition = await this.prisma.nutritionScan.create({
      data: {
        userId,

        imageUrl: null,

        productName: aiResult.productName,

        sugar: aiResult.sugar,

        sugarStatus: aiResult.sugarStatus,

        aiSummary: aiResult.aiSummary,
      },
    });

    return {
      message: 'Nutrition scanned successfully',

      data: nutrition,

      extractedText: aiResult.extractedText,
    };
  }

  async getHistory(userId: string) {
    return this.prisma.nutritionScan.findMany({
      where: {
        userId,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getDailySummary(userId: string) {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const scans = await this.prisma.nutritionScan.findMany({
      where: {
        userId,

        createdAt: {
          gte: today,
        },
      },
    });

    const totalSugar = scans.reduce((acc, item) => acc + (item.sugar || 0), 0);

    return {
      totalScans: scans.length,

      totalSugar,

      scans,
    };
  }
}
  