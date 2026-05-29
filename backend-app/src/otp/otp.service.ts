import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import { MailService } from 'src/mail/mail.service';

import { JwtService } from '@nestjs/jwt';

@Injectable()
export class OtpService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private jwtService: JwtService,
  ) {}

  // =========================================
  // SEND OTP
  // =========================================

  async sendOtp(email: string) {
    // =========================================
    // CHECK USER
    // =========================================

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new BadRequestException('Email not found');
    }

    // =========================================
    // GENERATE OTP
    // =========================================

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // =========================================
    // EXPIRE 5 MINUTES
    // =========================================

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // =========================================
    // DELETE OLD OTP
    // =========================================

    await this.prisma.oTPVerification.deleteMany({
      where: {
        email,
      },
    });

    // =========================================
    // SAVE OTP
    // =========================================

    await this.prisma.oTPVerification.create({
      data: {
        email,
        otp,
        expiresAt,
      },
    });

    // =========================================
    // SEND EMAIL
    // =========================================

    await this.mailService.sendOtp(email, otp);

    return {
      success: true,

      message: 'OTP sent successfully',
    };
  }

  // =========================================
  // VERIFY OTP + LOGIN
  // =========================================

  async verifyOtp(email: string, code: string) {
    // =========================================
    // FIND OTP
    // =========================================

    const otpData = await this.prisma.oTPVerification.findFirst({
      where: {
        email,
        otp: code,
        verified: false,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    // =========================================
    // INVALID OTP
    // =========================================

    if (!otpData) {
      throw new BadRequestException('Invalid OTP');
    }

    // =========================================
    // EXPIRED OTP
    // =========================================

    if (otpData.expiresAt < new Date()) {
      throw new BadRequestException('OTP expired');
    }

    // =========================================
    // UPDATE VERIFIED
    // =========================================

    await this.prisma.oTPVerification.update({
      where: {
        id: otpData.id,
      },

      data: {
        verified: true,
      },
    });

    // =========================================
    // UPDATE USER VERIFIED
    // =========================================

    const user = await this.prisma.user.update({
      where: {
        email,
      },

      data: {
        isVerified: true,
      },
    });

    // =========================================
    // GENERATE JWT
    // =========================================

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // =========================================
    // RETURN
    // =========================================

    const resetToken = this.jwtService.sign(
      {
        email,
        type: 'RESET_PASSWORD',
      },
      {
        expiresIn: '10m',
      },
    );

    return {
      success: true,

      message: 'OTP verified successfully',

      access_token: accessToken,

      reset_token: resetToken,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    };
  }
}
