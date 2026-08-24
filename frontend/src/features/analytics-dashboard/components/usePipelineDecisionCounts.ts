import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dealsService } from '@/services/dealsService';
import { quotesService } from '@/services/quotesService';

export interface PipelineDecisionCounts {
  // Open deals whose linked quote hasn't been approved by the client yet —
  // same real join DealsNeedingDecisionTable uses (dealsService + quotesService,
  // no dedicated backend endpoint for this exact cross-reference).
  awaitingResponseCount: number;
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

  const awaitingResponseCount = useMemo(() => {
    if (!openDeals || !quotesInRange) return 0;
    const openDealIds = new Set(openDeals.items.map((d) => d._id));
    return quotesInRange.items.filter((q) => q.dealId && openDealIds.has(q.dealId) && q.clientApprovalStatus !== 'approved').length;
  }, [openDeals, quotesInRange]);

  return { awaitingResponseCount, isLoading: dealsLoading || quotesLoading };
}
