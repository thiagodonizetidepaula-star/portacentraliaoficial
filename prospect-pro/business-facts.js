const days={Monday:'Segunda',Tuesday:'Terça',Wednesday:'Quarta',Thursday:'Quinta',Friday:'Sexta',Saturday:'Sábado',Sunday:'Domingo',PublicHolidays:'Feriados'};
const abbr={Mo:'Seg',Tu:'Ter',We:'Qua',Th:'Qui',Fr:'Sex',Sa:'Sáb',Su:'Dom',PH:'Feriados'};
const clean=(value,limit=110)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,limit):'';
const list=value=>Array.isArray(value)?value:value==null?[]:[value];
export function schedule(raw) {
 const lines=[];
 for (const entry of list(raw)) {
  if (typeof entry==='string') {
   for (const line of entry.split(/[;\n]/)) {
    const s=clean(line).replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g,(_,d)=>abbr[d]).replace(/\boff\b/g,'fechado');
    if(s)lines.push(s==='24/7'?'Todos os dias · 24 horas':s);
   }
  } else if (entry && typeof entry==='object') {
   if(entry.validFrom||entry.validThrough)continue;
   const names=list(entry.dayOfWeek).map(v=>days[String(v).split(/[\/#]/).pop()]).filter(Boolean);
   const times=[entry.opens,entry.closes].map(t=>/^(?:[01]\d|2[0-4]):[0-5]\d(?::[0-5]\d)?$/.test(t||'')?t.slice(0,5):'');
   if(names.length&&times.every(Boolean))lines.push(names.join(', ')+' · '+(times.join('-')==='00:00-00:00'?'fechado':times.join(' às ')));
  }
 }
 return [...new Set(lines)].slice(0,10);
}
export function bioFacts(value) {
 const hours=[],services=[];
 for(const line of String(value||'').split(/[\n•]+/).map(v=>clean(v,150)).filter(Boolean)){
  if(/(?:seg(?:unda)?|ter(?:ça)?|qua(?:rta)?|qui(?:nta)?|sex(?:ta)?|s[áa]b(?:ado)?|dom(?:ingo)?|todos os dias|diariamente|hor[áa]rios?)\b/i.test(line)&&/\d\s*(?:h|:|às)|24\/7|fechad[oa]/i.test(line))hours.push(line);
  const match=/^(?:servi[çc]os(?: oferecidos)?|especialidades|tratamentos|card[áa]pio)\s*[:–-]\s*(.+)$/i.exec(line);
  if(match)services.push(...match[1].split(/[,;|]/).map(v=>clean(v,85)).filter(Boolean));
 }
 return {hours:[...new Set(hours)].slice(0,10),services:[...new Set(services)].slice(0,8)};
}
export function catalog(raw) {
 const result=new Set();
 function add(item,depth){
  if(!item||typeof item!=='object'||depth>7||result.size>=8)return;
  if(Array.isArray(item)){for(const sub of item.slice(0,24))add(sub,depth+1);return;}
  const types=list(item['@type']).map(v=>String(v).split('/').pop());
  if(types.some(t=>['Service','MenuItem','Product','Offer'].includes(t))){
   const name=clean(item.name||item.itemOffered?.name,80);
   if(name)result.add(name);
  }
  for(const key of ['hasOfferCatalog','hasMenuSection','hasMenuItem','itemListElement','itemOffered','item','makesOffer','offers'])add(item[key],depth+1);
 }
 add(raw,0); return [...result].slice(0,8);
}
