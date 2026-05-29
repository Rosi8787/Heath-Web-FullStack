import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

import { SummarizeService } from './summarize.service';

@Controller('summarize')
export class SummarizeController {

  constructor(
    private summarizeService: SummarizeService,
  ) {}

  // ======================================================
  // AI SUMMARY
  // ======================================================

  @UseGuards(JwtAuthGuard)
  @Get()
  async summarize(
    @Req() req,
  ) {

    return this.summarizeService.generateSummary(
      req.user.id,
    );
  }
}