import { IsString } from 'class-validator';

export class TwoFactorLoginVerifyDto {
  @IsString()
  challengeToken: string;

  @IsString()
  code: string;
}
