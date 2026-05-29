import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SubscriptionService {

  constructor(
    private prisma: PrismaService,
  ) {}

  // ======================================================
  // ACTIVATE PREMIUM
  // ======================================================

  async activatePremium(
    userId: string,
  ) {

    const expiresAt =
      new Date();

    expiresAt.setDate(
      expiresAt.getDate() + 30,
    );

    const existing =
      await this.prisma.subscription.findUnique({
        where: {
          userId,
        },
      });

    // ============================================
    // UPDATE EXISTING
    // ============================================

    if (existing) {

      const subscription =
        await this.prisma.subscription.update({
          where: {
            userId,
          },

          data: {
            status: 'ACTIVE',
            expiresAt,
          },
        });

      await this.prisma.user.update({
        where: {
          id: userId,
        },

        data: {
          role: 'PREMIUM',
        },
      });

      return {
        success: true,

        message:
          'Premium activated successfully',

        data: subscription,
      };
    }

    // ============================================
    // CREATE NEW
    // ============================================

    const subscription =
      await this.prisma.subscription.create({
        data: {
          userId,

          status: 'ACTIVE',

          expiresAt,
        },
      });

    await this.prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        role: 'PREMIUM',
      },
    });

    return {
      success: true,

      message:
        'Premium activated successfully',

      data: subscription,
    };
  }

  // ======================================================
  // GET STATUS
  // ======================================================

  async getStatus(userId: string) {

    const subscription =
      await this.prisma.subscription.findUnique({
        where: {
          userId,
        },
      });

    // ============================================
    // NO SUBSCRIPTION
    // ============================================

    if (!subscription) {

      return {
        premium: false,
      };
    }

    // ============================================
    // EXPIRED
    // ============================================

    if (
      subscription.expiresAt <
      new Date()
    ) {

      await this.prisma.user.update({
        where: {
          id: userId,
        },

        data: {
          role: 'USER',
        },
      });

      return {
        premium: false,

        expired: true,
      };
    }

    return {
      premium: true,

      expiresAt:
        subscription.expiresAt,
    };
  }
}