import { lookup } from 'node:dns/promises';
import { get } from 'node:https';
import { isIP } from 'node:net';
import { Parser } from 'htmlparser2';
import ipaddr from 'ipaddr.js';

const reservedProfiles = new Set(['about', 'accounts', 'api', 'developer', 'developers', 'direct', 'directory', 'emails', 'explore', 'legal', 'p', 'press', 'privacy', 'reel', 'reels', 'share', 'stories', 'terms', 'tv', 'web']);
export function instagramProfile(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['www.instagram.com', 'instagram.com'].includes(url.hostname)) return '';
    const handle = /^\/([a-z0-9._]{1,30})\/?$/i.exec(url.pathname)?.[1]?.toLowerCase();
    return handle && !reservedProfiles.has(handle) ? 'https://www.instagram.com/' + handle + '/' : '';
  } catch { return ''; }
}

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
  return /(?:^|\.)(?:instagram\.com|facebook\.com|fb\.com|fb\.me|threads\.(?:net|com)|whatsapp\.com|wa\.me|google\.[a-z.]+|goo\.gl|gstatic\.com|googleusercontent\.com|maps\.app\.goo\.gl)$/.test(host.replace(/\.$/, ''));
}

export function websiteMetadata(html, pageUrl) {
  const photos = new Set();
  const profiles = new Set();
  const meta = {};
  let logo = '', headerLogo = '', icon = '', script = null;
  function assetUrl(raw) {
    const value = publicUrl(raw, pageUrl);
    if (!value) return '';
    const host = new URL(value).hostname;
    return platformPage(host) || /(?:^|\.)(?:fbcdn\.net|cdninstagram\.com|ggpht\.com)$/.test(host) ? '' : value;
  }
  const addPhoto = raw => { const value = assetUrl(raw); if (value && photos.size < 12) photos.add(value); };
  const addProfile = raw => { const value = instagramProfile(raw); if (value) profiles.add(value); };
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
    links(record.image).forEach(addPhoto);
    links(record.sameAs).forEach(addProfile);
  }
  const parser = new Parser({
    onopentag(tag, attrs) {
      if (tag === 'meta') {
        const key = (attrs.property || attrs.name || '').toLowerCase();
        if (['og:site_name','og:description', 'description', 'theme-color'].includes(key)) meta[key] ||= attrs.content;
        if (key === 'og:image' || key === 'og:image:secure_url') addPhoto(attrs.content);
      }
      if (tag === 'a') addProfile(attrs.href);
      if (tag === 'img' && /(?:^|[\s/_-])logo(?:tipo)?(?:$|[\s/_.-])/i.test([attrs.alt,attrs.class,attrs.src].join(' '))) headerLogo ||= assetUrl(attrs.src);
      if (tag === 'link' && (attrs.rel || '').toLowerCase().split(/\s+/).includes('apple-touch-icon')) icon ||= assetUrl(attrs.href);
      if (tag === 'script' && /^application\/ld\+json(?:;|$)/i.test(attrs.type || '')) script = '';
    },
    ontext(value) { if (script !== null) script += value; },
    onclosetag(tag) {
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
    source: pageUrl, name: (meta['og:site_name'] || '').slice(0,100), logo, photos: [...photos].slice(0, 3), profiles: [...profiles].slice(0, 5),
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
