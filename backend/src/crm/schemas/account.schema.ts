import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AccountDocument = Account & Document<Types.ObjectId>;

@Schema({ timestamps: true, collection: 'crm_accounts' })
export class Account {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  domain?: string;

  @Prop()
  city?: string;

  @Prop()
  industry?: string;

  @Prop()
  revenue?: number;
}

export const AccountSchema = SchemaFactory.createForClass(Account);
