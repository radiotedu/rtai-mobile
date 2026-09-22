import React, {useCallback, useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {WebView as NativeWebView} from 'react-native-webview';
import {useNavigation} from '@react-navigation/native';

import {RESOLVED_SOCIAL_WEB_URL} from '../../services/config';
import {isAllowedSocialNavigation} from '../../services/socialSessionService';
import {COLORS, SPACING} from '../../theme/theme';
import {useTranslation} from 'react-i18next';
import {appCopy} from '../../i18n/appCopy';
import {Analytics} from '../../services/analyticsService';

const WebView = NativeWebView as any;

const SocialWebViewScreen = () => {
  const navigation = useNavigation<any>();
  const {i18n} = useTranslation();
  const copy = (key: string) => appCopy(i18n.language, key);
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

  const allowSocialNavigation = useCallback(
    (request: {url: string}) =>
      isAllowedSocialNavigation(request.url, [RESOLVED_SOCIAL_WEB_URL]),
    [],
  );

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
        <View style={styles.headerCopy}>
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
        {!hasLoadError ? (
          <WebView
            key={webViewNonce}
            source={{uri: RESOLVED_SOCIAL_WEB_URL}}
            style={styles.webView}
            androidLayerType="software"
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
            onLoadEnd={() => {
              Analytics.webView('social', 'load', 'success');
            }}
            onShouldStartLoadWithRequest={allowSocialNavigation}
            onError={() => {
              Analytics.webView('social', 'load', 'error');
              setHasLoadError(true);
            }}
            onHttpError={(event: {nativeEvent: {statusCode: number; url: string}}) => {
              if (event.nativeEvent.url === RESOLVED_SOCIAL_WEB_URL && event.nativeEvent.statusCode >= 400) {
                Analytics.webView('social', 'load', `http_${event.nativeEvent.statusCode}`);
                setHasLoadError(true);
              }
            }}
          />
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
    height: 48,
    minHeight: 48,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  title: {color: COLORS.text, fontSize: 16, fontWeight: '800'},
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
