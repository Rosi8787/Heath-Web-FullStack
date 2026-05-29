import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { OtpService } from './otp.service';

@Controller('otp')
export class OtpController {

  constructor(
    private otpService: OtpService,
  ) {}

  // =========================================
  // SEND OTP
  // =========================================

  @Post('send')
  async sendOtp(
    @Body('email') email: string,
  ) {

    return this.otpService.sendOtp(
      email,
    );
  }

  // =========================================
  // VERIFY OTP
  // =========================================

  @Post('verify')
  async verifyOtp(
    @Body('email') email: string,

    @Body('code') code: string,
  ) {

    return this.otpService.verifyOtp(
      email,
      code,
    );
  }
}