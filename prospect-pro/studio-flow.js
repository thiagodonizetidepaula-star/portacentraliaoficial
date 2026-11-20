(function(){
'use strict';
if(!/^\/studio\/?$/.test(location.pathname))return;

const $=id=>document.getElementById(id);
const app=window.PortalSiteStudio;
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
 $('studioImageOptions').hidden=!capability.images||!connected;
}

function brazilNumber(value){
 const digits=String(value||'').replace(/\D/g,'');
 return /^(?:55)?[1-9]\d{9,10}$/.test(digits)?digits:'';
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

function reflectContact(){
 const phoneAvailable=Boolean(brazilNumber(formValue('studioPhone')));
 const confirmed=Boolean(formValue('studioWhatsApp'));
 const check=$('studioWhatsAppConfirmed');
 check.disabled=!phoneAvailable||confirmed;
 $('studioWhatsAppSuggestion').textContent=confirmed?'O botão do site usará o WhatsApp acima.'
  :phoneAvailable?'O telefone pode ser usado para ligações. Marque a opção acima se ele também recebe WhatsApp.'
  :'Informe o WhatsApp da empresa para colocar um botão de conversa no site.';
}

function fillClient(company) {
 const values={
  studioCompany:company?.name,
  studioSegment:company?.category||company?.categories?.[0],
  studioCity:company?.city,
  studioAddress:company?.address,
  studioPhone:company?.phone,
  studioWhatsApp:company?.whatsapp,
  studioWebsite:normalizeWebsite(company?.website),
  studioGoogleMapsUrl:company?.mapsUrl||company?.maps,
  studioHours:company?.hours,
  studioEmail:company?.email,
  studioInstagram:company?.instagram
 };
 for(const [id,value] of Object.entries(values))$(id).value=value||'';
 $('studioWhatsAppConfirmed').checked=Boolean(company?.whatsappConfirmed===true&&!company?.whatsapp);
 reflectContact();
}

function matchTemplate(value) {
 const query=norm(value);
 if(!query)return null;
 let best=null,bestScore=0;
 for(const template of app.templates){
  const label=norm(template.label);
  if(query===label)return template;
  for(const alias of [label,...template.aliases.map(norm)]){
   if(!(' '+query).includes(' '+alias))continue;
   const score=query===alias?100+alias.length:alias.length;
   if(score>bestScore){best=template;bestScore=score;}
  }
 }
 return best;
}

function blend(color, other, weight) {
 const parts=[1,3,5].map(index=>{
  const first=parseInt(color.slice(index,index+2),16),second=parseInt(other.slice(index,index+2),16);
  return Math.round(first*(1-weight)+second*weight).toString(16).padStart(2,'0');
 });
 return '#'+parts.join('');
}

const visualDirections=[
 {
  id:'assinatura',title:'Identidade',description:'Apresentação da empresa, com espaço para a marca e os serviços.',
  layout:base=>base.layout,colors:base=>({bg:base.bg,ink:base.ink,accent:base.accent})
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
 const base=match||app.templates.find(template=>template.id==='consultoria');
 const category=client.category;
 const location=client.city?' em '+client.city:'';
 const profile=match?base.profile:{
  experience:'Conheça '+client.name+'.',practical:category+' com '+client.name,
  services:'Serviços',action:'Falar com a empresa',contact:'Entre em contato',
  planning:'Prepare seu primeiro contato',ask:'Gostaria de saber como funciona o atendimento.',
  story:'Informe o que você procura para conversar sobre as opções e os próximos passos.'
 };
 const headlines=[match?base.headline:client.name,profile.experience,profile.practical];
 const identity=client.name+' atua no segmento de '+category.toLowerCase()+location+'.';
 const next=client.whatsapp||client.phone||client.email?' Use os canais de contato desta página para consultar o atendimento.':'';
 const summaries=[
  client.summary||[identity,match?.summary||next.trim()].filter(Boolean).join(' '),
  client.summary||[identity,profile.story].filter(Boolean).join(' '),
  [identity,client.summary||next.trim()].filter(Boolean).join(' ')
 ];
 const suggested=!client.services.length;
 const services=suggested?match?.services||[]:client.services.map(item=>item.split('|')[0].trim()).filter(Boolean);
 const serviceDetails=client.services.filter(item=>item.includes('|')).join('\n');
 const leadId=lead&&norm(lead.name)===norm(client.name)?lead.id:null;
 const googlePlaceId=leadId ? lead.googlePlaceId||lead.googleId||'' : '';
 const about=client.about||[identity,profile.story||next.trim()].filter(Boolean).join(' ');
 return visualDirections.map((direction,index)=>{
  const template={
   id:base.id+'-studio-'+index,
   label:category,category:base.category,example:client.name,profile,
   direction:direction.id,layout:direction.layout(base),...direction.colors(base),
   headline:headlines[index],summary:summaries[index].slice(0,320),services,
   photo:base.photos[index],detailPhoto:base.photos[(index+1)%base.photos.length]
  };
  const data={
   ...app.getDefault(template),
   name:client.name,industry:category,city:client.city,address:client.address,
   phone:client.phone,whatsapp:client.whatsapp,whatsappConfirmed:Boolean(client.whatsapp),website:client.website,
   hours:client.hours,email:client.email,instagram:client.instagram,mapsUrl:client.mapsUrl,googlePlaceId,
   about,serviceDetails,servicesSuggested:suggested,photoOrigin:'reference',
   companyFacts:{summary:client.summary,about:client.about,services:client.services},
   leadId,templateSnapshot:template
  };
  return {template,data,direction};
 });
}

function renderProposals(proposals) {
 const cards=document.createDocumentFragment();
 proposals.forEach(({template,data,direction},index)=>{
  const card=document.createElement('article');
  card.className='proposal-card';
  card.innerHTML=
   '<div class="proposal-preview"><iframe sandbox="allow-popups allow-popups-to-escape-sandbox" tabindex="-1" loading="lazy" referrerpolicy="no-referrer"></iframe></div>'+
   '<div class="proposal-info"><h3></h3><p></p><button type="button" class="button accent">Personalizar</button></div>';
  const preview=card.querySelector('iframe');
  preview.title='Prévia do site '+direction.title;
  preview.srcdoc=app.buildSite(data,template);
  card.querySelector('h3').textContent=direction.title;
  card.dataset.proposal=String(index);
  card.querySelector('p').textContent=direction.description;
  const button=card.querySelector('button');
  button.dataset.choose=String(index);
  button.setAttribute('aria-label','Personalizar proposta '+direction.title);
  button.addEventListener('click',()=>app.start(template.id,data));
  cards.append(card);
 });
 result.replaceChildren(cards);
}

function refreshCard(proposal,index){
 const preview=result.querySelector('[data-proposal="'+index+'"] iframe');
 if(preview)preview.srcdoc=app.buildSite(proposal.data,proposal.template);
}

function showProposalsStatus(client,proposals){
 const suggestion=proposals[0].data.servicesSuggested&&proposals[0].template.services.length
  ?' Confira as opções sugeridas antes de publicar.':'';
 status.textContent='Três propostas para '+client.name+'. Escolha uma para personalizar.'+suggestion;
}

function readClient(){
 const phone=formValue('studioPhone');
 const explicit=formValue('studioWhatsApp');
 return {
  name:formValue('studioCompany'),category:formValue('studioSegment'),city:formValue('studioCity'),
  phone,whatsapp:explicit||($('studioWhatsAppConfirmed').checked?phone:''),
  address:formValue('studioAddress'),website:normalizeWebsite(formValue('studioWebsite')),
  mapsUrl:formValue('studioGoogleMapsUrl'),hours:formValue('studioHours'),
  email:formValue('studioEmail'),instagram:formValue('studioInstagram'),
  summary:formValue('studioSummary'),about:formValue('studioAbout'),
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
  summary:[client.summary,client.about].filter(Boolean).join('\n'),services:client.services};
 if(available.text){
  tasks.push(aiRequest('text',{mode:'generate',company},token,signal).then(({proposals:copies})=>{
   if(signal.aborted||!Array.isArray(copies)||copies.length!==3)return;
   copies.forEach((copy,index)=>{refineCopy(proposals[index],copy,client);refreshCard(proposals[index],index)});
  }));
 }
 if(available.images&&$('studioGenerateImages').checked){
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
 const client=readClient();
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
 if(client.whatsapp&&!brazilNumber(client.whatsapp)){
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
 if(enhance)enhanceProposals(client,proposals,active).catch(()=>{
  if(!active.signal.aborted)status.textContent='As propostas estão disponíveis. A IA não pôde concluir os ajustes.';
 });
}

form.addEventListener('submit',event=>{
 event.preventDefault();
 formChanged=true;
 previewThree(true);
});
form.addEventListener('input',event=>{
 reflectContact();
 if(event.target.id==='studioGenerateImages')return;
 formChanged=true;
 generation?.abort();
 if(!result.childElementCount)return;
 result.replaceChildren();
 status.textContent='Dados alterados. Gere as propostas para atualizar as prévias.';
});
$('publishOverlay').addEventListener('close',reflectOptions);

fillClient(lead);
if(lead){
 if(!$('studioSegment').value)$('studioSegment').value='Serviços profissionais';
 previewThree();
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
    select:'id,business_name,business_category,city,address,phone,website,google_place_id',
    limit:'1'
   });
   const lookup=await fetch(url,{headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.access_token}});
   if(!lookup.ok)throw Error('Não foi possível recuperar o cadastro.');
   const [row]=await lookup.json();
   if(!row)throw Error('Empresa não encontrada. Confira o cadastro em Oportunidades.');
   lead={id:row.id,name:row.business_name,category:row.business_category,city:row.city,address:row.address,
    phone:row.phone,website:row.website,googleId:row.google_place_id};
   if(formChanged)return;
   fillClient(lead);
   if(!$('studioSegment').value)$('studioSegment').value='Serviços profissionais';
   previewThree();
  }catch(error){
   if(!formChanged)status.textContent=error.message||'Informe a empresa manualmente para gerar propostas.';
  }
 })();
}
})();
