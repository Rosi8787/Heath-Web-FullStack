import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'The email of the user',
    example: 'fatchur_rosi_33rpl@student.smktelkom-mlg.sch.id',
  })
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'The password of the user',
    example: 'Bakmi_123',
  })
  @IsNotEmpty()
  @IsString()
  password!: string;
}
