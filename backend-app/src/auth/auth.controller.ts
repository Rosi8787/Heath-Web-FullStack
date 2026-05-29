
import {
  Body,
  Controller,
  Patch,
  Post,
} from '@nestjs/common';

import { AuthService } from './auth.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
  ) {}

  // =========================================
  // REGISTER
  // =========================================

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
  ) {
    return this.authService.register(dto);
  }

  // =========================================
  // LOGIN
  // =========================================

  @Post('login')
  async login(
    @Body() dto: LoginDto,
  ) {
    return this.authService.login(dto);
  }

  // =========================================
  // RESET PASSWORD
  // =========================================

  @Patch('reset-password')
  async resetPassword(
    @Body()
    body: {
      token: string;
      newPassword: string;
    },
  ) {

    return this.authService.resetPassword(
      body.token,
      body.newPassword,
    );
  }
}