export type ForegroundAppState =
  | 'active'
  | 'background'
  | 'inactive'
  | 'unknown'
  | 'extension';

export interface ForegroundTaskRunner {
  handleAppStateChange: (state: ForegroundAppState) => Promise<void> | void;
  cancel: () => void;
}

export function createRunOnceWhenActive(
  task: () => Promise<void>,
  onError: (error: unknown) => void,
): ForegroundTaskRunner {
  let cancelled = false;
  let completed = false;
  let inFlight = false;
  let active = false;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const clearRetry = () => {
    if (retryTimer !== undefined) {clearTimeout(retryTimer); retryTimer = undefined;}
  };

  const handleAppStateChange = (state: ForegroundAppState) => {
    const wasActive = active;
    active = state === 'active';
    if (!active) {clearRetry(); return;}
    if (!wasActive) {retryCount = 0;}
    if (state !== 'active' || cancelled || completed || inFlight) {
      return;
    }

    inFlight = true;
    return task()
      .then(() => {
        completed = true;
      })
      .catch(error => {
        onError(error);
        // RN may report active before Android's Activity reaches RESUMED.
        // Retry only that specific setup race; never loop on arbitrary failures.
        if (active && !cancelled && retryCount < 3 &&
          /foreground/i.test(String(error?.message ?? error))) {
          clearRetry();
          retryTimer = setTimeout(() => {
            retryTimer = undefined;
            handleAppStateChange('active');
          }, 250 * 2 ** retryCount++);
        }
      })
      .finally(() => {
        inFlight = false;
      });
  };

  return {
    handleAppStateChange,
    cancel: () => {
      cancelled = true;
      clearRetry();
    },
  };
}
