import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";

import { JwtService } from "@nestjs/jwt";

import * as bcrypt from "bcrypt";

import { PrismaService } from "../prisma/prisma.service"

import { AuthDto } from "./dto/auth.dto";

@Injectable()
export class AuthService {

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // =========================
  // REGISTER
  // =========================

  async register(dto: AuthDto) {

    const existingUser =
      await this.prisma.user.findUnique({
        where: {
          email: dto.email,
        },
      });

    if (existingUser) {
      throw new BadRequestException(
        "Email already used",
      );
    }

    const hashedPassword =
      await bcrypt.hash(dto.password, 10);

    const user =
      await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          name: dto.email.split("@")[0],
        },
      });

    return {
      message: "Register success",
      user,
    };
  }

  // =========================
  // LOGIN
  // =========================

  async login(dto: AuthDto) {

    const user =
      await this.prisma.user.findUnique({
        where: {
          email: dto.email,
        },
      });

    if (!user) {
      throw new UnauthorizedException(
        "User not found",
      );
    }

    const isPasswordValid =
      await bcrypt.compare(
        dto.password,
        user.password,
      );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        "Wrong password",
      );
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const token =
      await this.jwtService.signAsync(
        payload,
      );

    return {
      message: "Login success",
      access_token: token,
    };
  }
}