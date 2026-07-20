import axios from 'axios';

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Could not reach the backend — is it running?';
    if (error.response.status === 401) return 'Your session has expired — please log in again.';
    const backendMessage = (error.response.data as { message?: string | string[] } | undefined)?.message;
    if (Array.isArray(backendMessage)) return backendMessage.join(', ');
    if (backendMessage) return backendMessage;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
