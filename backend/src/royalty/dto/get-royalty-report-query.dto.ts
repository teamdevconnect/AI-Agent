import { IsIn, IsOptional, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// dateFrom/dateTo are both required — an unbounded royalty report has no
// real business meaning (the whole concept is "royalty owed for this
// period"), so unlike most filter DTOs in this app they're not optional
// here. groupBy IS optional — omitting it returns the flat report exactly
// as before this field existed (backward compatible).
export class GetRoyaltyReportQueryDto {
  @Matches(DATE, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom: string;

  @Matches(DATE, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo: string;

  @IsOptional()
  @IsIn(['salesperson', 'customer'])
  groupBy?: 'salesperson' | 'customer';
}
