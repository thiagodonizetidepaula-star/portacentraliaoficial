// Input is GeoJSONSeq from the Overture Places release (bundled snapshot: 2026-11-18.0). Example:
// overturemaps download --bbox=-46.71,-23.93,-46.25,-23.53 -f geojsonseq --type=place -o abc.geojsonseq
// node scripts/build-social-directory.mjs abc.geojsonseq
import {createReadStream} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {brotliCompressSync,constants} from 'node:zlib';
import {cities,municipality,normalizeName} from '../local-directory.mjs';
import social from '../social-profiles.cjs';
const filename=process.argv[2];
if(!filename)throw Error('Informe o arquivo de lugares em GeoJSONSeq.');
const entries=new Map(cities.map(city=>[municipality(city),new Map()]));
function official(raw){
 try{
  const u=new URL(raw);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port||!u.hostname.includes('.')||raw.length>350)return '';
  const account=social.profile(raw);if(account)return account.url;
  if(/(?:^|\.)(?:facebook\.com|instagram\.com|whatsapp\.com|wa\.me|tiktok\.com|youtube\.com|youtu\.be|linkedin\.com|threads\.(?:com|net)|google\.[a-z.]+|goo\.gl|bit\.ly)$/.test(u.hostname))return '';
  u.hash='';return u.href;
 }catch{return '';}
}
for await(const line of createInterface({input:createReadStream(filename),crlfDelay:Infinity})){
 if(!line.trim())continue;
 const p=JSON.parse(line.replace(/^\x1e/,'')).properties;
 if(!p || p.operating_status && p.operating_status!=='open')continue;
 if(!p.sources?.length||!p.sources.every(s=>['meta','microsoft','overture'].includes(String(s.dataset).toLowerCase()) && (!s.license||s.license==='CDLA-Permissive-2.0')))continue;
 const addr=p.addresses?.find(a=>a.country==='BR'&&entries.has(municipality(a.locality)));
 const name=p.names?.primary?.trim();if(!addr||!name)continue;
 const links=[...new Set([...(p.socials||[]),...(p.websites||[])].map(official).filter(Boolean))].slice(0,6);
 if(!links.length)continue;
 const city=municipality(addr.locality),street=String(addr.freeform||'').split(',')[0].trim().slice(0,86);
 const key=normalizeName(name)+'|'+normalizeName(street)+'|'+links.join('|');
 entries.get(city).set(key,[name,street,links]);
}
for(const [city,items] of entries){
 const sorted=[...items.values()].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR')||a[1].localeCompare(b[1],'pt-BR'));
 const bytes=brotliCompressSync(Buffer.from(JSON.stringify(sorted)),{params:{[constants.BROTLI_PARAM_QUALITY]:8}});
 await writeFile(new URL('../directory/'+city.replaceAll(' ','-')+'.json.br',import.meta.url),bytes);
 console.log(city,sorted.length,bytes.length);
}
