type SafeErrorShape = {
  name?: unknown;
  code?: unknown;
  response?: {status?: unknown; data?: {code?: unknown}};
};

/** Dev-only diagnostics that never serialize Axios config, headers, or bodies. */
export function logSafeError(scope: string, error: unknown): void {
  if (!__DEV__) {
    return;
  }
  const candidate = (error ?? {}) as SafeErrorShape;
  console.warn(`[${scope}]`, {
    name: typeof candidate.name === 'string' ? candidate.name : 'Error',
    status:
      typeof candidate.response?.status === 'number'
        ? candidate.response.status
        : undefined,
    code:
      typeof candidate.response?.data?.code === 'string'
        ? candidate.response.data.code
        : typeof candidate.code === 'string'
          ? candidate.code
          : undefined,
  });
}
