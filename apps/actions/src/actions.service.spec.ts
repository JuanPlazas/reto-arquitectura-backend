import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ActionsService } from './actions.service';
import { PrismaService, SignalDto } from '@app/shared';
import { Rule, ActionType, RuleType, SignalType } from '@prisma/client';

describe('ActionsService', () => {
  let service: ActionsService;
  let mockPrisma: any;

  const fn = (): any => jest.fn();

  const mockRule: Rule = {
    id: 1,
    vehicleId: 1,
    type: RuleType.SPEED,
    conditions: { speed: { min: 0, max: 80 } },
    actions: [ActionType.NOTIFY_OWNER, ActionType.NOTIFY_DRIVER],
    isActive: true,
    createdAt: new Date(),
  };

  const mockSignal: SignalDto = {
    vehicleId: 1,
    latitude: 4.6097,
    longitude: -74.0817,
    direction: 90,
    speed: 60,
    type: SignalType.PANIC,
    receivedAt: new Date('2026-07-29T10:00:00Z'),
  };

  beforeEach(async () => {
    mockPrisma = { actionLog: { create: fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ActionsService>(ActionsService);
  });

  describe('executeAction — PANIC signal', () => {
    it('should execute all three notification actions for PANIC', async () => {
      mockPrisma.actionLog.create.mockResolvedValue({});

      await service.executeAction(mockSignal);

      expect(mockPrisma.actionLog.create).toHaveBeenCalledTimes(3);
    });

    it('should log NOTIFY_AUTHORITIES, NOTIFY_DRIVER, NOTIFY_OWNER for PANIC', async () => {
      mockPrisma.actionLog.create.mockResolvedValue({});

      await service.executeAction(mockSignal);

      expect(mockPrisma.actionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: ActionType.NOTIFY_AUTHORITIES, ruleId: null }),
        }),
      );
      expect(mockPrisma.actionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: ActionType.NOTIFY_DRIVER, ruleId: null }),
        }),
      );
      expect(mockPrisma.actionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: ActionType.NOTIFY_OWNER, ruleId: null }),
        }),
      );
    });

    it('should set ruleId to null for PANIC actions', async () => {
      mockPrisma.actionLog.create.mockResolvedValue({});

      await service.executeAction(mockSignal);

      const calls = mockPrisma.actionLog.create.mock.calls;
      for (const call of calls) {
        expect(call[0].data.ruleId).toBeNull();
      }
    });
  });

  describe('executeAction — Rule object', () => {
    it('should execute each action from the rule', async () => {
      mockPrisma.actionLog.create.mockResolvedValue({});

      await service.executeAction(mockRule);

      expect(mockPrisma.actionLog.create).toHaveBeenCalledTimes(2);
    });

    it('should log each action type and include ruleId', async () => {
      mockPrisma.actionLog.create.mockResolvedValue({});

      await service.executeAction(mockRule);

      expect(mockPrisma.actionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: ActionType.NOTIFY_OWNER, ruleId: 1 }),
        }),
      );
      expect(mockPrisma.actionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: ActionType.NOTIFY_DRIVER, ruleId: 1 }),
        }),
      );
    });

    it('should set reason as the rule type string', async () => {
      mockPrisma.actionLog.create.mockResolvedValue({});

      await service.executeAction(mockRule);

      const calls = mockPrisma.actionLog.create.mock.calls;
      for (const call of calls) {
        expect(call[0].data.reason).toBe('SPEED');
      }
    });
  });

  describe('executeAction — error handling', () => {
    it('should NOT throw when actionLog creation fails', async () => {
      mockPrisma.actionLog.create.mockRejectedValue(new Error('DB error'));

      await expect(service.executeAction(mockRule)).resolves.toBeUndefined();
    });
  });

  describe('executeAction — single action rule', () => {
    it('should execute NOTIFY_AUTHORITIES when that is the only action', async () => {
      const singleActionRule: Rule = {
        ...mockRule,
        actions: [ActionType.NOTIFY_AUTHORITIES],
      };
      mockPrisma.actionLog.create.mockResolvedValue({});

      await service.executeAction(singleActionRule);

      expect(mockPrisma.actionLog.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.actionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: ActionType.NOTIFY_AUTHORITIES }),
        }),
      );
    });
  });
});
