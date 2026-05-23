import {
  IsNotEmpty,
  IsString,
} from "class-validator";

export class ScanNutritionDto {

  @IsString()
    @IsNotEmpty()
    productName!: string;

}