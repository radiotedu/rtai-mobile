export interface WebViewAccountAuthState {
  accessToken: string | null;
  user: unknown | null;
}

function serializeForInjection(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildWebViewAccountBridge(
  authState: WebViewAccountAuthState,
  allowedApiPrefixes: readonly string[],
) {
  return `
    (function () {
      window.__RADIOTEDU_NATIVE_AUTH__ = ${serializeForInjection(authState)};
      window.__RADIOTEDU_NATIVE_API_PREFIXES__ = ${serializeForInjection(allowedApiPrefixes)};

      if (typeof window.fetch === 'function' && !window.__RADIOTEDU_NATIVE_FETCH_INSTALLED__) {
        window.__RADIOTEDU_NATIVE_FETCH_INSTALLED__ = true;
        window.__RADIOTEDU_NATIVE_FETCH__ = window.fetch.bind(window);
        window.fetch = function (resource, options) {
          var requestUrl = typeof resource === 'string'
            ? resource
            : (resource && resource.url ? resource.url : String(resource));
          var parsed;
          try {
            parsed = new URL(requestUrl, window.location.href);
          } catch (_) {
            return window.__RADIOTEDU_NATIVE_FETCH__(resource, options);
          }

          var prefixes = window.__RADIOTEDU_NATIVE_API_PREFIXES__ || [];
          var trustedPath = prefixes.some(function (prefix) {
            return parsed.pathname.indexOf(prefix) === 0;
          });
          var trustedOrigin = parsed.protocol === 'https:' &&
            parsed.hostname === 'radiotedu.com' &&
            parsed.port === '';
          var state = window.__RADIOTEDU_NATIVE_AUTH__ || {};
          if (!trustedOrigin || !trustedPath || !state.accessToken) {
            return window.__RADIOTEDU_NATIVE_FETCH__(resource, options);
          }

          var headers = new Headers(
            (options && options.headers) || (resource && resource.headers) || {}
          );
          headers.set('Authorization', 'Bearer ' + state.accessToken);
          return window.__RADIOTEDU_NATIVE_FETCH__(
            resource,
            Object.assign({}, options || {}, {headers: headers})
          );
        };
      }

      window.dispatchEvent(new CustomEvent('radiotedu:native-auth', {
        detail: {authenticated: Boolean(window.__RADIOTEDU_NATIVE_AUTH__.accessToken)}
      }));
      true;
    })();
    true;
  `;
}
