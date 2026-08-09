import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), '..');

function namedUrl(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*['\"](https:\\/\\/[^'\"]+)['\"]`));
  if (!match) throw new Error(`Could not read ${name} from source.`);
  return match[1];
}

export async function loadConfiguredServices(root = repositoryRoot) {
  const [juke, voting, study, channels] = await Promise.all([
    readFile(path.join(root, 'mobile/src/services/jukeLocalWebViewService.ts'), 'utf8'),
    readFile(path.join(root, 'mobile/src/services/votingWebViewService.ts'), 'utf8'),
    readFile(path.join(root, 'mobile/src/services/studyWebViewService.ts'), 'utf8'),
    readFile(path.join(root, 'mobile/android/formfactor/src/main/java/com/radiotedumobile/formfactor/RadioChannels.kt'), 'utf8'),
  ]);

  const streams = [...channels.matchAll(/RadioChannel\([^\n]+"(https:\/\/stream\.radiotedu\.com\/[^"?]+)"\)/g)]
    .map(match => ({kind: 'stream', name: new URL(match[1]).pathname.slice(1), url: match[1]}));

  return [
    {kind: 'webview', name: 'juke-local', url: namedUrl(juke, 'JUKE_LOCAL_CONTROLLER_URL')},
    {kind: 'webview', name: 'voting', url: namedUrl(voting, 'VOTING_WEBVIEW_URL')},
    {kind: 'webview', name: 'study', url: namedUrl(study, 'STUDY_REMOTE_ROOT')},
    ...streams,
  ];
}

export async function probeService(service, {fetchImpl = fetch, timeoutMs = 15_000} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(service.url, {
      headers: service.kind === 'stream' ? {Accept: 'audio/*', Range: 'bytes=0-2047'} : {},
      redirect: 'follow',
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (service.kind === 'webview' && !contentType.includes('text/html')) {
      throw new Error(`unexpected content type ${contentType || '(missing)'}`);
    }
    if (service.kind === 'stream' && !/^(audio\/|application\/(ogg|octet-stream))/.test(contentType)) {
      throw new Error(`unexpected content type ${contentType || '(missing)'}`);
    }
    if (service.kind === 'stream' && response.body) {
      const reader = response.body.getReader();
      const {value} = await reader.read();
      await reader.cancel();
      if (!value?.byteLength) throw new Error('empty stream response');
    }
    return {contentType, status: response.status};
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyLiveServices(options = {}) {
  const services = await loadConfiguredServices(options.root);
  const results = [];
  for (const service of services) {
    try {
      const response = await probeService(service, options);
      results.push({...service, ok: true, ...response});
    } catch (error) {
      results.push({...service, ok: false, error: error instanceof Error ? error.message : String(error)});
    }
  }
  return results;
}

export function isBlockingFailure(result, {allowUnavailableStreams = false} = {}) {
  return !result.ok && !(allowUnavailableStreams && result.kind === 'stream');
}

if (path.resolve(process.argv[1] ?? '') === scriptPath) {
  const allowUnavailableStreams = process.argv.includes('--allow-unavailable-streams');
  const results = await verifyLiveServices();
  for (const result of results) {
    const allowed = !result.ok && allowUnavailableStreams && result.kind === 'stream';
    console.log(`${result.ok ? 'PASS' : allowed ? 'WARN' : 'FAIL'} | ${result.kind} | ${result.name} | ${result.ok ? `HTTP ${result.status}` : result.error}`);
  }
  if (results.some(result => isBlockingFailure(result, {allowUnavailableStreams}))) process.exitCode = 1;
}
