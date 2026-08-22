import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useRoute} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {WebView as NativeWebView} from 'react-native-webview';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../../context/AuthContext';
import {subscribeAuthSessionChanges} from '../../services/authSessionEvents';
import {getAccessToken} from '../../services/authTokenStorage';
import {
  buildJukeLocalAuthInjection,
  buildJukeLocalControllerUrl,
  isAllowedJukeLocalNavigation,
} from '../../services/jukeLocalWebViewService';
import {COLORS, SPACING} from '../../theme/theme';
import {screenCopy} from '../../i18n/screenCopy';

const WebView = NativeWebView as any;

const JukeLocalWebViewScreen = () => {
  const route = useRoute<any>();
  const {user, isLoading: isAuthLoading} = useAuth();
  const {i18n} = useTranslation();
  const copy = (key: string) => screenCopy(i18n.language, key);
  const webViewRef = useRef<any>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [authResolved, setAuthResolved] = useState(false);
  const [authInjection, setAuthInjection] = useState(
    buildJukeLocalAuthInjection({accessToken: null, user: null}),
  );
  const controllerUrl = useMemo(
    () =>
      buildJukeLocalControllerUrl(
        route.params?.deviceCode ?? route.params?.code,
      ),
    [route.params?.code, route.params?.deviceCode],
  );
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
    const state = accessToken && user && !user.is_guest
      ? {accessToken, user}
      : {accessToken: null, user: null};
    const script = buildJukeLocalAuthInjection(state);
    setAuthInjection(script);
    setAuthResolved(true);
    webViewRef.current?.injectJavaScript(script);
  }, [isAuthLoading, user]);

  useEffect(() => {
    void refreshAuthBridge();
    return subscribeAuthSessionChanges(refreshAuthBridge);
  }, [refreshAuthBridge]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {!authResolved ? (
        <View style={styles.loadingPanel}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.loadingText}>{copy('juke.loading')}</Text>
        </View>
      ) : !hasLoadError ? (
        <WebView
          key={`${controllerUrl}:${reloadKey}`}
          source={{uri: controllerUrl}}
          ref={webViewRef}
          style={styles.webView}
          originWhitelist={['https://radiotedu.com']}
          javaScriptEnabled
          cacheEnabled={false}
          domStorageEnabled
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          injectedJavaScriptBeforeContentLoaded={authInjection}
          injectedJavaScript={authInjection}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingPanel}>
              <ActivityIndicator color={COLORS.primary} size="large" />
              <Text style={styles.loadingText}>{copy('juke.loading')}</Text>
            </View>
          )}
          onShouldStartLoadWithRequest={(request: {url: string}) =>
            isAllowedJukeLocalNavigation(request.url)
          }
          onError={() => setHasLoadError(true)}
          onLoadEnd={() => webViewRef.current?.injectJavaScript(authInjection)}
          onHttpError={(event: {nativeEvent: {statusCode?: number}}) => {
            if ((event.nativeEvent.statusCode ?? 0) >= 500) {
              setHasLoadError(true);
            }
          }}
        />
      ) : (
        <View style={styles.errorPanel}>
          <Icon name="server-network-off" size={36} color={COLORS.primary} />
          <Text style={styles.errorTitle}>{copy('juke.errorTitle')}</Text>
          <Text style={styles.errorText}>
            {copy('juke.errorText')}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setHasLoadError(false);
              setReloadKey(value => value + 1);
            }}>
            <Text style={styles.retryText}>{copy('juke.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#07080B'},
  webView: {flex: 1, backgroundColor: '#07080B'},
  loadingPanel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    backgroundColor: '#07080B',
  },
  loadingText: {color: COLORS.textMuted, fontWeight: '700'},
  errorPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  errorTitle: {color: COLORS.text, fontSize: 22, fontWeight: '900'},
  errorText: {color: COLORS.textMuted, textAlign: 'center', lineHeight: 20},
  retryButton: {
    minWidth: 120,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.primary,
  },
  retryText: {color: '#fff', fontWeight: '900'},
});

export default JukeLocalWebViewScreen;
