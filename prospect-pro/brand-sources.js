import { lookup } from 'node:dns/promises';
import { get } from 'node:https';
import { isIP } from 'node:net';
import { Parser } from 'htmlparser2';
import ipaddr from 'ipaddr.js';

import social from './social-profiles.cjs';
import { bioFacts, catalog, schedule } from './business-facts.js';

export const instagramProfile = value => {
 const account=social.profile(value);
 return account?.network==='instagram'?account.url:'';
};
function publicUrl(value, base) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096) return '';
  try {
    const url = new URL(value, base);
    const host = url.hostname.replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.port || url.username || url.password ||
        !host.includes('.') || isIP(host) || !/^[a-z\d.-]+$/.test(host) ||
        /(?:^|\.)(?:local|internal|localhost|home|test|invalid)$/.test(host)) return '';
    url.hash = '';
    return url.href;
  } catch { return ''; }
}

function platformPage(host) {
  return /(?:^|\.)(?:instagram\.com|facebook\.com|fb\.com|fb\.me|threads\.(?:net|com)|whatsapp\.com|wa\.me|google\.[a-z.]+|goo\.gl|gstatic\.com|googleusercontent\.com|tiktok\.com|youtube\.com|youtu\.be|linkedin\.com|maps\.app\.goo\.gl)$/.test(host.replace(/\.$/, ''));
}

export function websiteMetadata(html, pageUrl) {
  const photos = new Set();
  const profiles = new Set();
  const whatsappContacts = new Set();
  const meta = {};
  const hours = new Set(), services = new Set(), socials = new Set(), gallery = new Map();
  let figure=0, line='', heading='', currentPost='', currentPhoto='', alt='', context='', markers=[];
  const block = new Set(['h2','h3','h4','p','li','tr','address','figcaption','dt','dd','div','section','article']);
  const append=(set,values)=>{ for(const value of values)if(value&&set.size<12)set.add(value); };

  let logo = '', headerLogo = '', icon = '', script = null;
  function assetUrl(raw) {
    const value = publicUrl(raw, pageUrl);
    if (!value) return '';
    const host = new URL(value).hostname;
    return platformPage(host) || /(?:^|\.)(?:fbcdn\.net|cdninstagram\.com|ggpht\.com)$/.test(host) ? '' : value;
  }
  const addPhoto = raw => { const value = assetUrl(raw); if (value && photos.size < 12) photos.add(value); };
  const addProfile = raw => {
    const account=social.profile(raw);
    if(!account)return;
    if (account.network==='instagram')profiles.add(account.url);
    if (socials.size<20)socials.add(account.url);
  };
  const links = value => (Array.isArray(value) ? value : [value]).map(item =>
    typeof item === 'string' ? item : item?.contentUrl || item?.url).filter(Boolean);
  function organization(record) {
    if (!record || typeof record !== 'object') return;
    if (Array.isArray(record)) { record.forEach(organization); return; }
    if (Array.isArray(record['@graph'])) record['@graph'].forEach(organization);
    // Products, authors and review publishers can have logos of their own.
    if (![].concat(record['@type'] || []).some(type =>
      /Organization|Business|Store|Restaurant|Bakery|Salon|Studio|Agency|Clinic|Service|Lodging|Dentist|Hotel|Automotive|School|Corporation/i.test(type))) return;
    logo ||= assetUrl(links(record.logo)[0]);
    if(record.description && !meta.description)meta.description=String(record.description);
    links(record.image).forEach(addPhoto);
    append(hours,schedule(record.openingHoursSpecification || record.openingHours));
    for(const field of ['hasOfferCatalog','makesOffer','hasMenu','hasMenuSection','availableService'])append(services,catalog(record[field]));
    links(record.sameAs).forEach(addProfile);
  }
  const parser = new Parser({
    onopentag(tag, attrs) {
      if (block.has(tag))line='';
      if(tag==='figure')figure++;
      if (tag==='section' || tag==='article' || tag==='div') {
        const id=[attrs.id,attrs.class,attrs['aria-label'],attrs.itemprop].filter(Boolean).join(' ').toLowerCase();
        markers.push(context);
        if(/servi[cç]os|services|especialidades|card[aá]pio|offercatalog/.test(id)) context='services';
        else if(/hor[aá]rios|openinghours|hours/.test(id))context='hours';
        else if(/galeria|gallery|portfolio|portfólio/.test(id))context='gallery';
      }
      if(tag==='img' && (context==='gallery'||figure) && !/logo|avatar|ícone|icon|tracking|pixel/i.test([attrs.alt,attrs.class,attrs.src].join(' '))){
        if((!attrs.width||parseInt(attrs.width)>=160)&&(!attrs.height||parseInt(attrs.height)>=100))addPhoto(attrs['data-src']||attrs.src);
      }
      if(tag==='a'){currentPost=social.instagramPost(attrs.href);currentPhoto='';alt='';}
      if(tag==='img'&&currentPost){currentPhoto=assetUrl(attrs.src||attrs['data-src']);alt=String(attrs.alt||'').trim().slice(0,120);}
      if (tag === 'meta') {
        const key = (attrs.property || attrs.name || '').toLowerCase();
        if (['og:site_name','og:description', 'description', 'theme-color'].includes(key)) meta[key] ||= attrs.content;
        if (key === 'og:image' || key === 'og:image:secure_url') addPhoto(attrs.content);
      }
      if (tag === 'a') {
        addProfile(attrs.href);
        const href=attrs.href||'';
        if(whatsappContacts.size<5 && /^https?:\/\/(?:wa\.me|(?:api\.|web\.|www\.)?whatsapp\.com)\//i.test(href)){
          try {
            const url=new URL(href);
            const digits=url.hostname==='wa.me'?/^\/(\d+)\/?$/.exec(url.pathname)?.[1]:
              /^\/send\/?$/.test(url.pathname)?url.searchParams.get('phone'):'';
            if(/^[1-9]\d{7,14}$/.test(digits||''))whatsappContacts.add('+'+digits);
          } catch {}
        }
      }
      if (tag === 'img' && /(?:^|[\s/_-])logo(?:tipo)?(?:$|[\s/_.-])/i.test([attrs.alt,attrs.class,attrs.src].join(' '))) headerLogo ||= assetUrl(attrs.src);
      if (tag === 'link' && (attrs.rel || '').toLowerCase().split(/\s+/).includes('apple-touch-icon')) icon ||= assetUrl(attrs.href);
      if (tag === 'script' && /^application\/ld\+json(?:;|$)/i.test(attrs.type || '')) script = '';
    },
    ontext(value) {
      if(script!==null)script+=value;
      else if(line.length<400)line+=value;
    },
    onclosetag(tag) {
      if(tag==='figure')figure=Math.max(0,figure-1);
      if(tag==='a'&&currentPost) {
        if(currentPhoto && gallery.size<3){gallery.set(currentPhoto,{url:currentPhoto,source:currentPost,caption:alt});addPhoto(currentPhoto);}
        currentPost=''; currentPhoto='';
      }
      const words=line.replace(/\s+/g,' ').trim();
      if(block.has(tag)&&words&&words.length<=165) {
        const info=bioFacts(words);append(hours,info.hours);append(services,info.services);
        if((context==='services' || heading==='services') && ['h3','h4','li'].includes(tag) && words.length<=80)append(services,[words]);
        if((context==='hours'||heading==='hours')&&/\d(?:h|:\d)|fechad/i.test(words)&&['p','li','tr','dd'].includes(tag))append(hours,[words]);
        if (tag==='h2')heading=/^(?:serviços|nossos serviços|especialidades|cardápio)$/i.test(words)?'services':/^horários?/i.test(words)?'hours':'';
        line='';
      }
      if(tag==='section'||tag==='article'||tag==='div')context=markers.pop()||'';
      if (tag === 'script' && script !== null) {
        try { organization(JSON.parse(script)); } catch {}
        script = null;
      }
    }
  });
  parser.end(html);
  logo ||= headerLogo || icon;
  photos.delete(logo);
  const color = (meta['theme-color'] || '').trim();
  return {
    source: pageUrl, name: (meta['og:site_name'] || '').slice(0,100), logo, photos:[...new Set([...gallery.keys(),...photos])].filter(url=>url!==logo).slice(0,3).map(url=>gallery.get(url)||url), socialLinks:[...socials], hours:[...hours].slice(0,10), services:[...services].slice(0,8), profiles: [...profiles].slice(0, 5), whatsappContacts:[...whatsappContacts],
    description: (meta['og:description'] || meta.description || '').trim().slice(0, 320),
    color: /^#[a-f\d]{6}$/i.test(color) ? color : ''
  };
}

// Visit a single public HTTPS page. Resolve and pin the actual peer at every redirect.
// Do not send operator credentials, run site scripts, or follow links found in the page.
export async function inspectWebsite(raw, signal) {
  let next = raw;
  for (let hop = 0; hop <= 3; hop++) {
    const href = publicUrl(next);
    if (!href || platformPage(new URL(href).hostname)) throw Error('Informe uma página oficial HTTPS da empresa.');
    const url = new URL(href);
    const answers = await lookup(url.hostname, { all: true, family: 4 });
    signal.throwIfAborted();
    if (!answers.length || answers.some(({address}) => ipaddr.parse(address).range() !== 'unicast')) {
      throw Error('A página precisa estar em um endereço público.');
    }
    const page = await new Promise((resolve, reject) => {
      const req = get(url, {
        signal, agent: false, family: 4, maxHeaderSize: 32768,
        lookup: (_host, opts, done) => opts.all ? done(null, [answers[0]]) : done(null, answers[0].address, 4),
        headers: { Accept: 'text/html', 'User-Agent': 'PortalProspectPRO/1.0 (brand preview)' }
      }, res => {
        res.on('error', reject);
        const status = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          resolve({ location: res.headers.location }); res.destroy(); return;
        }
        if (status !== 200 || !/^text\/html\b/i.test(res.headers['content-type'] || '')) {
          reject(Error('A página não disponibilizou HTML público.')); res.destroy(); return;
        }
        const chunks = [];
        let size = 0;
        res.on('data', chunk => {
          size += chunk.length;
          if (size > 1500000) { reject(Error('A página ultrapassa o tamanho de leitura.')); res.destroy(); }
          else chunks.push(chunk);
        });
        res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }));
      });
      req.on('error', reject);
    });
    if (!page.location) return websiteMetadata(page.html, href);
    next = new URL(page.location, href).href;
  }
  throw Error('A página redireciona muitas vezes.');
}
