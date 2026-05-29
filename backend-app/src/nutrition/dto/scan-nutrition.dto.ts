import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class ScanNutritionDto {

  // OPTIONAL
  // karena kadang user scan dulu
  @IsOptional()
  @IsString()
  productName?: string;

  // OPTIONAL
  // karena kadang OCR berhasil
  // kadang user input manual
  @IsOptional()
  @IsNumber()
  sugar?: number;
}