import { Injectable, OnApplicationBootstrap, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SignalDto, PrismaService, RedisService } from '@app/shared';
import { Rule, SignalType } from '@prisma/client';

@Injectable()
export class WorkerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject('ACTIONS_SERVICE') private readonly actionClient: ClientProxy,
    @Inject('DLQ_SERVICE') private readonly dlqClient: ClientProxy,
  ) {}

  // Runs automatically after NestJS finishes bootstrapping
  async onApplicationBootstrap() {
    await this.cacheData();
  }

  private async cacheData() {
    try {
      const rulesDB: Rule[] = await this.prisma.rule.findMany({
        where: {
          isActive: true,
        },
      });
      if (rulesDB.length === 0) return;

      // Group by vehicleId to avoid overwriting
      const rulesByVehicle = rulesDB.reduce(
        (acc, rule) => {
          if (!acc[rule.vehicleId]) {
            acc[rule.vehicleId] = {};
          }
          acc[rule.vehicleId][rule.type] = rule;
          return acc;
        },
        {} as Record<number, Record<string, Rule>>,
      );

      // Use ioredis Pipeline to send all data in a single round trip
      const pipeline = await this.redis.pipeline();
      for (const [vehicleId, rulesData] of Object.entries(rulesByVehicle)) {
        for (const [ruleType, rules] of Object.entries(rulesData)) {
          const rulesKey = `vehicle:${vehicleId}:${ruleType}`;
          pipeline.set(rulesKey, JSON.stringify(rules));
        }
      }

      // Send all data in one shot
      await pipeline.exec();

      this.logger.log(
        `Cached rules for ${Object.keys(rulesByVehicle).length} vehicles successfully.`,
      );
    } catch (error) {
      this.logger.error('Failed to cache vehicle rules data', error);
    }
  }

  async sendToDLQ(signal: SignalDto, reason: string): Promise<void> {
    try {
      this.dlqClient.emit('signal.dlq', {
        originalSignal: signal,
        failedAt: new Date().toISOString(),
        reason,
      });
      this.logger.warn(`Signal routed to DLQ: vehicle ${signal.vehicleId} — ${reason}`);
    } catch {
      this.logger.error(`Failed Signal routed to DLQ`);
    }
  }

  async processSignal(signal: SignalDto) {
    const start = Date.now();

    // Bypass for Signal PANIC
    if (signal.type === SignalType.PANIC) {
      this.logger.warn(`PANIC signal received from ${signal.vehicleId}!`);
      this.actionClient.emit('action.required', signal);
    } else {
      const rulesKey = `vehicle:${signal.vehicleId}:${signal.type}`;
      // Get Vehicle Rules from Cache
      let rule = await this.redis.get(rulesKey);

      if (!rule) {
        try {
          const ruleDB = await this.prisma.rule.findFirst({
            where: {
              vehicleId: signal.vehicleId,
              type: signal.type,
            },
          });
          rule = ruleDB ? JSON.stringify(ruleDB) : null;
          await this.redis.set(rulesKey, rule);
        } catch (error) {
          this.logger.error(
            `Failed to get rules for vehicle ${signal.vehicleId}: ${(error as Error).message}`,
          );
        }
      }

      const parsedRule: Rule = JSON.parse(rule || '{}');

      if (Object.keys(parsedRule).length > 0) {
        // Parse full timestamp from signal
        if (signal.type === SignalType.SCHEDULE) {
          const currentDate = new Date(signal.receivedAt);
          const conditions = parsedRule.conditions;
          const { min, max } = conditions[currentDate.getDay()];
          const minDate = new Date(`${currentDate.toLocaleDateString()} ${min}`);
          const maxDate = new Date(`${currentDate.toLocaleDateString()} ${max}`);
          if (currentDate < minDate || currentDate > maxDate) {
            this.actionClient.emit('action.required', parsedRule);
          }
        } else {
          // Match conditions field names (e.g. "speed") to signal fields dynamically
          for (const [key, value] of Object.entries(parsedRule.conditions)) {
            const { min, max } = value;
            const valueSignal = signal[key.toLowerCase()];

            if (valueSignal < min || valueSignal > max) {
              this.actionClient.emit('action.required', parsedRule);
            }
          }
        }
      }
    }

    // Update Last State in Cache
    await this.redis.set(`vehicle:${signal.vehicleId}:last_state`, JSON.stringify(signal));

    // Persist signal to PostgreSQL
    try {
      await this.prisma.signal.create({
        data: {
          vehicleId: signal.vehicleId,
          latitude: signal.latitude,
          longitude: signal.longitude,
          speed: signal.speed,
          direction: signal.direction,
          type: signal.type,
          metadata: signal.metadata || {},
          receivedAt: new Date(signal.receivedAt),
        },
      });
    } catch (e) {
      this.logger.error(`Failed to persist signal: ${(e as Error).message}`);
    }
    const duration = Date.now() - start;
    this.logger.log(`Processed signal for vehicle ${signal.vehicleId} in ${duration}ms`);
  }
}
