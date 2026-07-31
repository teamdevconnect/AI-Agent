import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { OrganizationsService } from '../organizations/organizations.service';
import { UsersService } from '../users/users.service';
import { AssignDealDto } from './dto/assign-deal.dto';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { ListDealsQueryDto } from './dto/list-deals-query.dto';
import { ExportDealsQueryDto } from './dto/export-deals-query.dto';
import { DealsService } from './deals.service';
import { DealsExportService } from './deals-export.service';

const EXPORT_ROW_CAP = 5000;

// Native deal browsing/assignment for this app's own UI — deliberately
// separate from crm.controller.ts, which mirrors an external CRM's exact
// request/response contract for the AI tool-calling layer and must keep
// that shape untouched. This controller is free to use normal DTOs/roles.
//
// Route order matters: 'query'/'export' are static segments and must be
// registered before ':id', or a request to /crm/deals/query would match
// :id with id="query" instead (same rule tasks.controller.ts documents).
@UseGuards(JwtAuthGuard)
@Controller('crm/deals')
export class DealsController {
  constructor(
    private dealsService: DealsService,
    private dealsExportService: DealsExportService,
    private usersService: UsersService,
    private organizationsService: OrganizationsService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'manager')
  list(@CurrentUser() user: JwtPayload, @Query('storeId') storeIdOverride?: string) {
    const canOverride = user.roles.includes('admin') || user.roles.includes('owner');
    const storeId = (canOverride && storeIdOverride) || (!canOverride ? user.storeId : undefined);
    return this.dealsService.list(user.organizationId, storeId);
  }

  @Get('query')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'manager')
  listFiltered(@CurrentUser() user: JwtPayload, @Query() query: ListDealsQueryDto) {
    const canOverride = user.roles.includes('admin') || user.roles.includes('owner');
    const storeConstraint = canOverride ? undefined : user.storeId;
    return this.dealsService.listFiltered(user.organizationId, query, storeConstraint);
  }

  @Get('export')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'manager')
  async export(@CurrentUser() user: JwtPayload, @Query() query: ExportDealsQueryDto, @Res() res: Response) {
    const canOverride = user.roles.includes('admin') || user.roles.includes('owner');
    const storeConstraint = canOverride ? undefined : user.storeId;

    const [{ items, truncated }, users, stores] = await Promise.all([
      this.dealsService.listForExport(user.organizationId, query, storeConstraint, EXPORT_ROW_CAP),
      this.usersService.findAll(user.organizationId),
      this.organizationsService.listStores(user.organizationId),
    ]);
    const ownerNameById = new Map(users.map((u) => [u._id.toString(), u.name]));
    const storeNameById = new Map(stores.map((s) => [s._id.toString(), s.name]));
    const rows = this.dealsExportService.buildRows(items, ownerNameById, storeNameById);

    if (truncated) res.set('X-Export-Truncated', 'true');
    const filenameDate = query.dateFrom ?? 'all-time';

    if (query.format === 'csv') {
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="deals-${filenameDate}.csv"`,
      });
      res.send(this.dealsExportService.toCsv(rows));
      return;
    }

    if (query.format === 'xlsx') {
      const buffer = await this.dealsExportService.toExcel(rows);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="deals-${filenameDate}.xlsx"`,
      });
      res.send(buffer);
      return;
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="deals-${filenameDate}.pdf"`,
    });
    const doc = new PDFDocument();
    doc.pipe(res);
    this.dealsExportService.writePdf(doc, rows, query);
    doc.end();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'manager')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const canOverride = user.roles.includes('admin') || user.roles.includes('owner');
    const storeConstraint = canOverride ? undefined : user.storeId;
    return this.dealsService.findOne(id, user.organizationId, storeConstraint);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'manager')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDealDto) {
    const canOverride = user.roles.includes('admin') || user.roles.includes('owner');
    const storeConstraint = canOverride ? undefined : user.storeId;
    return this.dealsService.create(user.organizationId, dto, storeConstraint);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'manager')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateDealDto) {
    const canOverride = user.roles.includes('admin') || user.roles.includes('owner');
    const storeConstraint = canOverride ? undefined : user.storeId;
    return this.dealsService.update(id, user.organizationId, dto, storeConstraint);
  }

  @Patch(':id/assign')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'manager')
  assign(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AssignDealDto) {
    const canOverride = user.roles.includes('admin') || user.roles.includes('owner');
    const storeConstraint = canOverride ? undefined : user.storeId;
    return this.dealsService.assignOwner(id, user.organizationId, dto.ownerId ?? null, storeConstraint);
  }
}
