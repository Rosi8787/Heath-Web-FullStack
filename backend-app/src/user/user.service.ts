import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  // =========================================
  // GET PROFILE
  // =========================================

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        name: true,
        email: true,
        profileImage: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      message: 'Profile fetched successfully',
      data: user,
    };
  }

  // =========================================
  // UPDATE USERNAME
  // =========================================

  async updateUsername(userId: string, name: string) {
    if (!name || name.trim() === '') {
      throw new BadRequestException('Username is required');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        name,
      },

      select: {
        id: true,
        name: true,
        email: true,
        profileImage: true,
      },
    });

    return {
      success: true,
      message: 'Username updated successfully',
      data: updatedUser,
    };
  }

  // =========================================
  // UPDATE PROFILE IMAGE
  // =========================================

  async updateProfileImage(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Profile image is required');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const uploaded: any = await this.cloudinary.uploadImage(file);

    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        profileImage: uploaded.secure_url,
      },

      select: {
        id: true,
        name: true,
        profileImage: true,
      },
    });

    return {
      success: true,
      message: 'Profile image updated successfully',
      data: updatedUser,
    };
  }

  // =========================================
  // DELETE ACCOUNT
  // =========================================

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: {
        id: userId,
      },
    });

    return {
      success: true,
      message: 'Account deleted successfully',
    };
  }

  // =========================================
  // UPDATE HEALTH PROFILE
  // =========================================

  async updateHealthProfile(userId: string, dto: any) {
    const user = await this.prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        age: dto.age,
        height: dto.height,
        weight: dto.weight,
        gender: dto.gender,
      },
    });

    return {
      success: true,

      message: 'Health profile updated',

      data: user,
    };
  }

  // =========================================
  // CHANGE PASSWORD
  // =========================================

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // CHECK OLD PASSWORD
    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      throw new BadRequestException('Old password incorrect');
    }

    // HASH NEW PASSWORD
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // UPDATE
    await this.prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        password: hashedPassword,
      },
    });

    return {
      success: true,
      message: 'Password changed',
    };
  }
}
