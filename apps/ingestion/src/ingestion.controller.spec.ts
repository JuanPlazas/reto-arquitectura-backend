import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { SignalDto } from '@app/shared';

describe('IngestionController', () => {
  let controller: IngestionController;
  let mockService: jest.Mocked<Pick<IngestionService, 'publishSignal'>>;

  const mockSignal: SignalDto = {
    vehicleId: 1,
    latitude: 4.6097,
    longitude: -74.0817,
    direction: 90,
    speed: 60,
    type: 'LOCATION' as any,
    receivedAt: new Date('2023-11-30T10:00:00Z'),
  };

  beforeEach(async () => {
    mockService = {
      publishSignal: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [{ provide: IngestionService, useValue: mockService }],
    }).compile();

    controller = module.get<IngestionController>(IngestionController);
  });

  it('should call publishSignal with the signal DTO', async () => {
    mockService.publishSignal.mockResolvedValue(undefined);

    await controller.ingestSignal(mockSignal);

    expect(mockService.publishSignal).toHaveBeenCalledWith(mockSignal);
  });

  it('should return accepted status', async () => {
    mockService.publishSignal.mockResolvedValue(undefined);

    const result = await controller.ingestSignal(mockSignal);

    expect(result).toEqual({ status: 'accepted' });
  });

  it('should have HttpCode ACCEPTED (202) on ingestSignal', () => {
    const metadata = Reflect.getMetadata('__httpCode__', IngestionController.prototype.ingestSignal);
    expect(metadata).toBe(HttpStatus.ACCEPTED);
  });
});
