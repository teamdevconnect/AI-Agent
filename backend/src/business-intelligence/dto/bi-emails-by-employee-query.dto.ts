import { IsIn } from 'class-validator';
import { BiFilterQueryDto } from './bi-filter-query.dto';

export class BiEmailsByEmployeeQueryDto extends BiFilterQueryDto {
  @IsIn(['sent', 'missed'])
  kind: 'sent' | 'missed';
}
