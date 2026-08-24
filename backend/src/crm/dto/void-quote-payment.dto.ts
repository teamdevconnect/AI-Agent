import { IsOptional, IsString } from 'class-validator';

export class VoidQuotePaymentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
