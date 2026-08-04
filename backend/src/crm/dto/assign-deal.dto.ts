import { IsOptional, IsString } from 'class-validator';

export class AssignDealDto {
  // Explicit null unassigns; omitting the field is not a valid call for this
  // endpoint (the frontend always sends one or the other).
  @IsOptional()
  @IsString()
  ownerId?: string | null;
}
