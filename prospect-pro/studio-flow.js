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
let formChanged=false;

function fillClient(company) {
 $('studioCompany').value=company?.name||'';
 $('studioSegment').value=company?.category||company?.categories?.[0]||'';
 $('studioCity').value=company?.city||company?.address||'';
 $('studioPhone').value=company?.phone||'';
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
 const profile=match?base.profile:{
  experience:'Conheça '+client.name+'.',practical:'Informações para seu próximo contato.',
  services:'Serviços',action:'Solicitar informações',
  story:'Entre em contato para saber mais sobre as opções de atendimento.'
 };
 const headlines=[match?base.headline:client.name,profile.experience,profile.practical];
 const summaries=[
  client.summary||[client.name+'.',match?.summary].filter(Boolean).join(' '),
  client.summary||profile.story,
  [client.name+' · '+client.category+'.',client.summary].filter(Boolean).join(' ')
 ];
 const services=client.services.length?client.services:match?.services||[];
 return visualDirections.map((direction,index)=>{
  const template={
   id:base.id+'-studio-'+index,
   label:client.category,category:base.category,example:client.name,profile,
   direction:direction.id,layout:direction.layout(base),...direction.colors(base),
   headline:headlines[index],summary:summaries[index].slice(0,320),services,
   photo:base.photos[index],detailPhoto:base.photos[(index+1)%base.photos.length]
  };
  const data={
   ...app.getDefault(template),name:client.name,industry:client.category,city:client.city,phone:client.phone,
   leadId:lead&&norm(lead.name)===norm(client.name)?lead.id:null,
   templateSnapshot:template
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
   '<div class="proposal-preview"><iframe sandbox="" tabindex="-1" loading="lazy" referrerpolicy="no-referrer"></iframe></div>'+
   '<div class="proposal-info"><h3></h3><p></p><button type="button" class="button accent">Personalizar</button></div>';
  const preview=card.querySelector('iframe');
  preview.title='Prévia do site '+direction.title;
  preview.srcdoc=app.buildSite(data,template);
  card.querySelector('h3').textContent=direction.title;
  card.querySelector('p').textContent=direction.description;
  const button=card.querySelector('button');
  button.dataset.choose=String(index);
  button.setAttribute('aria-label','Personalizar proposta '+direction.title);
  button.addEventListener('click',()=>app.start(template.id,data));
  cards.append(card);
 });
 result.replaceChildren(cards);
}

function previewThree() {
 const client={
  name:formValue('studioCompany'),category:formValue('studioSegment'),city:formValue('studioCity'),
  phone:formValue('studioPhone'),summary:formValue('studioSummary'),
  services:formValue('studioServices').split(/\r?\n/).map(service=>service.trim()).filter(Boolean).slice(0,8)
 };
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
 const proposals=makeProposals(client);
 renderProposals(proposals);
 status.textContent=client.services.length||!proposals[0].template.services.length
  ?'Três propostas para '+client.name+'. Escolha uma para personalizar.'
  :'Três propostas para '+client.name+'. Revise os serviços sugeridos antes de publicar.';
}

form.addEventListener('submit',event=>{
 event.preventDefault();
 formChanged=true;
 previewThree();
});
form.addEventListener('input',()=>{
 formChanged=true;
 if(!result.childElementCount)return;
 result.replaceChildren();
 status.textContent='Dados alterados. Gere as propostas para atualizar as prévias.';
});

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
    select:'id,business_name,business_category,city,address,phone',
    limit:'1'
   });
   const lookup=await fetch(url,{headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.access_token}});
   if(!lookup.ok)throw Error('Não foi possível recuperar o cadastro.');
   const [row]=await lookup.json();
   if(!row)throw Error('Empresa não encontrada. Confira o cadastro em Oportunidades.');
   lead={id:row.id,name:row.business_name,category:row.business_category,city:row.city,address:row.address,phone:row.phone};
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
