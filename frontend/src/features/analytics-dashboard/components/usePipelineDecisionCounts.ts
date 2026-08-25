import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dealsService, type Deal } from '@/services/dealsService';
import { quotesService } from '@/services/quotesService';

export interface PipelineDecisionCounts {
  // Open deals whose linked quote hasn't been approved by the client yet —
  // same real join DealsNeedingDecisionTable uses (dealsService + quotesService,
  // no dedicated backend endpoint for this exact cross-reference).
  awaitingResponseCount: number;
  // Additive — the real deal records behind the two derived buckets, so
  // DealFunnelCard/DealStatusDistributionCard's click-to-drill-down popups
  // never need a second, duplicate join of the same already-fetched data.
  awaitingResponseDeals: Deal[];
  inReviewDeals: Deal[];
  openDeals: Deal[];
  isLoading: boolean;
}

// Shared by DealFunnelCard and DealStatusDistributionCard so the join logic
// (and its two underlying queries) lives in one place — both call this with
// the same arguments, so React Query also dedupes the network requests
// themselves via matching queryKeys, not just the derived count.
export function usePipelineDecisionCounts(dateFrom: string, dateTo: string, storeId?: string): PipelineDecisionCounts {
  const { data: openDeals, isLoading: dealsLoading } = useQuery({
    queryKey: ['analytics-open-deals-aging', dateFrom, dateTo, storeId],
    queryFn: () =>
      dealsService.listFiltered(
        { dealStatus: ['open'], dateFrom, dateTo, dateField: 'expectedClosingDate', ...(storeId ? { storeId: [storeId] } : {}) },
        1,
        100,
      ),
  });

  const { data: quotesInRange, isLoading: quotesLoading } = useQuery({
    queryKey: ['analytics-decision-quotes', dateFrom, dateTo],
    queryFn: () => quotesService.listFiltered({ dateFrom, dateTo }, 1, 100),
  });

  const { awaitingResponseDeals, inReviewDeals } = useMemo(() => {
    if (!openDeals || !quotesInRange) return { awaitingResponseDeals: [], inReviewDeals: [] };
    const awaitingDealIds = new Set(
      quotesInRange.items.filter((q) => q.dealId && q.clientApprovalStatus !== 'approved').map((q) => q.dealId!),
    );
    const awaiting: Deal[] = [];
    const review: Deal[] = [];
    for (const deal of openDeals.items) {
      (awaitingDealIds.has(deal._id) ? awaiting : review).push(deal);
    }
    return { awaitingResponseDeals: awaiting, inReviewDeals: review };
  }, [openDeals, quotesInRange]);

  return {
    awaitingResponseCount: awaitingResponseDeals.length,
    awaitingResponseDeals,
    inReviewDeals,
    openDeals: openDeals?.items ?? [],
    isLoading: dealsLoading || quotesLoading,
  };
}
