import {
  Controller,
  Get,
  Patch,
  Delete,
  UseGuards,
  Req,
  Body,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

import { UserService } from './user.service';

import { FileInterceptor } from '@nestjs/platform-express';

import { memoryStorage } from 'multer';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  // =========================================
  // GET PROFILE
  // =========================================

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    return this.userService.getProfile(req.user.id);
  }

  // =========================================
  // UPDATE USERNAME
  // =========================================

  @Patch('username')
  @UseGuards(JwtAuthGuard)
  async updateUsername(
    @Req() req: any,

    @Body()
    body: {
      name: string;
    },
  ) {
    return this.userService.updateUsername(req.user.id, body.name);
  }

  // =========================================
  // UPDATE PROFILE IMAGE
  // =========================================

  @Patch('profile-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
    }),
  )
  async updateProfileImage(
    @Req() req: any,

    @UploadedFile()
    file: Express.Multer.File,
  ) {
    return this.userService.updateProfileImage(req.user.id, file);
  }

  // =========================================
  // DELETE ACCOUNT
  // =========================================

  @Delete()
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: any) {
    return this.userService.deleteAccount(req.user.id);
  }

  // =========================================
  // DELETE ACCOUNT
  // =========================================

  @Patch('health-profile')
  @UseGuards(JwtAuthGuard)
  async updateHealthProfile(@Req() req, @Body() dto) {
    return this.userService.updateHealthProfile(req.user.id, dto);
  }

  // =========================================
  // CHANGE PASSWORD
  // =========================================

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Req() req, @Body() body) {
    console.log(req.user);

    return this.userService.changePassword(
      req.user.id,
      body.oldPassword,
      body.newPassword,
    );
  }
}
