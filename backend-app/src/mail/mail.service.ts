import { Injectable } from '@nestjs/common';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class MailService {
  private brevo: BrevoClient;

  constructor() {
    this.brevo = new BrevoClient({
      apiKey: process.env.BREVO_API_KEY!,
    });

    console.log(
      'BREVO_API_KEY EXISTS =',
      !!process.env.BREVO_API_KEY,
    );
  }

  async sendOtp(
    email: string,
    code: string,
  ) {
    await this.brevo.transactionalEmails.sendTransacEmail({
      sender: {
        name: 'Glucofy',
        email: 'glucofy.health@gmail.com',
      },

      to: [
        {
          email,
        },
      ],

      subject: 'Your Glucofy OTP Code',

      htmlContent: `
        <!-- HTML EMAIL KAMU -->
      `,
    });
  }
}