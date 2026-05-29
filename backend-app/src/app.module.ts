import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { AuthController } from './auth/auth.controller';
// import { AuthService } from './auth/auth.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { NutritionModule } from './nutrition/nutrition.module';
import { AiModule } from './ai/ai.module';
import { UserModule } from './user/user.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { SummarizeModule } from './summarize/summarize.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { OtpModule } from './otp/otp.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    AuthModule,

    NutritionModule,

    AiModule,

    UserModule,

    CloudinaryModule,

    SummarizeModule,

    SubscriptionModule,

    OtpModule,

    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
