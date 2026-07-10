const CATEGORY_QUERIES = {
  principais: 'Brasil OR política OR economia OR tecnologia',
  brasil: 'Brasil',
  economia: 'economia OR negócios OR mercado financeiro',
  tecnologia: 'inteligência artificial OR tecnologia',
  mundo: 'mundo OR internacional',
  esportes: 'esportes OR futebol',
  saude: 'saúde',
  entretenimento: 'entretenimento OR cultura'
};

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(value = '') {
  return decodeXml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]).trim() : '';
}

function extractImage(block) {
  const media = block.match(/<(?:media:content|media:thumbnail)[^>]+url=["']([^"']+)["']/i);
  if (media) return decodeXml(media[1]);
  const description = tagValue(block, 'description');
  const img = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  return img ? decodeXml(img[1]) : null;
}

function normalizeTitle(rawTitle, rawSource) {
  const title = stripTags(rawTitle);
  const source = stripTags(rawSource);
  if (source && title.endsWith(` - ${source}`)) return title.slice(0, -(source.length + 3)).trim();
  return title;
}

function parseRss(xml) {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return items.map((item) => {
    const source = stripTags(tagValue(item, 'source')) || 'Google Notícias';
    const rawTitle = tagValue(item, 'title');
    return {
      titulo: normalizeTitle(rawTitle, source),
      fonte: source,
      data: tagValue(item, 'pubDate') || null,
      url: stripTags(tagValue(item, 'link')),
      urlToImage: extractImage(item)
    };
  }).filter((article) => article.titulo && article.url);
}

function buildQuery(params = {}) {
  const category = String(params.categoria || '').toLowerCase();
  const supplied = String(params.q || '').trim();
  return supplied || CATEGORY_QUERIES[category] || CATEGORY_QUERIES.principais;
}

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=1800',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const query = buildQuery(event.queryStringParameters || {});
  const endpoint = new URL('https://news.google.com/rss/search');
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('hl', 'pt-BR');
  endpoint.searchParams.set('gl', 'BR');
  endpoint.searchParams.set('ceid', 'BR:pt-419');

  try {
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CentralIA/1.0; +https://portalcentralia.com.br)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });

    if (!response.ok) throw new Error(`Feed indisponível (${response.status})`);
    const xml = await response.text();
    const articles = parseRss(xml).slice(0, 18);

    if (!articles.length) throw new Error('O feed não retornou manchetes neste momento.');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, provider: 'Google News RSS', articles })
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        ok: false,
        message: 'As notícias estão temporariamente indisponíveis. Tente novamente em alguns minutos.'
      })
    };
  }
};
