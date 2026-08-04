import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DealPerformancePresetDocument = DealPerformancePreset & Document<Types.ObjectId>;

// Personal, not org/team-shared — avoids a whose-preset-can-whom-edit
// permissions model this pass doesn't need (see Phase 9a plan notes).
// Widget visibility rides inside the preset rather than a separate "last
// used" doc; unsaved in-session filter/visibility state is pure frontend
// state, no backend doc for "current."
@Schema({ timestamps: true, collection: 'deal_performance_presets' })
export class DealPerformancePreset {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  name: string;

  // Serialized DealFilterQueryDto — stored as opaque JSON so the preset
  // schema never has to change in lockstep with the filter DTO's shape.
  @Prop({ type: Object, required: true })
  filters: Record<string, unknown>;

  // Widget keys toggled off; [] = every widget visible.
  @Prop({ type: [String], default: [] })
  hiddenWidgets: string[];
}

export const DealPerformancePresetSchema = SchemaFactory.createForClass(DealPerformancePreset);
DealPerformancePresetSchema.index({ organizationId: 1, userId: 1, name: 1 }, { unique: true });
