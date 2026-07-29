import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError, Subject } from 'rxjs';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { IngestionService } from './ingestion.service';
import { SignalDto } from '@app/shared';

describe('IngestionService', () => {
  let service: IngestionService;
  let mockClient: { emit: jest.Mock };

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
    mockClient = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: 'SIGNAL_SERVICE', useValue: mockClient },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
  });

  it('should emit the signal successfully', async () => {
    mockClient.emit.mockReturnValue(of({}));

    await expect(service.publishSignal(mockSignal)).resolves.toBeUndefined();
    expect(mockClient.emit).toHaveBeenCalledWith('signal.received', mockSignal);
  });

  it('should throw ServiceUnavailableException on RabbitMQ timeout', async () => {
    const neverComplete = new Subject<any>();
    mockClient.emit.mockReturnValue(neverComplete);

    await expect(service.publishSignal(mockSignal)).rejects.toThrow(ServiceUnavailableException);
    neverComplete.unsubscribe();
  });

  it('should throw ServiceUnavailableException on RabbitMQ error', async () => {
    mockClient.emit.mockReturnValue(throwError(() => new Error('connection refused')));

    await expect(service.publishSignal(mockSignal)).rejects.toThrow(ServiceUnavailableException);
  });

  it('should throw ServiceUnavailableException on unexpected error', async () => {
    mockClient.emit.mockImplementation(() => {
      throw new Error('unexpected');
    });

    await expect(service.publishSignal(mockSignal)).rejects.toThrow(ServiceUnavailableException);
  });
});
