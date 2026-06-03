import {
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';

@ApiTags('Subscription')
@ApiBearerAuth()
@Controller('subscription')
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  // ======================================================
  // ACTIVATE PREMIUM
  // ======================================================
  @UseGuards(JwtAuthGuard)
  @Post('activate')
  @ApiOperation({ summary: 'Aktifkan langganan premium (monthly atau yearly)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        plan: { type: 'string', enum: ['monthly', 'yearly'], example: 'monthly' },
      },
      required: ['plan'],
    },
  })
  @ApiResponse({ status: 201, description: 'Premium berhasil diaktifkan' })
  @ApiResponse({ status: 400, description: 'Plan tidak valid atau user sudah premium' })
  async activate(@Req() req, @Body('plan') plan: 'monthly' | 'yearly') {
    return this.subscriptionService.activatePremium(req.user.id, plan);
  }

  // ======================================================
  // GET STATUS
  // ======================================================
  @UseGuards(JwtAuthGuard)
  @Get('status')
  @ApiOperation({ summary: 'Cek status langganan premium user' })
  @ApiResponse({ status: 200, description: 'Mengembalikan status subscription' })
  async status(@Req() req) {
    return this.subscriptionService.getStatus(req.user.id);
  }

  // ======================================================
  // CANCEL PREMIUM
  // ======================================================
  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  @ApiOperation({ summary: 'Batalkan langganan premium' })
  @ApiResponse({ status: 200, description: 'Premium berhasil dibatalkan' })
  async cancel(@Req() req) {
    return this.subscriptionService.cancelPremium(req.user.id);
  }
}