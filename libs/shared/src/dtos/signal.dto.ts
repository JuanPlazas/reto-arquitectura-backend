import {
  IsNumber,
  IsOptional,
  IsObject,
  IsNotEmpty,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { SignalType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignalDto {
  @ApiProperty({ description: 'Vehicle ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  vehicleId: number;

  @ApiProperty({ description: 'Geographic latitude', example: 4.6097 })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ description: 'Geographic longitude', example: -74.0817 })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiProperty({ description: 'Heading in degrees (0-360)', example: 90 })
  @IsNumber()
  @IsNotEmpty()
  direction: number;

  @ApiProperty({ description: 'Current speed in km/h', example: 60 })
  @IsNumber()
  @IsNotEmpty()
  speed: number;

  @ApiProperty({
    description: 'Signal type',
    enum: SignalType,
    example: 'LOCATION',
  })
  @IsEnum(SignalType)
  @IsNotEmpty()
  type: SignalType;

  @ApiPropertyOptional({
    description: 'Metadata (e.g., { temp: "200°C", water: "min" })',
    example: { battery: '5%' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Signal date and time (ISO 8601)',
    example: '2023-11-30T10:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  receivedAt: Date;
}
