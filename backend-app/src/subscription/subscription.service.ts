import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  // ======================================================
  // ACTIVATE PREMIUM
  // ======================================================
  async activatePremium(userId: string, plan: 'monthly' | 'yearly') {
    // Validasi plan
    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      throw new BadRequestException('Plan must be "monthly" or "yearly"');
    }

    const expiresAt = new Date();
    const daysToAdd = plan === 'monthly' ? 30 : 365;
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);

    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (existing) {
      const subscription = await this.prisma.subscription.update({
        where: { userId },
        data: {
          status: 'ACTIVE',
          expiresAt,
        },
      });

      await this.prisma.user.update({
        where: { id: userId },
        data: { role: 'PREMIUM' },
      });

      return {
        success: true,
        message: `Premium ${plan} activated successfully`,
        data: subscription,
      };
    }

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        status: 'ACTIVE',
        expiresAt,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'PREMIUM' },
    });

    return {
      success: true,
      message: `Premium ${plan} activated successfully`,
      data: subscription,
    };
  }

  // ======================================================
  // GET STATUS
  // ======================================================
  async getStatus(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return { premium: false };
    }

    if (subscription.expiresAt < new Date()) {
      // Jika sudah kedaluwarsa, ubah role menjadi USER
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: 'USER' },
      });
      return { premium: false, expired: true };
    }

    return {
      premium: true,
      expiresAt: subscription.expiresAt,
    };
  }

  // ======================================================
  // CANCEL PREMIUM (BARU)
  // ======================================================
  async cancelPremium(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      throw new BadRequestException('No active subscription to cancel');
    }

    // Ubah status subscription menjadi CANCELED
    await this.prisma.subscription.update({
      where: { userId },
      data: { status: 'CANCELED' },
    });

    // Ubah role user menjadi USER
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'USER' },
    });

    return {
      success: true,
      message: 'Premium subscription has been canceled. You are now a free user.',
    };
  }
}