import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

import {
  PASSWORD_REGEX,
  PASSWORD_MESSAGE,
} from '../../common/constants/password.constant';

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  otp!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters',
  })
  @Matches(PASSWORD_REGEX, {
    message: PASSWORD_MESSAGE,
  })
  newPassword!: string;

  @IsNotEmpty()
  @IsString()
  confirmPassword!: string;
}
