import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TagDocument = Tag & Document<Types.ObjectId>;

@Schema({ timestamps: true, collection: 'crm_tags' })
export class Tag {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: 'contact' })
  moduleName: string;
}

export const TagSchema = SchemaFactory.createForClass(Tag);
TagSchema.index({ organizationId: 1, name: 1, moduleName: 1 }, { unique: true });
