import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentExecution, AgentExecutionSchema } from '../command-center/schemas/agent-execution.schema';
import { CommandCenterModule } from '../command-center/command-center.module';
import { Organization, OrganizationSchema } from '../organizations/schemas/organization.schema';
import { AutoPayService } from './autopay.service';
import { BillingAdminController } from './billing-admin.controller';
import { BillingAdminService } from './billing-admin.service';
import { BillingSeedService } from './billing-seed.service';
import { BillingWebhookController } from './billing-webhook.controller';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { CashfreePaymentProvider } from './providers/cashfree-payment.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { paymentProviderFactory } from './providers/payment-provider.factory';
import { RazorpayPaymentProvider } from './providers/razorpay-payment.provider';
import { StripePaymentProvider } from './providers/stripe-payment.provider';
import { PricingService } from './pricing.service';
import { ReservationService } from './reservation.service';
import { WalletService } from './wallet.service';
import { CreditPackage, CreditPackageSchema } from './schemas/credit-package.schema';
import { CreditReservation, CreditReservationSchema } from './schemas/credit-reservation.schema';
import { PaymentMethod, PaymentMethodSchema } from './schemas/payment-method.schema';
import { PaymentRecord, PaymentRecordSchema } from './schemas/payment-record.schema';
import { ProviderPricing, ProviderPricingSchema } from './schemas/provider-pricing.schema';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { WalletTransaction, WalletTransactionSchema } from './schemas/wallet-transaction.schema';
import { WebhookEvent, WebhookEventSchema } from './schemas/webhook-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: CreditReservation.name, schema: CreditReservationSchema },
      { name: CreditPackage.name, schema: CreditPackageSchema },
      { name: ProviderPricing.name, schema: ProviderPricingSchema },
      { name: PaymentMethod.name, schema: PaymentMethodSchema },
      { name: PaymentRecord.name, schema: PaymentRecordSchema },
      { name: WebhookEvent.name, schema: WebhookEventSchema },
      // Registered here too (already registered in CommandCenterModule) —
      // Mongoose doesn't mind the same schema/collection being bound to a
      // model in more than one module; ReservationService/BillingAdminService
      // need their own injectable Model<AgentExecutionDocument>.
      { name: AgentExecution.name, schema: AgentExecutionSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    CommandCenterModule,
  ],
  controllers: [BillingController, BillingAdminController, BillingWebhookController],
  providers: [
    PricingService,
    WalletService,
    ReservationService,
    AutoPayService,
    BillingService,
    BillingAdminService,
    BillingSeedService,
    RazorpayPaymentProvider,
    StripePaymentProvider,
    CashfreePaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: paymentProviderFactory,
      inject: [ConfigService, RazorpayPaymentProvider, StripePaymentProvider, CashfreePaymentProvider],
    },
  ],
})
export class BillingModule {}
