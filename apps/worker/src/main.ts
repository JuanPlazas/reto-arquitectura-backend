import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: 'signals_queue',
        noAck: false,
        queueOptions: {
          durable: true,
        },
      },
    },
  );
  // shutdown: NestJS will call onModuleDestroy() on all modules
  // (Prisma, Redis, RMQ client) before the process exits.
  app.enableShutdownHooks();
  await app.listen();
  console.log('Worker Service is listening');
}
bootstrap();
