import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CustomerActivityService } from '../crm/customer-activity.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { EmailIntelligenceService } from './email-intelligence.service';

// No @Roles()/RolesGuard anywhere in this controller — every authenticated
// user, self-scoped via their own JWT sub. Each item belongs to exactly one
// mailbox owner; there is no org-wide oversight view in this pass (see
// Phase 14b plan notes).
@UseGuards(JwtAuthGuard)
@Controller('email-intelligence')
export class EmailIntelligenceController {
  constructor(
    private emailIntelligenceService: EmailIntelligenceService,
    private customerActivityService: CustomerActivityService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('status') status?: 'pending' | 'approved' | 'rejected') {
    return this.emailIntelligenceService.list(user.sub, status);
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.emailIntelligenceService.getOne(user.sub, id);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { finalDraftReply?: string }) {
    return this.emailIntelligenceService.approve(user.sub, id, body?.finalDraftReply);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.emailIntelligenceService.reject(user.sub, id, body?.reason);
  }

  // Phase 14d — the only route that actually dispatches a real email. No
  // additional safety gate here beyond the existing approved/self-scoped
  // checks in the service — the frontend's own confirmation prompt is the
  // deliberate human-in-the-loop step (see plan notes: approve and send are
  // two separate explicit actions, never combined).
  @Post(':id/send')
  send(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.emailIntelligenceService.send(user.sub, id);
  }

  @Post(':id/regenerate')
  async regenerate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    // CRM data may have changed since ingest — refetch a fresh correlation
    // context for this one on-demand action, same cost/effort as one poll
    // tick's per-org gather (not run in a loop here, just once).
    const context = await this.customerActivityService.gatherCorrelationContext(user.organizationId);
    return this.emailIntelligenceService.regenerate(user.sub, id, context);
  }
}
