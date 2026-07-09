export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300'
  };

  const apiKey = env.NEWS_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({
      ok: false,
      message: 'A variável de ambiente NEWS_API_KEY não está configurada no Cloudflare Pages.'
    }), { status: 500, headers });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || 'Brasil OR política OR economia OR tecnologia').trim();
  const endpoint = new URL('https://newsapi.org/v2/everything');

  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('language', 'pt');
  endpoint.searchParams.set('sortBy', 'publishedAt');

  endpoint.searchParams.set('pageSize', '12');
  endpoint.searchParams.set('apiKey', apiKey);

  try {
    const response = await fetch(endpoint.toString(), {
      headers: { 'User-Agent': 'PortalCentralIA/1.0' }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status === 'error') {
      return new Response(JSON.stringify({
        ok: false,
        message: data.message || 'A NewsAPI retornou um erro ao buscar as notícias.'
      }), { status: response.status || 502, headers });
    }

    const articles = (data.articles || [])
      .filter((article) => article && article.title && article.url)
      .sort((a,b) => Number(Boolean(b.urlToImage)) - Number(Boolean(a.urlToImage)))
      .slice(0, 12)
      .map((article) => ({
        titulo: article.title,
        fonte: article.source && article.source.name ? article.source.name : 'Fonte não informada',
        data: article.publishedAt || null,
        url: article.url,
        urlToImage: article.urlToImage || null
      }));

    return new Response(JSON.stringify({ ok: true, articles }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      message: 'Não foi possível conectar à NewsAPI agora. Tente novamente mais tarde.'
    }), { status: 502, headers });
  }
}
