import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { WorkerService } from './worker.service';
import { PrismaService, RedisService, SignalDto } from '@app/shared';
import { Rule, SignalType, RuleType, ActionType } from '@prisma/client';
import { of } from 'rxjs';

describe('WorkerService', () => {
  let service: WorkerService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockActionClient: { emit: any };
  let mockDlqClient: { emit: any };
  let mockPipeline: any;

  const baseSignal: SignalDto = {
    vehicleId: 1,
    latitude: 4.6097,
    longitude: -74.0817,
    direction: 90,
    speed: 60,
    type: 'LOCATION' as SignalType,
    receivedAt: new Date('2026-07-29T10:00:00Z'),
  };

  const mockRule: Rule = {
    id: 1,
    vehicleId: 1,
    type: RuleType.SPEED,
    conditions: { speed: { min: 0, max: 80 } },
    actions: [ActionType.NOTIFY_OWNER, ActionType.NOTIFY_DRIVER],
    isActive: true,
    createdAt: new Date(),
  };

  const fn = (): any => jest.fn();

  beforeEach(async () => {
    mockPipeline = {
      set: fn(),
      exec: fn().mockResolvedValue([]),
    };

    mockRedis = {
      get: fn(),
      set: fn(),
      pipeline: fn().mockResolvedValue(mockPipeline),
      del: fn(),
    };

    mockPrisma = {
      rule: {
        findMany: fn(),
        findFirst: fn(),
      },
      signal: {
        create: fn(),
      },
    };

    mockActionClient = { emit: fn().mockReturnValue(of({})) };
    mockDlqClient = { emit: fn().mockReturnValue(of({})) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: 'ACTIONS_SERVICE', useValue: mockActionClient },
        { provide: 'DLQ_SERVICE', useValue: mockDlqClient },
      ],
    }).compile();

    service = module.get<WorkerService>(WorkerService);
  });

  describe('onApplicationBootstrap', () => {
    it('should cache active rules on startup', async () => {
      const rules: Rule[] = [
        { ...mockRule, id: 1, vehicleId: 1, type: RuleType.SPEED },
        { ...mockRule, id: 2, vehicleId: 1, type: RuleType.LOCATION },
      ];
      mockPrisma.rule.findMany.mockResolvedValue(rules);

      await service.onApplicationBootstrap();

      expect(mockPrisma.rule.findMany).toHaveBeenCalledWith({ where: { isActive: true } });
      expect(mockPipeline.set).toHaveBeenCalledTimes(2);
      expect(mockPipeline.set).toHaveBeenCalledWith('vehicle:1:SPEED', JSON.stringify(rules[0]));
      expect(mockPipeline.set).toHaveBeenCalledWith('vehicle:1:LOCATION', JSON.stringify(rules[1]));
      expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
    });

    it('should skip caching when no active rules exist', async () => {
      mockPrisma.rule.findMany.mockResolvedValue([]);

      await service.onApplicationBootstrap();

      expect(mockPipeline.set).not.toHaveBeenCalled();
      expect(mockPipeline.exec).not.toHaveBeenCalled();
    });

    it('should log error when cache fails', async () => {
      (service as any).logger.error = fn();
      mockPrisma.rule.findMany.mockRejectedValue(new Error('DB down'));

      await service.onApplicationBootstrap();

      expect((service as any).logger.error).toHaveBeenCalled();
    });
  });

  describe('processSignal — PANIC', () => {
    const panicSignal: SignalDto = { ...baseSignal, type: SignalType.PANIC };

    it('should emit action immediately and bypass rule evaluation', async () => {
      mockPrisma.signal.create.mockResolvedValue({});

      await service.processSignal(panicSignal);

      expect(mockActionClient.emit).toHaveBeenCalledWith('action.required', panicSignal);
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockPrisma.rule.findFirst).not.toHaveBeenCalled();
    });

    it('should save last state and persist signal for PANIC', async () => {
      mockPrisma.signal.create.mockResolvedValue({});

      await service.processSignal(panicSignal);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'vehicle:1:last_state',
        JSON.stringify(panicSignal),
      );
      expect(mockPrisma.signal.create).toHaveBeenCalledWith({
        data: {
          vehicleId: 1,
          latitude: 4.6097,
          longitude: -74.0817,
          speed: 60,
          direction: 90,
          type: SignalType.PANIC,
          metadata: {},
          receivedAt: panicSignal.receivedAt,
        },
      });
    });
  });

  describe('processSignal — SPEED / LOCATION', () => {
    it('should emit action when speed exceeds max', async () => {
      const signal: SignalDto = { ...baseSignal, type: SignalType.SPEED, speed: 100 };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockRule));
      mockPrisma.signal.create.mockResolvedValue({});

      await service.processSignal(signal);

      expect(mockActionClient.emit).toHaveBeenCalledWith(
        'action.required',
        expect.objectContaining({ vehicleId: 1, type: 'SPEED' }),
      );
    });

    it('should NOT emit action when speed is within bounds', async () => {
      const signal: SignalDto = { ...baseSignal, type: SignalType.SPEED, speed: 50 };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockRule));
      mockPrisma.signal.create.mockResolvedValue({});

      await service.processSignal(signal);

      expect(mockActionClient.emit).not.toHaveBeenCalled();
    });

    it('should emit action when latitude is out of bounds', async () => {
      const locationRule: Rule = {
        ...mockRule,
        type: RuleType.LOCATION,
        conditions: { latitude: { min: -50, max: 50 } },
      };
      const signal: SignalDto = { ...baseSignal, type: SignalType.LOCATION, latitude: 100 };
      mockRedis.get.mockResolvedValue(JSON.stringify(locationRule));
      mockPrisma.signal.create.mockResolvedValue({});

      await service.processSignal(signal);

      expect(mockActionClient.emit).toHaveBeenCalledWith(
        'action.required',
        expect.objectContaining({ vehicleId: 1, type: 'LOCATION' }),
      );
    });

    it('should NOT emit action when coordinates are within bounds', async () => {
      const locationRule: Rule = {
        ...mockRule,
        type: RuleType.LOCATION,
        conditions: {
          latitude: { min: -50, max: 50 },
          longitude: { min: -150, max: 150 },
        },
      };
      const signal: SignalDto = {
        ...baseSignal,
        type: SignalType.LOCATION,
        latitude: 10,
        longitude: -74,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(locationRule));
      mockPrisma.signal.create.mockResolvedValue({});

      await service.processSignal(signal);

      expect(mockActionClient.emit).not.toHaveBeenCalled();
    });

    it('should fallback to DB when cache misses', async () => {
      const signal: SignalDto = { ...baseSignal, type: SignalType.SPEED, speed: 100 };
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.rule.findFirst.mockResolvedValue(mockRule);
      mockPrisma.signal.create.mockResolvedValue({});

      await service.processSignal(signal);

      expect(mockPrisma.rule.findFirst).toHaveBeenCalledWith({
        where: { vehicleId: 1, type: 'SPEED' },
      });
      expect(mockRedis.set).toHaveBeenCalledWith('vehicle:1:SPEED', JSON.stringify(mockRule));
      expect(mockActionClient.emit).toHaveBeenCalledWith(
        'action.required',
        expect.objectContaining({ vehicleId: 1, type: 'SPEED' }),
      );
    });

    it('should handle missing rule gracefully (no action, no error)', async () => {
      const signal: SignalDto = { ...baseSignal, type: SignalType.SPEED, speed: 100 };
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.rule.findFirst.mockResolvedValue(null);
      mockPrisma.signal.create.mockResolvedValue({});

      await expect(service.processSignal(signal)).resolves.toBeUndefined();
      expect(mockActionClient.emit).not.toHaveBeenCalled();
    });
  });

  describe('processSignal — SCHEDULE', () => {
    const scheduleRule: Rule = {
      ...mockRule,
      type: RuleType.SCHEDULE,
      conditions: {
        1: { min: '08:00', max: '18:00' },
        2: { min: '08:00', max: '18:00' },
        3: { min: '08:00', max: '18:00' },
        4: { min: '08:00', max: '18:00' },
        5: { min: '08:00', max: '12:00' },
      },
    };

    it('should evaluate SCHEDULE rule and emit action on violation', async () => {
      const signal: SignalDto = {
        ...baseSignal,
        type: SignalType.SCHEDULE,
        receivedAt: new Date('2026-07-29T10:00:00Z'),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(scheduleRule));
      mockPrisma.signal.create.mockResolvedValue({});

      await service.processSignal(signal);

      expect(mockRedis.get).toHaveBeenCalledWith('vehicle:1:SCHEDULE');
      expect(mockPrisma.signal.create).toHaveBeenCalled();
    });
  });

  describe('processSignal — error handling', () => {
    it('should NOT throw when signal persistence fails', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.rule.findFirst.mockResolvedValue(null);
      mockPrisma.signal.create.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.processSignal(baseSignal)).resolves.toBeUndefined();
    });
  });

  describe('sendToDLQ', () => {
    it('should emit signal to DLQ with metadata', async () => {
      await service.sendToDLQ(baseSignal, 'max retries exceeded');

      expect(mockDlqClient.emit).toHaveBeenCalledWith('signal.dlq', {
        originalSignal: baseSignal,
        failedAt: expect.any(String),
        reason: 'max retries exceeded',
      });
    });

    it('should not throw when DLQ emit fails', async () => {
      mockDlqClient.emit.mockImplementation(() => {
        throw new Error('RMQ down');
      });

      await expect(service.sendToDLQ(baseSignal, 'error')).resolves.toBeUndefined();
    });
  });
});
