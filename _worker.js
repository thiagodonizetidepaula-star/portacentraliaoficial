const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function cleanText(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function xmlValue(item, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = item.match(re);
  return match ? cleanText(match[1]) : '';
}

function extractImage(item) {
  const media = item.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
                item.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) ||
                item.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  return media ? media[1] : null;
}

async function fallbackRss(query) {
  const q = encodeURIComponent(query || 'Brasil notícias');
  const rssUrl = `https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  const response = await fetch(rssUrl, {
    headers: { 'User-Agent': 'PortalCentralIA/1.0' }
  });
  if (!response.ok) throw new Error('Falha ao consultar RSS de notícias.');
  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 12);
  const articles = items.map((m) => {
    const item = m[1];
    const source = xmlValue(item, 'source') || 'Google Notícias';
    return {
      titulo: xmlValue(item, 'title'),
      fonte: source,
      data: xmlValue(item, 'pubDate') || null,
      url: xmlValue(item, 'link'),
      urlToImage: extractImage(item)
    };
  }).filter(a => a.titulo && a.url);
  return { ok: true, source: 'rss', articles };
}

async function newsApi(request, env) {
  const url = new URL(request.url);
  const rawQuery = (url.searchParams.get('q') || '').trim();
  const query = rawQuery || 'Brasil OR política OR economia OR tecnologia';
  const apiKey = env.NEWS_API_KEY;

  if (!apiKey) {
    // Fallback para o site não ficar vazio enquanto a variável não estiver configurada.
    return json(await fallbackRss(query));
  }

  const endpoint = new URL(rawQuery ? 'https://newsapi.org/v2/everything' : 'https://newsapi.org/v2/top-headlines');
  if (rawQuery) {
    endpoint.searchParams.set('q', query);
    endpoint.searchParams.set('language', 'pt');
    endpoint.searchParams.set('sortBy', 'publishedAt');
  } else {
    endpoint.searchParams.set('country', 'br');
  }
  endpoint.searchParams.set('pageSize', '12');
  endpoint.searchParams.set('apiKey', apiKey);

  try {
    const response = await fetch(endpoint.toString(), {
      headers: { 'User-Agent': 'PortalCentralIA/1.0' }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status === 'error') {
      // Se a NewsAPI bloquear ou falhar, mantém o portal com notícias via RSS.
      return json(await fallbackRss(query));
    }

    const articles = (data.articles || [])
      .filter((article) => article && article.title && article.url)
      .sort((a, b) => Number(Boolean(b.urlToImage)) - Number(Boolean(a.urlToImage)))
      .slice(0, 12)
      .map((article) => ({
        titulo: article.title,
        fonte: article.source && article.source.name ? article.source.name : 'Fonte não informada',
        data: article.publishedAt || null,
        url: article.url,
        urlToImage: article.urlToImage || null
      }));

    if (!articles.length) return json(await fallbackRss(query));
    return json({ ok: true, source: 'newsapi', articles });
  } catch (error) {
    return json(await fallbackRss(query));
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/noticias' || url.pathname === '/api/noticias/') {
      return newsApi(request, env);
    }

    // Cloudflare Workers com Static Assets usa o binding ASSETS para servir HTML/CSS/JS.
    if (env.ASSETS) {
      let response = await env.ASSETS.fetch(request);
      if (response.status !== 404) return response;

      // Fallback para URLs limpas sem .html.
      if (!url.pathname.includes('.') && url.pathname !== '/') {
        const htmlRequest = new Request(new URL(url.pathname.replace(/\/$/, '') + '.html', url.origin), request);
        response = await env.ASSETS.fetch(htmlRequest);
        if (response.status !== 404) return response;
      }
      return env.ASSETS.fetch(new Request(new URL('/index.html', url.origin), request));
    }

    return new Response('Portal Central IA Worker ativo, mas os assets não foram vinculados.', { status: 500 });
  }
};
