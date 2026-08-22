import {
  encodeFormQueryValue,
  getSearchParameter,
  parseHttpUrl,
} from './safeHttpUrlService';

export const JUKE_LOCAL_CONTROLLER_URL =
  'https://radiotedu.com/juke-local/controller/';

export interface JukeLocalAuthState {
  accessToken: string | null;
  user: Record<string, unknown> | null;
}

const serializeForInjection = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export function buildJukeLocalAuthInjection(authState: JukeLocalAuthState) {
  return `
    (function () {
      var token = ${serializeForInjection(authState.accessToken)};
      var account = ${serializeForInjection(authState.user)};
      window.RadioTEDUAccount = account;
      try {
        if (token && account) {
          window.localStorage.setItem('token', token);
          window.localStorage.setItem('user', JSON.stringify(account));
        } else {
          window.localStorage.removeItem('token');
          window.localStorage.removeItem('user');
        }
      } catch (_) {}
      try {
        window.dispatchEvent(new CustomEvent('radiotedu:account', {detail: account}));
      } catch (_) {}
      true;
    })();
    true;
  `;
}

export function buildJukeLocalControllerUrl(deviceCode?: unknown): string {
  const normalizedCode =
    typeof deviceCode === 'string' ? deviceCode.trim() : '';

  return normalizedCode
    ? `${JUKE_LOCAL_CONTROLLER_URL}?code=${encodeFormQueryValue(normalizedCode)}`
    : JUKE_LOCAL_CONTROLLER_URL;
}

export function isAllowedJukeLocalNavigation(url: string): boolean {
  if (url === 'about:blank') {
    return true;
  }

  const candidate = parseHttpUrl(url);
  const controller = parseHttpUrl(JUKE_LOCAL_CONTROLLER_URL);
  if (!candidate || !controller || candidate.hasCredentials) {
    return false;
  }

  const normalizedPath = candidate.pathname.replace(/\/+$/, '');
  const controllerPath = controller.pathname.replace(/\/+$/, '');
  return candidate.origin === controller.origin && normalizedPath === controllerPath;
}

export function normalizeJukeLocalAppPath(path: string): string {
  const candidate = parseHttpUrl(path, 'https://radiotedu.com/');
  if (!candidate || candidate.hasCredentials) {
    return path;
  }

  const normalizedPath = candidate.pathname.replace(/\/+$/, '');
  if (normalizedPath !== '/juke-local/controller') {
    return path;
  }

  const code = getSearchParameter(candidate.search, 'code')?.trim();
  return code ? `jukebox/${encodeURIComponent(code)}` : 'jukebox';
}
