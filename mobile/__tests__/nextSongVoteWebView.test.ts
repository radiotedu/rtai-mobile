import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('NextSongVote production WebView surface', () => {
  const screenSource = fs.readFileSync(
    path.join(__dirname, '../src/screens/next-song-vote/NextSongVoteScreen.tsx'),
    'utf8',
  );

  it('mounts the production Voting WebView instead of the native voting client', () => {
    expect(screenSource).toContain('buildVotingWebViewUrl');
    expect(screenSource).toContain('source={{uri: votingUrl}}');
    expect(screenSource).toContain('i18n.resolvedLanguage ?? i18n.language');
    expect(screenSource).not.toContain('NextSongVotePanel');
    expect(screenSource).not.toContain('socket.io-client');
    expect(screenSource).not.toContain('nextSongVote');
    expect(screenSource).not.toContain('setInterval(');
    expect(screenSource).not.toContain('submitNextSongVote');
  });

  it('injects account auth before the page bundle starts and refreshes it at runtime', () => {
    expect(screenSource).toContain("message.type !== 'radiotedu.voting.ready'");
    expect(screenSource).toContain('webViewReadyRef.current = true');
    expect(screenSource).toContain('webViewRef.current?.injectJavaScript(');
    expect(screenSource).toContain('buildVotingAuthInjection(authStateRef.current)');
    expect(screenSource).toContain('injectedJavaScriptBeforeContentLoaded={authBootstrap}');
    expect(screenSource).toContain('injectedJavaScript={authBootstrap}');
    expect(screenSource).toContain('createLatestRefreshCoordinator');
    expect(screenSource).toContain('resolveStableWebViewSession');
    expect(screenSource).toContain('readStoredWebViewCredential');
    expect(screenSource).toContain('coordinator.dispose()');
  });

  it('locks down navigation, cookies, mixed content, files, windows, and debugging', () => {
    expect(screenSource).toContain('onShouldStartLoadWithRequest={handleNavigationRequest}');
    expect(screenSource).toContain('mixedContentMode="never"');
    expect(screenSource).toContain('thirdPartyCookiesEnabled={false}');
    expect(screenSource).toContain('sharedCookiesEnabled={false}');
    expect(screenSource).toContain('allowFileAccess={false}');
    expect(screenSource).toContain('allowUniversalAccessFromFileURLs={false}');
    expect(screenSource).toContain('setSupportMultipleWindows={false}');
    expect(screenSource).toContain('webviewDebuggingEnabled={false}');
  });

  it('implements retry, renderer failure, foreground auth refresh, and Android back handling', () => {
    expect(screenSource).toContain("copy('vote.errorTitle')");
    expect(screenSource).toContain("copy('vote.retry')");
    expect(screenSource).toContain('onRenderProcessGone');
    expect(screenSource).toContain('onContentProcessDidTerminate');
    expect(screenSource).toContain('AppState.addEventListener(');
    expect(screenSource).toContain("'change'");
    expect(screenSource).toContain('.handleAppStateChange(nextState, undefined)');
    expect(screenSource).toContain('cacheMode="LOAD_NO_CACHE"');
    expect(screenSource).toContain('BackHandler.addEventListener(');
    expect(screenSource).toContain("'hardwareBackPress'");
    expect(screenSource).toContain('leaveVoting();');
    expect(screenSource).toContain("copy('vote.back')");
    expect(screenSource).not.toContain('webViewRef.current?.goBack()');
  });

  it('re-injects auth when the shared native session token changes', () => {
    const apiSource = fs.readFileSync(
      path.join(__dirname, '../src/services/api.ts'),
      'utf8',
    );
    const authSource = fs.readFileSync(
      path.join(__dirname, '../src/context/AuthContext.tsx'),
      'utf8',
    );

    expect(screenSource).toContain('subscribeAuthSessionChanges(() => {');
    expect(screenSource).toContain('requestSessionRefresh().catch(() => undefined);');
    expect(apiSource).toContain('notifyAuthSessionChanged()');
    expect(authSource).toContain('notifyAuthSessionChanged()');
  });
});
