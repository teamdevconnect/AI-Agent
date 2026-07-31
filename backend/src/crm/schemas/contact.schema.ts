import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ContactDocument = Contact & Document<Types.ObjectId>;

// Field names mirror what python-agent's crm_contact tool already sends/expects
// (see python-agent/app/tools/crm_tool.py) — this is the native backing store
// used when an org hasn't connected an external CRM; keeping the same
// vocabulary means the tool's request/response shape never has to branch on
// which backend it's actually talking to.
@Schema({ timestamps: true, collection: 'crm_contacts' })
export class Contact {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop()
  storeId?: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  name?: string;

  @Prop({ index: true })
  email?: string;

  @Prop({ index: true })
  phone?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  stageId?: string;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);
