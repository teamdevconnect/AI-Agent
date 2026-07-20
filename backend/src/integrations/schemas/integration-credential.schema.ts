import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type IntegrationCredentialDocument = IntegrationCredential & Document<Types.ObjectId>;

@Schema({ timestamps: true, collection: 'integration_credentials' })
export class IntegrationCredential {
  @Prop({ required: true, unique: true, index: true })
  provider: string;

  @Prop({ required: true })
  apiKey: string;

  @Prop()
  baseUrl?: string;
}

export const IntegrationCredentialSchema = SchemaFactory.createForClass(IntegrationCredential);
