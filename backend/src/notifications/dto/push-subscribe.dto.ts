import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PushKeysDto {
  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}

// Matches the browser's own PushSubscription.toJSON() shape exactly — no
// remapping needed between what the frontend's subscribe() call produces
// and what this DTO validates.
export class PushSubscribeDto {
  @IsString()
  endpoint: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

export class PushUnsubscribeDto {
  @IsString()
  endpoint: string;
}
