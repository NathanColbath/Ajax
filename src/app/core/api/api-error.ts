/** Extract API error message from HttpErrorResponse-shaped errors. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const body = (err as { error?: { message?: string } | string }).error;
    if (typeof body === 'string' && body.trim()) {
      return body;
    }
    if (body && typeof body === 'object' && typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}
