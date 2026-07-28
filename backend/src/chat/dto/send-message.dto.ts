import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
<<<<<<< HEAD
=======

  @IsOptional()
  @IsString()
  agentId?: string;
>>>>>>> 6a60a8648 (Initial AI Agent source code)
}
