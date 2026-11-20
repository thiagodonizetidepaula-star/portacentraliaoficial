import { publicationHtml, readPublication, validSlug, previewPolicy } from '../lib/prospect-page.mjs';

// This is the same public project configuration provided to visitors by the studio.
// Anonymous database access is restricted by its published-only row policy.
const project = 'https://ddysnwudsvnekyfxnphh.supabase.co';
const publishableKey = 'sb_publishable_BUK4ETyDsqKuFk_ja4SmMA_YPHtzvOP';
export const config = {path: '/p/*'};

const commonHeaders = {
  'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'X-Prospect-Updated'
};

export default async function handler(request) {
  const url = new URL(request.url);
  const slug = /^\/p\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  const message = (status, body) => new Response(request.method === 'HEAD' ? null : body, {
    status, headers: {...commonHeaders, 'Content-Type':'text/plain; charset=utf-8'}
  });
  if (!['GET','HEAD'].includes(request.method)) return message(405, 'Método não permitido.');
  if (!validSlug(slug)) return message(404, 'Prévia não encontrada.');
  try {
    const row = await readPublication(project, publishableKey, slug);
    if (!row) return message(404, 'Esta prévia não está publicada.');
    const html = publicationHtml(row, url.origin + '/p/' + slug);
    return new Response(request.method === 'HEAD' ? null : html, {headers: {
      ...commonHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': previewPolicy,
      'X-Frame-Options': 'SAMEORIGIN', 'X-Prospect-Updated': String(Date.parse(row.updated_at)),
      'Netlify-CDN-Cache-Control': 'public, max-age=5, durable'
    }});
  } catch {
    return message(503, 'Não foi possível carregar a prévia. Tente de novo em instantes.');
  }
}
