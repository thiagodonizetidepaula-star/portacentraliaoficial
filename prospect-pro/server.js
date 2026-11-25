import http from 'node:http';
import {publicationHtml, publicationIcon, readPublication, validSlug, previewPolicy} from './public-page.mjs';
import {readFile} from 'node:fs/promises';
import {createStudioAi, studioOperator} from './studio-ai.js';
import {createStudioBrand} from './studio-brand-api.js';
const port=process.env.PORT||3000;
const LIMIT=50;
// Cota persistente e atômica no Supabase, só para o operador autorizado.
// Sem Supabase, login ou chave Google: nenhuma consulta pagável será executada.
const month=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date());const year=parts.find(p=>p.type==='year').value,mo=parts.find(p=>p.type==='month').value;return year+'-'+mo};
async function usageBudget(bearer,reserve=false){
 if(!endpoint||!publicKey)throw Error('Banco de dados do controle de buscas não configurado');
 if(!bearer||!/^[a-zA-Z0-9_.-]{40,}$/.test(bearer))throw Error('Entre com sua conta do Portal Central IA para usar a busca automática');
 const response=await fetch(endpoint+'/rest/v1/rpc/prospect_search_quota',{
  method:'POST',
  headers:{'Content-Type':'application/json',apikey:publicKey,Authorization:'Bearer '+bearer},
  body:JSON.stringify({p_reserve:reserve}),
  signal:AbortSignal.timeout(9000)
 });
 let result;try{result=await response.json()}catch{throw Error('Contador de pesquisas indisponível')}
 if(!response.ok)throw Error(response.status===401||response.status===403?'Acesso não autorizado para pesquisar. Faça login na sua conta.':(result.message||'Contador indisponível'));
 return result;
}
function getToken(req){
 const raw=String(req.headers.authorization||'');
 return /^Bearer [A-Za-z0-9_.-]+$/.test(raw)?raw.slice(7):'';
}
function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))}

const endpoint=process.env.SUPABASE_URL||'';
const publicKey=process.env.SUPABASE_PUBLISHABLE_KEY||'';
const authorizedOperator=studioOperator(endpoint,publicKey);
const studioAi=createStudioAi({endpoint,publicKey,json,getToken,authorizedOperator});
const studioBrand=createStudioBrand({json,getToken,authorizedOperator});
function queryPlaces({placeId,term,city,identity}) {
 const fields=['id','displayName','formattedAddress','websiteUri','internationalPhoneNumber','googleMapsUri'];
 if(identity)fields.push('googleMapsLinks.photosUri','attributions','regularOpeningHours.weekdayDescriptions');
 const headers={
  'X-Goog-Api-Key':process.env.GOOGLE_PLACES_API_KEY,
  'X-Goog-FieldMask':fields.map(field=>placeId?field:'places.'+field).join(',')
 };
 const signal=AbortSignal.timeout(12000);
 if(placeId)return fetch('https://places.googleapis.com/v1/places/'+encodeURIComponent(placeId)+'?languageCode=pt-BR',{headers,signal});
 return fetch('https://places.googleapis.com/v1/places:searchText',{
  method:'POST',headers:{...headers,'Content-Type':'application/json'},signal,
  body:JSON.stringify({textQuery:term+' em '+city,languageCode:'pt-BR',regionCode:'BR',pageSize:20})
 });
}
function publicationOrigin(value) {
 try {
  const url = new URL(value);
  const testHost = process.env.NODE_ENV === 'test' && url.protocol === 'http:' && url.hostname === '127.0.0.1';
  if ((url.protocol !== 'https:' && !testHost) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return '';
  return url.origin;
 } catch { return ''; }
}
const previewOrigin = publicationOrigin(process.env.PROSPECT_PUBLICATION_ORIGIN);
const redirectOrigin = publicationOrigin(process.env.PROSPECT_PUBLICATION_REDIRECT_ORIGIN);
const versionPath = '/api/publication-version/';

async function publicationVersion(res, slug) {
 res.setHeader('Cache-Control', 'no-store');
 if (!previewOrigin || !validSlug(slug)) {
  res.writeHead(404);
  return res.end();
 }
 const path = '/p/' + slug;
 const options = {method: 'HEAD', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(7500)};
 try {
  let page = await fetch(previewOrigin + path, options);
  // Follow only the configured host and preserve the exact client path.
  if (redirectOrigin && [301, 302, 303, 307, 308].includes(page.status) &&
      page.headers.get('location') === redirectOrigin + path) {
   page = await fetch(redirectOrigin + path, options);
  }
  const updated = page.headers.get('X-Prospect-Updated');
  if (page.status === 200 && /^\d{1,16}$/.test(updated || '')) {
   res.writeHead(200, {'X-Prospect-Updated': updated});
  } else {
   res.writeHead([404, 410].includes(page.status) ? 404 : 503);
  }
 } catch {
  res.writeHead(503);
 }
 res.end();
}

http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname.startsWith('/api/studio/brand/'))return studioBrand(req,res,u.pathname);
 if(u.pathname.startsWith('/api/studio/ai/'))return studioAi(req,res,u.pathname);
 if(u.pathname.startsWith(versionPath)){
  if(req.method==='HEAD')return publicationVersion(res,u.pathname.slice(versionPath.length));
  res.setHeader('Allow','HEAD');
  return json(res,405,{error:'Método não permitido'});
 }
 if(req.method!=='GET')return json(res,405,{error:'Método não permitido'});
 if(u.pathname==='/publication-config.js'){
  res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  return res.end('window.ProspectPreviewOrigin = '+JSON.stringify(previewOrigin)+';');
 }
 if(u.pathname==='/health')return json(res,200,{ok:true});
 if(u.pathname==='/api/public-config')return json(res,200,{supabaseUrl:endpoint,publishableKey:publicKey,configured:!!endpoint&&!!publicKey});
 if(u.pathname.startsWith('/mvp/')){
  const iconRequest=u.pathname.endsWith('/favicon.svg');
  const slug=u.pathname.slice(5,iconRequest?-12:undefined);
  if(!validSlug(slug))return json(res,404,{error:'Prévia não encontrada'});
  try{
   const p=await readPublication(endpoint,publicKey,slug);
   if(!p)return json(res,404,{error:'Demonstração indisponível ou não publicada'});
   const base=process.env.PREVIEW_PUBLIC_ORIGIN||'https://portal-prospect-pro.onrender.com';
   const url=base+'/mvp/'+slug;
   if(iconRequest){res.writeHead(200,{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"});return res.end(publicationIcon(p))}
   const html=publicationHtml(p,url);
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':previewPolicy});
   return res.end(html);
  }catch(e){return json(res,503,{error:'Não foi possível carregar a demonstração'})}
 }
 if(u.pathname==='/studio'||u.pathname==='/studio/') {
  try{const html=await readFile(new URL('./biblioteca.html',import.meta.url));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(html)}
  catch{return json(res,500,{error:'Estúdio indisponível'})}
 }

 const libraryFiles={
  '/vendor/fflate.mjs':['./node_modules/fflate/esm/browser.js','text/javascript; charset=utf-8'],
  '/biblioteca':['./biblioteca.html','text/html; charset=utf-8'],
  '/biblioteca/':['./biblioteca.html','text/html; charset=utf-8'],
  '/biblioteca.html':['./biblioteca.html','text/html; charset=utf-8'],
  '/biblioteca.css':['./biblioteca.css','text/css; charset=utf-8'],
  '/biblioteca.js':['./biblioteca.js','text/javascript; charset=utf-8'],
  '/biblioteca-data.js':['./biblioteca-data.js','text/javascript; charset=utf-8'],
  '/studio-flow.js':['./studio-flow.js','text/javascript; charset=utf-8'],
  '/studio-brand.js':['./studio-brand.js','text/javascript; charset=utf-8'],
  '/studio-publish.js':['./studio-publish.js','text/javascript; charset=utf-8'],
  '/studio-projects.js':['./studio-projects.js','text/javascript; charset=utf-8'],
  '/prospect-dashboard.css':['./prospect-dashboard.css','text/css; charset=utf-8'],
  '/instagram-archive.mjs':['./instagram-archive.mjs','text/javascript; charset=utf-8'],
  '/dados/locais/licenca':['./directory/CDLA-Permissive-2.0.txt','text/plain; charset=utf-8'],
  '/social-profiles.js':['./social-profiles.cjs','text/javascript; charset=utf-8'],
  '/prospect-links.js':['./prospect-links.js','text/javascript; charset=utf-8'],
  '/prospect-dashboard.js':['./prospect-dashboard.js','text/javascript; charset=utf-8'],
  '/prospect-radar.css':['./prospect-radar.css','text/css; charset=utf-8'],
  '/prospect-radar.js':['./prospect-radar.js','text/javascript; charset=utf-8'],
  '/google-maps-attribution.png':['./google-maps-attribution.png','image/png'],
  '/prospect-auth.js':['./prospect-auth.js','text/javascript; charset=utf-8'],
  '/prospect-crm.js':['./prospect-crm.js','text/javascript; charset=utf-8']
 };
 if(Object.prototype.hasOwnProperty.call(libraryFiles,u.pathname)){
  const [file,kind]=libraryFiles[u.pathname];
  try{const buffer=await readFile(new URL(file,import.meta.url));res.writeHead(200,{'Content-Type':kind,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});return res.end(buffer)}
  catch{return json(res,500,{error:'Biblioteca indisponível'})}
 }
 if(u.pathname==='/api/quota'){
  const enabled=!!process.env.GOOGLE_PLACES_API_KEY&&!!endpoint&&!!publicKey;
  if(!enabled)return json(res,200,{month:month(),limit:LIMIT,used:null,remaining:null,enabled:false,reason:'Busca automática bloqueada até configurar a chave Google e o controle seguro.'});
  const token=getToken(req);
  if(!token)return json(res,200,{month:month(),limit:LIMIT,used:null,remaining:null,enabled:true,loginRequired:true,reason:'Integração pronta. Entre com sua conta para pesquisar.'});
  try{const v=await usageBudget(token,false);return json(res,200,{...v,remaining:Math.max(0,LIMIT-v.used),enabled:true})}
  catch(e){return json(res,200,{month:month(),limit:LIMIT,used:null,remaining:null,enabled:true,loginRequired:true,reason:e.message})}
 }
 if(u.pathname==='/api/search'||u.pathname==='/api/studio/place'){
  const byId=u.pathname==='/api/studio/place';
  const placeId=u.searchParams.get('id')||'';
  const term=(u.searchParams.get('term')||'').trim(),city=(u.searchParams.get('city')||'').trim();
  if(byId&&!/^[A-Za-z0-9_-]{5,250}$/.test(placeId))return json(res,400,{error:'Identificador do local inválido.'});
  if(!byId&&(!term||!city||term.length>100||city.length>100))return json(res,400,{error:'Informe setor e cidade.'});
  if(!process.env.GOOGLE_PLACES_API_KEY)return json(res,503,{error:'Google Places API ainda não configurada. Nenhuma cobrança foi gerada.'});
  const token=getToken(req);
  if(!token)return json(res,401,{error:'Faça login na sua conta do Portal Central IA para usar a busca automática.'});
  let slot;try{slot=await usageBudget(token,true)}catch(e){return json(res,403,{error:e.message})}
  if(slot?.blocked===true)return json(res,429,{error:'Limite de segurança de 50 buscas atingido neste mês. O acesso será liberado no próximo mês.',used:slot.used,limit:LIMIT});
  if(!Number.isInteger(slot?.used)||slot.used<1||slot.used>LIMIT){
   return json(res,503,{error:'Não foi possível confirmar a reserva da busca. Consulte a cota antes de tentar novamente.'});
  }
  try{
   const upstream=await queryPlaces({placeId:byId?placeId:'',term,city,identity:byId||u.searchParams.get('identity')==='1'});
   const j=await upstream.json();
   if(!upstream.ok)return json(res,502,{error:j.error?.message||'Falha na consulta Google Places'});
   return json(res,200,{data:(byId?[j]:j.places||[]).map(p=>({googleId:p.id,name:p.displayName?.text||'Empresa',address:p.formattedAddress||'',website:p.websiteUri||'',phone:p.internationalPhoneNumber||'',maps:p.googleMapsUri||'',photosUrl:p.googleMapsLinks?.photosUri||'',hours:p.regularOpeningHours?.weekdayDescriptions||[],attributions:p.attributions||[]})),usage:{used:slot.used,limit:LIMIT}});
  }catch(e){return json(res,502,{error:'Falha na pesquisa: '+e.message})}
 }
 if(u.pathname==='/'||u.pathname==='/index.html'||u.pathname==='/prospect-pro'||u.pathname==='/prospect-pro/'){
  try{const html=await readFile(new URL('./index.html',import.meta.url));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(html)}catch{return json(res,500,{error:'Arquivo indisponível'})}
 }
 return json(res,404,{error:'Não encontrado'});
}).listen(port,'0.0.0.0',()=>console.log('Portal Prospect PRO na porta '+port));
