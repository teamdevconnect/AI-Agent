import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { AutoPayService } from './autopay.service';
import { BillingService } from './billing.service';
import { ReservationService } from './reservation.service';
import { AutoPaySettingsDto } from './dto/autopay-settings.dto';
import { ConfirmPurchaseDto } from './dto/confirm-purchase.dto';
import { PurchasePackageDto } from './dto/purchase-package.dto';
import { RequestIdDto } from './dto/request-id.dto';
import { ReserveCreditsDto } from './dto/reserve-credits.dto';
import { SavePaymentMethodDto } from './dto/save-payment-method.dto';

// Every route here is JwtAuthGuard-only (no @Roles) — reserve/settle/release
// are called by python-agent's service-role bridge token (see
// integration_executor.py's identical pattern for /integrations/execute),
// and the rest are ordinary customer-facing routes any authenticated org
// member can use. Nothing here ever returns a provider name/model/cost —
// see billing.service.ts's listCustomerTransactions for the enforcement
// point.
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private billingService: BillingService,
    private reservationService: ReservationService,
    private autoPayService: AutoPayService,
  ) {}

  @Get('wallet')
  getWallet(@CurrentUser() user: JwtPayload) {
    return this.billingService.getWalletSummary(user.organizationId);
  }

  @Get('packages')
  listPackages() {
    return this.billingService.listPackages();
  }

  @Get('usage/summary')
  getUsageSummary(@CurrentUser() user: JwtPayload) {
    return this.billingService.getUsageSummary(user.organizationId);
  }

  @Get('transactions')
  listTransactions(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.billingService.listCustomerTransactions(user.organizationId, limit ? Number.parseInt(limit, 10) : undefined);
  }

  @Get('payment-methods')
  listPaymentMethods(@CurrentUser() user: JwtPayload) {
    return this.billingService.listPaymentMethods(user.organizationId);
  }

  @Post('payment-methods')
  savePaymentMethod(@CurrentUser() user: JwtPayload, @Body() dto: SavePaymentMethodDto) {
    return this.billingService.savePaymentMethod(
      user.organizationId,
      dto.gatewayCustomerId,
      dto.gatewayPaymentId ?? '',
      dto.signature ?? '',
      dto.gatewayOrderId ?? '',
    );
  }

  @Delete('payment-methods/:id')
  deletePaymentMethod(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.billingService.deletePaymentMethod(user.organizationId, id);
  }

  @Post('credits/purchase')
  purchase(@CurrentUser() user: JwtPayload, @Body() dto: PurchasePackageDto) {
    return this.billingService.initiatePurchase(user.organizationId, user.sub, dto.packageKey);
  }

  // Called right after a real (non-simulated) checkout's client-side
  // success handler fires — closes the loop without needing a publicly
  // reachable webhook URL. See billing.service.ts's confirmPurchase for
  // why this can't be spoofed into granting free credits.
  @Post('credits/confirm-purchase')
  confirmPurchase(@CurrentUser() user: JwtPayload, @Body() dto: ConfirmPurchaseDto) {
    return this.billingService.confirmPurchase(user.organizationId, user.sub, dto.paymentRecordId, dto.gatewayPaymentId, dto.signature ?? '');
  }

  @Get('autopay')
  getAutoPay(@CurrentUser() user: JwtPayload) {
    return this.billingService.getWalletSummary(user.organizationId).then((w) => w.autoPay);
  }

  @Put('autopay')
  async updateAutoPay(@CurrentUser() user: JwtPayload, @Body() dto: AutoPaySettingsDto) {
    const wallet = await this.autoPayService.updateSettings(user.organizationId, dto);
    return wallet.autoPay;
  }

  // --- Service-to-service (python-agent's billing bridge) ---

  @Post('credits/reserve')
  reserve(@CurrentUser() user: JwtPayload, @Body() dto: ReserveCreditsDto) {
    return this.reservationService.reserve(user.organizationId, user.sub, dto.requestId, dto.conversationId);
  }

  @Post('credits/settle')
  settle(@Body() dto: RequestIdDto) {
    return this.reservationService.settle(dto.requestId);
  }

  @Post('credits/release')
  release(@Body() dto: RequestIdDto) {
    return this.reservationService.release(dto.requestId);
  }
}
