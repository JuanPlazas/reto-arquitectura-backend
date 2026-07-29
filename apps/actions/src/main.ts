import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
      queue: 'actions_queue',
      noAck: false,
      queueOptions: {
        durable: true,
      },
    },
  });
  app.enableShutdownHooks();
  await app.listen();
  console.log('Actions Service is listening');
}
bootstrap();
