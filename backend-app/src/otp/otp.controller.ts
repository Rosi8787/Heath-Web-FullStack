import {
  Body,
  Controller,
  Post,
  Get,
} from '@nestjs/common';

import { OtpService } from './otp.service';
import { MailService } from 'src/mail/mail.service';

@Controller('otp')
export class OtpController {
  constructor(
    private otpService: OtpService,
    private mailService: MailService,
  ) {}

  @Get('mail-test')
  async mailTest() {
    await this.mailService.sendOtp(
      'emailkamu@gmail.com',
      '123456',
    );

    return 'ok';
  }

  @Post('send')
  async sendOtp(
    @Body('email') email: string,
  ) {
    return this.otpService.sendOtp(email);
  }

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