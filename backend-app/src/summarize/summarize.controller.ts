import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SummarizeService } from './summarize.service';

@ApiTags('Summarize')
@ApiBearerAuth()
@Controller('summarize')
export class SummarizeController {
  constructor(private summarizeService: SummarizeService) {}

  // ======================================================
  // AI SUMMARY
  // ======================================================
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Generate AI summary of user nutrition data' })
  @ApiResponse({ status: 200, description: 'Summary generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async summarize(@Req() req) {
    return this.summarizeService.generateSummary(req.user.id);
  }
}