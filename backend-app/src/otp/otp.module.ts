import { Module } from '@nestjs/common';

import { OtpController } from './otp.controller';

import { OtpService } from './otp.service';

import { PrismaModule } from 'src/prisma/prisma.module';

import { MailModule } from 'src/mail/mail.module';
import { JwtModule } from '@nestjs/jwt/dist/jwt.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    JwtModule.register({
    secret: process.env.JWT_SECRET,
  }),
  ],

  

  controllers: [OtpController],

  providers: [OtpService],
})
export class OtpModule {}