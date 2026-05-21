import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Req,
  Get,
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { FileInterceptor } from "@nestjs/platform-express";

import { memoryStorage } from "multer";

import { NutritionService } from "./nutrition.service";

@Controller("nutrition")
export class NutritionController {

  constructor(
    private nutritionService: NutritionService,
  ) {}

  @Post("scan")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("image", {
      storage: memoryStorage(),
    }),
  )

  async scanNutrition(
    @UploadedFile()
    file: Express.Multer.File,

    @Req() req: any,
  ) {

    const userId =
      req.user?.id || "test-user";

    return this.nutritionService.scanNutrition(
      userId,
      file,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("history")
  async getHistory(
    @Req() req: any,
  ) {

    const userId =
      req.user?.id || "test-user";

    return this.nutritionService.getHistory(
      userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("daily")
  async getDailyStats(
    @Req() req: any,
  ) {

    const userId =
      req.user?.id || "test-user";

    return this.nutritionService.getDailySummary(
      userId,
    );
  }
}