import { IsArray, IsObject, IsString } from 'class-validator';

export class UpsertDealPerformancePresetDto {
  @IsString()
  name: string;

  @IsObject()
  filters: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  hiddenWidgets: string[];
}
