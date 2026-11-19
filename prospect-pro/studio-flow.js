(function(){
'use strict';
if(!location.pathname.startsWith('/studio'))return;
const $=id=>document.getElementById(id);
const app=window.PortalSiteStudio;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let lead=app.pendingLead;
const leadKey=new URLSearchParams(location.search).get('lead');
document.title='Criar sites premium | Portal Prospect PRO';
document.querySelector('.intro').hidden=true;
document.querySelector('.workspace-nav').hidden=true;
const projectMode=new URLSearchParams(location.search).get('view')==='projects';
$('galleryView').hidden=true;$('projectsView').hidden=!projectMode;$('studioView').hidden=projectMode;
if(projectMode){app.renderProjects();return;}
document.querySelector('.identity small').textContent='PROSPECÇÃO · STUDIO';
const client={name:lead?.name||'',category:lead?.category||lead?.categories?.[0]||localStorage.getItem('prospect_last_segment')||'',city:lead?.address||'Mauá, SP',phone:lead?.phone||''};
$('studioCompany').value=client.name;$('studioSegment').value=client.category;$('studioCity').value=client.city;$('studioPhone').value=client.phone;
const fields={barbearia:['barbearia','barber','corte masculino'],salao:['salao','cabeleireir','hair','beauty','studio beleza'],hamburgueria:['hamburg','burger'],restaurante:['restaurante','churrasc','lanchonete','sushi'],pizzaria:['pizza'],cafeteria:['cafe','cafeteria'],clinica:['clinica','medic','hospital'],odontologia:['odont','dentista'],estetica:['estetica','spa','design sobrancelha'],imobiliaria:['imobiliaria','imoveis','corretor'],advocacia:['advog','advocacia','juridic'],contabilidade:['contabil','contador'],oficina:['oficina','mecanica'],esteticaauto:['lava rapido','detalhamento automotivo'],veterinaria:['veterinaria','veterinario'],petshop:['pet','banho tosa'],academia:['academia','fitness','crossfit'],construcao:['construcao','reforma'],arquitetura:['arquitetura'],moda:['moda','boutique'],hotelaria:['hotel','pousada'],logistica:['logistica','transporte'],farmacia:['farmacia'],educacao:['escola','curso'],fotografia:['fotografia']};
function chooseBase(category,name){
 const q=norm(category+' '+name);
 for(const [id,tests] of Object.entries(fields)){if(tests.some(k=>q.includes(k)))return app.templates.find(t=>t.id===id)}
 return app.templates.find(t=>norm(t.label)===norm(category))||app.templates.find(t=>t.id==='consultoria');
}
function colorScheme(base,index){
 const schemes=[
 {layout:base.layout,bg:base.bg,ink:base.ink,accent:base.accent,title:'Assinatura Original',summary:'O estilo editorial pensado para comunicar a identidade da empresa.'},
 {layout:base.layout==='immersive'?'editorial':base.layout==='editorial'?'immersive':'immersive',bg:'#1b242d',ink:'#ffffff',accent:base.accent,title:'Experiência Imersiva',summary:'Imagens em destaque, tipografia marcante e apresentação cinematográfica.'},
 {layout:['corporate','technical','kinetic'].includes(base.layout)?'serene':'corporate',bg:'#f5f7f8',ink:'#253749',accent:base.accent,title:'Premium Contemporâneo',summary:'Composição elegante, comunicação objetiva e design sofisticado.'}
 ];return schemes[index];
}
// Three licensed-demo style image references per segment; replace with the client's own media before delivery.
const photoBuckets={
 hamburgueria:['photo-1550547660-d9450f859349','photo-1571091718767-18b5b1457add'],
 restaurante:['photo-1517248135467-4c7edcad34c4','photo-1552566626-52f8b828add9'],
 pizzaria:['photo-1513104890138-7c749659a591','photo-1574071318508-1cdbab80d002'],
 cafeteria:['photo-1442512595331-e89e73853f31','photo-1501339847302-ac426a4a7cbb'],
 barbearia:['photo-1599351431202-1e0f0137899a','photo-1621605815971-fbc98d665033'],
 salao:['photo-1522335789203-aabd1fc54bc9','photo-1512290923902-8a9f81dc236c'],
 spa:['photo-1512290923902-8a9f81dc236c','photo-1540555700478-4be289fbecef'],
 estetica:['photo-1512290923902-8a9f81dc236c','photo-1522335789203-aabd1fc54bc9'],
 clinica:['photo-1576091160399-112ba8d25d1d','photo-1551076805-e1869033e561'],
 odontologia:['photo-1606811971618-4486d14f3f99','photo-1551076805-e1869033e561'],
 imobiliaria:['photo-1600566753086-00f18fb6b3ea','photo-1600585154340-be6161a56a0c'],
 arquitetura:['photo-1600607687920-4e2a09cf159d','photo-1600566753086-00f18fb6b3ea'],
 oficina:['photo-1485291571150-772bcfc10da5','photo-1517524206127-48bbd363f3d7'],
 esteticaauto:['photo-1517524206127-48bbd363f3d7','photo-1486496572940-2bb2341fdbdf'],
 advocacia:['photo-1589829545856-d10d557cf95f','photo-1497366811353-6870744d04b2'],
 contabilidade:['photo-1497366754035-f200968a6e72','photo-1497366811353-6870744d04b2'],
 academia:['photo-1517836357463-d25dfeac3438','photo-1571019614242-c5c5dee9f50b'],
 educacao:['photo-1427504494785-3a9ca7044f45','photo-1523240795612-9a054b0db644'],
 veterinaria:['photo-1583337130417-3346a1be7dee','photo-1517849845537-4d257902454b'],
 petshop:['photo-1548199973-03cce0bbc87b','photo-1583337130417-3346a1be7dee'],
 hotelaria:['photo-1566073771259-6a8506099945','photo-1571896349842-33c89424de2d'],
 fotografia:['photo-1542038784456-1ea8e935640e','photo-1497366754035-f200968a6e72'],
 generic:['photo-1497366811353-6870744d04b2','photo-1600585154340-be6161a56a0c']
};
function differentPhoto(base,index){
 if(index===0)return base.photo;
 const bucket=photoBuckets[base.id]||photoBuckets.generic;
 const id=bucket[index-1];
 const url='https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=1600&q=80';
 return url!==base.photo?url:('https://images.unsplash.com/'+photoBuckets.generic[index-1]+'?auto=format&fit=crop&w=1600&q=80');
}
function proposalData(t){
 const name=$('studioCompany').value.trim()||'Empresa demonstrativa';
 const category=$('studioSegment').value.trim()||t.label;
 const city=$('studioCity').value.trim()||'Mauá, SP';
 const phone=$('studioPhone').value.trim();
 return {...app.getDefault(t),leadId:lead?.id||leadKey||null,templateId:t.id,name,industry:category,city,phone,headline:t.headline,summary:t.summary,color:t.accent,photo:t.photo};
}
function previewThree(){
 const name=$('studioCompany').value.trim(),category=$('studioSegment').value.trim();
 if(name.length<2){$('studioCompany').focus();$('studioStep').textContent='Informe o nome da empresa para gerar propostas.';return}
 if(!category){$('studioSegment').focus();$('studioStep').textContent='Informe o segmento da empresa.';return}
 const base=chooseBase(category,name);
 const metas=[0,1,2].map(i=>{
  const style=colorScheme(base,i);
  const t={...base,id:base.id+'-studio-'+i,layout:style.layout,bg:style.bg,ink:style.ink,accent:style.accent,photo:differentPhoto(base,i),label:category,headline:i===0?base.headline:i===1?'Uma experiência que merece ser descoberta.':'Conheça uma nova forma de viver nossos serviços.'};
  return {template:t,info:proposalData(t),style};
 });
 window.__generatedTemplates=metas.map(x=>x.template);
 $('studioStep').classList.add('studio-loading');
 $('studioStep').textContent='Combinando conteúdo e layouts para '+name+'…';
 $('threeProposals').replaceChildren();
 requestAnimationFrame(()=>{
  setTimeout(()=>{
   $('threeProposals').innerHTML=metas.map(({template:t,info,style},i)=>
    '<article class="proposal-card">'+
    '<div class="proposal-preview"><span class="proposal-label">PROPOSTA 0'+(i+1)+'</span><iframe sandbox="" tabindex="-1" title="Prévia da proposta '+(i+1)+'" loading="lazy"></iframe></div>'+
    '<div class="proposal-info"><h3>'+style.title+'</h3><p>'+style.summary+'</p><button type="button" class="button accent" data-choose="'+i+'">Abrir no editor profissional</button></div></article>'
   ).join('');
   document.querySelectorAll('.proposal-card').forEach((card,i)=>{
    card.querySelector('iframe').srcdoc=app.buildSite(metas[i].info,metas[i].template);
   });
   document.querySelectorAll('[data-choose]').forEach(b=>b.onclick=()=>{
    const item=metas[Number(b.dataset.choose)];app.start(item.template.id,{...item.info,templateSnapshot:item.template})
   });
   $('studioStep').classList.remove('studio-loading');
   $('studioStep').textContent='Três propostas geradas. Abra qualquer uma no editor, faça os ajustes e publique uma demonstração.';
  },250)
 });
}
$('generateThree').onclick=previewThree;
if(lead){if(!$('studioSegment').value)$('studioSegment').value='Serviços profissionais';previewThree()}
else if(leadKey){
 $('studioStep').textContent='Recuperando empresa salva no CRM…';
 (async()=>{
  try{
   let session;try{session=JSON.parse(sessionStorage.getItem('prospect_publisher_session_v1')||'null')}catch{}
   if(!session?.access_token)throw Error('Entre no Prospect PRO para recuperar esta empresa da nuvem.');
   const response=await fetch('/api/public-config',{cache:'no-store'}),c=await response.json();
   if(!c.configured)throw Error('Armazenamento não configurado.');
   const r=await fetch(c.supabaseUrl+'/rest/v1/prospect_crm_leads?id=eq.'+encodeURIComponent(leadKey)+'&select=id,business_name,business_category,city,address,phone&limit=1',{headers:{apikey:c.publishableKey,Authorization:'Bearer '+session.access_token}});
   if(!r.ok)throw Error('Não foi possível recuperar o cadastro.');
   const rows=await r.json();if(!rows.length)throw Error('Empresa não encontrada. Abra Oportunidades e confirme seu cadastro.');
   const d=rows[0];lead={id:d.id,name:d.business_name,category:d.business_category,city:d.city,address:d.address,phone:d.phone};
   $('studioCompany').value=lead.name;$('studioSegment').value=lead.category||'Serviços profissionais';$('studioCity').value=lead.city||'Mauá, SP';$('studioPhone').value=lead.phone;
   previewThree();
  }catch(e){$('studioStep').textContent=e.message||'Informe a empresa manualmente para gerar propostas.'}
 })();
}
else $('studioStep').textContent='Informe a empresa acima para gerar automaticamente três propostas de site.';
})();
