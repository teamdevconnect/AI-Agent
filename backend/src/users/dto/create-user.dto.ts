import { IsEmail, IsIn, IsString, MinLength, ValidateIf } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsIn(['admin', 'agent_user', 'user'])
  role: 'admin' | 'agent_user' | 'user';

  @ValidateIf((o: CreateUserDto) => o.role === 'agent_user')
  @IsString()
  assignedAgentId?: string;
}
