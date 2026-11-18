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
http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(req.method!=='GET')return json(res,405,{error:'Método não permitido'});
 if(u.pathname==='/health')return json(res,200,{ok:true});
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
