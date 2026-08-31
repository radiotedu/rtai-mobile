import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  WebView as NativeWebView,
  type WebViewMessageEvent,
} from 'react-native-webview';

import GlobalHeader from '../../components/GlobalHeader';
import PageTransition from '../../components/PageTransition';
import {useAuth, type User} from '../../context/AuthContext';
import {subscribeAuthSessionChanges} from '../../services/authSessionEvents';
import {
  buildVotingWebViewUrl,
  buildVotingAuthInjection,
  classifyVotingNavigation,
  isAllowedVotingNavigation,
  parseVotingWebViewMessage,
  type VotingWebViewAuthState,
} from '../../services/votingWebViewService';
import {updateLiveVotingActivity} from '../../services/liveVotingActivity';
import {COLORS, SPACING} from '../../theme/theme';
import {screenCopy} from '../../i18n/screenCopy';
import {Analytics} from '../../services/analyticsService';
import {
  createLatestRefreshCoordinator,
  createWebViewUserRevision,
  readStoredWebViewCredential,
  resolveStableWebViewSession,
  type LatestRefreshCoordinator,
} from '../../services/webViewSessionRefreshCoordinator';

const WebView = NativeWebView as any;
const EMPTY_AUTH_STATE: VotingWebViewAuthState = {
  accessToken: null,
  user: null,
};

export default function NextSongVoteScreen() {
  const navigation = useNavigation<any>();
  const {i18n} = useTranslation();
  const copy = (key: string) => screenCopy(i18n.language, key);
  const {user, isLoading: isAuthLoading, refreshSession} = useAuth();
  const webViewRef = useRef<any>(null);
  const webViewReadyRef = useRef(false);
  const sessionConfigRef = useRef({user, isAuthLoading, refreshSession});
  const userRevision = createWebViewUserRevision(user);
  const observedUserRevisionRef = useRef(userRevision);
  const refreshCoordinatorRef = useRef<LatestRefreshCoordinator<void> | null>(null);
  sessionConfigRef.current = {user, isAuthLoading, refreshSession};
  const authStateRef = useRef<VotingWebViewAuthState>(EMPTY_AUTH_STATE);
  const [authResolved, setAuthResolved] = useState(false);
  const [authBootstrap, setAuthBootstrap] = useState(
    buildVotingAuthInjection(EMPTY_AUTH_STATE),
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [, setCanGoBack] = useState(false);
  const votingUrl = useMemo(
    () =>
      buildVotingWebViewUrl(i18n.resolvedLanguage ?? i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  );
  const leaveVoting = useCallback(() => {
    Analytics.webView('voting', 'leave', 'success');
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs', {screen: 'Home'});
    }
  }, [navigation]);

  const injectCurrentAuth = useCallback(() => {
    if (!webViewReadyRef.current) {
      return;
    }
    webViewRef.current?.injectJavaScript(
      buildVotingAuthInjection(authStateRef.current),
    );
  }, []);

  const requestSessionRefresh = useCallback(() => {
    if (sessionConfigRef.current.isAuthLoading) {
      setAuthResolved(false);
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
        authStateRef.current = state;
        setAuthBootstrap(buildVotingAuthInjection(state));
        setAuthResolved(true);
        injectCurrentAuth();
      },
    });
    refreshCoordinatorRef.current = coordinator;

    return () => {
      if (refreshCoordinatorRef.current === coordinator) {
        refreshCoordinatorRef.current = null;
      }
      coordinator.dispose();
      webViewReadyRef.current = false;
    };
  }, [injectCurrentAuth]);

  useEffect(() => {
    if (observedUserRevisionRef.current === userRevision) {
      return;
    }
    observedUserRevisionRef.current = userRevision;
    if (authResolved && !isAuthLoading) {
      requestSessionRefresh().catch(() => undefined);
    }
  }, [authResolved, isAuthLoading, requestSessionRefresh, userRevision]);

  useEffect(() => {
    requestSessionRefresh().catch(() => undefined);
  }, [isAuthLoading, requestSessionRefresh]);

  useEffect(() => subscribeAuthSessionChanges(() => {
    requestSessionRefresh().catch(() => undefined);
  }), [requestSessionRefresh]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState === 'active') {
          refreshCoordinatorRef.current
            ?.handleAppStateChange(nextState, undefined)
            .catch(() => undefined);
        }
      },
    );
    const networkSubscription = NetInfo.addEventListener(state => {
      const offline = state.isConnected === false;
      setIsOffline(offline);
      if (offline) {
        setHasLoadError(true);
        setIsLoading(false);
      }
    });

    return () => {
      appStateSubscription.remove();
      networkSubscription();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        leaveVoting();
        return true;
      },
    );

    return () => backSubscription.remove();
  }, [leaveVoting]);

  const handleVotingMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseVotingWebViewMessage(event.nativeEvent.data);
      if (!message) {
        return;
      }
      if (message.type === 'radiotedu.voting.round') {
        updateLiveVotingActivity(message);
        return;
      }
      if (message.type !== 'radiotedu.voting.ready') {
        return;
      }

      webViewReadyRef.current = true;
      injectCurrentAuth();
    },
    [injectCurrentAuth],
  );

  const handleVotingLoadEnd = useCallback(() => {
    setIsLoading(false);
    // Production page currently has no native-ready postMessage. Treat the
    // completed document as ready, then let the injected bearer bridge trigger
    // its session refresh.
    webViewReadyRef.current = true;
    injectCurrentAuth();
  }, [injectCurrentAuth]);

  const handleNavigationRequest = useCallback((request: {url: string}) => {
    const decision = classifyVotingNavigation(request.url);
    if (decision === 'allowed') {
      return true;
    }
    if (decision === 'external-https') {
      Linking.openURL(request.url).catch(() => undefined);
    }
    return false;
  }, []);

  const showConnectionError = useCallback(() => {
    webViewReadyRef.current = false;
    setCanGoBack(false);
    setIsLoading(false);
    setHasLoadError(true);
  }, []);

  const retry = useCallback(() => {
    webViewReadyRef.current = false;
    setCanGoBack(false);
    setHasLoadError(false);
    setIsLoading(true);
    setReloadKey(value => value + 1);
  }, []);

  return (
    <PageTransition>
      <SafeAreaView
        style={styles.container}
        edges={['top', 'left', 'right']}>
        <GlobalHeader />
        <View style={styles.exitBar}>
          <TouchableOpacity
            style={styles.exitButton}
            onPress={leaveVoting}
            accessibilityRole="button"
            accessibilityLabel={copy('vote.back')}>
            <Icon name="chevron-left" size={21} color={COLORS.text} />
            <Text style={styles.exitText}>{copy('vote.back')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.webContainer}>
          {!authResolved ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : !hasLoadError ? (
            <WebView
              key={`production-vote-${votingUrl}-${reloadKey}`}
              ref={webViewRef}
              source={{uri: votingUrl}}
              style={styles.webView}
              originWhitelist={['https://radiotedu.com']}
              javaScriptEnabled
              injectedJavaScriptBeforeContentLoaded={authBootstrap}
              injectedJavaScript={authBootstrap}
              cacheEnabled={false}
              cacheMode="LOAD_NO_CACHE"
              domStorageEnabled={false}
              mixedContentMode="never"
              thirdPartyCookiesEnabled={false}
              sharedCookiesEnabled={false}
              allowFileAccess={false}
              allowFileAccessFromFileURLs={false}
              allowUniversalAccessFromFileURLs={false}
              setSupportMultipleWindows={false}
              javaScriptCanOpenWindowsAutomatically={false}
              webviewDebuggingEnabled={false}
              allowsLinkPreview={false}
              onMessage={handleVotingMessage}
              onShouldStartLoadWithRequest={handleNavigationRequest}
              onNavigationStateChange={(state: {
                url: string;
                canGoBack: boolean;
              }) => {
                if (!isAllowedVotingNavigation(state.url)) {
                  showConnectionError();
                  return;
                }
                setCanGoBack(state.canGoBack);
              }}
              onLoadStart={() => {
                webViewReadyRef.current = false;
                setIsLoading(true);
              }}
              onLoadEnd={handleVotingLoadEnd}
              onError={showConnectionError}
              onHttpError={(event: {
                nativeEvent: {statusCode: number};
              }) => {
                if (event.nativeEvent.statusCode >= 400) {
                  showConnectionError();
                }
              }}
              onRenderProcessGone={() => {
                showConnectionError();
                return true;
              }}
              onContentProcessDidTerminate={showConnectionError}
            />
          ) : (
            <View style={styles.errorPanel}>
              <Icon name="wifi-alert" size={40} color={COLORS.primary} />
              <Text style={styles.errorTitle}>{copy('vote.errorTitle')}</Text>
              <Text style={styles.errorText}>
                {isOffline
                  ? copy('vote.offline')
                  : copy('vote.unavailable')}
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={retry}
                accessibilityRole="button"
                accessibilityLabel={copy('vote.retry')}>
                <Text style={styles.retryButtonText}>{copy('vote.retry')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {isLoading && !hasLoadError ? (
            <View style={styles.loadingPanel} pointerEvents="none">
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>{copy('vote.loading')}</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#07080B',
  },
  exitBar: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  exitButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  exitText: {color: COLORS.text, fontSize: 13, fontWeight: '800'},
  webView: {
    flex: 1,
    backgroundColor: '#07080B',
  },
  loadingPanel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#07080B',
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  errorPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    backgroundColor: '#07080B',
  },
  errorTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.sm,
    minHeight: 46,
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  retryButtonText: {
    color: '#07100d',
    fontSize: 15,
    fontWeight: '800',
  },
});
