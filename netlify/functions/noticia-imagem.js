const FALLBACKS = {
  brasil: '/assets/img/noticias/brasil.svg',
  economia: '/assets/img/noticias/economia.svg',
  tecnologia: '/assets/img/noticias/tecnologia.svg',
  mundo: '/assets/img/noticias/mundo.svg',
  esportes: '/assets/img/noticias/esportes.svg',
  saude: '/assets/img/noticias/saude.svg',
  entretenimento: '/assets/img/noticias/entretenimento.svg',
  principais: '/assets/img/noticias/principais.svg'
};

function absoluteUrl(value, base) {
  if (!value) return null;
  try { return new URL(value, base).href; } catch (_) { return null; }
}

function extractMeta(html, baseUrl) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const url = match && absoluteUrl(match[1].replace(/&amp;/g, '&'), baseUrl);
    if (url && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const tema = String(params.tema || 'principais').toLowerCase();
  const fallback = FALLBACKS[tema] || FALLBACKS.principais;
  const seed = String(params.seed || `centralia-${tema}`).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  const photoFallback = `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/700`;
  const target = String(params.url || '').trim();
  const cache = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';

  if (!/^https?:\/\//i.test(target)) {
    return { statusCode: 302, headers: { Location: photoFallback, 'Cache-Control': cache }, body: '' };
  }

  try {
    const response = await fetch(target, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CentralIA/1.0; +https://portalcentralia.com.br)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) throw new Error('Página indisponível');
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new Error('Conteúdo inválido');
    const html = (await response.text()).slice(0, 500000);
    const image = extractMeta(html, response.url || target);
    if (!image) throw new Error('Imagem não encontrada');
    return { statusCode: 302, headers: { Location: image, 'Cache-Control': cache }, body: '' };
  } catch (_) {
    return { statusCode: 302, headers: { Location: photoFallback, 'Cache-Control': cache }, body: '' };
  }
};
