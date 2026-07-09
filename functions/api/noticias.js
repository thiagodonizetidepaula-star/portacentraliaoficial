function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
function cleanText(value){return String(value||'').replace(/<!\[CDATA\[(.*?)\]\]>/gs,'$1').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();}
function xmlValue(item,tag){const re=new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i');const m=item.match(re);return m?cleanText(m[1]):'';}
async function fallbackRss(query){const q=encodeURIComponent(query||'Brasil notícias');const r=await fetch(`https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`);if(!r.ok)throw new Error('Falha ao consultar RSS.');const xml=await r.text();const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,12);return{ok:true,source:'rss',articles:items.map(m=>{const item=m[1];return{titulo:xmlValue(item,'title'),fonte:xmlValue(item,'source')||'Google Notícias',data:xmlValue(item,'pubDate')||null,url:xmlValue(item,'link'),urlToImage:null};}).filter(a=>a.titulo&&a.url)}}
export async function onRequestGet({request, env}) {
  const url = new URL(request.url);
  const rawQuery = (url.searchParams.get('q') || '').trim();
  const query = rawQuery || 'Brasil OR política OR economia OR tecnologia';
  const apiKey = env.NEWS_API_KEY;
  if (!apiKey) return json(await fallbackRss(query));
  const endpoint = new URL(rawQuery ? 'https://newsapi.org/v2/everything' : 'https://newsapi.org/v2/top-headlines');
  if (rawQuery) { endpoint.searchParams.set('q', query); endpoint.searchParams.set('language','pt'); endpoint.searchParams.set('sortBy','publishedAt'); }
  else { endpoint.searchParams.set('country','br'); }
  endpoint.searchParams.set('pageSize','12'); endpoint.searchParams.set('apiKey',apiKey);
  try { const resp=await fetch(endpoint.toString(),{headers:{'User-Agent':'PortalCentralIA/1.0'}}); const data=await resp.json().catch(()=>({})); if(!resp.ok||data.status==='error') return json(await fallbackRss(query)); const articles=(data.articles||[]).filter(a=>a&&a.title&&a.url).sort((a,b)=>Number(Boolean(b.urlToImage))-Number(Boolean(a.urlToImage))).slice(0,12).map(a=>({titulo:a.title,fonte:a.source&&a.source.name?a.source.name:'Fonte não informada',data:a.publishedAt||null,url:a.url,urlToImage:a.urlToImage||null})); return json({ok:true,source:'newsapi',articles}); } catch(e) { return json(await fallbackRss(query)); }
}
