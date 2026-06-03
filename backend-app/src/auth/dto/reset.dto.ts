import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

import {
  PASSWORD_REGEX,
  PASSWORD_MESSAGE,
} from '../../common/constants/password.constant';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'The email of the user',
    example: 'john.doe@example.com',
  })  
  @IsNotEmpty()
  @IsEmail()
  email!: string;
  
  @ApiProperty({
    description: 'The OTP sent to the user',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  otp!: string;

  @ApiProperty({
    description: 'The new password for the user',
    example: 'NewPassword123!',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters',
  })
  @Matches(PASSWORD_REGEX, {
    message: PASSWORD_MESSAGE,
  })
  newPassword!: string;

  @ApiProperty({
    description: 'Confirmation of the new password',
    example: 'NewPassword123!',
  })
  @IsNotEmpty()
  @IsString()
  confirmPassword!: string;
}
