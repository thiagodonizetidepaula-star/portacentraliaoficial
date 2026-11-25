export const validSlug = value => typeof value === 'string' && value.length >= 3 && value.length <= 90 &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export const previewPolicy = "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'";

const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

function brandImage(value) {
 const s=String(value||'');
 if(!/^https:\/\/[^<>"'\s\\]+$/i.test(s)||s.length>2000)return '';
 try {
  const u=new URL(s);
  if(u.username||u.password||/(^|\.)portalcentralia\.com\.br$|(^|\.)resonant-puffpuff-6de5a0\.netlify\.app$|(^|\.)portal-prospect-pro\.onrender\.com$/i.test(u.hostname))return '';
  return u.href.replace(/[()]/g,c=>encodeURIComponent(c));
 }catch{return ''}
}
function brandIconSvg(name,category) {
 const k=String(category||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const pet=/pet\s*shop|veterin|animal|banho\s*e\s*tosa|\bpet\b/.test(k);
 const food=/restaur|pizz|hamburg|padaria|cafeter|gastronom/.test(k);
 const auto=/automotiv|oficina|mecanica|veiculo/.test(k);
 const beauty=/beleza|estetic|salao|barbear|manicure/.test(k);
 const initial=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().match(/[A-Z0-9]/)?.[0]||'•';
 const art=pet?'<g fill="#fff"><ellipse cx="17" cy="24" rx="5" ry="7" transform="rotate(-25 17 24)"/><ellipse cx="27" cy="16" rx="5" ry="7"/><ellipse cx="39" cy="16" rx="5" ry="7"/><ellipse cx="49" cy="24" rx="5" ry="7" transform="rotate(25 49 24)"/><path d="M32 28c-7 0-9 7-15 12-7 7-2 15 6 13 4-1 6-3 9-3s5 2 9 3c8 2 13-6 6-13-6-5-8-12-15-12Z"/></g>':food?'<path d="M17 12v15m6-15v15m6-15v15q0 9-6 9v16m24-40q-10 7-10 19h10v21" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>':auto?'<g fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"><path d="m15 30 5-13h24l5 13 5 5v12H10V35z"/><path d="M16 47v5m32-5v5M16 30h32M16 38h7m18 0h7"/></g>':beauty?'<path d="M32 10q3 17 20 22-17 4-20 22-4-18-20-22 16-5 20-22Z" fill="#fff"/>':'<text x="32" y="44" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="36" fill="#fff">'+initial+'</text>';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="'+(pet?'#16766c':food?'#9a552d':auto?'#334155':beauty?'#85557c':'#344d68')+'"/>'+art+'</svg>';
}

function attr(markup,key) {
 const m=new RegExp('\\b'+key+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27)','i').exec(markup||'');
 return (m?.[1]??m?.[2]??'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
function storedLogo(raw) {
 const tag=(raw.match(/<img\b[^>]*>/gi)||[]).find(img=>attr(img,'class').split(/\s+/).includes('brand-logo'));
 return brandImage(attr(tag,'src'));
}
function storedSocialImage(raw) {
 const tags=raw.match(/<meta\b[^>]*>/gi)||[];
 const find=key=>attr(tags.find(t=>attr(t,'property')===key),'content');
 return {url:brandImage(find('og:image')),alt:find('og:image:alt')};
}
export function publicationIcon(row) {
 return brandIconSvg(row.business_name,row.business_category||row.description||row.business_name);
}

export async function readPublication(endpoint, key, slug, prefer = 'slug', fetcher = fetch) {
  const url = new URL('/rest/v1/prospect_site_previews', endpoint);
  url.search = new URLSearchParams({
    or: '(slug.eq.' + slug + ',share_slug.eq.' + slug + ')', status: 'eq.published', limit: '2',
    select: 'slug,share_slug,business_name,business_category,description,cover_image,html,updated_at'
  });
  const response = await fetcher(url, {headers: {apikey: key}, signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error('Leitura da publicação indisponível');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Resposta de publicação inválida');
  return rows.find(row => row[prefer] === slug) || rows[0] || null;
}

export function publicationHtml(row, canonical) {
  const raw = row.html;
  if (typeof raw !== 'string' || raw.length > 280000 || !/<\/head>/i.test(raw)) throw new Error('HTML indisponível');
  const title = String(row.business_name || 'Empresa').slice(0,120);
  const logo=storedLogo(raw), existing=storedSocialImage(raw), cover=brandImage(row.cover_image);
  const image=existing.url&&/^Foto de /i.test(existing.alt)?existing.url:logo||existing.url||cover;
  const imageAlt=image===logo?'Logo de '+title:image===existing.url&&existing.alt?existing.alt:'Imagem de apresentação de '+title;
  const icon=logo||canonical.replace(/\/$/,'')+'/favicon.svg?v=2';
  const identity='<title>'+escape(title)+'</title><link rel="icon"'+(logo?'':' type="image/svg+xml"')+' href="'+escape(icon)+'">'+(logo?'<link rel="apple-touch-icon" href="'+escape(logo)+'">':'');
  const fields = {
    'og:type': 'website', 'og:locale': 'pt_BR', 'og:site_name': title,
    'og:title': title, 'og:description': String(row.description || title).slice(0,160),
    'og:url': canonical
  };
  if (image) { fields['og:image']=image; fields['og:image:alt']=imageAlt; }
  const tags = Object.entries(fields).map(([name, value]) => '<meta property="' + name + '" content="' + escape(value) + '">');
  if (fields['og:image']) tags.push('<meta name="twitter:card" content="summary_large_image">');
  tags.push('<meta name="robots" content="noindex,nofollow">');
  // Remove only the old administrative footer line, including from previously saved HTML.
  const cleaned = raw.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, footer =>
    footer.replace(/<span\b[^>]*>\s*Proposta de site\s*(?:·|&middot;)[\s\S]*?<\/span>/gi, ''));
  // The public renderer owns the social metadata (avoid duplicate tags from final-site HTML).
  return cleaned.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, head => head
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi,'')
    .replace(/<link\b[^>]*>/gi,tag=>/(^|\s)(icon|apple-touch-icon|apple-touch-icon-precomposed|mask-icon)(\s|$)/i.test(attr(tag,'rel'))?'':tag)
    .replace(/<meta\b[^>]*>/gi,tag=>/^og:/i.test(attr(tag,'property'))||/^twitter:/i.test(attr(tag,'name'))||/^robots$/i.test(attr(tag,'name'))?'':tag)
    .replace(/<\/head>/i, () => identity + tags.join('') + '</head>'));
}
