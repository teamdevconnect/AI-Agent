import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NoteDocument = Note & Document<Types.ObjectId>;

@Schema({ timestamps: true, collection: 'crm_notes' })
export class Note {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  contactId: string;

  @Prop()
  dealId?: string;

  @Prop()
  accountId?: string;

  @Prop({ required: true })
  body: string;

  @Prop()
  createdBy?: string;
}

export const NoteSchema = SchemaFactory.createForClass(Note);
