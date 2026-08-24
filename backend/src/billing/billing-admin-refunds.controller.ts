import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RefundService } from './refund.service';

// Phase 6 admin surface — platform_admin only, matching every other
// billing-admin-*.controller.ts's gate. A refund moves real money back out
// through the original gateway and claws back wallet credits — the
// strictest-consequence admin action in this module, same RBAC tier as
// billing-admin.controller.ts's provider cost/revenue view.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('billing/admin/refunds')
export class BillingAdminRefundsController {
  constructor(private refundService: RefundService) {}

  @Get()
  list(@Query('organizationId') organizationId?: string, @Query('paymentRecordId') paymentRecordId?: string, @Query('limit') limit?: string) {
    return this.refundService.listRefunds({ organizationId, paymentRecordId, limit: limit ? Number.parseInt(limit, 10) : undefined });
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRefundDto) {
    return this.refundService.refundPayment(dto.paymentRecordId, user.sub, { amount: dto.amount, reason: dto.reason });
  }
}
