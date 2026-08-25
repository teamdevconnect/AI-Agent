import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';
import { InvoiceCounter, InvoiceCounterDocument } from './schemas/invoice-counter.schema';
import { Quote, QuoteDocument } from '../crm/schemas/quote.schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { buildInvoiceMatchStage } from './invoice-filter.util';

export interface CreateDraftInvoiceFromQuoteInput {
  quoteId: string;
  dealId?: string;
  storeId?: string;
  salespersonId?: string;
  quoteAmount: number;
  clientDetails?: { companyName?: string; contactName?: string; email?: string; phone?: string };
  currency?: string;
  createdBy: string;
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(InvoiceCounter.name) private counterModel: Model<InvoiceCounterDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
  ) {}

  // Quote.paidAmount's single source of truth, replacing the old manual
  // "Record a Payment" popup on the Dashboard's Pipeline & Quotes tab (users
  // don't want to type in a payment figure by hand — they want it to follow
  // whatever finance already marks the real Invoice as). A quote is only
  // ever "paid" when its linked Invoice's own status says so, and a voided
  // invoice can never count even if its status happens to still say 'paid'.
  // currentValue (not quoteAmount) is used so a revised invoice amount is
  // what actually gets reflected as collected. Fires from every write path
  // below that can change invoiceStatus/currentValue/voidStatus, so it can
  // never drift out of sync with what's actually stored.
  private async syncQuotePaidAmount(organizationId: string, invoice: Pick<Invoice, 'quoteId' | 'invoiceStatus' | 'currentValue' | 'voidStatus'>): Promise<void> {
    if (!invoice.quoteId) return;
    const isPaid = invoice.invoiceStatus === 'paid' && !invoice.voidStatus;
    await this.quoteModel
      .updateOne({ _id: invoice.quoteId, organizationId }, { $set: { paidAmount: isPaid ? invoice.currentValue : 0 } })
      .exec();
  }

  list(organizationId: string, storeConstraint?: string) {
    return this.invoiceModel
      .find({ organizationId, ...(storeConstraint ? { storeId: storeConstraint } : {}) })
      .sort({ invoiceDate: -1 })
      .exec();
  }

  async listFiltered(organizationId: string, query: ListInvoicesQueryDto, storeConstraint?: string) {
    const match = buildInvoiceMatchStage(organizationId, query, storeConstraint);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const sortBy = query.sortBy ?? 'invoiceDate';
    const sortDir = query.sortDir === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.invoiceModel
        .find(match)
        .sort({ [sortBy]: sortDir })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.invoiceModel.countDocuments(match).exec(),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string, organizationId: string, storeConstraint?: string) {
    const filter = { _id: id, organizationId, ...(storeConstraint ? { storeId: storeConstraint } : {}) };
    const invoice = await this.invoiceModel.findOne(filter).exec();
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(organizationId: string, dto: CreateInvoiceDto, storeConstraint: string | undefined, createdBy: string) {
    const invoiceNumber = await this.nextInvoiceNumber(organizationId);
    const { value, invoiceDate, storeId, ...rest } = dto;
    const invoice = await this.invoiceModel.create({
      organizationId,
      ...rest,
      storeId: storeConstraint ?? storeId,
      invoiceNumber,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      originalValue: value,
      currentValue: value,
      currency: dto.currency ?? 'INR',
      invoiceStatus: 'draft',
      voidStatus: false,
      source: 'manual',
      createdBy,
    });
    await this.syncQuotePaidAmount(organizationId, invoice);
    return invoice;
  }

  // storeConstraint, when passed, scopes the match itself (not just the
  // input) — a manager can only ever touch an invoice actually in their own
  // store, regardless of what the caller claims. Same pattern as
  // deals.service.ts's update()/assignOwner().
  async update(id: string, organizationId: string, dto: UpdateInvoiceDto, storeConstraint?: string) {
    const filter = { _id: id, organizationId, ...(storeConstraint ? { storeId: storeConstraint } : {}) };
    const { value, invoiceDate, ...rest } = dto;
    const staticSet: Record<string, unknown> = { ...rest };
    if (invoiceDate) staticSet.invoiceDate = new Date(invoiceDate);

    let updated: InvoiceDocument | null;
    if (value !== undefined) {
      // Atomic aggregation-pipeline update — shifts currentValue into
      // previousValue before applying the new value, in one round trip, so
      // the revision can never be observed half-applied.
      updated = await this.invoiceModel
        .findOneAndUpdate(filter, [{ $set: { ...staticSet, previousValue: '$currentValue', currentValue: value } }], {
          new: true,
        })
        .exec();
    } else {
      updated = await this.invoiceModel.findOneAndUpdate(filter, { $set: staticSet }, { new: true }).exec();
    }
    if (!updated) throw new NotFoundException('Invoice not found');
    await this.syncQuotePaidAmount(organizationId, updated);
    return updated;
  }

  async voidInvoice(id: string, organizationId: string, dto: VoidInvoiceDto, storeConstraint?: string) {
    const filter = { _id: id, organizationId, ...(storeConstraint ? { storeId: storeConstraint } : {}) };
    const updated = await this.invoiceModel
      .findOneAndUpdate(
        filter,
        { $set: { voidStatus: true, voidDate: new Date(), voidReason: dto.voidReason } },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Invoice not found');
    await this.syncQuotePaidAmount(organizationId, updated);
    return updated;
  }

  // Dormant in Phase 20a — no live caller yet. Kept ready for a future
  // native Quote-approval path, mirroring QuotesService.createDraftQuote's
  // exact atomic-counter + honest-fields shape (originalValue/currentValue
  // is the Quote's own real accepted amount, never fabricated). The live
  // trigger for this org's real production data is python-agent's
  // crm_mongo_sync.py, which writes directly via pymongo (see that file's
  // sync_quotes_for_org / _draft_invoice_for_approved_quote).
  async createDraftFromQuote(organizationId: string, input: CreateDraftInvoiceFromQuoteInput) {
    const invoiceNumber = await this.nextInvoiceNumber(organizationId);
    const invoice = await this.invoiceModel.create({
      organizationId,
      storeId: input.storeId,
      dealId: input.dealId,
      quoteId: input.quoteId,
      invoiceNumber,
      clientDetails: input.clientDetails,
      salespersonId: input.salespersonId,
      invoiceDate: new Date(),
      originalValue: input.quoteAmount,
      currentValue: input.quoteAmount,
      currency: input.currency ?? 'INR',
      invoiceStatus: 'draft',
      voidStatus: false,
      source: 'auto_from_quote',
      createdBy: input.createdBy,
    });
    await this.syncQuotePaidAmount(organizationId, invoice);
    return invoice;
  }

  private async nextInvoiceNumber(organizationId: string): Promise<string> {
    const counter = await this.counterModel
      .findOneAndUpdate({ organizationId }, { $inc: { seq: 1 } }, { upsert: true, new: true })
      .exec();
    return `INV-${String(counter.seq).padStart(4, '0')}`;
  }
}
