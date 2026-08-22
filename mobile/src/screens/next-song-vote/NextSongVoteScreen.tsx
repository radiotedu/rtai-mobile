import React, {useCallback, useEffect, useRef, useState} from 'react';
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
import {getAccessToken} from '../../services/authTokenStorage';
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
import {useAuth} from '../../context/AuthContext';
import {subscribeAuthSessionChanges} from '../../services/authSessionEvents';
import {
  VOTING_WEBVIEW_URL,
  buildVotingAuthInjection,
  classifyVotingNavigation,
  isAllowedVotingNavigation,
  parseVotingWebViewMessage,
  type VotingWebViewAuthState,
} from '../../services/votingWebViewService';
import {COLORS, SPACING} from '../../theme/theme';
import {screenCopy} from '../../i18n/screenCopy';

const WebView = NativeWebView as any;
const EMPTY_AUTH_STATE: VotingWebViewAuthState = {
  accessToken: null,
  user: null,
};

export default function NextSongVoteScreen() {
  const navigation = useNavigation<any>();
  const {i18n} = useTranslation();
  const copy = (key: string) => screenCopy(i18n.language, key);
  const {user} = useAuth();
  const webViewRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const webViewReadyRef = useRef(false);
  const authReadVersionRef = useRef(0);
  const authStateRef = useRef<VotingWebViewAuthState>(EMPTY_AUTH_STATE);
  const [authResolved, setAuthResolved] = useState(false);
  const [authBootstrap, setAuthBootstrap] = useState(
    buildVotingAuthInjection(EMPTY_AUTH_STATE),
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  const injectCurrentAuth = useCallback(() => {
    if (!webViewReadyRef.current) {
      return;
    }
    webViewRef.current?.injectJavaScript(
      buildVotingAuthInjection(authStateRef.current),
    );
  }, []);

  const readAndInjectAuth = useCallback(async () => {
    const requestVersion = ++authReadVersionRef.current;
    let accessToken: string | null = null;

    try {
      accessToken = await getAccessToken();
    } catch {
      accessToken = null;
    }

    if (
      !mountedRef.current ||
      requestVersion !== authReadVersionRef.current
    ) {
      return;
    }

    authStateRef.current =
      accessToken && user && !user.is_guest
        ? {accessToken, user}
        : {accessToken: null, user: null};
    setAuthBootstrap(buildVotingAuthInjection(authStateRef.current));
    setAuthResolved(true);
    injectCurrentAuth();
  }, [injectCurrentAuth, user]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      authReadVersionRef.current += 1;
      webViewReadyRef.current = false;
    };
  }, []);

  useEffect(() => {
    readAndInjectAuth();
  }, [readAndInjectAuth]);

  useEffect(
    () => subscribeAuthSessionChanges(readAndInjectAuth),
    [readAndInjectAuth],
  );

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState === 'active') {
          readAndInjectAuth();
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
  }, [readAndInjectAuth]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (canGoBack) {
          webViewRef.current?.goBack();
        } else {
          navigation.goBack();
        }
        return true;
      },
    );

    return () => backSubscription.remove();
  }, [canGoBack, navigation]);

  const handleVotingMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseVotingWebViewMessage(event.nativeEvent.data);
      if (!message || message.type !== 'radiotedu.voting.ready') {
        return;
      }

      webViewReadyRef.current = true;
      readAndInjectAuth();
    },
    [readAndInjectAuth],
  );

  const handleVotingLoadEnd = useCallback(() => {
    setIsLoading(false);
    // Production page currently has no native-ready postMessage. Treat the
    // completed document as ready, then let the injected bearer bridge trigger
    // its session refresh.
    webViewReadyRef.current = true;
    readAndInjectAuth();
  }, [readAndInjectAuth]);

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
        <View style={styles.webContainer}>
          {!authResolved ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : !hasLoadError ? (
            <WebView
              key={`production-vote-${reloadKey}`}
              ref={webViewRef}
              source={{uri: VOTING_WEBVIEW_URL}}
              style={styles.webView}
              originWhitelist={['https://*']}
              javaScriptEnabled
              injectedJavaScriptBeforeContentLoaded={authBootstrap}
              injectedJavaScript={authBootstrap}
              cacheEnabled={false}
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
