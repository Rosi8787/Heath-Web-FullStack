import { Module } from "@nestjs/common";

import { NutritionController } from "./nutrition.controller";
import { NutritionService } from "./nutrition.service";

import { PrismaModule } from "src/prisma/prisma.module";

import { AiModule } from "src/ai/ai.module";

@Module({

  imports: [
    PrismaModule,
    AiModule,
  ],

  controllers: [
    NutritionController,
  ],

  providers: [
    NutritionService,
  ],
})
export class NutritionModule {}