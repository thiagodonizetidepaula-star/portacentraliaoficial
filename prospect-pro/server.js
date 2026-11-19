import http from 'node:http';
import {readFile,writeFile,rename,access} from 'node:fs/promises';
import {dirname} from 'node:path';
const port=process.env.PORT||3000;
const LIMIT=500;
// A durable mounted path is deliberately required. Without persistent storage,
// restarting a free Render instance could reset usage and cause unplanned charges.
const COUNTER_PATH=process.env.PERSISTENT_QUOTA_FILE||'';
let queue=Promise.resolve();
function serialize(fn){const p=queue.then(fn);queue=p.catch(()=>{});return p;}
const month=()=>new Date().toISOString().slice(0,7);
async function loadUsage(){
 if(!COUNTER_PATH||!COUNTER_PATH.startsWith('/'))throw Error('Armazenamento persistente do contador não configurado');
 await access(dirname(COUNTER_PATH));
 try{
  const data=JSON.parse(await readFile(COUNTER_PATH,'utf8'));
  if(data.month===month()&&Number.isInteger(data.used)&&data.used>=0)return data;
  if(!data.month||!Number.isInteger(data.used))throw Error('Contador inválido');
  return {month:month(),used:0};
 }catch(e){if(e.code==='ENOENT')throw Error('Contador ainda não inicializado');throw e}
}
async function reserve(){
 return serialize(async()=>{
  const v=await loadUsage();
  if(v.used>=LIMIT)return {blocked:true,used:v.used};
  const n={month:month(),used:v.used+1};
  const tmp=COUNTER_PATH+'.tmp';
  await writeFile(tmp,JSON.stringify(n),{mode:0o600});
  await rename(tmp,COUNTER_PATH);
  return {blocked:false,used:n.used};
 });
}
function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))}

const safeSlug=x=>typeof x==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x)&&x.length>=3&&x.length<=90;
const escapeHtml=x=>String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const endpoint=process.env.SUPABASE_URL||'';
const publicKey=process.env.SUPABASE_PUBLISHABLE_KEY||'';
async function publicPreview(slug){
 if(!endpoint||!publicKey)throw new Error('Banco de dados não configurado');
 const url=endpoint+'/rest/v1/prospect_site_previews?slug=eq.'+encodeURIComponent(slug)+'&status=eq.published&select=business_name,business_category,city,description,cover_image,html,slug&limit=1';
 const response=await fetch(url,{headers:{apikey:publicKey,Authorization:'Bearer '+publicKey},signal:AbortSignal.timeout(9000)});
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
  const slug=decodeURIComponent(u.pathname.slice(5));
  if(!safeSlug(slug))return json(res,404,{error:'Prévia não encontrada'});
  try{
   const p=await publicPreview(slug);
   if(!p)return json(res,404,{error:'Demonstração indisponível ou não publicada'});
   const base='https://'+(req.headers.host||'portal-prospect-pro.onrender.com');
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
  '/biblioteca-data.js':['./biblioteca-data.js','text/javascript; charset=utf-8']
 };
 if(Object.prototype.hasOwnProperty.call(libraryFiles,u.pathname)){
  const [file,kind]=libraryFiles[u.pathname];
  try{const buffer=await readFile(new URL(file,import.meta.url));res.writeHead(200,{'Content-Type':kind,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});return res.end(buffer)}
  catch{return json(res,500,{error:'Biblioteca indisponível'})}
 }
 if(u.pathname==='/api/quota'){
  try{const v=await loadUsage();return json(res,200,{month:v.month,used:v.used,limit:LIMIT,remaining:Math.max(0,LIMIT-v.used),enabled:!!process.env.GOOGLE_PLACES_API_KEY})}
  catch{return json(res,200,{month:month(),used:0,limit:LIMIT,remaining:0,enabled:false,reason:'Busca bloqueada até configurar chave Google e contador persistente no servidor.'})}
 }
 if(u.pathname==='/api/search'){
  const term=(u.searchParams.get('term')||'').trim(),city=(u.searchParams.get('city')||'').trim();
  if(!term||!city||term.length>100||city.length>100)return json(res,400,{error:'Informe setor e cidade.'});
  if(!process.env.GOOGLE_PLACES_API_KEY)return json(res,503,{error:'Google Places API ainda não configurada. Nenhuma cobrança foi gerada.'});
  let slot;try{slot=await reserve()}catch{return json(res,503,{error:'Pesquisa bloqueada para evitar cobranças: contador mensal persistente não configurado.'})}
  if(slot.blocked)return json(res,429,{error:'Limite de 500 pesquisas atingido neste mês.',used:slot.used,limit:LIMIT});
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
