import { Controller, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AiService } from "./ai.service";

@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("analyze")
  @UseInterceptors(FileInterceptor("image"))
  async analyze(
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.aiService.analyzeNutritionImage(file);
  }
}