import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {getAccessToken} from '../../services/authTokenStorage';
import {useNavigation, useRoute} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {WebView as NativeWebView} from 'react-native-webview';

import {useAuth} from '../../context/AuthContext';
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

const WebView = NativeWebView as any;

const LibraryStudyWebView = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const webViewRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const authReadVersionRef = useRef(0);
  const {user} = useAuth();
  const {i18n} = useTranslation();
  const copy = (key: string) => screenCopy(i18n.language, key);
  const appText = (key: string) => appCopy(i18n.language, key);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [credentialsReady, setCredentialsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [credentialAccountId, setCredentialAccountId] = useState<string | null>(
    null,
  );
  const roomId = route.params?.locationId === 'chim-alan' ? 'chim-alan' : 'library';
  const isLocked = !user || user.is_guest;

  const account = useMemo(
    () =>
      user
        ? {
            id: user.id,
            displayName: user.display_name,
            authenticated: !user.is_guest,
          }
        : null,
    [user],
  );

  const createBridgeScript = useCallback(
    (token: string | null) => {
      if (!account || !token) {
        return 'true;';
      }
      return createStudyWebViewBridge({
        account,
        globalPoints: Number(user?.rank_score ?? 0),
        apiBase: BASE_API,
        accessToken: token,
      });
    },
    [account, user?.rank_score],
  );

  const refreshAuthBridge = useCallback(async () => {
    const requestVersion = ++authReadVersionRef.current;
    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {
      token = null;
    }

    if (
      !mountedRef.current ||
      requestVersion !== authReadVersionRef.current
    ) {
      return;
    }

    const nextToken = user && !user.is_guest ? token : null;
    setAccessToken(nextToken);
    setCredentialAccountId(user?.id ?? null);
    setCredentialsReady(true);
    webViewRef.current?.injectJavaScript(
      nextToken
        ? createBridgeScript(nextToken)
        : createStudyAuthClearInjection(),
    );
  }, [createBridgeScript, user]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      authReadVersionRef.current += 1;
    };
  }, []);

  useEffect(() => {
    refreshAuthBridge();
    return subscribeAuthSessionChanges(refreshAuthBridge);
  }, [refreshAuthBridge]);

  const bridgeScript = useMemo(() => {
    return createBridgeScript(accessToken);
  }, [accessToken, createBridgeScript]);

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

  if (!credentialsReady || credentialAccountId !== user?.id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!accessToken) {
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
