import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';
import { PrismaService, RedisService, SharedModule } from '@app/shared';

@Module({
  imports: [
    SharedModule,
    ClientsModule.register([
      {
        name: 'ACTIONS_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'actions_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
      {
        name: 'DLQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'signal.dlq',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [WorkerController],
  providers: [WorkerService],
})
export class AppModule {}
