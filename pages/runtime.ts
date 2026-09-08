// Public datasets are compressed separately so mobile visitors download only
// the regions they use. Records are handled locally by the preceding adapter.
export function installCompressedData() {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.origin !== window.location.origin || !/\/data\/(?:regions\/)?[^/]+\.json$/.test(url.pathname)) {
      return original(input, init);
    }
    url.pathname += '.gz';
    const response = await original(url, { ...init, cache: 'no-cache' });
    if (!response.ok || !response.body) return response;
    if (!('DecompressionStream' in window)) {
      throw new Error('최신 Safari 또는 Chrome에서 지도를 열어 주세요.');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Some hosts decode gzip themselves. Never decompress twice.
    const stream = bytes[0] === 0x1f && bytes[1] === 0x8b
      ? new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
      : new Blob([bytes]).stream();
    return new Response(stream, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  };
}
