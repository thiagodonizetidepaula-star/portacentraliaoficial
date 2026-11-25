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

const qualityCss="/* prospect-design-quality-v1 */\n.site-header.container{gap:clamp(12px,3vw,36px);min-height:70px;border-bottom:1px solid color-mix(in srgb,var(--ink) 14%,transparent);padding-block:10px}\n.site-header .brand{font-size:clamp(17px,2vw,23px);font-weight:750;letter-spacing:-.035em;line-height:1.2}\n.site-header nav{gap:clamp(8px,1.7vw,24px);font-weight:600}\n.site-header nav a,.site-header nav a:not(:last-child){border:0!important;box-shadow:none!important;min-height:44px;padding:0 4px;font-size:14px;font-weight:600;line-height:1.2}\n.site-header nav a.nav-cta{background:var(--accent);color:var(--buttonInk,var(--ink));border-radius:999px!important;padding-inline:19px;text-decoration:none}\n.site-header nav a:focus-visible{outline:2px solid currentColor;outline-offset:4px}\n.site-header nav a:hover{text-underline-offset:5px}\n.hero h1{overflow-wrap:break-word;text-wrap:balance;line-height:1.07;letter-spacing:-.04em}\n.hero .hero-summary{line-height:1.6;max-width:52ch;text-wrap:pretty}\n.hero-button,.cta-button{min-height:48px;line-height:1.35;font-size:clamp(14px,1.3vw,16px)}\n.story-copy p+p{margin-top:1em}\n.brand-portfolio .portfolio-strip img{border-radius:12px}\n.footer{border-top:1px solid color-mix(in srgb,var(--ink) 14%,transparent)}\n@media(max-width:850px){\n .site-header.container{display:block;padding:12px 20px 5px}\n .site-header .brand{display:inline-flex;min-height:28px;max-width:100%}\n .site-header nav{display:flex;flex-wrap:wrap;justify-content:flex-start;gap:0 15px;margin-top:3px}\n .site-header nav a,.site-header nav a:not(:last-child){display:inline-flex;min-height:44px;padding:0;font-size:13px}\n .site-header nav a.nav-cta{background:transparent;color:inherit;padding:0;border-radius:0!important}\n .site-header nav a.nav-cta:hover{text-decoration:underline}\n main,main>section[id]{scroll-margin-top:148px}\n body .hero.immersive{height:auto;min-height:clamp(460px,72svh,620px);display:flex;align-items:flex-end}\n body .hero.immersive .hero-text{position:relative;inset:auto;padding:clamp(26px,5vw,48px);width:100%}\n body .hero.immersive .hero-image{position:absolute;inset:0}\n body .hero.immersive::after{background:linear-gradient(0deg,rgba(0,0,0,.79),rgba(0,0,0,.34) 58%,rgba(0,0,0,.12))}\n body .hero.immersive h1{max-width:18ch}\n .art-pet .hero.immersive{display:flex;flex-direction:column;align-items:stretch;min-height:0;height:auto;background:var(--surface);color:var(--ink)}\n .art-pet .hero.immersive::after{display:none}\n .art-pet .hero.immersive .hero-image{position:relative;inset:auto;order:-1;height:clamp(180px,54vw,320px);margin:14px 20px 0;border-radius:18px;overflow:hidden}\n .art-pet .hero.immersive .hero-image img{height:100%;object-fit:cover;object-position:center 42%;filter:none}\n .art-pet .hero.immersive .hero-text{padding:22px 20px 32px;text-align:left}\n .art-pet .hero.immersive .hero-text h1,.art-pet .hero.immersive .hero-text p{margin-inline-start:0}\n .art-pet .hero.immersive .hero-actions{justify-content:flex-start}\n .art-pet .hero h1{text-transform:none}\n}\n@media(max-width:520px){\n .site-header.container{padding-inline:16px}\n .site-header nav{gap:0 12px}\n .site-header nav a,.site-header nav a:not(:last-child){font-size:13px}\n body .hero h1{font-size:clamp(32px,9vw,45px)!important;line-height:1.09;letter-spacing:-.04em;margin:12px 0 14px}\n body .hero .hero-summary{font-size:15px;line-height:1.55;margin:0}\n body .hero .hero-actions{margin-top:17px}\n body .hero .hero-button{margin-top:0;padding:12px 19px}\n body .hero:not(.immersive):not(.serene) .hero-text{padding:30px 20px}\n body .art-pet .hero.immersive .hero-text{padding:22px 20px 32px}\n .art-pet .hero.immersive .hero-image{margin-inline:16px}\n .section{padding-block:42px}\n .section h2,.contact h2{font-size:clamp(27px,8vw,36px);line-height:1.12}\n .story-grid,.faq-grid{grid-template-columns:minmax(0,1fr)!important;gap:22px}\n .contact{padding-block:44px}\n .hero-image figcaption,.story-image figcaption,.catalog-gallery figcaption{font-size:10px;padding:4px 6px;border-radius:6px;opacity:.86}\n}\n@media(max-width:360px){.site-header nav{gap:0 9px}.site-header nav a,.site-header nav a:not(:last-child){font-size:12px}}\n@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}}";
const motionEnhancements="/* prospect-motion-v2 */\n@keyframes prospect-reveal{from{opacity:.35;transform:translateY(24px)}to{opacity:1;transform:none}}\n@keyframes prospect-slide{from{opacity:.35;transform:translateX(-22px)}to{opacity:1;transform:none}}\n@keyframes prospect-photo{from{opacity:.55;transform:scale(.96)}to{opacity:1;transform:none}}\n@keyframes prospect-panel{from{opacity:.6;transform:translateY(12px)}to{opacity:1;transform:none}}\n@keyframes prospect-shimmer{from{transform:translateX(-150%) skewX(-18deg)}to{transform:translateX(230%) skewX(-18deg)}}\n.brand-portfolio .portfolio-strip{grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(12px,2vw,24px)}\n.portfolio-strip figure{min-width:0}\n.portfolio-strip figure a{border-radius:12px;background:var(--surface);isolation:isolate}\n.portfolio-strip img{aspect-ratio:4/3;object-fit:cover}\n.portfolio-strip figcaption{font-size:12px;opacity:.83}\n@media(max-width:760px){.brand-portfolio .portfolio-strip{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.portfolio-strip figcaption{font-size:11px}}\n@media(prefers-reduced-motion:no-preference){\n body:not(.motion-none) .hero .eyebrow{animation:prospect-reveal .55s var(--curve,ease) both}\n body:not(.motion-none) .hero .hero-summary{animation:prospect-reveal .65s var(--curve,ease) .12s both}\n body:not(.motion-none) main>section:target{animation:prospect-panel .38s var(--curve,ease) both}\n body:not(.motion-none) .hero-button,body:not(.motion-none) .cta-button{position:relative;overflow:hidden;isolation:isolate;transition:transform .25s ease,box-shadow .25s ease,filter .25s ease}\n body:not(.motion-none) .hero-button::after,body:not(.motion-none) .cta-button::after{content:\"\";position:absolute;inset:0 auto 0 0;width:42%;background:linear-gradient(90deg,transparent,#ffffff38,transparent);pointer-events:none;transform:translateX(-150%)}\n @media(hover:hover){body:not(.motion-none) .hero-button:hover::after,body:not(.motion-none) .cta-button:hover::after{animation:prospect-shimmer .75s ease both}body:not(.motion-none) .portfolio-strip figure a:hover img{transform:scale(1.045)}body:not(.motion-none) .service-card{transition:transform .25s ease,background-color .25s ease}body:not(.motion-none) .service-card:hover{transform:translateY(-3px)}}\n @supports(animation-timeline:view()){\n  body:not(.motion-none) main:not(:has(>section:target)) :is(.section h2,.story-copy,.contact-heading){animation:prospect-reveal linear both;animation-timeline:view();animation-range:entry 0% entry 80%}\n  body:not(.motion-none) main:not(:has(>section:target)) :is(.story-image,.portfolio-strip figure){animation:prospect-photo linear both;animation-timeline:view();animation-range:entry 0% entry 85%}\n  body:not(.motion-none) main:not(:has(>section:target)) .service-card{animation:prospect-reveal linear both;animation-timeline:view();animation-range:entry 0% entry 85%}\n  body.direction-experiencia:not(.motion-none) main:not(:has(>section:target)) .story-copy{animation-name:prospect-slide}\n  body.direction-pratico:not(.motion-none) main:not(:has(>section:target)) :is(.section h2,.service-card){animation-name:prospect-panel}\n }\n}\n@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}";
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
    .replace(/<\/head>/i, () => identity + tags.join('') + (raw.includes('/* prospect-design-quality-v1 */')?'':'<style>'+qualityCss+'</style>') + (raw.includes('/* prospect-motion-v2 */')?'':'<style>'+motionEnhancements+'</style>') + '</head>'));
}
