import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {WebView as NativeWebView} from 'react-native-webview';

import {useAuth, type User} from '../../context/AuthContext';
import {subscribeAuthSessionChanges} from '../../services/authSessionEvents';
import {BASE_API} from '../../services/config';
import {
  buildStudyEntryUrl,
  createStudyAuthClearInjection,
  createStudyWebViewBridge,
  isAllowedStudyNavigation,
} from '../../services/studyWebViewService';
import {COLORS, SPACING} from '../../theme/theme';
import {useTranslation} from 'react-i18next';
import {screenCopy} from '../../i18n/screenCopy';
import {appCopy} from '../../i18n/appCopy';
import {
  createLatestRefreshCoordinator,
  createWebViewUserRevision,
  readStoredWebViewCredential,
  resolveStableWebViewSession,
  type LatestRefreshCoordinator,
  type WebViewSessionState,
} from '../../services/webViewSessionRefreshCoordinator';

const WebView = NativeWebView as any;

const buildStudyBridgeScript = (sessionUser: User | null, token: string | null) => {
  if (!sessionUser || sessionUser.is_guest || !token) {
    return 'true;';
  }
  return createStudyWebViewBridge({
    account: {
      id: sessionUser.id,
      displayName: sessionUser.display_name,
      authenticated: true,
    },
    globalPoints: Number(sessionUser.rank_score ?? 0),
    apiBase: BASE_API,
    accessToken: token,
  });
};

const LibraryStudyWebView = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const webViewRef = useRef<any>(null);
  const {user, isLoading: isAuthLoading, refreshSession} = useAuth();
  const sessionConfigRef = useRef({user, isAuthLoading, refreshSession});
  const userRevision = createWebViewUserRevision(user);
  const observedUserRevisionRef = useRef(userRevision);
  const refreshCoordinatorRef = useRef<LatestRefreshCoordinator<void> | null>(null);
  sessionConfigRef.current = {user, isAuthLoading, refreshSession};
  const {i18n} = useTranslation();
  const copy = (key: string) => screenCopy(i18n.language, key);
  const appText = (key: string) => appCopy(i18n.language, key);
  const [appliedSession, setAppliedSession] = useState<WebViewSessionState<User>>({
    accessToken: null,
    user: null,
  });
  const [credentialsReady, setCredentialsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const roomId = route.params?.locationId === 'chim-alan' ? 'chim-alan' : 'library';
  const isLocked = !user || user.is_guest;

  const requestSessionRefresh = useCallback(() => {
    if (sessionConfigRef.current.isAuthLoading) {
      setCredentialsReady(false);
      return Promise.resolve();
    }

    return refreshCoordinatorRef.current?.requestRefresh() ?? Promise.resolve();
  }, []);

  useEffect(() => {
    const coordinator = createLatestRefreshCoordinator<
      void,
      {accessToken: string | null; user: User | null}
    >({
      resolve: () => {
        const config = sessionConfigRef.current;
        return resolveStableWebViewSession({
          readCredential: readStoredWebViewCredential,
          refreshUser: config.refreshSession,
          getCurrentUser: () => sessionConfigRef.current.user,
          isEligibleUser: sessionUser => !sessionUser.is_guest,
        });
      },
      apply: state => {
        setAppliedSession(state);
        setCredentialsReady(true);
        webViewRef.current?.injectJavaScript(
          state.accessToken && state.user
            ? buildStudyBridgeScript(state.user, state.accessToken)
            : createStudyAuthClearInjection(),
        );
      },
    });
    refreshCoordinatorRef.current = coordinator;

    return () => {
      if (refreshCoordinatorRef.current === coordinator) {
        refreshCoordinatorRef.current = null;
      }
      coordinator.dispose();
    };
  }, []);

  useEffect(() => {
    requestSessionRefresh().catch(() => undefined);
  }, [isAuthLoading, requestSessionRefresh]);

  useEffect(() => {
    if (observedUserRevisionRef.current === userRevision) {
      return;
    }
    observedUserRevisionRef.current = userRevision;
    if (credentialsReady && !isAuthLoading) {
      requestSessionRefresh().catch(() => undefined);
    }
  }, [credentialsReady, isAuthLoading, requestSessionRefresh, userRevision]);

  useEffect(() => subscribeAuthSessionChanges(() => {
    requestSessionRefresh().catch(() => undefined);
  }), [requestSessionRefresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      refreshCoordinatorRef.current
        ?.handleAppStateChange(nextState, undefined)
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  const bridgeScript = useMemo(() => {
    return buildStudyBridgeScript(appliedSession.user, appliedSession.accessToken);
  }, [appliedSession]);

  const gameUrl = useMemo(
    () =>
      buildStudyEntryUrl(roomId, i18n.resolvedLanguage ?? i18n.language),
    [i18n.language, i18n.resolvedLanguage, roomId],
  );

  if (isLocked) {
    return (
      <SafeAreaView style={styles.lockedContainer}>
        <Icon name="lock-outline" size={34} color={COLORS.primary} />
        <Text style={styles.lockedTitle}>{copy('study.loginRequired')}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Auth', {screen: 'Login'})}>
          <Text style={styles.primaryButtonText}>{copy('study.login')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!credentialsReady || appliedSession.user?.id !== user?.id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!appliedSession.accessToken) {
    return (
      <SafeAreaView style={styles.lockedContainer}>
        <Icon name="account-lock-outline" size={34} color={COLORS.primary} />
        <Text style={styles.lockedTitle}>{copy('study.loginRequired')}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Auth', {screen: 'Login'})}>
          <Text style={styles.primaryButtonText}>{copy('study.login')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {hasLoadError ? (
        <View style={styles.errorPanel}>
          <Icon name="alert-circle-outline" size={32} color={COLORS.primary} />
          <Text style={styles.errorTitle}>{appText('study.errorTitle')}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setHasLoadError(false);
              setReloadKey(value => value + 1);
            }}>
            <Text style={styles.primaryButtonText}>{appText('study.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <WebView
        key={`remote-study-${gameUrl}-${reloadKey}`}
        ref={webViewRef}
        source={{uri: gameUrl}}
        style={styles.webView}
        originWhitelist={['https://radiotedu.com']}
        javaScriptEnabled
        cacheEnabled={false}
        cacheMode="LOAD_NO_CACHE"
        domStorageEnabled
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        webviewDebuggingEnabled={false}
        allowsLinkPreview={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        injectedJavaScriptBeforeContentLoaded={bridgeScript}
        injectedJavaScript={bridgeScript}
        onLoadEnd={() => webViewRef.current?.injectJavaScript(bridgeScript)}
        onShouldStartLoadWithRequest={({url}: {url: string}) =>
          isAllowedStudyNavigation(url)
        }
        onHttpError={({nativeEvent}: {nativeEvent: {statusCode: number}}) => {
          if (nativeEvent.statusCode < 400) {
            return;
          }
          setHasLoadError(true);
        }}
        onError={() => setHasLoadError(true)}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        )}
        startInLoadingState
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0b1013'},
  webView: {flex: 1, backgroundColor: '#0b1013'},
  loading: {...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1013'},
  lockedContainer: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, backgroundColor: COLORS.background},
  lockedTitle: {color: COLORS.text, fontSize: 18, fontWeight: '700'},
  errorPanel: {...StyleSheet.absoluteFillObject, zIndex: 2, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, backgroundColor: '#0b1013'},
  errorTitle: {color: COLORS.text, fontSize: 18, fontWeight: '700'},
  primaryButton: {minWidth: 120, alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: 6, backgroundColor: COLORS.primary},
  primaryButtonText: {color: '#07100d', fontWeight: '700'},
});

export default LibraryStudyWebView;
