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

export function asWebViewUserPresentation(user: unknown) {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const source = user as Record<string, unknown>;
  const presentation: Record<string, string> = {};
  for (const key of ['id', 'display_name', 'avatar_url'] as const) {
    const value = source[key];
    if (typeof value === 'string') {
      presentation[key] = value;
    }
  }
  return Object.keys(presentation).length ? presentation : null;
}

export function buildWebViewAccountBridge(
  authState: WebViewAccountAuthState,
  allowedApiPrefixes: readonly string[],
) {
  const publicAuthState = {
    authenticated: Boolean(authState.accessToken),
    user: authState.accessToken
      ? asWebViewUserPresentation(authState.user)
      : null,
  };

  return `
    (function () {
      var updateNativeAuth = window.__RADIOTEDU_UPDATE_NATIVE_AUTH__;
      if (!updateNativeAuth) {
        var nativeFetch = typeof window.fetch === 'function'
          ? window.fetch.bind(window)
          : null;
        var NativeHeaders = typeof window.Headers === 'function'
          ? window.Headers
          : null;
        var NativeURL = typeof window.URL === 'function' ? window.URL : null;
        var nativeHeadersSet = NativeHeaders && NativeHeaders.prototype
          ? Function.prototype.call.bind(NativeHeaders.prototype.set)
          : null;
        var nativeAssign = Object.assign.bind(Object);
        var prefixes = ${serializeForInjection(allowedApiPrefixes)};
        var accessToken = '';
        try {
          if (nativeFetch) Object.freeze(nativeFetch);
          if (NativeHeaders) Object.freeze(NativeHeaders);
          if (NativeURL) Object.freeze(NativeURL);
          if (nativeHeadersSet) Object.freeze(nativeHeadersSet);
          Object.freeze(nativeAssign);
          Object.freeze(prefixes);
        } catch (_) {}

        var authenticatedFetch = function (resource, options) {
          if (
            !accessToken ||
            !nativeFetch ||
            !NativeHeaders ||
            !NativeURL ||
            !nativeHeadersSet
          ) {
            return nativeFetch(resource, options);
          }
          var requestUrl = typeof resource === 'string'
            ? resource
            : (resource && resource.url ? resource.url : String(resource));
          var parsed;
          try {
            parsed = new NativeURL(requestUrl, window.location.href);
          } catch (_) {
            return nativeFetch(resource, options);
          }

          var trustedPath = prefixes.some(function (prefix) {
            return parsed.pathname.indexOf(prefix) === 0;
          });
          var trustedOrigin = parsed.protocol === 'https:' &&
            parsed.hostname === 'radiotedu.com' &&
            parsed.port === '';
          if (!trustedOrigin || !trustedPath) {
            return nativeFetch(resource, options);
          }

          var headers = new NativeHeaders(
            (options && options.headers) || (resource && resource.headers) || {}
          );
          nativeHeadersSet(headers, 'Authorization', 'Bearer ' + accessToken);
          return nativeFetch(
            resource,
            nativeAssign({}, options || {}, {headers: headers})
          );
        };

        updateNativeAuth = function (nextAccessToken, nextPublicAuth) {
          accessToken = typeof nextAccessToken === 'string'
            ? nextAccessToken
            : '';
          var publicAuth = nextPublicAuth && typeof nextPublicAuth === 'object'
            ? nextPublicAuth
            : {authenticated: false, user: null};
          try {
            if (publicAuth.user) Object.freeze(publicAuth.user);
            Object.freeze(publicAuth);
          } catch (_) {}
          window.__RADIOTEDU_NATIVE_AUTH__ = publicAuth;
          if (nativeFetch) {
            window.fetch = accessToken ? authenticatedFetch : nativeFetch;
          }
          window.dispatchEvent(new CustomEvent('radiotedu:native-auth', {
            detail: {authenticated: Boolean(accessToken)}
          }));
        };
        try { Object.freeze(updateNativeAuth); } catch (_) {}
        try {
          Object.defineProperty(window, '__RADIOTEDU_UPDATE_NATIVE_AUTH__', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: updateNativeAuth
          });
        } catch (_) {
          window.__RADIOTEDU_UPDATE_NATIVE_AUTH__ = updateNativeAuth;
        }
      }

      window.__RADIOTEDU_UPDATE_NATIVE_AUTH__(
        ${serializeForInjection(authState.accessToken)},
        ${serializeForInjection(publicAuthState)}
      );
      true;
    })();
    true;
  `;
}
