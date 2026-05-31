import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from "@nestjs/common";
import dns from 'dns';

dns.lookup('smtp.gmail.com', { all: true }, (err, addresses) => {
  console.log('DNS RESULT:', addresses);
});

dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: "*",
  });

  app.useGlobalPipes(
    new ValidationPipe(),
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();