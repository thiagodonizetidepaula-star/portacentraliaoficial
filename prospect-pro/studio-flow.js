(function(){
'use strict';
if(!/^\/studio\/?$/.test(location.pathname))return;

const $=id=>document.getElementById(id);
const app=window.PortalSiteStudio;
const composition=window.ProspectComposition;
const {blend}=composition;
const search=new URLSearchParams(location.search);
const projectMode=search.get('view')==='projects';
const leadKey=search.get('lead');
let lead=app.pendingLead;

document.title=(projectMode?'Meus projetos':'Criar sites')+' | Portal Prospect PRO';
document.querySelector('.intro').hidden=true;
document.querySelector('.workspace-nav').hidden=true;
$('galleryView').hidden=true;
$('projectsView').hidden=!projectMode;
$('studioView').hidden=projectMode;
if(projectMode){app.renderProjects();return;}

const form=$('studioClientForm');
const result=$('threeProposals');
const status=$('studioStep');
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const formValue=id=>$(id)?.value.trim()||'';
const tokenKey='prospect_publisher_session_v1';
let formChanged=false;
let generation;
let capability={text:false,images:false};
function matchesLead() {
 return lead && norm(lead.name)===norm(formValue('studioCompany')) &&
  (!lead.city || norm(lead.city)===norm(formValue('studioCity'))) &&
  (!lead.address || norm(lead.address)===norm(formValue('studioAddress')));
}
const brandPanel=window.createProspectBrand({
 sessionToken, getPlaceId:()=>matchesLead() ? lead.googlePlaceId||lead.googleId||'' : '',
 aiAvailable:()=>Boolean(capability.text)
});
const options=fetch('/api/studio/ai/status',{cache:'no-store'})
 .then(response=>response.ok?response.json():capability).catch(()=>capability)
 .then(value=>{capability=value;reflectOptions();return value;});

function sessionToken(){
 try{return JSON.parse(sessionStorage.getItem(tokenKey)||'null')?.access_token||''}
 catch{return ''}
}

function reflectOptions(){
 const connected=Boolean(sessionToken());
 $('studioAiConnect').hidden=!(capability.text||capability.images)||connected;
 $('studioImageOptions').hidden=!capability.images||!connected||!$('studioAllowReferences').checked;
 brandPanel.refresh();
}

function normalizeWebsite(value){
 const candidate=String(value||'').trim();
 if(!candidate)return '';
 try{
  const address=new URL(/^[a-z][a-z0-9+.-]*:/i.test(candidate)?candidate:'https://'+candidate);
  if(['http:','https:'].includes(address.protocol)&&address.hostname.includes('.')&&!address.username&&!address.password)return address.href;
 }catch{}
 return '';
}

function reflectContact(changed){
 const number=window.ProspectLinks.whatsappNumber({phone:formValue('studioPhone')});
 const input=$('studioWhatsApp');
 const check=$('studioWhatsAppConfirmed');
 if(changed==='studioWhatsApp')check.checked=false;
 if(check.checked)input.value=number?formValue('studioPhone'):'';
 else if(changed==='studioWhatsAppConfirmed')input.value='';
 check.disabled=!number;
 $('studioWhatsAppSuggestion').textContent=check.checked&&number?'O site e a proposta usarão este número. Você pode informar outro WhatsApp.'
  :input.value?'O site e a proposta usarão o WhatsApp informado.':'Informe o WhatsApp ou use um telefone com DDD.';
}

function fillClient(company) {
 const values={
  studioCompany:company?.name,
  studioSegment:company?.category||company?.categories?.[0],
  studioCity:company?.city,
  studioAddress:company?.address,
  studioPhone:company?.phone,
  studioWhatsApp:company?.whatsapp||window.ProspectLinks.whatsappLinkNumber(company?.website),
  studioWebsite:window.ProspectLinks.hasWebsite(company||{})?normalizeWebsite(company.website):'',
  studioGoogleMapsUrl:company?.mapsUrl||company?.maps,
  studioHours:company?.hours,
  studioEmail:company?.email,
  studioSocialLinks:company?.socialLinks||((window.ProspectSocial.profile(company?.website)?.network!=='instagram' && window.ProspectSocial.profile(company?.website)?.url)||''),
  studioInstagram:company?.instagram||window.ProspectLinks.instagram(company?.website)
 };
 for(const [id,value] of Object.entries(values))$(id).value=value||'';
 $('studioWhatsAppConfirmed').checked=company?.whatsappUsePhone!==false&&(!values.studioWhatsApp ||
  window.ProspectLinks.whatsappNumber({whatsapp:values.studioWhatsApp})===window.ProspectLinks.whatsappNumber({phone:values.studioPhone}));
 reflectContact();
 brandPanel.refresh();
}

function matchTemplate(value) { return window.ProspectMatchSegment?.(value)||null; }

const visualDirections=[
 {
  id:'assinatura',title:'Identidade',description:'Apresentação da empresa, com espaço para a marca e os serviços.',
  layout:base=>base.layout==='directory'?'editorial':base.layout,colors:base=>({bg:base.bg,ink:base.ink,accent:base.accent})
 },
 {
  id:'experiencia',title:'Experiência',description:'Fotografia em destaque e conteúdo que convida a conhecer o negócio.',
  layout:base=>base.layout==='immersive'?'artisan':'immersive',
  colors:base=>({bg:blend(base.accent,'#141e29',.88),ink:'#ffffff',accent:blend(base.accent,'#fff1d9',.55)})
 },
 {
  id:'pratico',title:'Direto ao ponto',description:'Serviços e contato organizados para quem já sabe o que procura.',
  layout:()=> 'directory',
  colors:base=>({bg:blend(base.accent,'#ffffff',.94),ink:'#172533',accent:blend(base.accent,'#233448',.54)})
 }
];

function makeProposals(client) {
 const match=matchTemplate(client.category)||matchTemplate(client.name);
 const base=match||{id:'generico',category:'Outros',layout:'directory',accent:'#50677d',bg:'#f7f8fa',ink:'#172533',photo:'',photos:[]};
 const category=client.category;
 const sourcesOnly=!client.allowReferences;
 const profile=match?base.profile:{
  experience:'Como funciona o atendimento',practical:'Serviços e atendimento',
  services:'Serviços',action:'Falar com a empresa',contact:'Entre em contato',
  planning:'Prepare seu primeiro contato',ask:'Gostaria de saber como funciona o atendimento.',
  story:'Informe o que você procura para conversar sobre as opções e os próximos passos.'
 };
 const headlines=[match?base.headline:(client.services[0]?.split('|')[0].trim()||category),profile.experience,profile.practical];
 const identity=category+(client.city?' em '+client.city:'');
 const firstServices=client.services.slice(0,3).map(line=>line.split('|')[0].trim()).filter(Boolean);
 const overview=firstServices.length?firstServices.join(' · '):'';
 const next=client.whatsapp||client.phone||client.email?'Consulte os canais de atendimento.':'';
 const summaries=[client.summary||overview||match?.summary||identity,
  client.summary||profile.story||overview||identity,client.summary||overview||next||identity];
 const suggested=!sourcesOnly&&!client.services.length;
 const services=suggested?match?.services||[]:client.services.map(item=>item.split('|')[0].trim()).filter(Boolean);
 const serviceDetails=client.services.filter(item=>item.includes('|')).join('\n');
 const crmPlace=lead?.googlePlaceId||lead?.googleId||'';
 const leadId=matchesLead() && (!client.brand.placeId || !crmPlace || client.brand.placeId===crmPlace) ? lead.id : null;
 const googlePlaceId=client.brand.placeId;
 const brand=client.brand;
 const seed=Array.from(norm(client.name+' '+client.city)).reduce((hash,c)=>(Math.imul(hash,31)+c.charCodeAt(0))>>>0,0);
 const ownPhotos=brand.photos;
 const recent=app.otherCovers(client.name,client.city);
 const groups=sourcesOnly?composition.authorizedGroups(ownPhotos):
  window.ProspectImageLibrary.allocate(base.id,client.name+' '+client.city,ownPhotos,recent);
 const about=client.about||[profile.story!==summaries[0]?profile.story:'',overview].filter(Boolean).join('\n')||identity;
 return visualDirections.map((direction,index)=>{
  const group=groups[index], cover=group.cover;
  const signatureLayout=visualDirections[0].layout(base);
  const defaultLayout=index===1?(signatureLayout==='immersive'?'artisan':'immersive'):direction.layout(base);
  const layout=sourcesOnly?composition.layout(base.id,index,defaultLayout):defaultLayout;
  const colors=sourcesOnly?composition.colors(base,index,brand.color):
   direction.colors(brand.color?{...base,accent:brand.color}:base);
  const template={
   id:base.id+'-studio-'+index,
   label:category,category:base.category,example:client.name,profile,
   direction:direction.id,motionStyle:direction.id==='experiencia'?'strong':'soft',layout,...colors,
   headline:sourcesOnly?client.name:headlines[index],
   summary:(sourcesOnly?client.summary:summaries[index]).slice(0,320),services,
   photo:cover,photos:group.photos,exclusivePhotos:true,stockPhotos:group.stock,
   detailPhoto:group.photos[1]||'',
   photoOrigin:group.real.includes(cover)?'business':'reference',brandColor:brand.color||'',
   logo:brand.logo,brandGallery:group.real.join('\n')
  };
  const data={
   ...app.getDefault(template),
   name:client.name,industry:category,city:client.city,address:client.address,
   phone:client.phone,whatsapp:client.whatsapp,whatsappUsePhone:client.whatsappUsePhone,website:client.website,
   hours:client.hours,email:client.email,instagram:client.instagram,socialLinks:client.socialLinks,mapsUrl:client.mapsUrl,googlePlaceId,
   about:sourcesOnly?client.about:about,serviceDetails,servicesSuggested:suggested,photoOrigin:template.photoOrigin,
   logo:brand.logo,brandGallery:group.real.join('\n'),brandSources:brand.sources,photoCaptions:brand.captions,
   variant:String((seed+index)%3),
   companyFacts:{summary:client.summary,about:client.about,services:client.services},sourcesOnly,
   leadId,templateSnapshot:template
  };
  return {template,data,direction:sourcesOnly?composition.direction(direction,base.id,index):direction};
 });
}

function renderProposals(proposals) {
 const cards=document.createDocumentFragment();
 proposals.forEach(({template,data,direction},index)=>{
  const card=document.createElement('article');
  card.className='proposal-card';
  card.innerHTML=
   '<div class="proposal-preview"><iframe sandbox="allow-popups allow-popups-to-escape-sandbox" loading="lazy" referrerpolicy="no-referrer"></iframe></div>'+
   '<div class="proposal-info"><h3></h3><p></p><div class="proposal-actions"><button type="button" class="button secondary" data-full>Ver site completo</button><button type="button" class="button accent">Personalizar</button></div></div>';
  const preview=card.querySelector('iframe');
  preview.title='Prévia do site '+direction.title;
  app.showInFrame(preview,app.buildSite(data,template));
  card.querySelector('h3').textContent=direction.title;
  card.dataset.proposal=String(index);
  card.querySelector('p').textContent=direction.description;
  card.querySelector('[data-full]').onclick=()=>app.fullPreview(app.buildSite(data,template),data.name+' · '+direction.title);
  const button=card.querySelector('.accent');
  button.dataset.choose=String(index);
  button.setAttribute('aria-label','Personalizar proposta '+direction.title);
  button.addEventListener('click',()=>app.start(template.id,data));
  cards.append(card);
 });
 result.replaceChildren(cards);
 window.ProspectPrivateStudio?.setProposals(proposals);
}

function refreshCard(proposal,index){
 const preview=result.querySelector('[data-proposal="'+index+'"] iframe');
 if(preview)app.showInFrame(preview,app.buildSite(proposal.data,proposal.template));
}

function showProposalsStatus(client,proposals){
 if(!client.allowReferences){
  status.textContent='Três propostas para '+client.name+'. Cada uma usa os dados informados, com composições gráficas próprias quando faltam fotos autorizadas.';
  return;
 }
 const suggestion=proposals[0].data.servicesSuggested&&proposals[0].template.services.length
  ?' Confira as opções sugeridas antes de publicar.':'';
 const limited=proposals.some(p=>p.template.photos.length<3)?' Acervo limitado: algumas propostas terão menos fotos, sem repetir imagens entre modelos.':'';
 status.textContent='Três identidades visuais para '+client.name+', com conjuntos de fotos independentes. Escolha uma para personalizar.'+limited+suggestion;
}

function readClient(brand){
 const phone=formValue('studioPhone');
 const explicit=formValue('studioWhatsApp');
 const website=normalizeWebsite(formValue('studioWebsite'));
 const account=window.ProspectSocial.profile(website);
 const profile=account?.network==='instagram'?account.url:'';
 const networks=window.ProspectSocial.profiles([...formValue('studioSocialLinks').split(/\s+/),account?.url]).filter(v=>v.network!=='instagram');
 return {
  name:formValue('studioCompany'),category:formValue('studioSegment'),city:formValue('studioCity'),
  phone,whatsapp:explicit,whatsappUsePhone:$('studioWhatsAppConfirmed').checked,
  address:formValue('studioAddress'),website:account||window.ProspectLinks.whatsappLinkNumber(website)?'':website,
  mapsUrl:formValue('studioGoogleMapsUrl'),hours:formValue('studioHours'),
  email:formValue('studioEmail'),instagram:window.ProspectLinks.instagram(formValue('studioInstagram'))||profile,socialLinks:networks.map(v=>v.url).join('\n'),
  summary:formValue('studioSummary'),about:formValue('studioAbout'),brand,allowReferences:$('studioAllowReferences').checked,
  services:formValue('studioServices').split(/\r?\n/).map(service=>service.trim()).filter(Boolean).slice(0,8)
 };
}

async function aiRequest(type,body,token,signal){
 const response=await fetch('/api/studio/ai/'+type,{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify(body),signal
 });
 const payload=await response.json().catch(()=>null);
 if(!response.ok)throw Error(payload?.error||'A IA não respondeu. Tente novamente.');
 return payload;
}

function refineCopy(proposal,copy,client){
 const data=proposal.data;
 if(copy.headline)data.headline=copy.headline.slice(0,120);
 if(copy.summary&&!client.summary)data.summary=copy.summary.slice(0,320);
 if(copy.about&&!client.about)data.about=copy.about;
 if(copy.cta)data.cta=copy.cta;
 if(Array.isArray(copy.faq))data.faq=copy.faq.filter(item=>item?.question&&item?.answer)
  .map(item=>item.question+' | '+item.answer).join('\n');
 const names=new Set(client.services.map(item=>norm(item.split('|')[0])));
 const detailed=new Set(client.services.filter(item=>item.includes('|')).map(item=>norm(item.split('|')[0])));
 const suggested=Array.isArray(copy.services)?copy.services.filter(item=>
  typeof item==='string'&&item.includes('|')&&names.has(norm(item.split('|')[0]))&&!detailed.has(norm(item.split('|')[0]))):[];
 data.serviceDetails=[data.serviceDetails,...suggested].filter(Boolean).join('\n');
}

async function enhanceProposals(client,proposals,controller){
 const {signal}=controller;
 const available=await options;
 const token=sessionToken();
 if(signal.aborted||!token||(!available.text&&!available.images))return;
 const tasks=[];
 const company={name:client.name,industry:client.category,city:client.city,address:client.address,
  summary:[client.summary,client.about].filter(Boolean).join('\n'),services:client.services,
  brand:{hasLogo:Boolean(client.brand.logo),color:client.brand.color,photos:client.brand.photos.length}};
 if(available.text){
  tasks.push(aiRequest('text',{mode:'generate',company},token,signal).then(({proposals:copies})=>{
   if(signal.aborted||!Array.isArray(copies)||copies.length!==3)return;
   copies.forEach((copy,index)=>{refineCopy(proposals[index],copy,client);refreshCard(proposals[index],index)});
  }));
 }
 if(available.images&&!client.brand.photos.length&&$('studioGenerateImages').checked){
  const imageBriefs=[
   'Imagem principal de apresentação da atividade, com composição clara e espaço negativo.',
   'Cena próxima de uma experiência típica do segmento, com luz e textura em destaque.',
   'Elementos concretos de trabalho ou produtos que ajudem a entender o serviço oferecido.'
  ];
  proposals.forEach((proposal,index)=>{
   const request=imageBriefs[index]+(client.services.length
    ?' Use como referência os seguintes serviços: '+client.services.map(item=>item.split('|')[0].trim()).join(', ')+'.':'');
   tasks.push(aiRequest('image',{request,company:{name:client.name,industry:client.category,city:client.city},
    direction:proposal.direction.id},token,signal).then(({url,imageSource})=>{
     if(signal.aborted||!url||imageSource!=='ai')return;
     proposal.data.photo=url;
     proposal.data.photoOrigin='generated';
     refreshCard(proposal,index);
   }));
  });
 }
 if(!tasks.length)return;
 status.textContent='As propostas já estão disponíveis. A IA está preparando os ajustes solicitados.';
 const responses=await Promise.allSettled(tasks);
 if(signal.aborted)return;
 showProposalsStatus(client,proposals);
 const failure=responses.find(item=>item.status==='rejected');
 if(failure)status.textContent+=' '+failure.reason.message;
}

function previewThree(enhance=false) {
 let brand;
 try { brand=brandPanel.read(); }
 catch(error) { status.textContent=error.message; return; }
 const client=readClient(brand);
 if(client.name.length<2){
  $('studioCompany').focus();
  status.textContent='Informe o nome da empresa.';
  return;
 }
 if(!client.category){
  $('studioSegment').focus();
  status.textContent='Informe o segmento da empresa.';
  return;
 }
 if(client.whatsapp&&!window.ProspectLinks.whatsappNumber(client)){
  $(formValue('studioWhatsApp')?'studioWhatsApp':'studioPhone').focus();
  status.textContent='Confira o número de WhatsApp com DDD para gerar o botão de contato.';
  return;
 }
 generation?.abort();
 generation=new AbortController();
 const proposals=makeProposals(client);
 renderProposals(proposals);
 showProposalsStatus(client,proposals);
 const active=generation;
 if(enhance&&client.allowReferences)enhanceProposals(client,proposals,active).catch(()=>{
  if(!active.signal.aborted)status.textContent='As propostas estão disponíveis. A IA não pôde concluir os ajustes.';
 });
}

form.addEventListener('submit',async event=>{
 event.preventDefault();
 formChanged=true;
 try {
  if (!await brandPanel.prepare()) { status.textContent='Confira a identidade da empresa antes de gerar as propostas.'; return; }
 } catch (error) { status.textContent=error.message; return; }
 previewThree(true);
});
form.addEventListener('input',event=>{
 if(event.target.id==='studioAllowReferences')reflectOptions();
 if(event.target.id==='studioWebsite'){
  const number=window.ProspectLinks.whatsappLinkNumber(formValue('studioWebsite'));
  if(number){
   if(!formValue('studioWhatsApp')||$('studioWhatsAppConfirmed').checked){
    $('studioWhatsAppConfirmed').checked=false;
    $('studioWhatsApp').value=number;
   }
   $('studioWebsite').value='';
  }
 }
 reflectContact(event.target.id);
 if(event.target.id==='studioGenerateImages')return;
 formChanged=true;
 generation?.abort();
 if(!result.childElementCount)return;
 result.replaceChildren();
 window.ProspectPrivateStudio?.setProposals([]);
 status.textContent='Dados alterados. Gere as propostas para atualizar as prévias.';
});
$('publishOverlay').addEventListener('close',reflectOptions);

function openLeadProposals(){
 previewThree();
 if(!sessionToken()||!$('brandSocialAtGenerate').checked)return;
 brandPanel.prepare().then(ready=>{if(!ready)status.textContent='Confira os dados encontrados em Identidade da empresa. A seleção será aplicada às propostas.';}).catch(error=>{status.textContent=error.message;});
}
fillClient(lead);
if(lead){
 if(!$('studioSegment').value)$('studioSegment').value='Serviços profissionais';
 openLeadProposals();
}else if(leadKey){
 status.textContent='Recuperando empresa salva no CRM…';
 (async()=>{
  try{
   let session;
   try{session=JSON.parse(sessionStorage.getItem('prospect_publisher_session_v1')||'null')}catch{}
   if(!session?.access_token)throw Error('Entre no Prospect PRO para recuperar esta empresa da nuvem.');
   const response=await fetch('/api/public-config',{cache:'no-store'});
   const config=await response.json();
   if(!response.ok||!config.configured)throw Error('Armazenamento não configurado.');
   const url=new URL('/rest/v1/prospect_crm_leads',config.supabaseUrl);
   url.search=new URLSearchParams({
    id:'eq.'+leadKey,
    select:'id,business_name,business_category,city,address,phone,whatsapp,whatsapp_use_phone,website,google_place_id',
    limit:'1'
   });
   const lookup=await fetch(url,{headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.access_token}});
   if(!lookup.ok)throw Error('Não foi possível recuperar o cadastro.');
   const [row]=await lookup.json();
   if(!row)throw Error('Empresa não encontrada. Confira o cadastro em Oportunidades.');
   lead={id:row.id,name:row.business_name,category:row.business_category,city:row.city,address:row.address,
    phone:row.phone,whatsapp:row.whatsapp,whatsappUsePhone:row.whatsapp_use_phone,website:row.website,googleId:row.google_place_id};
   if(formChanged)return;
   fillClient(lead);
   if(!$('studioSegment').value)$('studioSegment').value='Serviços profissionais';
   openLeadProposals();
  }catch(error){
   if(!formChanged)status.textContent=error.message||'Informe a empresa manualmente para gerar propostas.';
  }
 })();
}
})();
