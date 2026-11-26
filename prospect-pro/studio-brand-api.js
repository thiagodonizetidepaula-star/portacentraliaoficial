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
  const facebookAccess=process.env.FACEBOOK_GRAPH_ACCESS_TOKEN||'';
  const facebookVersion=process.env.FACEBOOK_GRAPH_VERSION||version;
  const facebook=Boolean(facebookAccess && /^v\d+\.\d+$/.test(facebookVersion));
  const sign = text => createHmac('sha256', access||facebookAccess).update(text).digest('base64url');

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

  async function facebookPage(profile, owner, signal) {
    if (!facebook) throw new RequestError(503,'A importação do Facebook precisa da conexão oficial com a Meta e das permissões de páginas públicas.');
    const account=social.profile(profile);
    if(account?.network!=='facebook')throw new RequestError(400,'Informe o endereço de uma página comercial do Facebook.');
    const source=account.url, parsed=new URL(source);
    const id=parsed.searchParams.get('id')||parsed.pathname.split('/').filter(Boolean)[0];
    if(!/^[a-z\d._-]{1,100}$/i.test(id||''))throw new RequestError(400,'Endereço de página inválido.');
    async function graph(path,fields,params={}) {
      const url=new URL('https://graph.facebook.com/'+facebookVersion+'/'+path);
      url.search=new URLSearchParams({fields,...params});
      const response=await fetch(url,{headers:{Authorization:'Bearer '+facebookAccess},redirect:'error',signal});
      const data=await response.json();
      if(!response.ok||data.error)throw new RequestError(422,'A Meta não liberou os dados dessa página. Confira as permissões da conexão.');
      return data;
    }
    const target=encodeURIComponent(id);
    const data=await graph(target,'id,name,link,about,description,picture.type(large)');
    if(!/^\d+$/.test(String(data.id||''))||!data.name)throw new RequestError(422,'A página comercial não foi confirmada pela Meta.');
    if(/^\d+$/.test(id)&&String(data.id)!==id)throw new RequestError(422,'A página retornada não corresponde ao endereço informado.');
    if(!/^\d+$/.test(id)&&social.profile(data.link)?.url!==source)throw new RequestError(422,'Confirme o endereço ou o ID numérico da página comercial.');
    const [extraResult,photoResult]=await Promise.allSettled([
      graph(data.id,'cover,phone,location,hours,website'),
      graph(data.id+'/photos','id,images,name,link',{type:'uploaded',limit:'12'})
    ]);
    const extra=extraResult.status==='fulfilled'?extraResult.value:{};
    const records=photoResult.status==='fulfilled'?photoResult.value.data||[]:[];
    const logo=mediaItem(data.picture?.data?.url,source,owner);
    const photos=[];
    const add=(url,caption)=>{const item=mediaItem(url,source,owner);if(item&&item.url!==logo?.url&&!photos.some(p=>p.url===item.url))photos.push({...item,caption:String(caption||'').slice(0,100)});};
    add(extra.cover?.source,'Foto de capa da página');
    for(const item of records){const best=(item.images||[]).filter(x=>x.source).sort((a,b)=>(b.width||0)-(a.width||0))[0];add(best?.source,item.name);}
    const description=String(data.description||data.about||'').slice(0,320);
    const facts=bioFacts(description);
    const days=[['mon','Segunda'],['tue','Terça'],['wed','Quarta'],['thu','Quinta'],['fri','Sexta'],['sat','Sábado'],['sun','Domingo']];
    const hours=days.flatMap(([key,label])=>{
      const ranges=[1,2].flatMap(n=>{const a=extra.hours?.[key+'_'+n+'_open'],b=extra.hours?.[key+'_'+n+'_close'];return /^\d{1,2}:\d{2}$/.test(a||'')&&/^\d{1,2}:\d{2}$/.test(b||'')?[a+'–'+b]:[];});
      return ranges.length?[label+': '+ranges.join(' / ')]:[];
    });
    const address=[extra.location?.street,extra.location?.city,extra.location?.state,extra.location?.zip].filter(Boolean).join(', ').slice(0,240);
    return {...facts,source,name:String(data.name).slice(0,100),description,logo,photos:photos.slice(0,9),socialLinks:[source],profiles:[],phone:String(extra.phone||'').slice(0,50),address,hours:hours.length?hours:facts.hours,mediaLimited:photoResult.status!=='fulfilled'};
  }

  async function media(ticket, owner, signal, res) {
    const [data, signature] = String(ticket || '').split('.');
    const expected = Buffer.from(sign(data));
    const given = Buffer.from(signature || '');
    if ((!instagram && !facebook) || given.length !== expected.length || !timingSafeEqual(given, expected)) throw new RequestError(400, 'Referência de imagem inválida.');
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
      skill: 'prospect-premium', instagram, facebook, revision:process.env.RENDER_GIT_COMMIT?.slice(0,12),
      places: Boolean(process.env.GOOGLE_PLACES_API_KEY && process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY)
    });
    if (!['website', 'instagram', 'facebook', 'media', 'directory'].some(action => path === '/api/studio/brand/' + action)) return json(res, 404, {error:'Fonte desconhecida.'});
    if (req.method !== 'POST') return json(res, 405, {error:'Método não permitido.'});
    const controller = new AbortController();
    res.once('close', () => { if (!res.writableEnded) controller.abort(); });
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    try {
      const owner = await authorizedOperator(getToken(req), signal);
      const body = await readPayload(req);
      if(path.endsWith('/directory'))return json(res,200,{candidates:await findPublicIdentity(body.name,body.city,signal)});
      if (path.endsWith('/media')) return await media(body.ticket, owner, signal, res);
      const result = path.endsWith('/instagram') ? await discover(body.url, owner, signal) : path.endsWith('/facebook') ? await facebookPage(body.url,owner,signal) : await inspectWebsite(body.url, signal);
      if (!res.destroyed) json(res, 200, result);
    } catch (error) {
      if (!res.destroyed) json(res, error instanceof RequestError ? error.status : 422, {
        error: error instanceof RequestError ? error.message : 'Não foi possível ler essa fonte pública. Você pode informar os materiais da empresa abaixo.'
      });
    }
  };
}
