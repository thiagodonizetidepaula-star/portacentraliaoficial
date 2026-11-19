(function(){
'use strict';
if(!location.pathname.startsWith('/studio'))return;
const $=id=>document.getElementById(id);
const app=window.PortalSiteStudio;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const lead=app.pendingLead;
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
function proposalData(t){
 const name=$('studioCompany').value.trim()||'Empresa demonstrativa';
 const category=$('studioSegment').value.trim()||t.label;
 const city=$('studioCity').value.trim()||'Mauá, SP';
 const phone=$('studioPhone').value.trim();
 return {...app.getDefault(t),templateId:t.id,name,industry:category,city,phone,headline:t.headline,summary:t.summary,color:t.accent,photo:t.photo};
}
function previewThree(){
 const name=$('studioCompany').value.trim(),category=$('studioSegment').value.trim();
 if(name.length<2){$('studioCompany').focus();$('studioStep').textContent='Informe o nome da empresa para gerar propostas.';return}
 if(!category){$('studioSegment').focus();$('studioStep').textContent='Informe o segmento da empresa.';return}
 const base=chooseBase(category,name);
 const metas=[0,1,2].map(i=>{
  const style=colorScheme(base,i);
  const t={...base,id:base.id+'-studio-'+i,layout:style.layout,bg:style.bg,ink:style.ink,accent:style.accent,photo:base.photo,label:category};
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
else $('studioStep').textContent='Informe a empresa acima para gerar automaticamente três propostas de site.';
})();
