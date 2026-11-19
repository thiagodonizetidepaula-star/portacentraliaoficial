import http from 'node:http';
import {readFile} from 'node:fs/promises';
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

const safeSlug=x=>typeof x==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x)&&x.length>=3&&x.length<=90;
const escapeHtml=x=>String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const endpoint=process.env.SUPABASE_URL||'';
const publicKey=process.env.SUPABASE_PUBLISHABLE_KEY||'';
async function publicPreview(slug){
 if(!endpoint||!publicKey)throw new Error('Banco de dados não configurado');
 const url=endpoint+'/rest/v1/prospect_site_previews?slug=eq.'+encodeURIComponent(slug)+'&status=eq.published&select=business_name,business_category,city,description,cover_image,html,slug&limit=1';
 const response=await fetch(url,{headers:{apikey:publicKey},signal:AbortSignal.timeout(9000)});
 if(!response.ok)throw Error('Falha no banco: '+response.status);
 const rows=await response.json();
 return rows[0]||null;
}

http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(req.method!=='GET')return json(res,405,{error:'Método não permitido'});
 if(u.pathname==='/health')return json(res,200,{ok:true});
 if(u.pathname==='/api/public-config')return json(res,200,{supabaseUrl:endpoint,publishableKey:publicKey,configured:!!endpoint&&!!publicKey});
 if(u.pathname.startsWith('/mvp/')){
  const slug=u.pathname.slice(5);
  if(!safeSlug(slug))return json(res,404,{error:'Prévia não encontrada'});
  try{
   const p=await publicPreview(slug);
   if(!p)return json(res,404,{error:'Demonstração indisponível ou não publicada'});
   const base=process.env.PREVIEW_PUBLIC_ORIGIN||'https://portal-prospect-pro.onrender.com';
   const url=base+'/mvp/'+slug;
   const title=String(p.business_name||'Site demonstrativo').slice(0,90)+' | Demonstração Portal Central IA';
   const desc=String(p.description||'Uma proposta de site criada para esta empresa.').slice(0,160);
   const img=typeof p.cover_image==='string'&&/^https:\/\/[^<>"' ]+$/.test(p.cover_image)?p.cover_image:'';
   const meta='<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR">'+
    '<meta property="og:site_name" content="Portal Central IA · Demonstração">'+
    '<meta property="og:title" content="'+escapeHtml(title)+'">'+
    '<meta property="og:description" content="'+escapeHtml(desc)+'">'+
    '<meta property="og:url" content="'+escapeHtml(url)+'">'+
    (img?'<meta property="og:image" content="'+escapeHtml(img)+'"><meta name="twitter:card" content="summary_large_image">':'')+
    '<meta name="robots" content="noindex,nofollow">';
   const raw=String(p.html||'');
   if(raw.length>280000||!/<\/head>/i.test(raw))return json(res,500,{error:'Prévia inválida'});
   const html=raw.replace(/<\/head>/i,meta+'</head>');
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'"});
   return res.end(html);
  }catch(e){return json(res,503,{error:'Não foi possível carregar a demonstração'})}
 }
 if(u.pathname==='/studio'||u.pathname==='/studio/') {
  try{const html=await readFile(new URL('./biblioteca.html',import.meta.url));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(html)}
  catch{return json(res,500,{error:'Estúdio indisponível'})}
 }

 const libraryFiles={
  '/biblioteca':['./biblioteca.html','text/html; charset=utf-8'],
  '/biblioteca/':['./biblioteca.html','text/html; charset=utf-8'],
  '/biblioteca.html':['./biblioteca.html','text/html; charset=utf-8'],
  '/biblioteca.css':['./biblioteca.css','text/css; charset=utf-8'],
  '/biblioteca.js':['./biblioteca.js','text/javascript; charset=utf-8'],
  '/biblioteca-data.js':['./biblioteca-data.js','text/javascript; charset=utf-8'],
  '/studio-flow.js':['./studio-flow.js','text/javascript; charset=utf-8'],
  '/studio-publish.js':['./studio-publish.js','text/javascript; charset=utf-8'],
  '/prospect-radar.css':['./prospect-radar.css','text/css; charset=utf-8'],
  '/prospect-radar.js':['./prospect-radar.js','text/javascript; charset=utf-8'],
  '/prospect-auth.js':['./prospect-auth.js','text/javascript; charset=utf-8']
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
 if(u.pathname==='/api/search'){
  const term=(u.searchParams.get('term')||'').trim(),city=(u.searchParams.get('city')||'').trim();
  if(!term||!city||term.length>100||city.length>100)return json(res,400,{error:'Informe setor e cidade.'});
  if(!process.env.GOOGLE_PLACES_API_KEY)return json(res,503,{error:'Google Places API ainda não configurada. Nenhuma cobrança foi gerada.'});
  const token=getToken(req);
  if(!token)return json(res,401,{error:'Faça login na sua conta do Portal Central IA para usar a busca automática.'});
  let slot;try{slot=await usageBudget(token,true)}catch(e){return json(res,403,{error:e.message})}
  if(slot.blocked)return json(res,429,{error:'Limite de segurança de 50 buscas atingido neste mês. O acesso será liberado no próximo mês.',used:slot.used,limit:LIMIT});
  try{
   const upstream=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':process.env.GOOGLE_PLACES_API_KEY,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.googleMapsUri'},body:JSON.stringify({textQuery:term+' em '+city,languageCode:'pt-BR',regionCode:'BR',pageSize:20}),signal:AbortSignal.timeout(12000)});
   const j=await upstream.json();
   if(!upstream.ok)return json(res,502,{error:j.error?.message||'Falha na consulta Google Places'});
   return json(res,200,{data:(j.places||[]).map(p=>({googleId:p.id,name:p.displayName?.text||'Empresa',address:p.formattedAddress||'',website:p.websiteUri||'',phone:p.internationalPhoneNumber||'',maps:p.googleMapsUri||''})),usage:{used:slot.used,limit:LIMIT}});
  }catch(e){return json(res,502,{error:'Falha na pesquisa: '+e.message})}
 }
 if(u.pathname==='/'||u.pathname==='/index.html'){
  try{const html=await readFile(new URL('./index.html',import.meta.url));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(html)}catch{return json(res,500,{error:'Arquivo indisponível'})}
 }
 return json(res,404,{error:'Não encontrado'});
}).listen(port,'0.0.0.0',()=>console.log('Portal Prospect PRO na porta '+port));
