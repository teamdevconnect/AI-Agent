import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsIn(['admin', 'agent_user', 'user'])
  role?: 'admin' | 'agent_user' | 'user';

  @IsOptional()
  @IsString()
  assignedAgentId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
