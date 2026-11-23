import { createHmac, timingSafeEqual } from 'node:crypto';
import { inspectWebsite, instagramProfile } from './brand-sources.js';
import { findPublicIdentity } from './public-identity.js';
import { bioFacts } from './business-facts.js';
import social from './social-profiles.cjs';
import { readPayload, RequestError } from './studio-ai.js';

function metaImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.port && !url.username && !url.password &&
      /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net)$/.test(url.hostname) ? url.href : '';
  } catch { return ''; }
}

export function createStudioBrand({ json, getToken, authorizedOperator }) {
  const account = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '';
  const access = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN || '';
  const version = process.env.INSTAGRAM_GRAPH_VERSION || 'v25.0';
  const instagram = Boolean(/^\d+$/.test(account) && access && /^v\d+\.\d+$/.test(version));
  const sign = text => createHmac('sha256', access).update(text).digest('base64url');

  function mediaItem(url, source, owner) {
    const image = metaImage(url);
    if (!image) return null;
    const payload = Buffer.from(JSON.stringify([owner, Date.now() + 900000, image])).toString('base64url');
    return { url: image, source, ticket: payload + '.' + sign(payload) };
  }

  async function discover(profile, owner, signal) {
    if (!instagram) throw new RequestError(503, 'A leitura de perfis profissionais depende da conexão com a Meta. Você pode usar arquivos da empresa.');
    const source = instagramProfile(profile);
    if (!source) throw new RequestError(400, 'Informe o link de um perfil do Instagram.');
    const handle = new URL(source).pathname.split('/')[1];
    const url = new URL('https://graph.facebook.com/' + version + '/' + account);
    url.searchParams.set('fields', 'business_discovery.username(' + handle +
      '){username,name,biography,profile_picture_url,media.limit(6){caption,media_type,media_url,permalink,children{media_type,media_url}}}');
    const response = await fetch(url, { headers: { Authorization: 'Bearer ' + access }, redirect: 'error', signal });
    const data = (await response.json()).business_discovery;
    if (!response.ok || data?.username?.toLowerCase() !== handle) {
      throw new RequestError(422, 'A Meta não disponibilizou este perfil. Confira o usuário, o tipo de conta e a conexão.');
    }
    const photos=[],posts=data.media?.data||[];
    for(const post of posts){
      const assets=post.media_type==='CAROUSEL_ALBUM' && post.children?.data?.length?post.children.data:[post];
      for(const child of assets){
        if(!['IMAGE','CAROUSEL_ALBUM'].includes(child.media_type))continue;
        const item=mediaItem(child.media_url,social.instagramPost(post.permalink)||source,owner);
        if(item&&!photos.some(p=>p.url===item.url))photos.push({...item,caption:String(post.caption||'').split('\n')[0].slice(0,100)});
        if(photos.length===3)break;
      }
      if(photos.length===3)break;
    }
    const facts=bioFacts(data.biography);
    return { source, name: String(data.name || '').slice(0, 100), description: String(data.biography || '').slice(0, 320),
      ...facts,logo: mediaItem(data.profile_picture_url, source, owner), photos, profiles:[source],socialLinks:[source] };
  }

  async function media(ticket, owner, signal, res) {
    const [data, signature] = String(ticket || '').split('.');
    const expected = Buffer.from(sign(data));
    const given = Buffer.from(signature || '');
    if (!instagram || given.length !== expected.length || !timingSafeEqual(given, expected)) throw new RequestError(400, 'Referência de imagem inválida.');
    const [user, expires, url] = JSON.parse(Buffer.from(data, 'base64url'));
    if (owner !== user || Date.now() >= expires || !metaImage(url)) throw new RequestError(410, 'Consulte o perfil novamente para atualizar as fotos.');
    const image = await fetch(url, { signal, redirect: 'error' });
    const type = image.headers.get('content-type')?.split(';')[0];
    if (!image.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new RequestError(422, 'A imagem não está disponível para importação.');
    const chunks = [];
    let size = 0;
    for await (const chunk of image.body) {
      size += chunk.length;
      if (size > 8000000) throw new RequestError(413, 'Use uma imagem de até 8 MB.');
      chunks.push(chunk);
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(Buffer.concat(chunks));
  }

  return async (req, res, path) => {
    if (path === '/api/studio/brand/status' && req.method === 'GET') return json(res, 200, {
      skill: 'prospect-premium', instagram, revision:process.env.RENDER_GIT_COMMIT?.slice(0,12),
      places: Boolean(process.env.GOOGLE_PLACES_API_KEY && process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY)
    });
    if (!['website', 'instagram', 'media', 'directory'].some(action => path === '/api/studio/brand/' + action)) return json(res, 404, {error:'Fonte desconhecida.'});
    if (req.method !== 'POST') return json(res, 405, {error:'Método não permitido.'});
    const controller = new AbortController();
    res.once('close', () => { if (!res.writableEnded) controller.abort(); });
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    try {
      const owner = await authorizedOperator(getToken(req), signal);
      const body = await readPayload(req);
      if(path.endsWith('/directory'))return json(res,200,{candidates:await findPublicIdentity(body.name,body.city,signal)});
      if (path.endsWith('/media')) return await media(body.ticket, owner, signal, res);
      const result = path.endsWith('/instagram') ? await discover(body.url, owner, signal) : await inspectWebsite(body.url, signal);
      if (!res.destroyed) json(res, 200, result);
    } catch (error) {
      if (!res.destroyed) json(res, error instanceof RequestError ? error.status : 422, {
        error: error instanceof RequestError ? error.message : 'Não foi possível ler essa fonte pública. Você pode informar os materiais da empresa abaixo.'
      });
    }
  };
}
