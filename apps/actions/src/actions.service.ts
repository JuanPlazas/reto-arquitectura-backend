import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, SignalDto } from '@app/shared';
import { ActionType, Rule, SignalType } from '@prisma/client';

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async executeAction(data: Rule | SignalDto) {
    // simulate delay or external API call (SMS/Email)
    await new Promise((resolve) => setTimeout(resolve, 100));

    const actions =
      data.type === SignalType.PANIC
        ? [ActionType.NOTIFY_AUTHORITIES, ActionType.NOTIFY_DRIVER, ActionType.NOTIFY_OWNER]
        : 'actions' in data && data.actions;
    this.logger.log(`Executing action for vehicle ${data.vehicleId}: ${actions}`);

    for (let action of actions) {
      try {
        /** integrate services to SMS-Email */
        switch (action) {
          case ActionType.NOTIFY_OWNER:
            this.logger.log(`Notifying owner for vehicle ${data.vehicleId}`);
            break;
          case ActionType.NOTIFY_AUTHORITIES:
            this.logger.log(`Notifying authorities for vehicle ${data.vehicleId}`);
            break;
          case ActionType.NOTIFY_DRIVER:
            this.logger.log(`Notifying driver for vehicle ${data.vehicleId}`);
            break;
          default:
            break;
        }

        await this.prisma.actionLog.create({
          data: {
            vehicleId: data.vehicleId,
            ruleId: data.type === SignalType.PANIC ? null : 'id' in data && data.id,
            reason: data.type,
            action: action,
            executedAt: new Date(),
          },
        });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        this.logger.error(`Failed to log action: ${errorMessage}`);
      }
    }

    this.logger.log(`Action executed successfully for ${data.vehicleId}`);
  }
}
