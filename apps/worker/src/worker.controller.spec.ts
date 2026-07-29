import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';
import { SignalDto } from '@app/shared';

describe('WorkerController', () => {
  let controller: WorkerController;
  let mockWorkerService: any;
  let mockChannel: { ack: any; nack: any };

  const mockSignal: SignalDto = {
    vehicleId: 1,
    latitude: 4.6097,
    longitude: -74.0817,
    direction: 90,
    speed: 60,
    type: 'LOCATION' as any,
    receivedAt: new Date('2026-07-29T10:00:00Z'),
  };

  function createMockContext(xDeathCount?: number): any {
    const headers: Record<string, any> = {};
    if (xDeathCount !== undefined) {
      headers['x-death'] = [{ count: xDeathCount }];
    }
    return {
      getChannelRef: jest.fn().mockReturnValue(mockChannel),
      getMessage: jest.fn().mockReturnValue({
        properties: { headers },
      }),
    };
  }

  beforeEach(async () => {
    mockChannel = { ack: jest.fn(), nack: jest.fn() };
    mockWorkerService = {
      processSignal: jest.fn(),
      sendToDLQ: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkerController],
      providers: [{ provide: WorkerService, useValue: mockWorkerService }],
    }).compile();

    controller = module.get<WorkerController>(WorkerController);
    process.env.MAX_RETRIES_SIGNAL = '3';
  });

  describe('handleSignal', () => {
    it('should ack the message on success', async () => {
      mockWorkerService.processSignal.mockResolvedValue(undefined);

      await controller.handleSignal(mockSignal, createMockContext());

      expect(mockWorkerService.processSignal).toHaveBeenCalledWith(mockSignal);
      expect(mockChannel.ack).toHaveBeenCalledTimes(1);
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('should nack with requeue when retries are below the limit', async () => {
      mockWorkerService.processSignal.mockRejectedValue(new Error('evaluation failed'));

      await controller.handleSignal(mockSignal, createMockContext(1));

      expect(mockChannel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should send to DLQ and nack without requeue when retries exhausted', async () => {
      mockWorkerService.processSignal.mockRejectedValue(new Error('evaluation failed'));

      await controller.handleSignal(mockSignal, createMockContext(3));

      expect(mockWorkerService.sendToDLQ).toHaveBeenCalledWith(mockSignal, 'evaluation failed');
      expect(mockChannel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should handle error without x-death header (first attempt)', async () => {
      mockWorkerService.processSignal.mockRejectedValue(new Error('first fail'));

      await controller.handleSignal(mockSignal, createMockContext());

      expect(mockWorkerService.sendToDLQ).not.toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
    });
  });
});
