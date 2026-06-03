import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  PASSWORD_REGEX,
  PASSWORD_MESSAGE,
} from '../../common/constants/password.constant';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Password lama user',
    example: 'oldPassword123',
  })
  @IsNotEmpty()
  @IsString()
  oldPassword!: string;

  @ApiProperty({
    description: 'Password baru (minimal 8 karakter, kombinasi huruf dan angka)',
    example: 'newPassword456',
    minLength: 8,
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
}