// geoqartuli-media: serves Live Mug files (video, AR target, photos) from the R2 bucket with CORS and range support.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};
const OK = /^\d{4}\/\d{2}\/[A-Za-z0-9._-]+\.(mp4|mov|webm|mind|webp|jpe?g|png)$/i;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: CORS });
    const key = decodeURIComponent(new URL(request.url).pathname.slice(1));
    if (!OK.test(key)) return new Response('Not found', { status: 404, headers: CORS });

    let range;
    const rh = request.headers.get('range');
    const m = rh && rh.match(/^bytes=(\d*)-(\d*)$/);
    if (m && (m[1] || m[2])) {
      if (m[1]) {
        const start = Number(m[1]);
        range = m[2] ? { offset: start, length: Number(m[2]) - start + 1 } : { offset: start };
      } else {
        range = { suffix: Number(m[2]) };
      }
    }

    const obj = await env.MEDIA.get(key, range ? { range } : {});
    if (!obj) return new Response('Not found', { status: 404, headers: CORS });

    const h = new Headers(CORS);
    obj.writeHttpMetadata(h);
    h.set('ETag', obj.httpEtag);
    h.set('Accept-Ranges', 'bytes');
    h.set('Cache-Control', 'public, max-age=31536000, immutable');
    const body = request.method === 'HEAD' ? null : obj.body;

    if (range) {
      let start, len;
      if ('suffix' in range) { len = Math.min(range.suffix, obj.size); start = obj.size - len; }
      else { start = range.offset; len = Math.min(range.length ?? obj.size - start, obj.size - start); }
      h.set('Content-Range', `bytes ${start}-${start + len - 1}/${obj.size}`);
      h.set('Content-Length', String(len));
      return new Response(body, { status: 206, headers: h });
    }
    h.set('Content-Length', String(obj.size));
    return new Response(body, { headers: h });
  },
};
