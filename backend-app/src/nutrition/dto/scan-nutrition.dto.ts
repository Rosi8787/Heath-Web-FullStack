import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanNutritionDto {
  @ApiProperty({
    description: 'Nama produk (optional jika scan gambar, wajib jika manual input)',
    example: 'Coca Cola',
    required: false,
  })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiProperty({
    description: 'Kandungan gula dalam gram (optional jika scan gambar, wajib jika manual input)',
    example: 12.5,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sugar?: number;
}