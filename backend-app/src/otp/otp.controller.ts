import { Body, Controller, Post, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { MailService } from 'src/mail/mail.service';
import * as dns from 'dns';
import * as net from 'net';

@ApiTags('OTP')
@Controller('otp')
export class OtpController {
  constructor(private otpService: OtpService) {}

  @Post('send')
  @ApiOperation({ summary: 'Kirim kode OTP ke email' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com', description: 'Alamat email penerima' },
      },
      required: ['email'],
    },
  })
  @ApiResponse({ status: 201, description: 'OTP berhasil dikirim' })
  @ApiResponse({ status: 400, description: 'Email tidak valid atau gagal mengirim' })
  async sendOtp(@Body('email') email: string) {
    return this.otpService.sendOtp(email);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verifikasi kode OTP' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        code: { type: 'string', example: '123456' },
      },
      required: ['email', 'code'],
    },
  })
  @ApiResponse({ status: 200, description: 'OTP valid' })
  @ApiResponse({ status: 400, description: 'Kode salah atau expired' })
  async verifyOtp(@Body('email') email: string, @Body('code') code: string) {
    return this.otpService.verifyOtp(email, code);
  }
}