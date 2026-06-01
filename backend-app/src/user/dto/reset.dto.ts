import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

import {
  PASSWORD_REGEX,
  PASSWORD_MESSAGE,
} from '../../common/constants/password.constant';

export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  oldPassword!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters',
  })
  @Matches(PASSWORD_REGEX, {
    message: PASSWORD_MESSAGE,
  })
  newPassword!: string;
}
