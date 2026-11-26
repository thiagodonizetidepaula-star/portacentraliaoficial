(() => {
'use strict';
const $ = id => document.getElementById(id);
const value = id => $(id).value.trim();
const node = (tag, text) => {
 const el = document.createElement(tag);
 if (text) el.textContent = text;
 return el;
};
function https(raw) {
 try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; }
 catch { return ''; }
}
const profile=window.ProspectLinks.instagram;
function safeLink(label, raw) {
 const href = https(raw);
 const a = node(href ? 'a' : 'span', label);
 if (href) { a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
 return a;
}
function action(label, run) {
 const b = node('button', label);
 b.type = 'button'; b.className = 'button secondary'; b.onclick = run;
 return b;
}
function logoColor(bitmap) {
 const canvas = document.createElement('canvas'); canvas.width = canvas.height = 48;
 const ctx = canvas.getContext('2d', {willReadFrequently:true});
 ctx.drawImage(bitmap, 0, 0, 48, 48);
 const pixels = ctx.getImageData(0, 0, 48, 48).data;
 const bins = new Map();
 for (let i = 0; i < pixels.length; i += 4) {
  if (pixels[i+3] < 170) continue;
  const [r,g,b] = pixels.subarray(i,i+3);
  if (Math.min(r,g,b) > 235) continue;
  const key = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
  const bin = bins.get(key) || {n:0,r:0,g:0,b:0};
  bin.n++; bin.r += r; bin.g += g; bin.b += b; bins.set(key, bin);
 }
 const best = [...bins.values()].sort((a,b) => b.n-a.n)[0];
 return best ? '#' + [best.r,best.g,best.b].map(v => Math.round(v/best.n).toString(16).padStart(2,'0')).join('') : '';
}
async function imageFile(file, logo) {
 if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 12000000) throw Error('Escolha uma imagem JPG, PNG ou WebP de até 12 MB.');
 const bitmap = await createImageBitmap(file).catch(() => {throw Error('O navegador não conseguiu ler essa imagem.');});
 try {
  const scale = Math.min(1, (logo ? 640 : 1440) / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .83));
  if (!blob || blob.type !== 'image/webp' || blob.size > 2500000) throw Error('A imagem não pôde ser preparada. Use um arquivo menor.');
  return {blob, color:logo ? logoColor(bitmap) : ''};
 } finally { bitmap.close(); }
}

window.createProspectBrand = ({sessionToken, getPlaceId, aiAvailable}) => {
 const form = $('studioClientForm'), results = $('brandResults'), feedback = $('brandStatus');
 let caps = {places:false,instagram:false,facebook:false};
 let selectedPlace = '', sources = [], job = null, ambiguous = false, checked = false, waiting = false;
 const appliedFields = new Map(), photoCaptions=new Map();
 let archiveUrls=[];
 function clearArchive(){ archiveUrls.forEach(url=>URL.revokeObjectURL(url)); archiveUrls=[]; }
 const setMessage = message => { feedback.textContent = message; };
 const social = () => profile(value('studioInstagram')) || profile(value('studioWebsite'));
 const official = () => !window.ProspectSocial.profile(value('studioWebsite')) && !window.ProspectLinks.whatsappLinkNumber(value('studioWebsite')) && https(value('studioWebsite'));
 const facebook=()=>window.ProspectSocial.profiles([value('studioWebsite'),...value('studioSocialLinks').split(/\s+/)]).filter(p=>p.network==='facebook')[0]?.url;
 const sourceTarget=()=>official()||social()||facebook()||window.ProspectSocial.profile(value('studioWebsite'))?.url;
 const key = () => [value('studioCompany'),value('studioCity')].join('\n');
 const fieldChange = () => form.dispatchEvent(new Event('input',{bubbles:true}));
 function refresh() {
  const name = value('studioCompany'), city = value('studioCity');
  const query = [name, value('studioAddress'), city].filter(Boolean).join(' ');
  const id = selectedPlace || getPlaceId();
  const map = $('brandMaps');
  map.hidden = !name;
  map.href = 'https://www.google.com/maps/search/?' + new URLSearchParams({api:'1',query,...(id?{query_place_id:id}:{})});
  const find = $('brandFindSocial');
  find.hidden = !name;
  find.href = 'https://www.google.com/search?' + new URLSearchParams({q:query+' (site:instagram.com OR site:facebook.com OR site:tiktok.com OR site:youtube.com OR site:linkedin.com OR site:threads.com)'});
  $('brandResearch').textContent = official() ? 'Pesquisar página da empresa' : sourceTarget() ? 'Conferir rede social' : $('brandGoogleAtGenerate').checked ? 'Consultar Google · 1 busca' : 'Pesquisar redes e horários';
  $('brandReadSocial').hidden = !official() || !social();
  $('brandGoogleOption').hidden = !caps.places || Boolean(official() || social());
  $('brandSearchAI').hidden = !aiAvailable() || !name || !city;
 }
 const enabled = fetch('/api/studio/brand/status',{cache:'no-store'}).then(async r => {
  if (r.ok) caps = await r.json();
 }).catch(() => {}).finally(refresh);

 function invalidate() {
  job?.abort(); job = null; results.replaceChildren(); ambiguous = checked = waiting = false;
  $('brandSkip').hidden = true; $('brandResearch').disabled = false; setMessage('');
 }
 function acceptField(id,text) { $(id).value=text; appliedFields.set(id,text); }
 function resume() {
  if (!waiting) return;
  const identity = key(); waiting=false; $('brandSkip').hidden=true;
  setTimeout(()=>{ if (identity===key()) form.requestSubmit(); },0);
 }
 function run(task) {
  job?.abort();
  const controller = new AbortController(), start = key();
  job = controller;
  $('brandResearch').disabled = true;
  const signal = controller.signal;
  const active = () => !signal.aborted && start === key();
  return (async () => {
   try { await task(signal, active); }
   catch (e) { if (active()) setMessage(e.message || 'Não foi possível consultar a fonte.'); }
   finally { if (job === controller) { job = null; $('brandResearch').disabled=false; } }
  })();
 }
 function login() {
  if (sessionToken()) return true;
  setMessage('Entre no Prospect PRO e repita a consulta ou importação.');
  $('manageProjectAccount').click(); return false;
 }
 async function request(path, body, signal, binary = false) {
  const response = await fetch(path, {method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessionToken()},
   body:JSON.stringify(body), signal});
  if (binary && response.ok) return response.blob();
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || 'A consulta não foi concluída.');
  return data;
 }
 async function uploader(signal) {
  const token = sessionToken();
  const config = await fetch('/api/public-config',{signal,cache:'no-store'}).then(r => r.json());
  if (!config.configured) throw Error('O armazenamento de imagens está indisponível. Você pode usar links HTTPS.');
  const headers = {apikey:config.publishableKey, Authorization:'Bearer '+token};
  const root = config.supabaseUrl.replace(/\/+$/,'');
  const user = await fetch(root+'/auth/v1/user',{headers,signal});
  const account = user.ok && await user.json();
  if (!account?.id || account.app_metadata?.prospect_operator !== true || account.is_anonymous) throw Error('Entre com a conta de operador para importar imagens.');
  return async (file, isLogo, source = file.name || '') => {
   const {blob,color} = await imageFile(file,isLogo);
   // A retried import uses the same immutable object, including after a partial batch.
   const input = new Blob([isLogo?'logo\n':'foto\n',source,'\n',blob]);
   const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',await input.arrayBuffer())).slice(0,16);
   digest[6] = (digest[6]&15)|128; digest[8] = (digest[8]&63)|128;
   const hex = Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
   const id = [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
   const path = '/prospect-site-images/'+encodeURIComponent(account.id)+'/'+id+'.webp';
   const response = await fetch(root+'/storage/v1/object'+path,{method:'POST',signal,
    headers:{...headers,'Content-Type':blob.type,'x-upsert':'false'},body:blob});
   if (!response.ok) {
    const issue=await response.json().catch(()=>({}));
    if (!['Duplicate','KeyAlreadyExists','ResourceAlreadyExists'].includes(issue.error||issue.code)) {
     throw Error('O armazenamento não aceitou a imagem. Use um link HTTPS ou confira o acesso da conta.');
    }
   }
   return {url:root+'/storage/v1/object/public'+path,color};
  };
 }
 const asset = item => typeof item === 'string' ? {url:https(item)} : item;
 const photoList = () => [...new Set(value('brandPhotos').split(/\r?\n/).map(s=>s.trim()).filter(Boolean))];
 const remember = url => { if (https(url) && !sources.includes(url)) sources.push(url); };
 function review(data) {
  results.replaceChildren();
  const panel = node('div'); panel.className = 'brand-review';
  panel.append(safeLink('Conferir fonte'+(data.name?' · '+data.name:''),data.source));
  const items = [];
  function choice(kind, label, candidate, item) {
   const line = node('label'); line.className = 'brand-choice';
   const input = node('input'); input.type = kind === 'profile' ? 'radio' : 'checkbox';
   if (kind === 'profile') input.name = 'candidateProfile';
   input.checked = kind !== 'profile' || (data.profiles||[]).length === 1;
   if(kind==='hours'){
    input.type='radio';input.name='importedBusinessHours';
    input.checked=!data.alternativeHours&&!value('studioHours');
   }
   if(kind==='photo')input.checked=items.filter(i=>i.kind==='photo').length<3;
   if(kind==='description')input.checked=!value('studioSummary');
   if(kind==='whatsapp'){
    input.type='radio'; input.name='candidateWhatsapp';
    input.checked=data.whatsappContacts.length===1 && (!$('studioWhatsApp').value.trim() || $('studioWhatsAppConfirmed').checked);
   }
   line.append(input);
   if (item) {
    const img = node('img'); img.src = item.url; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
    line.append(img);
   }
   line.append(node('span',label)); panel.append(line); items.push({kind,value:candidate,item,input});
  }
  const mark = asset(data.logo);
  if (mark?.url) choice('logo','Usar como logo',mark.url,mark);
  for (const [i,raw] of (data.photos||[]).entries()) {
   const item = asset(raw); if (item?.url) choice('photo',item.caption||'Foto '+(i+1),item.url,item);
  }
  if (data.color) choice('color','Cor sugerida '+data.color,data.color);
  if (data.description) choice('description',data.description,data.description);
  if(data.phone&&!value('studioPhone'))choice('phone','Telefone · '+data.phone,data.phone);
  if(data.address&&!value('studioAddress'))choice('address','Endereço · '+data.address,data.address);
  if(data.mediaLimited)panel.append(node('p','A Meta liberou parte dos dados, mas não disponibilizou a galeria desta página.'));
  if(data.alternativeHours)panel.append(node('p','As fontes informam horários diferentes. Confira com a empresa e escolha uma opção.'));
  if(data.hours?.length)choice('hours','Horários da fonte consultada · '+data.hours.join(' / '),data.hours.join('\n'));
  if(data.alternativeHours)choice('hours','Horários no Instagram · '+data.alternativeHours.lines.join(' / '),data.alternativeHours.lines.join('\n'));
  for(const service of data.services||[])choice('service','Serviço · '+service,service);
  for(const account of window.ProspectSocial.profiles(data.socialLinks||[]))if(account.network!=='instagram')choice('network',account.label+' · '+account.url,account.url);
  for(const number of data.whatsappContacts||[])if(window.ProspectLinks.whatsappNumber({whatsapp:number}))choice('whatsapp','WhatsApp '+number,number);
  for (const url of data.profiles || []) if (profile(url)) choice('profile',profile(url),profile(url));
  if (items.length) {
   panel.append(node('p','Confira se a fonte é desta unidade e selecione o conteúdo autorizado para o site.'));
   const apply = action('Aplicar seleção autorizada', () => run(async (signal,active) => {
    const chosen = items.filter(item=>item.input.checked);
    if(chosen.filter(i=>i.kind==='photo').length>3){setMessage('Escolha até três fotos para a galeria.');return;}
    if (!chosen.length) { setMessage('Selecione os materiais que deseja aplicar.'); return; }
    apply.disabled = true;
    try {
     const upload = chosen.some(i=>i.item?.ticket) ? await uploader(signal) : null;
     const prepared = [];
     for (const item of chosen) {
      const file = item.item?.ticket ? await request('/api/studio/brand/media',{ticket:item.item.ticket},signal,true) : null;
      const saved = file ? await upload(file,item.kind==='logo',item.item.source) : {url:item.value};
      prepared.push({...item,saved});
     }
     if (!active()) return;
     const photos = [];
     for (const {kind,value:val,saved,item} of prepared) {
      if (kind==='logo') { $('brandLogo').value=saved.url; if(saved.color&&!value('brandColorHex')) $('brandColorHex').value=saved.color; }
      if (kind==='photo') { photos.push(saved.url); if(item?.caption)photoCaptions.set(saved.url,item.caption); }
      if (kind==='color') $('brandColorHex').value=val;
      if (kind==='description') acceptField('studioSummary',val);
      if (kind==='phone'&&!value('studioPhone'))acceptField('studioPhone',val);
      if (kind==='address'&&!value('studioAddress'))acceptField('studioAddress',val);
      if (kind==='whatsapp') { $('studioWhatsAppConfirmed').checked=false; acceptField('studioWhatsApp',val); }
      if (kind==='hours')acceptField('studioHours',val);
      if (kind==='service')acceptField('studioServices',[...new Set([...value('studioServices').split('\n').filter(Boolean),val])].slice(0,8).join('\n'));
      if (kind==='network')acceptField('studioSocialLinks',window.ProspectSocial.profiles([...value('studioSocialLinks').split('\n'),val]).map(s=>s.url).join('\n'));
      if (kind==='profile') acceptField('studioInstagram',val);
      if (item?.source) remember(item.source);
     }
     if (photos.length) $('brandPhotos').value=photos.join('\n');
     remember(data.source); for(const source of data.otherSources||[])remember(source);
     results.replaceChildren(); refresh(); fieldChange();
     setMessage('Seleção aplicada às informações da empresa.'); resume();
    } finally { apply.disabled=false; }
   }));
   panel.append(apply);
  }
  results.append(panel);
  setMessage(items.length ? 'Materiais encontrados para revisão.' : 'A fonte não disponibilizou materiais identificáveis. Use os arquivos da empresa.');
 }
 async function reviewWithInstagram(data,signal,active){
  const accounts=window.ProspectSocial.profiles([...(data.socialLinks||[]),...(data.profiles||[])]);
  const profiles=accounts.filter(p=>p.network==='instagram');
  if(caps.instagram && profiles.length===1 && (!social()||social()===profiles[0].url)){
   let extra;
   try { extra=await request('/api/studio/brand/instagram',{url:profiles[0].url},signal); } catch {}
   if(!active())return;
   if(extra){
    data.photos=[...(extra.photos||[]),...(data.photos||[])].slice(0,6);
    data.logo ||= extra.logo; data.description ||= extra.description;
    data.otherSources=[...(data.otherSources||[]),extra.source];
    data.services=[...new Set([...(data.services||[]),...(extra.services||[])])].slice(0,8);
    if(extra.hours?.length && data.hours?.length && data.hours.join(' ')!==extra.hours.join(' '))data.alternativeHours={source:extra.source,lines:extra.hours};
    else if(!data.hours?.length)data.hours=extra.hours;
   }
  }
  const fb=accounts.filter(p=>p.network==='facebook');
  if(caps.facebook&&fb.length===1&&!data.facebookChecked){
   try{
    const extra=await request('/api/studio/brand/facebook',{url:fb[0].url},signal);
    if(!active())return;
    data.photos=[...(data.photos||[]),...(extra.photos||[])].slice(0,9);
    data.logo||=extra.logo;data.description||=extra.description;data.phone||=extra.phone;data.address||=extra.address;
    if(!data.hours?.length)data.hours=extra.hours;
    data.services=[...new Set([...(data.services||[]),...(extra.services||[])])].slice(0,8);
    data.otherSources=[...(data.otherSources||[]),extra.source];
   }catch{}
  }
  if(active())review(data);
 }
 async function readSource(url,signal,active,directoryItem) {
  const account=window.ProspectSocial.profile(url);
  if(account?.network==='facebook'){
   if(!caps.facebook){review({source:account.url,socialLinks:[account.url]});setMessage('Facebook localizado. A importação de fotos e informações depende da autorização da Meta.');return;}
   setMessage('Consultando a página comercial no Facebook…');
   try {
    const data=await request('/api/studio/brand/facebook',{url:account.url},signal);
    if(active())review(data);
   } catch(e){if(active()){review({source:account.url,socialLinks:[account.url]});setMessage(e.message+' O link pode ser mantido.');}}
   return;
  }
  if(account&&account.network!=='instagram'){review({source:account.url,socialLinks:[account.url]});return;}
  const instagram = profile(url);
  if (instagram && !caps.instagram) {
   results.replaceChildren(safeLink('Abrir perfil no Instagram',instagram),
    action('Confirmar perfil desta unidade',()=>{ acceptField('studioInstagram',instagram); remember(instagram); fieldChange(); refresh();
     results.replaceChildren(); setMessage('Instagram vinculado. Adicione as fotos da empresa ou o ZIP exportado pelo Instagram.'); resume(); }));
   setMessage('A conexão com a Meta está inativa. Confira o perfil para vincular o Instagram ao site.');
   return;
  }
  setMessage(instagram?'Consultando o perfil profissional no Instagram…':'Lendo a página da empresa…');
  const data = await request('/api/studio/brand/'+(instagram?'instagram':'website'),{url:instagram||url},signal);
  if(!active())return;
  if(directoryItem){
   const accounts=window.ProspectSocial.profiles([...(data.socialLinks||[]),...(data.profiles||[]),...(directoryItem.socialLinks||[])]);
   data.socialLinks=accounts.map(a=>a.url);
   data.profiles=accounts.filter(a=>a.network==='instagram').map(a=>a.url);
   data.otherSources=[directoryItem.source];
  }
  if(instagram)review(data);
  else await reviewWithInstagram(data,signal,active);
 }
 function places(list) {
  results.replaceChildren(); ambiguous = list.length > 1;
  if (ambiguous) fieldChange();
  const logo = node('img'); logo.src='/google-maps-attribution.png'; logo.alt='Google Maps'; logo.width=98; logo.height=18;
  results.append(logo);
  for (const place of list) {
   const row=node('div'); row.className='brand-place';
   row.append(node('strong',place.name),node('span',[place.address,place.phone].filter(Boolean).join(' · ')));
   if(place.hours?.length){
    const hours=node('details');hours.append(node('summary','Horários no Google Maps'));
    place.hours.forEach(line=>hours.append(node('p',line)));row.append(hours);
   }
   const links=node('div'); links.className='brand-actions';
   if (place.maps) links.append(safeLink('Ver no Maps',place.maps));
   if (place.photosUrl) links.append(safeLink('Ver fotos no Google',place.photosUrl));
   if (place.website) links.append(safeLink('Conferir página indicada',place.website));
   for (const credit of place.attributions||[]) if (credit.provider) links.append(safeLink(credit.provider,credit.providerUri));
   const pick=action('Usar esta unidade',()=>run(async(signal,active)=>{
    selectedPlace=place.googleId; ambiguous=false;
    if(place.phone&&!value('studioPhone'))acceptField('studioPhone',place.phone);
    const whatsapp=window.ProspectLinks.whatsappLinkNumber(place.website);
    if(whatsapp&&(!value('studioWhatsApp')||$('studioWhatsAppConfirmed').checked)){
     $('studioWhatsAppConfirmed').checked=false;
     acceptField('studioWhatsApp',whatsapp);
    }
    refresh(); fieldChange();
    $('brandSkip').hidden=!waiting;
    results.replaceChildren();
    const target=(!whatsapp&&https(place.website)) || social() || official() || facebook();
    if (target) {
     await readSource(target,signal,active);
     if (active() && waiting) $('brandSkip').hidden=false;
    } else {
     await lookupDirectory(signal,active); if(active()&&!results.querySelector('button'))resume();
    }
   }));
   row.append(links,pick); results.append(row);
  }
  setMessage(list.length?'Confira o endereço e escolha a unidade correta.':'Nenhuma unidade encontrada. Você pode informar a página ou o Instagram da empresa.');
 }
 async function lookupDirectory(signal,active){
  if(!value('studioCity'))throw Error('Informe a cidade para pesquisar as redes desta unidade.');
  setMessage('Buscando páginas da empresa pelo nome e pela cidade…');
  const data=await request('/api/studio/brand/directory',{name:value('studioCompany'),city:value('studioCity')},signal);
  if(!active())return;
  results.replaceChildren();
  const candidates=data.candidates||[];
  for(const item of candidates){
   const row=node('div');row.className='brand-place';
   row.append(node('strong',item.name),node('span',item.address),safeLink(item.attribution||'Conferir fonte',item.source));
   if(item.license) {const license=node('a','Licença dos dados');license.href='/dados/locais/licenca';license.target='_blank';license.rel='noopener';row.append(license);}
   for(const account of window.ProspectSocial.profiles(item.socialLinks||[]))row.append(safeLink('Abrir '+account.label,account.url));
   if(item.socialLinks?.length||item.hours?.length)row.append(action('Conferir redes e horários',()=>run((s,a)=>reviewWithInstagram({...item},s,a))));
   if(item.website)row.append(action('Pesquisar página indicada',()=>run((s,a)=>readSource(item.website,s,a,item))));
   results.append(row);
  }
  setMessage(candidates.length?'Confira o endereço da unidade antes de aplicar os dados.':'Nenhuma rede identificada nessa fonte. Use Pesquisar nas redes ou informe uma página oficial.');
 }
 const lookupBrand=()=>run(async(signal,active)=>{
  await enabled;
  if (!active()) return;
  const target=sourceTarget();
  if (!value('studioCompany')) throw Error('Informe o nome da empresa.');
  if (target && (caps.instagram===false && profile(target))) { checked=true; await readSource(target,signal,active); return; }

  if (!login()) return;
  checked=true;
  if (target) { await readSource(target,signal,active); return; }
  if(!$('brandGoogleAtGenerate').checked || !caps.places){await lookupDirectory(signal,active);return;}
  const id=selectedPlace||getPlaceId();
  if (!id && !value('studioCity')) throw Error('Informe a cidade para localizar a unidade.');
  const path=id?'/api/studio/place?'+new URLSearchParams({id}):'/api/search?'+new URLSearchParams({term:value('studioCompany'),city:value('studioCity'),identity:'1'});
  setMessage('Consultando a unidade no Google…');
  const response=await fetch(path,{headers:{Authorization:'Bearer '+sessionToken()},signal,cache:'no-store'});
  const data=await response.json();
  if (!response.ok) throw Error(data.error||'Consulta indisponível.');
  if (active()) places(data.data||[]);
 });
 $('brandResearch').onclick=lookupBrand;
 $('brandReadSocial').onclick=()=>run(async(signal,active)=>{
  await enabled;
  if (active() && (!caps.instagram || login())) await readSource(social(),signal,active);
 });
 $('brandSkip').onclick=()=>{ if (!ambiguous) { results.replaceChildren(); resume(); } };
 $('brandSearchAI').onclick=()=>run(async(signal,active)=>{
  if (!login()) return;
  setMessage('Pesquisando perfis da empresa na web…');
  const data=await request('/api/studio/ai/instagram',{company:{name:value('studioCompany'),city:value('studioCity'),industry:value('studioSegment')}},signal);
  if (!active()) return;
  results.replaceChildren();
  const profiles=data.socialLinks||data.profiles||[];
  for (const url of profiles) {
   const row=node('div'); row.className='brand-place'; row.append(safeLink(url,url),
    action('Conferir este perfil',()=>run((s,a)=>readSource(url,s,a)))); results.append(row);
  }
  setMessage(profiles.length?'Confira o perfil e a unidade antes de aplicar os materiais.':'Nenhum perfil foi confirmado na pesquisa. Você pode informar o link da empresa.');
 });
 $('brandInstagramZip').addEventListener('change',()=>run(async(signal,active)=>{
  const file=$('brandInstagramZip').files[0];
  clearArchive(); if(!file)return;
  setMessage('Lendo as fotos das publicações no seu dispositivo…');
  const {postImages}=await import('/instagram-archive.mjs');
  const photos=await postImages(file);
  if(!active())return;
  results.replaceChildren();const panel=node('div');panel.className='brand-review';
  if(!photos.length){setMessage('Este ZIP não inclui fotos de publicações. Selecione o arquivo de mídia do Instagram ou envie as fotos individualmente.');return;}
  panel.append(node('strong','Escolha até três fotos das publicações'));
  const choices=photos.map((photo,i)=>{
   const label=node('label');label.className='brand-choice';
   const check=node('input');check.type='checkbox';const img=node('img');img.alt='';
   img.src=URL.createObjectURL(photo);archiveUrls.push(img.src);label.append(check,img,node('span','Foto '+(i+1)));panel.append(label);
   return {check,photo};
  });
  panel.append(action('Usar fotos selecionadas',()=>run(async(sig,current)=>{
   const selected=choices.filter(v=>v.check.checked);if(!selected.length||selected.length>3)throw Error('Selecione de uma a três fotos.');
   if(!login())return;
   const upload=await uploader(sig),urls=[];
   for(const {photo} of selected)urls.push((await upload(photo,false)).url);
   if(!current())return;
   $('brandPhotos').value=urls.join('\n');$('brandInstagramZip').value='';clearArchive();results.replaceChildren();fieldChange();setMessage('Fotos das publicações incluídas na galeria.');resume();
  })));
  results.append(panel);setMessage('Somente as fotos que você escolher serão importadas.');
 }));
 $('brandUpload').onclick=()=>run(async(signal,active)=>{
  const logo=$('brandLogoFile').files[0], photos=[...$('brandPhotoFiles').files];
  if (!logo&&!photos.length) throw Error('Escolha o arquivo do logo ou as fotos da empresa.');
  if (photos.length>3) throw Error('Escolha até três fotos.');
  if (!login()) return;
  setMessage('Preparando os arquivos da empresa…');
  const upload=await uploader(signal);
  const mark=logo ? await upload(logo,true) : null;
  const urls=[]; for (const file of photos) urls.push((await upload(file,false)).url);
  if (!active()) return;
  if (mark) { $('brandLogo').value=mark.url; if (mark.color&&!value('brandColorHex')) $('brandColorHex').value=mark.color; }
  if (urls.length) $('brandPhotos').value=urls.join('\n');
  $('brandLogoFile').value=''; $('brandPhotoFiles').value=''; fieldChange();
  setMessage('Arquivos da empresa prontos para as propostas.');
 });
 form.addEventListener('input',event=>{
  if (['studioCompany','studioCity'].includes(event.target.id)) {
   invalidate(); selectedPlace=''; sources=[]; photoCaptions.clear();clearArchive();
   for (const [id,previous] of appliedFields) if ($(id).value===previous) $(id).value='';
   appliedFields.clear();
   $('brandGoogleAtGenerate').checked=false;
   for (const id of ['brandLogo','brandPhotos','brandColorHex','brandLogoFile','brandPhotoFiles','brandInstagramZip']) $(id).value='';
  } else if (['studioInstagram','studioWebsite','studioSocialLinks','studioAddress','brandGoogleAtGenerate','brandSocialAtGenerate'].includes(event.target.id)) invalidate();
  refresh();
 });
 window.addEventListener('portal-studio-session',()=>{ invalidate(); refresh(); });
 return { refresh, async prepare() {
  await enabled;
  if (job) throw Error('Aguarde a conclusão da pesquisa ou da importação da marca.');
  if (ambiguous) throw Error('Escolha a unidade correta nos resultados do Google.');
  if (waiting) { setMessage('Confira o material encontrado ou continue com os dados já confirmados.'); return false; }
  if (checked) return true;
  const autoSource=sessionToken() && $('brandSocialAtGenerate').checked && (official() || (social() && caps.instagram) || (facebook() && caps.facebook) || (!sourceTarget() && value('studioCity') && !value('studioSocialLinks')));
  const useGoogle=!official()&&!social() && caps.places && $('brandGoogleAtGenerate').checked;
  if (!autoSource && !useGoogle) return true;
  if (!login()) return false;
  const initial=key();
  await lookupBrand();
  if (initial!==key() || !checked) return false;
  if (results.querySelector('button')) {
   waiting=true; $('brandSkip').hidden=ambiguous; return false;
  }
  return true;
 }, read() {
  if (ambiguous) throw Error('Selecione a unidade correta nos resultados do Google para continuar.');
  if (job) throw Error('Aguarde a conclusão da pesquisa ou da importação da marca.');
  const photos=photoList(),logo=value('brandLogo'),color=value('brandColorHex');
  if (photos.length>3 || [...photos,...(logo?[logo]:[])].some(url=>!https(url))) throw Error('Use links HTTPS válidos para o logo e até três fotos.');
  if (color&&!/^#[a-f\d]{6}$/i.test(color)) throw Error('Informe a cor no formato #145B52.');
  return {logo:https(logo),photos:photos.map(https),captions:Object.fromEntries(photos.filter(url=>photoCaptions.has(url)).map(url=>[url,photoCaptions.get(url)])),color,sources:[...sources],placeId:selectedPlace||getPlaceId()};
 }};
};
})();
