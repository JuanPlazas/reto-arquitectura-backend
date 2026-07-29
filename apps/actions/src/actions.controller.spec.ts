import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';
import { Rule, ActionType, RuleType } from '@prisma/client';

describe('ActionsController', () => {
  let controller: ActionsController;
  let mockActionsService: any;
  let mockChannel: { ack: any; nack: any };

  const mockData: Rule = {
    id: 1,
    vehicleId: 1,
    type: RuleType.SPEED,
    conditions: { speed: { min: 0, max: 80 } },
    actions: [ActionType.NOTIFY_OWNER],
    isActive: true,
    createdAt: new Date(),
  };

  function createMockContext(): any {
    return {
      getChannelRef: jest.fn().mockReturnValue(mockChannel),
      getMessage: jest.fn().mockReturnValue({ properties: { headers: {} } }),
    };
  }

  beforeEach(async () => {
    mockChannel = { ack: jest.fn(), nack: jest.fn() };
    mockActionsService = { executeAction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActionsController],
      providers: [{ provide: ActionsService, useValue: mockActionsService }],
    }).compile();

    controller = module.get<ActionsController>(ActionsController);
  });

  describe('handleAction', () => {
    it('should ack the message on success', async () => {
      mockActionsService.executeAction.mockResolvedValue(undefined);

      await controller.handleAction(mockData, createMockContext());

      expect(mockActionsService.executeAction).toHaveBeenCalledWith(mockData);
      expect(mockChannel.ack).toHaveBeenCalledTimes(1);
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('should nack with requeue on error', async () => {
      mockActionsService.executeAction.mockRejectedValue(new Error('execution failed'));

      await controller.handleAction(mockData, createMockContext());

      expect(mockChannel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });
  });
});
