import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ListQuotesQueryDto } from './dto/list-quotes-query.dto';
import { QuotesService } from './quotes.service';

// Phase 19 — the Unified Analytics Dashboard's quote drill-down. Same
// role/scope shape as DealsController's own /query route: owner/admin see
// the whole org, manager is store-constrained (via the linked deal),
// consultant is self-constrained (via the linked deal's ownerId) —
// server-forced, never client-supplied.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crm/quotes')
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  @Get('query')
  @Roles('owner', 'admin', 'manager', 'consultant')
  listFiltered(@CurrentUser() user: JwtPayload, @Query() query: ListQuotesQueryDto) {
    const canOverride = user.roles.includes('admin') || user.roles.includes('owner');
    // Owner/admin may optionally narrow to one store (matches the dashboard's
    // own store-select override); a manager's store is always server-forced.
    const storeConstraint = canOverride ? query.storeId : user.roles.includes('manager') ? user.storeId : undefined;
    const ownerConstraint = !canOverride && user.roles.includes('consultant') ? user.sub : undefined;
    return this.quotesService.listFiltered(user.organizationId, query, storeConstraint, ownerConstraint);
  }
}
