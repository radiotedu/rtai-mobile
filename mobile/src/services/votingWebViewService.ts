import {parseHttpUrl} from './safeHttpUrlService';
import {
  buildWebViewAccountBridge,
  type WebViewAccountAuthState,
} from './webViewAccountBridge';
import {normalizeWebViewLocale} from './webViewLocale';

export const VOTING_WEBVIEW_URL = 'https://radiotedu.com/vote/?embed=1';

export function buildVotingWebViewUrl(locale?: unknown) {
  return `${VOTING_WEBVIEW_URL}&lang=${normalizeWebViewLocale(locale)}`;
}

export type VotingWebViewAuthState = WebViewAccountAuthState;

export type VotingWebViewMessage =
  | {type: 'radiotedu.voting.ready'}
  | {
      type: 'radiotedu.voting.vote-recorded';
      roundId: string;
      candidateId: string;
    }
  | {
      type: 'radiotedu.voting.round';
      roundId: string;
      title: string;
      startedAt: string;
      endsAt: string;
      active: boolean;
    };

export type VotingNavigationDecision =
  | 'allowed'
  | 'external-https'
  | 'blocked';

function isTrustedExternalHost(hostname: string) {
  return (
    hostname === 'radiotedu.com' ||
    hostname === 'tedu.edu.tr' ||
    hostname.endsWith('.tedu.edu.tr')
  );
}

export function isAllowedVotingNavigation(url: string) {
  const candidate = parseHttpUrl(url);
  if (!candidate) {
    return false;
  }

  return (
    candidate.protocol === 'https:' &&
    candidate.hostname === 'radiotedu.com' &&
    candidate.port === '' &&
    !candidate.hasCredentials &&
    (candidate.pathname === '/vote' || candidate.pathname === '/vote/')
  );
}

export function classifyVotingNavigation(
  url: string,
): VotingNavigationDecision {
  if (isAllowedVotingNavigation(url)) {
    return 'allowed';
  }

  const candidate = parseHttpUrl(url);
  if (
    candidate?.protocol === 'https:' &&
    isTrustedExternalHost(candidate.hostname) &&
    !candidate.hasCredentials
  ) {
    return 'external-https';
  }

  return 'blocked';
}

export function parseVotingWebViewMessage(
  rawMessage: string,
): VotingWebViewMessage | null {
  try {
    const message = JSON.parse(rawMessage) as Record<string, unknown>;
    if (message.type === 'radiotedu.voting.ready') {
      return {type: 'radiotedu.voting.ready'};
    }

    if (
      message.type === 'radiotedu.voting.vote-recorded' &&
      typeof message.roundId === 'string' &&
      typeof message.candidateId === 'string'
    ) {
      return {
        type: 'radiotedu.voting.vote-recorded',
        roundId: message.roundId,
        candidateId: message.candidateId,
      };
    }

    if (
      message.type === 'radiotedu.voting.round' &&
      typeof message.roundId === 'string' &&
      typeof message.title === 'string' &&
      typeof message.startedAt === 'string' &&
      typeof message.endsAt === 'string' &&
      typeof message.active === 'boolean'
    ) {
      return {
        type: 'radiotedu.voting.round',
        roundId: message.roundId,
        title: message.title,
        startedAt: message.startedAt,
        endsAt: message.endsAt,
        active: message.active,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function buildVotingAuthInjection(authState: VotingWebViewAuthState) {
  return buildWebViewAccountBridge(authState, ['/jukebox/api/v1/']);
}
