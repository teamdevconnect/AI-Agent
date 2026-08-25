import { IsString, MaxLength } from 'class-validator';

export class VoidInvoiceDto {
  @IsString()
  @MaxLength(500)
  voidReason: string;
}
