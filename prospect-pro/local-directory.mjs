import {readFile} from 'node:fs/promises';
import {brotliDecompress} from 'node:zlib';
import {promisify} from 'node:util';
import social from './social-profiles.cjs';

export const normalizeName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const municipality=value=>normalizeName(String(value||'').split(/[,/]|\s+-\s+/)[0]).replace(/\s+(?:sp|rj|mg|pr|rs|ba|sc|pe|ce|go|df)$/,'');
export const cities=['Mauá','Santo André','São Bernardo do Campo','São Caetano do Sul','Diadema','Ribeirão Pires','Rio Grande da Serra'];
const files=new Map(cities.map(city=>[normalizeName(city),normalizeName(city).replaceAll(' ','-')]));
const unpack=promisify(brotliDecompress),cache=new Map();
const staticSource='https://docs.overturemaps.org/guides/places/';
export function matchBusinesses(rows,name,town) {
 const term=normalizeName(name);
 if(term.length<2)return [];
 const exact=rows.filter(item=>item.key===term);
 const choices=exact.length?exact:term.length>=7 && term.includes(' ')?rows.filter(item=>item.key.startsWith(term+' ')||term.startsWith(item.key+' ')&&item.key.length>=7&&item.key.includes(' ')):[];
 return choices.slice(0,5).map(({record:[name,area,links]})=>{
  const accounts=social.profiles(links);
  const website=links.find(link=>!social.profile(link))?.replace(/^http:/i,'https:');
  return {name,address:[area,town].filter(Boolean).join(' · '),source:staticSource,attribution:'Overture Maps · 18/11/2026',license:'/dados/locais/licenca',website,
   socialLinks:accounts.map(v=>v.url),profiles:accounts.filter(v=>v.network==='instagram').map(v=>v.url)};
 });
}
export async function lookupLocal(name,city){
 const file=files.get(municipality(city));
 if(!file)return [];
 if(!cache.has(file)){
  const read=readFile(new URL('./directory/'+file+'.json.br',import.meta.url)).then(unpack).then(raw=>
    JSON.parse(raw).map(record=>({key:normalizeName(record[0]),record}))).catch(error=>{cache.delete(file);throw error;});
  cache.set(file,read);
 }
 return matchBusinesses(await cache.get(file),name,cities.find(s=>normalizeName(s)===municipality(city)));
}
