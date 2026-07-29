import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SignalDto } from '@app/shared';
import { IngestionService } from './ingestion.service';

@ApiTags('Signals')
@Controller('signals')
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(private readonly ingestionService: IngestionService) {}

  @Post()
  @ApiOperation({ summary: 'Receive vehicle signals' })
  @ApiResponse({ status: 202, description: 'Request accepted for processing' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 503, description: 'Service unavailable' })
  @ApiBody({ type: SignalDto })
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestSignal(@Body() signalDto: SignalDto) {
    this.logger.log(`Received signal from vehicle ${signalDto.vehicleId} type ${signalDto.type}`);

    await this.ingestionService.publishSignal(signalDto);

    return { status: 'accepted' };
  }
}
