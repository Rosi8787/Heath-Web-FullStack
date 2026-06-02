import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import dns from 'dns';

dns.lookup('smtp.gmail.com', { all: true }, (err, addresses) => {
  console.log('DNS RESULT:', addresses);
});

dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Glucofy API')
    .setDescription('Dokumentasi API untuk OCR, AI, dan Nutrition')
    .setVersion('1.0')
    .addBearerAuth() // jika pakai JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // 2. Setup path ke '/docs'
  SwaggerModule.setup('docs', app, document);
  
  const port = process.env.PORT || 3000;

  app.enableCors({
    origin: "*",
  });

  app.useGlobalPipes(
    new ValidationPipe(),
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();