import { IsIn, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Matches the reference report's 4 grouping radios exactly: Sales/Quotes
// (the metric) crossed with Customer/User (the dimension).
export class GetGrossMarginReportQueryDto {
  @Matches(DATE, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom: string;

  @Matches(DATE, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo: string;

  @IsIn(['salesCustomer', 'salesUser', 'quotesCustomer', 'quotesUser'])
  groupBy: 'salesCustomer' | 'salesUser' | 'quotesCustomer' | 'quotesUser';
}
