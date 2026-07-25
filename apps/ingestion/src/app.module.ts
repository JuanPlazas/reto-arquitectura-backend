import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { SharedModule } from '@app/shared';

/**
 * register = static client config (one RMQ queue, known at startup).
 */
@Module({
  imports: [
    SharedModule,
    ClientsModule.register([
      {
        name: 'SIGNAL_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'signals_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class AppModule {}
