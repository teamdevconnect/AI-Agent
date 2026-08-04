import { FilterQuery } from 'mongoose';
import { BusinessKnowledgeDocument } from './schemas/business-knowledge-document.schema';
import { BusinessKnowledgeDocumentFilterQueryDto } from './dto/business-knowledge-document-filter-query.dto';

// Single place the Mongo match stage gets built from a filter DTO — mirrors
// crm/deal-filter.util.ts and finance/finance-filter.util.ts's identical
// convention so list semantics never drift between callers.
export function buildBusinessKnowledgeDocumentMatchStage(
  organizationId: string,
  filters: BusinessKnowledgeDocumentFilterQueryDto,
): FilterQuery<BusinessKnowledgeDocument> {
  const match: FilterQuery<BusinessKnowledgeDocument> = { organizationId };

  if (filters.assetType?.length) match.assetType = { $in: filters.assetType };
  if (filters.extractionStatus) match.extractionStatus = filters.extractionStatus;
  if (filters.reviewStatus) match.reviewStatus = filters.reviewStatus;
  if (filters.search) {
    const re = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [{ title: re }, { originalFilename: re }];
  }

  return match;
}
