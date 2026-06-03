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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserService } from './user.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ChangePasswordDto } from './dto/reset.dto';

// DTO inline untuk update username
class UpdateUsernameDto {
  @ApiProperty({ example: 'john_doe', description: 'Nama baru user' })
  name!: string;
}

// DTO inline untuk update health profile (sesuaikan field dengan service Anda)
class UpdateHealthProfileDto {
  @ApiProperty({ required: false, example: 70, description: 'Berat badan (kg)' })
  weight?: number;

  @ApiProperty({ required: false, example: 170, description: 'Tinggi badan (cm)' })
  height?: number;

  @ApiProperty({ required: false, example: 'male', description: 'Jenis kelamin' })
  gender?: string;

  @ApiProperty({ required: false, example: 30, description: 'Umur' })
  age?: number;

  @ApiProperty({ required: false, example: 'active', description: 'Level aktivitas' })
  activityLevel?: string;
}

@ApiTags('User')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  // =========================================
  // GET PROFILE
  // =========================================
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Req() req: any) {
    return this.userService.getProfile(req.user.id);
  }

  // =========================================
  // UPDATE USERNAME
  // =========================================
  @Patch('username')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update username' })
  @ApiBody({ type: UpdateUsernameDto })
  @ApiResponse({ status: 200, description: 'Username updated' })
  async updateUsername(@Req() req: any, @Body() body: UpdateUsernameDto) {
    return this.userService.updateUsername(req.user.id, body.name);
  }

  // =========================================
  // UPDATE PROFILE IMAGE
  // =========================================
  @Patch('profile-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Update profile image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary', description: 'File gambar' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Profile image updated' })
  async updateProfileImage(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.userService.updateProfileImage(req.user.id, file);
  }

  // =========================================
  // DELETE ACCOUNT
  // =========================================
  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  async deleteAccount(@Req() req: any) {
    return this.userService.deleteAccount(req.user.id);
  }

  // =========================================
  // UPDATE HEALTH PROFILE
  // =========================================
  @Patch('health-profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update health profile (weight, height, gender, age, activityLevel)' })
  @ApiBody({ type: UpdateHealthProfileDto })
  @ApiResponse({ status: 200, description: 'Health profile updated' })
  async updateHealthProfile(@Req() req: any, @Body() dto: UpdateHealthProfileDto) {
    return this.userService.updateHealthProfile(req.user.id, dto);
  }

  // =========================================
  // CHANGE PASSWORD
  // =========================================
  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed' })
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.userService.changePassword(
      req.user.id,
      dto.oldPassword,
      dto.newPassword,
    );
  }
}