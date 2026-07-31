import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { UpdateWorkflowDefinitionDto } from './dto/update-workflow-definition.dto';
import { WorkflowsService } from './workflows.service';

// Org-wide automation config — admin-only, same tier as Sales Targets/Deal
// Assignment/Command Center (not a per-store or per-employee concern).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('workflows')
export class WorkflowsController {
  constructor(private workflowsService: WorkflowsService) {}

  private bearerToken(req: Request): string {
    return (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.workflowsService.list(user.organizationId);
  }

  @Get('available')
  listAvailable(@Req() req: Request) {
    return this.workflowsService.listAvailable(this.bearerToken(req));
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWorkflowDefinitionDto, @Req() req: Request) {
    return this.workflowsService.create(dto, user.organizationId, user.sub, this.bearerToken(req));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDefinitionDto,
    @Req() req: Request,
  ) {
    return this.workflowsService.update(id, dto, user.organizationId, this.bearerToken(req));
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.workflowsService.remove(id, user.organizationId);
  }

  @Post(':id/run')
  runNow(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.workflowsService.runNow(id, user.organizationId);
  }

  @Get(':id/executions')
  listExecutions(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.workflowsService.listExecutions(id, user.organizationId);
  }
}
