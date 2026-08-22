import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {getAccessToken} from '../../services/authTokenStorage';
import {useNavigation, useRoute} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {WebView as NativeWebView} from 'react-native-webview';

import {useAuth} from '../../context/AuthContext';
import {BASE_API} from '../../services/config';
import {
  buildStudyEntryUrl,
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
  const {user} = useAuth();
  const {i18n} = useTranslation();
  const copy = (key: string) => screenCopy(i18n.language, key);
  const appText = (key: string) => appCopy(i18n.language, key);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [credentialsReady, setCredentialsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const roomId = route.params?.locationId === 'chim-alan' ? 'chim-alan' : 'library';
  const isLocked = !user || user.is_guest;

  useEffect(() => {
    let active = true;
    getAccessToken()
      .then(token => {
        if (active) {
          setAccessToken(token);
          setCredentialsReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setAccessToken(null);
          setCredentialsReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

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

  const bridgeScript = useMemo(() => {
    if (!account) {
      return 'true;';
    }
    const publicInput = {
      account,
      globalPoints: Number(user?.rank_score ?? 0),
    };
    if (!accessToken) {
      return 'true;';
    }
    return createStudyWebViewBridge({
      ...publicInput,
      apiBase: BASE_API,
      accessToken,
    });
  }, [accessToken, account, user?.rank_score]);

  const gameUrl = buildStudyEntryUrl(roomId);

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

  if (!credentialsReady) {
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
        key={`remote-study-${reloadKey}`}
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
