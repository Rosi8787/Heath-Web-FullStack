import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import Groq from 'groq-sdk';

@Injectable()
export class SummarizeService {
  private groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  constructor(private prisma: PrismaService) {}

  // ======================================================
  // AI SUMMARY
  // ======================================================

  async generateSummary(userId: string) {
    // ======================================================
    // USER
    // ======================================================

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // ======================================================
    // VALIDASI PROFILE
    // ======================================================

    if (!user.age || !user.height || !user.weight || !user.gender) {
      throw new BadRequestException('Please complete your profile first');
    }

    // ======================================================
    // PREMIUM ONLY
    // ======================================================

    const subscription = await this.prisma.subscription.findUnique({
      where: {
        userId,
      },
    });

    const isPremium =
      subscription &&
      subscription.status === 'ACTIVE' &&
      subscription.expiresAt > new Date();

    if (!isPremium) {
      throw new ForbiddenException('Premium feature');
    }

    // ======================================================
    // TODAY
    // ======================================================

    const today = new Date().toISOString().split('T')[0];

    // ======================================================
    // GET TODAY SCANS
    // ======================================================

    const scans = await this.prisma.nutritionScan.findMany({
      where: {
        userId,
        dayKey: today,
      },
    });

    if (scans.length === 0) {
      throw new BadRequestException('No nutrition data today');
    }

    // ======================================================
    // FORMAT SCAN
    // ======================================================

    const formattedScans = scans.map((item) => ({
      productName: item.productName,
      sugar: item.sugar,
      sugarStatus: item.sugarStatus,
    }));

    // ======================================================
    // TOTAL SUGAR
    // ======================================================

    const totalSugar = scans.reduce(
      (sum, item) => sum + Number(item.sugar || 0),
      0,
    );

    // ======================================================
    // AI PROMPT
    // ======================================================

    const prompt = `
You are a professional nutrition AI assistant.

Analyze the user's sugar consumption today.

User Profile:
- Age: ${user.age}
- Gender: ${user.gender}
- Height: ${user.height} cm
- Weight: ${user.weight} kg

Nutrition Data Today:
${JSON.stringify(formattedScans)}

Total Sugar Today:
${totalSugar}g

Please provide:
1. Health analysis
2. Is the sugar intake safe or dangerous
3. Personalized recommendation
4. Healthy lifestyle advice
5. Maximum daily sugar suggestion

Rules:
- Use simple English
- Friendly tone
- Maximum 200 words
- Give realistic advice
`;

    // ======================================================
    // GROQ REQUEST
    // ======================================================

    const response = await this.groq.chat.completions.create({
      model: 'llama3-70b-8192',

      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content;

    // ======================================================
    // RETURN
    // ======================================================

    return {
      success: true,

      totalScans: scans.length,

      totalSugar,

      summary,
    };
  }
}
