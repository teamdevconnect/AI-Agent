import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PaymentProviderKey } from '../providers/payment-provider.interface';

export type PaymentMethodDocument = PaymentMethod & Document<Types.ObjectId>;

// A saved/tokenized card for AutoPay off-session charges, against whichever
// gateway saved it. The gateway token itself is encrypted at rest via the
// existing EncryptionService — same pattern as
// IntegrationCredential.credentialsEncrypted.
@Schema({ timestamps: true, collection: 'payment_methods' })
export class PaymentMethod {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, enum: ['razorpay', 'stripe', 'cashfree'] })
  provider: PaymentProviderKey;

  @Prop({ required: true })
  gatewayCustomerId: string;

  @Prop({ required: true })
  gatewayTokenIdEncrypted: string;

  @Prop({ required: true })
  cardLast4: string;

  @Prop({ required: true })
  cardNetwork: string;

  @Prop({ default: true })
  isDefault: boolean;
}

export const PaymentMethodSchema = SchemaFactory.createForClass(PaymentMethod);
