import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {WebView as NativeWebView, WebViewMessageEvent} from 'react-native-webview';
import {useNavigation} from '@react-navigation/native';

import AuthGuard from '../../components/AuthGuard';
import {useAuth} from '../../context/AuthContext';
import {subscribeAuthSessionChanges} from '../../services/authSessionEvents';
import {getAccessToken} from '../../services/authTokenStorage';
import {RESOLVED_SOCIAL_WEB_URL} from '../../services/config';
import {
  buildSocialAuthInjection,
  isAllowedSocialNavigation,
  parseSocialMessage,
} from '../../services/socialSessionService';
import {COLORS, SPACING} from '../../theme/theme';
import {useTranslation} from 'react-i18next';
import {appCopy} from '../../i18n/appCopy';
import {Analytics} from '../../services/analyticsService';

const WebView = NativeWebView as any;

const SocialWebViewScreen = () => {
  const navigation = useNavigation<any>();
  const webViewRef = useRef<any>(null);
  const {user, isLoading: isAuthLoading, refreshSession} = useAuth();
  const {i18n} = useTranslation();
  const copy = (key: string) => appCopy(i18n.language, key);
  const isRegisteredUser = Boolean(user && !user.is_guest);
  const [isPreparingSession, setIsPreparingSession] = useState(true);
  const [authResolved, setAuthResolved] = useState(false);
  const [authInjection, setAuthInjection] = useState(
    buildSocialAuthInjection({accessToken: null, user: null}, null),
  );
  const [webViewNonce, setWebViewNonce] = useState(0);
  const [hasLoadError, setHasLoadError] = useState(false);
  const leaveSocial = useCallback(() => {
    Analytics.webView('social', 'leave', 'success');
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs', {screen: 'Home'});
    }
  }, [navigation]);

  useEffect(() => {
    let isMounted = true;

    async function prepareSession() {
      try {
        await refreshSession();
      } catch {
        // AuthGuard handles a session that becomes invalid after refresh.
      } finally {
        if (isMounted) {
          setIsPreparingSession(false);
          setWebViewNonce((value) => value + 1);
        }
      }
    }

    prepareSession().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [refreshSession, user?.id]);

  const refreshAuthBridge = useCallback(async () => {
    if (isAuthLoading) {
      setAuthResolved(false);
      return;
    }
    let accessToken: string | null = null;
    try {
      accessToken = await getAccessToken();
    } catch {
      accessToken = null;
    }
    const eligibleUser = accessToken && user && !user.is_guest ? user : null;
    const script = buildSocialAuthInjection(
      {accessToken: eligibleUser ? accessToken : null, user: eligibleUser},
      eligibleUser,
    );
    setAuthInjection(script);
    setAuthResolved(true);
    webViewRef.current?.injectJavaScript(script);
  }, [isAuthLoading, user]);

  useEffect(() => {
    refreshAuthBridge().catch(() => undefined);
    return subscribeAuthSessionChanges(refreshAuthBridge);
  }, [refreshAuthBridge]);

  const injectAccount = useCallback(() => {
    webViewRef.current?.injectJavaScript(authInjection);
  }, [authInjection]);

  const handleSocialMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseSocialMessage(event.nativeEvent.data);
      if (message) {
        injectAccount();
      }
    },
    [injectAccount],
  );

  const allowSocialNavigation = useCallback(
    (request: {url: string}) =>
      isAllowedSocialNavigation(request.url, [RESOLVED_SOCIAL_WEB_URL]),
    [],
  );

  if (!isRegisteredUser) {
    return (
      <AuthGuard
        title={copy('social.registerTitle')}
        message={copy('social.registerText')}
        icon="account-group-outline"
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={leaveSocial}
          accessibilityRole="button"
          accessibilityLabel={copy('social.back')}>
          <Icon name="chevron-left" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          <Icon name="account-group" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>RadioTEDU</Text>
          <Text style={styles.title}>{copy('social.title')}</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            Analytics.webView('social', 'reload', 'requested');
            setHasLoadError(false);
            setWebViewNonce((value) => value + 1);
          }}
          accessibilityLabel={copy('social.reload')}>
          <Icon name="refresh" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.webContainer}>
        {!isPreparingSession && authResolved && !hasLoadError ? (
          <WebView
            key={`${user?.id || 'anonymous'}-account-${webViewNonce}`}
            ref={webViewRef}
            source={{uri: RESOLVED_SOCIAL_WEB_URL}}
            style={styles.webView}
            originWhitelist={['https://radiotedu.com']}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled={false}
            cacheMode="LOAD_NO_CACHE"
            sharedCookiesEnabled={false}
            thirdPartyCookiesEnabled={false}
            mixedContentMode="never"
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically={false}
            webviewDebuggingEnabled={false}
            allowsLinkPreview={false}
            injectedJavaScriptBeforeContentLoaded={authInjection}
            injectedJavaScript={authInjection}
            onLoadEnd={() => {
              injectAccount();
              Analytics.webView('social', 'load', 'success');
            }}
            onMessage={handleSocialMessage}
            onShouldStartLoadWithRequest={allowSocialNavigation}
            onError={() => {
              Analytics.webView('social', 'load', 'error');
              setHasLoadError(true);
            }}
            onHttpError={(event: {nativeEvent: {statusCode: number}}) => {
              if (event.nativeEvent.statusCode >= 400) {
                Analytics.webView('social', 'load', `http_${event.nativeEvent.statusCode}`);
                setHasLoadError(true);
              }
            }}
          />
        ) : null}

        {isPreparingSession ? (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : null}

        {hasLoadError ? (
          <View style={styles.errorPanel}>
            <Icon name="wifi-alert" size={30} color={COLORS.primary} />
            <Text style={styles.errorTitle}>{copy('social.loadError')}</Text>
            <Text style={styles.errorText}>{copy('social.loadErrorText')}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                Analytics.webView('social', 'retry', 'requested');
                setHasLoadError(false);
                setWebViewNonce((value) => value + 1);
              }}>
              <Text style={styles.retryButtonText}>{copy('social.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  header: {
    minHeight: 58,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(227,30,36,0.12)',
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerCopy: {flex: 1},
  kicker: {color: COLORS.primary, fontSize: 10, fontWeight: '900', textTransform: 'uppercase'},
  title: {color: COLORS.text, fontSize: 17, fontWeight: '900'},
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  webContainer: {flex: 1, backgroundColor: '#000'},
  webView: {flex: 1, backgroundColor: '#000'},
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  errorPanel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  errorTitle: {color: COLORS.text, fontSize: 20, fontWeight: '900'},
  errorText: {color: COLORS.textMuted, fontSize: 13, textAlign: 'center'},
  retryButton: {
    minWidth: 110,
    minHeight: 42,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  retryButtonText: {color: '#fff', fontSize: 14, fontWeight: '900'},
});

export default SocialWebViewScreen;
