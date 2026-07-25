import { Injectable } from '@nestjs/common';
import { RedisService } from '@app/shared';

@Injectable()
export class AppService {
  constructor(private readonly redis: RedisService) {}

  async getHello(): Promise<string> {
    await this.redis.set('saludo', 'Hello World!', 3600);
    return 'Hello World!';
  }
}
