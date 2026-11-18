import http from 'node:http';
import {readFile} from 'node:fs/promises';
const port=process.env.PORT||3000;
http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const send=(status,x)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(x))};
 if(u.pathname==='/health')return send(200,{ok:true});
 if(u.pathname==='/api/search'){
  const term=(u.searchParams.get('term')||'').trim(),city=(u.searchParams.get('city')||'').trim();
  if(!term||!city||term.length>100||city.length>100)return send(400,{error:'Informe o setor e a cidade.'});
  if(!process.env.GOOGLE_PLACES_API_KEY)return send(503,{error:'Pesquisa real ainda não ativada. É necessário configurar GOOGLE_PLACES_API_KEY no Render.'});
  try{
   const upstream=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':process.env.GOOGLE_PLACES_API_KEY,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.googleMapsUri'},body:JSON.stringify({textQuery:term+' em '+city,languageCode:'pt-BR',regionCode:'BR',pageSize:20}),signal:AbortSignal.timeout(12000)});
   const j=await upstream.json();
   if(!upstream.ok)return send(502,{error:j.error?.message||'Falha na consulta Google Places'});
   return send(200,{data:(j.places||[]).map(p=>({googleId:p.id,name:p.displayName?.text||'Empresa',address:p.formattedAddress||'',website:p.websiteUri||'',phone:p.internationalPhoneNumber||'',maps:p.googleMapsUri||''}))});
  }catch(e){return send(502,{error:'Falha na pesquisa: '+e.message})}
 }
 if(u.pathname==='/'||u.pathname==='/index.html'){
  try{const html=await readFile(new URL('./index.html',import.meta.url));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});return res.end(html)}catch{return send(500,{error:'Arquivo indisponível'})}
 }
 return send(404,{error:'Não encontrado'});
}).listen(port,'0.0.0.0',()=>console.log('Portal Prospect PRO iniciado na porta '+port));
