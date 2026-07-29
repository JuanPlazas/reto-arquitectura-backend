import { PrismaService } from './prisma.service';
import { describe, expect, it, jest } from '@jest/globals';

describe('PrismaService', () => {
  it('should call $connect on module init', async () => {
    const service = new PrismaService();
    const connectSpy = jest.spyOn(service as any, '$connect').mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalled();
  });

  it('should call $disconnect on module destroy', async () => {
    const service = new PrismaService();
    const disconnectSpy = jest.spyOn(service as any, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalled();
  });
});
