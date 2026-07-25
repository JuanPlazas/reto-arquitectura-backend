import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, catchError, throwError, timeout } from 'rxjs';
import { SignalDto } from '@app/shared';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(@Inject('SIGNAL_SERVICE') private readonly client: ClientProxy) {}

  async publishSignal(signalDto: SignalDto): Promise<void> {
    try {
      /**
       * Wait 2 seconds for the RMQ response.
       * lastValueFrom converts the observable to a Promise.
       */
      await lastValueFrom(
        this.client.emit('signal.received', signalDto).pipe(
          timeout(2000),
          catchError((error) => {
            this.logger.error(`RabbitMQ publish failed: ${error.message}`);
            return throwError(
              () =>
                new ServiceUnavailableException(
                  'RabbitMQ is unavailable, please try later.',
                ),
            );
          }),
        ),
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(
        `Unexpected error publishing signal: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'RabbitMQ is unavailable, please try later.',
      );
    }
  }
}
