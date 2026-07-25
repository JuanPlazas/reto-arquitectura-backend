import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

/**
 * Global module: available across all modules.
 */
@Global()
@Module({
  providers: [PrismaService, RedisService],
  exports: [PrismaService, RedisService],
})
export class SharedModule {}
