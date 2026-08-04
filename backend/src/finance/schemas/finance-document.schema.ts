import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FinanceDocumentDocument = FinanceDocument & Document<Types.ObjectId>;

// Finance is organization-level, not store-level, in Phase 10a — RBAC
// (owner/admin only) already means every viewer sees the whole org, so
// there's no narrower scope to attach. A store-scoped view is a deliberate
// deferral, not an oversight.
@Schema({ timestamps: true, collection: 'finance_documents' })
export class FinanceDocument {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  uploadedBy: string;

  // ---- file / storage ----
  @Prop({ required: true })
  originalFilename: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  fileSizeBytes: number;

  // GridFS file id (finance-gridfs.service.ts) — stored as a string for
  // consistency with every other id field in this app.
  @Prop({ required: true })
  gridFsFileId: string;

  @Prop({ enum: ['pdf', 'image', 'xlsx', 'xls', 'csv', 'docx'], required: true })
  documentFormat: 'pdf' | 'image' | 'xlsx' | 'xls' | 'csv' | 'docx';

  // ---- processing lifecycle ----
  @Prop({ enum: ['processing', 'completed', 'failed'], default: 'processing', index: true })
  extractionStatus: 'processing' | 'completed' | 'failed';

  @Prop()
  extractionError?: string;

  // Never a gate on dashboard totals — a document counts the instant
  // extraction completes, regardless of human review (see Phase 10a plan
  // notes: same "show real data immediately, surface incompleteness
  // visibly" principle as Deal Performance's coverage tracking). This field
  // only drives a "needs review" banner/count.
  @Prop({ enum: ['needs_review', 'reviewed'], default: 'needs_review', index: true })
  reviewStatus: 'needs_review' | 'reviewed';

  @Prop()
  reviewedBy?: string;

  @Prop()
  reviewedAt?: Date;

  // ---- extracted structured fields ----
  @Prop()
  vendorName?: string;

  @Prop({ index: true })
  vendorId?: string;

  @Prop()
  invoiceNumber?: string;

  @Prop()
  poNumber?: string;

  // "YYYY-MM-DD" — the period-attribution field for trends, same convention
  // as Deal.expectedClosingDate.
  @Prop()
  invoiceDate?: string;

  @Prop()
  dueDate?: string;

  @Prop()
  paymentDate?: string;

  @Prop({ default: 0 })
  paymentAmount: number;

  @Prop({ default: 'INR' })
  currency: string;

  @Prop({ default: 0 })
  taxAmount: number;

  @Prop({ type: Object })
  taxDetails?: {
    gstAmount?: number;
    vatAmount?: number;
    taxRatePct?: number;
    taxType?: string;
  };

  @Prop({ default: 0 })
  deliveryCharges: number;

  @Prop({ default: false, index: true })
  isSubscriptionPayment: boolean;

  @Prop()
  subscriptionProvider?: string;

  @Prop({ default: 0 })
  subscriptionCharges: number;

  // Plain string, vocabulary enforced at the DTO layer — same "no schema
  // migration for new categories" convention as Deal.leadSource/product.
  @Prop()
  paymentMethod?: string;

  @Prop({ type: Object })
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifscOrSwift?: string;
    accountHolderName?: string;
  };

  @Prop()
  department?: string;

  @Prop()
  costCenter?: string;

  // Genuinely fixed/structural — drives which dashboard bucket a doc falls
  // into — so a real Mongoose enum, unlike the free-text dimensions above.
  @Prop({ enum: ['paid', 'pending', 'overdue', 'partially_paid', 'cancelled'], default: 'pending', index: true })
  paymentStatus: 'paid' | 'pending' | 'overdue' | 'partially_paid' | 'cancelled';

  // AI-classified, plain string.
  @Prop({ index: true })
  expenseCategory?: string;

  @Prop({ type: Object, default: {} })
  otherFinancialInfo: Record<string, unknown>;

  @Prop()
  aiSummary?: string;

  @Prop({ type: [String], default: [] })
  missingFields: string[];

  @Prop({ type: [String], default: [] })
  inconsistencyNotes: string[];

  // ---- Phase 10b forward-pointers: land now, unpopulated until 10b's
  // duplicate-detection logic ships — same pattern as Deal.lostReason/
  // lostReasonSource landing in 9a ahead of 9b's UI/inference. ----
  @Prop({ default: false, index: true })
  possibleDuplicate: boolean;

  @Prop()
  duplicateOfDocumentId?: string;

  // ---- RAG linkage ----
  @Prop()
  vectorDocumentId?: string;

  @Prop({ default: 0 })
  vectorChunkCount: number;
}

export const FinanceDocumentSchema = SchemaFactory.createForClass(FinanceDocument);
FinanceDocumentSchema.index({ organizationId: 1, createdAt: -1 });
FinanceDocumentSchema.index({ organizationId: 1, paymentStatus: 1 });
FinanceDocumentSchema.index({ organizationId: 1, vendorName: 1 });
FinanceDocumentSchema.index({ organizationId: 1, expenseCategory: 1 });
