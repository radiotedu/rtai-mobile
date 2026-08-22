import {parseHttpUrl} from './safeHttpUrlService';
import {normalizeWebViewLocale} from './webViewLocale';

export const STUDY_REMOTE_ROOT = 'https://radiotedu.com/study/';

export type StudyRoomId = 'library' | 'chim-alan';

export interface StudyBridgeAccount {
  id: string;
  displayName: string;
  authenticated: boolean;
}

interface StudyPublicBridgeInput {
  account: StudyBridgeAccount;
  globalPoints: number;
}

interface StudySecureBridgeInput extends StudyPublicBridgeInput {
  apiBase: string;
  accessToken: string;
}

const asInjectedJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export const buildStudyEntryUrl = (roomId: StudyRoomId, locale?: unknown) => {
  return `${STUDY_REMOTE_ROOT}index.html?embedded=mobile&room=${encodeURIComponent(roomId)}&lang=${normalizeWebViewLocale(locale)}`
    .replace('/study/index.html?', '/study/?');
};

export const isAllowedStudyNavigation = (url: string) => {
  if (url === 'about:blank') {
    return true;
  }

  const parsed = parseHttpUrl(url);
  return Boolean(
    parsed &&
      parsed.protocol === 'https:' &&
      parsed.hostname === 'radiotedu.com' &&
      parsed.port === '' &&
      !parsed.hasCredentials &&
      (parsed.pathname === '/study' || parsed.pathname.startsWith('/study/')),
  );
};

export const createStudyPublicAccountBridge = (
  input: StudyPublicBridgeInput,
) => `
  (function () {
    var updateStudyAuth = window.__RADIOTEDU_UPDATE_STUDY_AUTH__;
    if (typeof updateStudyAuth === 'function') {
      updateStudyAuth(null);
    }
    window.RadioTEDUStudyAccount = ${asInjectedJson({
      ...input.account,
      globalPoints: input.globalPoints,
    })};
    window.RadioTEDUStudyBridge = null;
    window.dispatchEvent(new CustomEvent('radiotedu:study-account', {detail: window.RadioTEDUStudyAccount}));
    true;
  })();
`;

export const createStudyAuthClearInjection = () => `
  (function () {
    var updateStudyAuth = window.__RADIOTEDU_UPDATE_STUDY_AUTH__;
    if (typeof updateStudyAuth === 'function') {
      updateStudyAuth(null);
    }
    window.RadioTEDUStudyAccount = null;
    window.RadioTEDUStudyBridge = null;
    window.dispatchEvent(new CustomEvent('radiotedu:study-account', {detail: null}));
    true;
  })();
  true;
`;

export const createStudyWebViewBridge = (input: StudySecureBridgeInput) => `
  (function () {
    if (!window.__RADIOTEDU_STUDY_STORAGE__) {
      var studyStorageValues = Object.create(null);
      window.__RADIOTEDU_STUDY_STORAGE__ = {
        getItem: function (key) {
          return Object.prototype.hasOwnProperty.call(studyStorageValues, String(key))
            ? studyStorageValues[String(key)]
            : null;
        },
        setItem: function (key, value) {
          studyStorageValues[String(key)] = String(value);
        },
        removeItem: function (key) {
          delete studyStorageValues[String(key)];
        },
        clear: function () {
          studyStorageValues = Object.create(null);
        },
        key: function (index) {
          return Object.keys(studyStorageValues)[index] || null;
        }
      };
      Object.defineProperty(window.__RADIOTEDU_STUDY_STORAGE__, 'length', {
        get: function () { return Object.keys(studyStorageValues).length; }
      });
    }
    try {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: window.__RADIOTEDU_STUDY_STORAGE__
      });
    } catch (_) {}

    var updateStudyAuth = window.__RADIOTEDU_UPDATE_STUDY_AUTH__;
    if (!updateStudyAuth) {
      var nativeStudyFetch = typeof window.fetch === 'function'
        ? window.fetch.bind(window)
        : null;
      var NativeStudyHeaders = typeof window.Headers === 'function'
        ? window.Headers
        : null;
      var NativeStudyURL = typeof window.URL === 'function'
        ? window.URL
        : null;
      var nativeStudyHeadersSet = NativeStudyHeaders && NativeStudyHeaders.prototype
        ? Function.prototype.call.bind(NativeStudyHeaders.prototype.set)
        : null;
      var nativeStudyHeadersForEach = NativeStudyHeaders && NativeStudyHeaders.prototype
        ? Function.prototype.call.bind(NativeStudyHeaders.prototype.forEach)
        : null;
      var nativeStudyAssign = Object.assign.bind(Object);
      var studyAccessToken = '';
      try {
        if (nativeStudyFetch) Object.freeze(nativeStudyFetch);
        if (NativeStudyHeaders) Object.freeze(NativeStudyHeaders);
        if (NativeStudyURL) Object.freeze(NativeStudyURL);
        if (nativeStudyHeadersSet) Object.freeze(nativeStudyHeadersSet);
        if (nativeStudyHeadersForEach) Object.freeze(nativeStudyHeadersForEach);
        Object.freeze(nativeStudyAssign);
      } catch (_) {}

      var legacyToClientWearable = {
        'default-hair': 'short-hair',
        'default-top': 'radio-hoodie',
        'default-bottom': 'jeans',
        'default-shoes': 'sneakers'
      };
      var clientToLegacyWearable = {
        'short-hair': 'default-hair',
        'radio-hoodie': 'default-top',
        'jeans': 'default-bottom',
        'sneakers': 'default-shoes'
      };
      var authenticatedStudyFetch = async function (resource, options) {
        if (
          !studyAccessToken ||
          !nativeStudyFetch ||
          !NativeStudyHeaders ||
          !NativeStudyURL ||
          !nativeStudyHeadersSet ||
          !nativeStudyHeadersForEach
        ) {
          return nativeStudyFetch(resource, options);
        }
        var requestUrl = typeof resource === 'string'
          ? resource
          : (resource && resource.url ? resource.url : String(resource));
        var requestOptions = options;
        var parsedRequest;
        try {
          parsedRequest = new NativeStudyURL(requestUrl, window.location.href);
        } catch (_) {
          return nativeStudyFetch(resource, options);
        }
        var trustedOrigin = parsedRequest.protocol === 'https:' &&
          parsedRequest.hostname === 'radiotedu.com' &&
          parsedRequest.port === '';
        var studyPath = parsedRequest.pathname;
        var studyApiRequest = trustedOrigin && (
          studyPath === '/jukebox/api/v1/study' ||
          studyPath.indexOf('/jukebox/api/v1/study/') === 0 ||
          studyPath === '/jukebox/api/v1/economy' ||
          studyPath.indexOf('/jukebox/api/v1/economy/') === 0
        );
        if (studyApiRequest && studyAccessToken) {
          var authHeaders = new NativeStudyHeaders(
            resource && typeof resource === 'object' && resource.headers
              ? resource.headers
              : (options && options.headers ? options.headers : undefined),
          );
          if (options && options.headers) {
            var optionHeaders = new NativeStudyHeaders(options.headers);
            nativeStudyHeadersForEach(optionHeaders, function (value, name) {
              nativeStudyHeadersSet(authHeaders, name, value);
            });
          }
          nativeStudyHeadersSet(
            authHeaders,
            'Authorization',
            'Bearer ' + studyAccessToken
          );
          requestOptions = nativeStudyAssign(
            {},
            options || {},
            {headers: authHeaders}
          );
        }
        if (
          trustedOrigin &&
          (studyPath.indexOf('/study/avatar/equip') !== -1 ||
            studyPath.indexOf('/study/avatar/purchase') !== -1) &&
          options && typeof options.body === 'string'
        ) {
          try {
            var requestBody = JSON.parse(options.body);
            if (typeof requestBody.itemId === 'string' && clientToLegacyWearable[requestBody.itemId]) {
              requestBody.itemId = clientToLegacyWearable[requestBody.itemId];
              requestOptions = nativeStudyAssign({}, options, {body: JSON.stringify(requestBody)});
            }
          } catch (_) {}
        }
        var response = await nativeStudyFetch(resource, requestOptions);
        if (!trustedOrigin || studyPath.indexOf('/study/avatar/me') === -1) {
          return response;
        }
        return {
          ok: response.ok,
          status: response.status,
          json: async function () {
            var payload = await response.json();
            var avatar = payload && payload.data;
            if (avatar && Array.isArray(avatar.ownedItemIds)) {
              avatar.ownedItemIds = avatar.ownedItemIds.map(function (id) {
                return legacyToClientWearable[id] || id;
              });
            }
            if (avatar && avatar.equipped && typeof avatar.equipped === 'object') {
              Object.keys(avatar.equipped).forEach(function (slot) {
                var id = avatar.equipped[slot];
                avatar.equipped[slot] = legacyToClientWearable[id] || id;
              });
            }
            return payload;
          }
        };
      };

      updateStudyAuth = function (nextAccessToken) {
        studyAccessToken = typeof nextAccessToken === 'string'
          ? nextAccessToken
          : '';
        if (nativeStudyFetch) {
          window.fetch = studyAccessToken
            ? authenticatedStudyFetch
            : nativeStudyFetch;
        }
      };
      try { Object.freeze(updateStudyAuth); } catch (_) {}
      try {
        Object.defineProperty(window, '__RADIOTEDU_UPDATE_STUDY_AUTH__', {
          configurable: false,
          enumerable: false,
          writable: false,
          value: updateStudyAuth
        });
      } catch (_) {
        window.__RADIOTEDU_UPDATE_STUDY_AUTH__ = updateStudyAuth;
      }
    }
    window.__RADIOTEDU_UPDATE_STUDY_AUTH__(
      ${asInjectedJson(input.accessToken)}
    );
    window.RadioTEDUStudyAccount = ${asInjectedJson({
      ...input.account,
      globalPoints: input.globalPoints,
    })};
    window.RadioTEDUStudyBridge = ${asInjectedJson({
      apiBase: input.apiBase,
      account: input.account,
      globalPoints: input.globalPoints,
    })};
    if (window.RadioTEDUStudyBridge) {
      window.RadioTEDUStudyBridge.request = function (resource, options) {
        return window.fetch(resource, options);
      };
    }
    window.dispatchEvent(new CustomEvent('radiotedu:study-account', {detail: window.RadioTEDUStudyAccount}));
    window.dispatchEvent(new CustomEvent('radiotedu:study-bridge-ready'));
    true;
  })();
`;
