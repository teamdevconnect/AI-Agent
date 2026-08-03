import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FinancePresetDocument = FinancePreset & Document<Types.ObjectId>;

// Personal, not org/team-shared — same reasoning as
// deal-performance-preset.schema.ts (avoids a whose-preset-can-whom-edit
// permissions model this pass doesn't need).
@Schema({ timestamps: true, collection: 'finance_dashboard_presets' })
export class FinancePreset {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: Object, required: true })
  filters: Record<string, unknown>;

  @Prop({ type: [String], default: [] })
  hiddenWidgets: string[];
}

export const FinancePresetSchema = SchemaFactory.createForClass(FinancePreset);
FinancePresetSchema.index({ organizationId: 1, userId: 1, name: 1 }, { unique: true });
