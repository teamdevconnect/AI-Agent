import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { ListDealsQueryDto } from './list-deals-query.dto';

function toBool({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true';
}

// GET /crm/deals/assignment's own query shape — everything ListDealsQueryDto
// already validates (search/filters/pagination/sort), plus needsMapping,
// which is specific to the Deal Assignment page's "assigned vs. still needs
// a mapping" concept and has no meaning for /crm/deals/query's other
// consumer (see deal-owner-mapping.service.ts's listDealsForAssignment).
export class ListAssignmentDealsQueryDto extends ListDealsQueryDto {
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  needsMapping?: boolean;
}
