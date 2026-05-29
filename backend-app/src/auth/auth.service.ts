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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // =========================================
  // REGISTER
  // =========================================

  async register(
    dto: RegisterDto,
  ) {

    const existingUser =
      await this.prisma.user.findUnique({
        where: {
          email: dto.email,
        },
      });

    if (existingUser) {
      throw new BadRequestException(
        'Email already used',
      );
    }

    const hashedPassword =
      await bcrypt.hash(
        dto.password,
        10,
      );

    const user =
      await this.prisma.user.create({
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

  async login(
    dto: LoginDto,
  ) {

    const user =
      await this.prisma.user.findUnique({
        where: {
          email: dto.email,
        },
      });

    if (!user) {
      throw new UnauthorizedException(
        'User not found',
      );
    }

    const isPasswordValid =
      await bcrypt.compare(
        dto.password,
        user.password,
      );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Wrong password',
      );
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken =
      await this.jwtService.signAsync(
        payload,
      );

    return {
      success: true,

      message: 'Login success',

      access_token: accessToken,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  // =========================================
  // RESET PASSWORD
  // =========================================

  async resetPassword(
    token: string,
    newPassword: string,
  ) {

    // =========================================
    // VALIDATION
    // =========================================

    if (!token) {
      throw new BadRequestException(
        'Reset token required',
      );
    }

    if (!newPassword) {
      throw new BadRequestException(
        'New password required',
      );
    }

    if (newPassword.length < 6) {
      throw new BadRequestException(
        'Password minimum 6 characters',
      );
    }

    // =========================================
    // VERIFY TOKEN
    // =========================================

    let payload: any;

    try {

      payload =
        this.jwtService.verify(
          token,
        );

    } catch {

      throw new UnauthorizedException(
        'Invalid or expired token',
      );
    }

    // =========================================
    // VALIDATE TYPE
    // =========================================

    if (
      payload.type !==
      'RESET_PASSWORD'
    ) {
      throw new UnauthorizedException(
        'Invalid token type',
      );
    }

    // =========================================
    // HASH PASSWORD
    // =========================================

    const hashedPassword =
      await bcrypt.hash(
        newPassword,
        10,
      );

    // =========================================
    // UPDATE USER PASSWORD
    // =========================================

    await this.prisma.user.update({
      where: {
        email: payload.email,
      },

      data: {
        password: hashedPassword,
      },
    });

    return {
      success: true,

      message:
        'Password reset successfully',
    };
  }
}