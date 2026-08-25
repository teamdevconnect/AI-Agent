import { IsString, MinLength } from 'class-validator';

export class GenerateFromDescriptionDto {
  @IsString()
  @MinLength(10)
  description: string;
}
