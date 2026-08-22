import {
  encodeFormQueryValue,
  getSearchParameter,
  parseHttpUrl,
} from './safeHttpUrlService';
import {
  buildWebViewAccountBridge,
  type WebViewAccountAuthState,
} from './webViewAccountBridge';

export const JUKE_LOCAL_CONTROLLER_URL =
  'https://radiotedu.com/juke-local/controller/';

export function buildJukeLocalAuthInjection(authState: WebViewAccountAuthState) {
  return `${buildWebViewAccountBridge(authState, [
    '/jukebox/api/',
    '/juke-local/api/',
  ])}
    (function () {
      var trustedController = window.location.protocol === 'https:' &&
        window.location.hostname === 'radiotedu.com' &&
        window.location.port === '' &&
        window.location.pathname.replace(/\\/+$/, '') === '/juke-local/controller';
      if (!trustedController) return true;

      // The current controller reads its bearer token through Axios from the
      // same-origin token key. Emulate only that key in memory: never leave a
      // native bearer token in origin-wide persistent WebView localStorage.
      var state = window.__RADIOTEDU_NATIVE_AUTH__ || {};
      try {
        if (!window.__RADIOTEDU_TOKEN_STORAGE_SHIM__) {
          var originalGetItem = Storage.prototype.getItem;
          var originalSetItem = Storage.prototype.setItem;
          var originalRemoveItem = Storage.prototype.removeItem;
          window.__RADIOTEDU_TOKEN_STORAGE_SHIM__ = {
            getItem: originalGetItem,
            setItem: originalSetItem,
            removeItem: originalRemoveItem
          };
          // Remove any token persisted by older app builds before installing
          // the ephemeral compatibility view.
          originalRemoveItem.call(window.localStorage, 'token');
          Storage.prototype.getItem = function (key) {
            if (this === window.localStorage && key === 'token') {
              return window.__RADIOTEDU_EPHEMERAL_TOKEN__ || null;
            }
            return originalGetItem.call(this, key);
          };
          Storage.prototype.setItem = function (key, value) {
            if (this === window.localStorage && key === 'token') {
              window.__RADIOTEDU_EPHEMERAL_TOKEN__ = String(value || '');
              return;
            }
            return originalSetItem.call(this, key, value);
          };
          Storage.prototype.removeItem = function (key) {
            if (this === window.localStorage && key === 'token') {
              window.__RADIOTEDU_EPHEMERAL_TOKEN__ = '';
              return;
            }
            return originalRemoveItem.call(this, key);
          };
        }
        window.__RADIOTEDU_EPHEMERAL_TOKEN__ =
          typeof state.accessToken === 'string' ? state.accessToken : '';
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('radiotedu:native-auth', {
        detail: {authenticated: Boolean(state.accessToken)}
      }));
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
