import { IsString, MinLength } from 'class-validator';

export class PurchasePackageDto {
  @IsString()
  @MinLength(1)
  packageKey: string;
}
