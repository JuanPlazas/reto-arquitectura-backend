import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { ActionsService } from './actions.service';

@Controller()
export class ActionsController {
    constructor(private readonly actionsService: ActionsService) { }

    @EventPattern('action.required')
    async handleAction(@Payload() data: any, @Ctx() context: RmqContext) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        try {
            await this.actionsService.executeAction(data);
            channel.ack(originalMsg);
        } catch (error) {
            channel.nack(originalMsg);
        }
    }
}
