import social from './social-profiles.cjs';

import { lookupLocal, municipality, normalizeName } from './local-directory.mjs';
const cache=new Map(),pending=new Map();
const claims=(record,code)=>(record?.claims?.[code]||[]).filter(x=>x.rank!=='deprecated').map(x=>x.mainsnak?.datavalue?.value).filter(Boolean);
const labels=(entry)=>[entry?.labels?.pt?.value,entry?.labels?.en?.value].filter(Boolean);
const properties={P2003:'https://www.instagram.com/',P2013:'https://www.facebook.com/',P7085:'https://www.tiktok.com/@',P2397:'https://www.youtube.com/channel/'};
async function wiki(params,signal){
 const url=new URL('https://www.wikidata.org/w/api.php');
 url.search=new URLSearchParams({format:'json',...params});
 const response=await fetch(url,{headers:{'User-Agent':'PortalProspectPRO/1.0 (+https://portalcentralia.com.br)','Accept':'application/json'},redirect:'error',signal});
 if(!response.ok)throw Error('O diretório público está indisponível.');
 const data=await response.json();
 if(data.error)throw Error('O diretório público não pôde concluir a pesquisa.');
 return data;
}
async function lookupWiki(name,city,signal){
 const matches=await wiki({action:'wbsearchentities',search:name,language:'pt',uselang:'pt',type:'item',limit:'5'},signal);
 const ids=(matches.search||[]).filter(r=>normalizeName(r.label)===normalizeName(name)||normalizeName(r.match?.text)===normalizeName(name)).map(r=>r.id).filter(id=>/^Q\d+$/.test(id));
 if(!ids.length)return [];
 const {entities}=await wiki({action:'wbgetentities',ids:ids.join('|'),props:'claims|labels|descriptions',languages:'pt|en'},signal);
 const records=Object.values(entities||{}).filter(r=>!claims(r,'P31').some(v=>v.id==='Q5') && !claims(r,'P576').length);
 const locationIds=record=>['P131','P159','P276'].flatMap(k=>claims(record,k).map(v=>v.id).filter(v=>/^Q\d+$/.test(v)));
 const places=[...new Set(records.flatMap(locationIds))].slice(0,30);
 const located=places.length?(await wiki({action:'wbgetentities',ids:places.join('|'),props:'labels',languages:'pt|en'},signal)).entities||{}:{};
 return records.flatMap(record=>{
  const desc=record.descriptions?.pt?.value||record.descriptions?.en?.value||'';
  const match=locationIds(record).some(k=>labels(located[k]).some(v=>municipality(v)===city))||(' '+normalizeName(desc)+' ').includes(' '+city+' ');
  if(!match)return [];
  const networks=social.profiles(Object.entries(properties).flatMap(([key,prefix])=>claims(record,key).filter(v=>typeof v==='string').map(v=>prefix+v)));
  const website=claims(record,'P856').find(s=>typeof s==='string'&&/^https:\/\//.test(s));
  if(!networks.length&&!website)return [];
  return [{name:labels(record)[0]||name,address:desc||city,source:'https://www.wikidata.org/wiki/'+record.id,attribution:'Wikidata',website,socialLinks:networks.map(v=>v.url),profiles:networks.filter(v=>v.network==='instagram').map(v=>v.url)}];
 });
}
export async function findPublicIdentity(name,city,signal){
 if(typeof name!=='string'||typeof city!=='string'||name.trim().length<2||city.trim().length<2||name.length>100||city.length>100)return [];
 const town=municipality(city),id=normalizeName(name)+'|'+town,now=Date.now();
 if(!town)return [];
 const previous=cache.get(id);if(previous&&previous.until>now)return previous.results;
 if(!pending.has(id)){
  const task=lookupLocal(name,town).then(local=>local.length?local:lookupWiki(name,town,AbortSignal.timeout(6500))).then(results=>{
   if(cache.size>=400)cache.delete(cache.keys().next().value);
   cache.set(id,{results,until:Date.now()+86400000});return results;
  }).finally(()=>pending.delete(id));
  pending.set(id,task);
 }
 signal.throwIfAborted();const results=await pending.get(id);signal.throwIfAborted();return results;
}
