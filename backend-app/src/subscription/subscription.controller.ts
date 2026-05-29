import {
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

import { SubscriptionService } from './subscription.service';

@Controller('subscription')
export class SubscriptionController {

  constructor(
    private subscriptionService: SubscriptionService,
  ) {}

  // ======================================================
  // ACTIVATE PREMIUM
  // ======================================================

  @UseGuards(JwtAuthGuard)
  @Post('activate')
  async activate(
    @Req() req,
  ) {

    return this.subscriptionService.activatePremium(
      req.user.id,
    );
  }

  // ======================================================
  // GET STATUS
  // ======================================================

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status(
    @Req() req,
  ) {

    return this.subscriptionService.getStatus(
      req.user.id,
    );
  }
}