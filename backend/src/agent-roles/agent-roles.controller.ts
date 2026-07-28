import { FileInterceptor } from '@nestjs/platform-express';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { AgentRolesService } from './agent-roles.service';
import { UpdateAgentRoleDto } from './dto/update-agent-role.dto';

@UseGuards(JwtAuthGuard)
@Controller('agent-roles')
export class AgentRolesController {
  constructor(private agentRolesService: AgentRolesService) {}

  // Read-only, needed by every user's chat @mention widget — stays
  // unrestricted. generate/update/remove below create or change the AI
  // personas every user interacts with, so those are admin-only, same as
  // the equally sensitive integrations/store-settings mutations.
  @Get()
  list() {
    return this.agentRolesService.listAll();
  }

  @Post('generate')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  generate(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const bearerToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    return this.agentRolesService.generateDraft(user.sub, bearerToken, file);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateAgentRoleDto, @Req() req: Request) {
    const bearerToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    return this.agentRolesService.update(id, dto, bearerToken);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string, @Req() req: Request) {
    const bearerToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    return this.agentRolesService.remove(id, bearerToken);
  }
}
