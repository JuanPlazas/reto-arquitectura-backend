import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { WorkerService } from './worker.service';
import { SignalDto } from '@app/shared';

@Controller()
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @EventPattern('signal.received')
  async handleSignal(@Payload() data: SignalDto, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    const retryCount = originalMsg.properties.headers['x-death']?.[0]?.count || 0;

    try {
      await this.workerService.processSignal(data);
      channel.ack(originalMsg);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (retryCount >= process.env.MAX_RETRIES_SIGNAL) {
        await this.workerService.sendToDLQ(data, errorMessage);
        channel.nack(originalMsg, false, false);
      } else {
        channel.nack(originalMsg, false, true);
      }
    }
  }
}
