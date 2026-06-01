import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // =========================================
  // REGISTER
  // =========================================

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (existingUser) {
      throw new BadRequestException('Email already used');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
      },
    });

    return {
      success: true,
      message: 'Register success',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  // =========================================
  // LOGIN
  // =========================================

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Wrong password');
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      success: true,

      message: 'Login success',

      access_token: accessToken,

      // user: {
      //   id: user.id,
      //   name: user.name,
      //   email: user.email,
      //   role: user.role,
      //   profileImage: user.profileImage
      // },

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
      },
    };
  }

  // =========================================
  // RESET PASSWORD
  // =========================================

  async resetPassword(dto: ResetPasswordDto) {
  if (dto.newPassword !== dto.confirmPassword) {
    throw new BadRequestException(
      'Password confirmation does not match',
    );
  }

  const otpRecord = await this.prisma.otp.findFirst({
    where: {
      email: dto.email,
      code: dto.otp,
      verified: true,
    },
  });

  if (!otpRecord) {
    throw new UnauthorizedException('Invalid OTP');
  }

  const hashedPassword = await bcrypt.hash(
    dto.newPassword,
    10,
  );

  await this.prisma.user.update({
    where: {
      email: dto.email,
    },
    data: {
      password: hashedPassword,
    },
  });

  await this.prisma.otp.delete({
    where: {
      id: otpRecord.id,
    },
  });

  return {
    success: true,
    message: 'Password reset successfully',
  };
}
}
