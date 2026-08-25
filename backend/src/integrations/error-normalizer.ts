// One normalized shape for every Dynamic Executor outcome — used by both the
// HTTP route (resources.controller.ts, for the browser UI) and the
// integration_execute AI tool's string rendering (via python-agent's HTTP
// call to the same route), so the two never drift into two different
// "friendly error" implementations.
export interface NormalizedExecutionResult {
  success: boolean;
  statusCode?: number;
  data?: unknown;
  error?: string;
  message: string;
  integrationId: string;
  endpointId: string;
}

export function normalizeSuccess(
  integrationId: string,
  endpointId: string,
  statusCode: number,
  data: unknown,
): NormalizedExecutionResult {
  return {
    success: true,
    statusCode,
    data,
    message: `Request succeeded (HTTP ${statusCode}).`,
    integrationId,
    endpointId,
  };
}

export function normalizeError(integrationId: string, endpointId: string, err: unknown): NormalizedExecutionResult {
  const axiosErr = err as { response?: { status?: number; data?: unknown }; code?: string; message?: string };
  const status = axiosErr.response?.status;

  let message: string;
  if (status === 401) message = 'The provider rejected these credentials (401 Unauthorized).';
  else if (status === 403) message = "These credentials don't have permission for this action (403 Forbidden).";
  else if (status === 404) message = 'The provider returned 404 Not Found for this endpoint/path.';
  else if (status === 429) message = 'The provider rate-limited this request (429 Too Many Requests).';
  else if (status && status >= 500) message = `The provider's server had an error (HTTP ${status}).`;
  else if (axiosErr.code === 'ECONNABORTED') message = 'The request timed out.';
  else if (axiosErr.code === 'ENOTFOUND' || axiosErr.code === 'ECONNREFUSED') {
    message = "Couldn't reach the provider — check the base URL/path.";
  } else message = axiosErr.message || 'The request failed.';

  return {
    success: false,
    statusCode: status,
    error: axiosErr.code ?? String(status ?? 'unknown'),
    data: axiosErr.response?.data,
    message,
    integrationId,
    endpointId,
  };
}
