import {
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  // ======================================================
  // ACTIVATE PREMIUM
  // ======================================================
  @UseGuards(JwtAuthGuard)
  @Post('activate')
  async activate(
    @Req() req,
    @Body('plan') plan: 'monthly' | 'yearly',
  ) {
    return this.subscriptionService.activatePremium(req.user.id, plan);
  }

  // ======================================================
  // GET STATUS
  // ======================================================
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status(@Req() req) {
    return this.subscriptionService.getStatus(req.user.id);
  }

  // ======================================================
  // CANCEL PREMIUM
  // ======================================================
  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  async cancel(@Req() req) {
    return this.subscriptionService.cancelPremium(req.user.id);
  }
}