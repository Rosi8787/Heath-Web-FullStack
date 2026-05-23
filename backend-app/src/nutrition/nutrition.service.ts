import { Injectable, BadRequestException } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import axios from 'axios';
import FormData from 'form-data';

@Injectable()
export class NutritionService {
  getDailySummary(userId: any) {
    throw new Error('Method not implemented.');
  }
  getHistory(userId: any) {
    throw new Error('Method not implemented.');
  }
  constructor(private prisma: PrismaService) {}

  async scanNutrition(
    userId: string,
    productName: string,
    file: Express.Multer.File,
  ) {
    // OCR
    const formData = new FormData();

    formData.append('file', file.buffer, file.originalname);

    const ocrResponse = await axios.post(
      'http://127.0.0.1:8000/ocr',
      formData,
      {
        headers: formData.getHeaders?.() || {},
      },
    );

    const extractedText = ocrResponse.data.text || '';

    // cari gula
    const sugarMatch = extractedText.match(/gula\s*(\d+)\s*g/i);

    const sugar = sugarMatch ? parseInt(sugarMatch[1]) : 0;

    // status gula
    let sugarStatus = 'Low Sugar';

    if (sugar >= 20) {
      sugarStatus = 'High Sugar';
    } else if (sugar >= 10) {
      sugarStatus = 'Medium Sugar';
    }

    // simpan db
    const nutrition = await this.prisma.nutritionScan.create({
      data: {
        userId,
        productName,
        sugar,
        sugarStatus,
        aiSummary: `This product contains ${sugar}g sugar and is classified as ${sugarStatus}.`,
      },
    });

    return {
      message: 'Nutrition scanned successfully',

      data: nutrition,

      // extractedText, || kalo mau kasi tau hasil OCRnya juga
    };
  }
}
