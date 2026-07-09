exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        message: 'A variável de ambiente NEWS_API_KEY não está configurada no Netlify.'
      })
    };
  }

  const query = (event.queryStringParameters && event.queryStringParameters.q) || 'Brasil OR economia OR tecnologia OR política';
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
      return {
        statusCode: response.status || 502,
        headers,
        body: JSON.stringify({
          ok: false,
          message: data.message || 'A NewsAPI retornou um erro ao buscar as notícias.'
        })
      };
    }

    const articles = (data.articles || [])
      .filter(article => article && article.title && article.url)
      .sort((a, b) => Number(Boolean(b.urlToImage)) - Number(Boolean(a.urlToImage)))
      .slice(0, 12)
      .map(article => ({
        titulo: article.title,
        fonte: article.source && article.source.name ? article.source.name : 'Fonte não informada',
        data: article.publishedAt || null,
        url: article.url,
        urlToImage: article.urlToImage || null
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, articles })
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        ok: false,
        message: 'Não foi possível conectar à NewsAPI agora. Tente novamente mais tarde.'
      })
    };
  }
};
