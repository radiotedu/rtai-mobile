import {logSafeError} from './safeLog';

export const fetchAlbumArtwork = async (
  term: string,
  timeoutMs = 2500,
): Promise<string | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        term,
      )}&media=music&entity=song&limit=1`,
      {signal: controller.signal},
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();

    if (
      data?.resultCount > 0 &&
      Array.isArray(data.results) &&
      typeof data.results[0]?.artworkUrl100 === 'string'
    ) {
      // Get higher resolution image (600x600)
      return data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

// Check if a stream URL is available/reachable
export const checkStreamAvailability = async (
  streamUrl: string,
): Promise<boolean> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    console.log(`Checking stream: ${streamUrl}`);
    const controller = new AbortController();
    // A live mount should return headers immediately. A timeout is not proof
    // that a station is on air: treating it as live made dormant mounts appear
    // in the station list.
    timeoutId = setTimeout(() => controller.abort(), 5000);

    // HEAD validates headers without opening the endless audio body. Android's
    // fetch can wait for GET body bytes and hide a healthy live mount on timeout.
    const response = await fetch(streamUrl, {
      method: 'HEAD',
      headers: {'Cache-Control': 'no-cache'},
      cache: 'no-store', // Don't use cached responses
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    timeoutId = undefined;

    // Check status code
    const isStatusValid = response.status === 200 || response.status === 206;

    // Check Content-Type to avoid treating HTML pages (200 OK) as audio streams
    const contentType = response.headers.get('content-type');
    const isAudio = contentType
      ? contentType.includes('audio/') ||
        contentType.includes('application/ogg') ||
        contentType.includes('application/x-mpegURL') ||
        contentType.includes('application/vnd.apple.mpegurl')
      : false;

    // Strict check: Must be 200/206 AND be an audio/playlist type
    const isValid = isStatusValid && isAudio;

    console.log(`Stream Check Results:
        - URL: ${streamUrl}
        - Status: ${response.status}
        - Content-Type: ${contentType}
        - isStatusValid: ${isStatusValid}
        - isAudio: ${isAudio}
        - FINAL DECISION: ${isValid}`);

    return isValid;
  } catch (error: any) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    logSafeError('stream.availability', error);
    return false;
  }
};
