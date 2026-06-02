import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ScanNutritionDto {
  // OPTIONAL
  // karena kadang user scan dulu
  @IsOptional()
  @IsString()
  productName?: string;

  // OPTIONAL
  // karena kadang OCR berhasil
  // kadang user input manual
  
  // @Type(() => Number)
  @IsOptional()
  @IsNumber()
  sugar?: number;
}
