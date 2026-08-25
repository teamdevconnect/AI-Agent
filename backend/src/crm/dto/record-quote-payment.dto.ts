import { IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class RecordQuotePaymentDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @Matches(DATE, { message: 'paymentDate must be YYYY-MM-DD' })
  paymentDate: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
