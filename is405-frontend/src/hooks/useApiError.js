import { useState, useCallback } from 'react';

/**
 * Simple hook to capture API errors and display them as user-visible messages.
 * Usage:
 *   const { apiError, setApiError, withErrorHandling } = useApiError();
 *   // Wrap any async operation:
 *   await withErrorHandling(() => someService.doSomething());
 */
export function useApiError() {
  const [apiError, setApiError] = useState(null);

  const clearError = useCallback(() => setApiError(null), []);

  const withErrorHandling = useCallback(async (fn) => {
    setApiError(null);
    try {
      return await fn();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.title ||
        err?.message ||
        'Something went wrong. Please try again.';
      setApiError(msg);
      throw err; // re-throw so callers can also handle if needed
    }
  }, []);

  return { apiError, setApiError, clearError, withErrorHandling };
}
