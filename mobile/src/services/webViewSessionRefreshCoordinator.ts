import {getAuthTokenSnapshot} from './authTokenStorage';

export type WebViewCredentialSnapshot = {
  accessToken: string;
  generation: number;
};

export type WebViewSessionState<TUser> = {
  accessToken: string | null;
  user: TUser | null;
};

type StableSessionOptions<TUser> = {
  getCurrentUser: () => TUser | null;
  isEligibleUser: (user: TUser) => boolean;
  readCredential: () => Promise<WebViewCredentialSnapshot | null>;
  refreshUser?: () => Promise<TUser | null>;
  maxCredentialAttempts?: number;
};

type RefreshCoordinatorOptions<TInput, TValue> = {
  resolve: (input: TInput) => Promise<TValue>;
  apply: (value: TValue) => void;
};

export type LatestRefreshCoordinator<TInput> = {
  requestRefresh: (input: TInput) => Promise<void>;
  handleAppStateChange: (state: string, input: TInput) => Promise<void>;
  dispose: () => void;
};

type WebViewUserRevisionInput = {
  id: string;
  is_guest: boolean;
  display_name?: string;
  avatar_url?: string;
  rank_score?: number;
  gold_balance?: number;
};

const emptySession = <TUser>(): WebViewSessionState<TUser> => ({
  accessToken: null,
  user: null,
});

export const createWebViewUserRevision = (
  user: WebViewUserRevisionInput | null,
) => user
  ? JSON.stringify([
      user.id,
      user.is_guest,
      user.display_name ?? '',
      user.avatar_url ?? '',
      Number(user.rank_score ?? 0),
      Number(user.gold_balance ?? 0),
    ])
  : 'signed-out';

const sameCredential = (
  left: WebViewCredentialSnapshot | null,
  right: WebViewCredentialSnapshot | null,
) =>
  left?.generation === right?.generation &&
  left?.accessToken === right?.accessToken;

const safelyReadCredential = async (
  readCredential: StableSessionOptions<unknown>['readCredential'],
) => {
  try {
    return await readCredential();
  } catch {
    return null;
  }
};

export async function readStoredWebViewCredential(): Promise<WebViewCredentialSnapshot | null> {
  const snapshot = await getAuthTokenSnapshot();
  return snapshot
    ? {accessToken: snapshot.accessToken, generation: snapshot.generation}
    : null;
}

export async function resolveStableWebViewSession<TUser>(
  options: StableSessionOptions<TUser>,
): Promise<WebViewSessionState<TUser>> {
  const maxAttempts = Math.max(1, options.maxCredentialAttempts ?? 3);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const before = await safelyReadCredential(options.readCredential);
    if (!before) {
      return emptySession();
    }

    let sessionUser = options.getCurrentUser();
    if (options.refreshUser) {
      try {
        sessionUser = await options.refreshUser();
      } catch {
        sessionUser = options.getCurrentUser();
      }
    }

    const after = await safelyReadCredential(options.readCredential);
    if (!sameCredential(before, after)) {
      continue;
    }

    if (!after || !sessionUser || !options.isEligibleUser(sessionUser)) {
      return emptySession();
    }

    return {accessToken: after.accessToken, user: sessionUser};
  }

  // A credential that keeps changing cannot be paired safely with a user.
  return emptySession();
}

export function createLatestRefreshCoordinator<TInput, TValue>(
  options: RefreshCoordinatorOptions<TInput, TValue>,
): LatestRefreshCoordinator<TInput> {
  let revision = 0;
  let disposed = false;
  let queued: {input: TInput; revision: number} | null = null;
  let running: Promise<void> | null = null;

  const drain = async () => {
    while (!disposed && queued) {
      const request = queued;
      queued = null;

      let value: TValue;
      try {
        value = await options.resolve(request.input);
      } catch {
        continue;
      }

      if (disposed || request.revision !== revision) {
        continue;
      }

      options.apply(value);
    }
  };

  const ensureRunning = () => {
    if (!running) {
      const flight = drain();
      running = flight.finally(() => {
        running = null;
        if (!disposed && queued) {
          ensureRunning().catch(() => undefined);
        }
      });
    }
    return running;
  };

  const requestRefresh = (input: TInput) => {
    if (disposed) {
      return Promise.resolve();
    }
    revision += 1;
    queued = {input, revision};
    return ensureRunning();
  };

  return {
    requestRefresh,
    handleAppStateChange(state, input) {
      return state === 'active' ? requestRefresh(input) : Promise.resolve();
    },
    dispose() {
      disposed = true;
      revision += 1;
      queued = null;
    },
  };
}
