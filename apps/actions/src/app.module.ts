import { Module } from '@nestjs/common';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';
import { SharedModule } from '@app/shared';

@Module({
  imports: [SharedModule],
  controllers: [ActionsController],
  providers: [ActionsService],
})
export class AppModule {}
