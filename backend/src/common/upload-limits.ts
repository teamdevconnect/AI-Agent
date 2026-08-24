// Shared across every FileInterceptor('file', ...) call site (finance
// documents, business-knowledge documents, generic documents, agent-role
// generation) — previously none of them set any limit at all, so Multer
// buffered an arbitrarily large upload fully in memory before the handler
// ever ran, a straightforward single-request OOM/DoS vector. 25MB comfortably
// covers a scanned multi-page PDF/invoice, the actual documents this app's
// upload routes are built for.
export const UPLOAD_FILE_SIZE_LIMIT_BYTES = 25 * 1024 * 1024;

export const UPLOAD_FILE_INTERCEPTOR_OPTIONS = {
  limits: { fileSize: UPLOAD_FILE_SIZE_LIMIT_BYTES },
};
