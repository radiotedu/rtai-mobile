async function readIcecastMetadata(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {headers: {'Icy-Metadata': '1'}, signal: controller.signal});
    const fallback = response.headers.get('icy-name') || null;
    const metaint = Number(response.headers.get('icy-metaint') || 0);
    if (!response.body || !metaint) return {title: null, station: fallback};
    const reader = response.body.getReader();
    let buffer = Buffer.alloc(0);
    let audioRemaining = metaint;
    while (buffer.length < metaint + 1 + 16 * 255) {
      const next = await reader.read();
      if (next.done) break;
      buffer = Buffer.concat([buffer, Buffer.from(next.value)]);
      if (buffer.length < audioRemaining + 1) continue;
      const lengthOffset = audioRemaining;
      const metadataBytes = buffer[lengthOffset] * 16;
      if (buffer.length < lengthOffset + 1 + metadataBytes) continue;
      const metadata = buffer.subarray(lengthOffset + 1, lengthOffset + 1 + metadataBytes).toString('utf8').replace(/\0+$/, '');
      const match = metadata.match(/StreamTitle='([^']*)'/i);
      return {title: match?.[1]?.trim() || null, station: fallback};
    }
    return {title: null, station: fallback};
  } catch {
    return {title: null, station: null};
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

async function isLive(url, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {method: 'GET', headers: {Range: 'bytes=0-1'}, signal: controller.signal});
    const contentType = response.headers.get('content-type') || '';
    return response.ok && (/audio|ogg|mpeg|aac|flac/i.test(contentType) || response.status === 206);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

module.exports = {readIcecastMetadata, isLive};
