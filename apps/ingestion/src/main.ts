import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable ValidationPipe to enforce DTO rules (like vehicleId required)
  app.useGlobalPipes(new ValidationPipe());

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('CCS Ingestion API')
    .setDescription('API for receiving vehicle signals')
    .setVersion('1.0')
    .addTag('Signals')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // shutdown: NestJS will call onModuleDestroy() on all modules
  // (Prisma, Redis, RMQ client) before the process exits.
  app.enableShutdownHooks();
  await app.listen(3000);
  console.log(`Ingestion Service running on port 3000`);
  console.log(`Swagger docs available at http://localhost:3000/api`);
}
bootstrap();
