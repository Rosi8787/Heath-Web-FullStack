import { Module } from '@nestjs/common';

import { SummarizeController } from './summarize.controller';

import { SummarizeService } from './summarize.service';

import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],

  controllers: [
    SummarizeController,
  ],

  providers: [
    SummarizeService,
  ],
})
export class SummarizeModule {}