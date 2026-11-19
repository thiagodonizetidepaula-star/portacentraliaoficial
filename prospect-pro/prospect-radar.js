(()=>{
'use strict';
// Radar de busca: as marcações do SVG são animação ilustrativa, não pins de empresas.
const root=document;
const $$r=sel=>[...root.querySelectorAll(sel)];
const escR=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'" :'&#39;'}[c]));
let currentResults=[],lastTerm='',filterMode='no',loading=false,config=null;
const labels=['Preparando a região','Consultando Google Places','Verificando presença digital','Organizando oportunidades'];
const stage=root.getElementById('radarStage');
const byId=id=>root.getElementById(id);
function initRadar(){
 stage.innerHTML='<div class="radar-hero-bg" aria-hidden="true"><div class="radar-orbit"></div>'+
 '<svg class="radar-map-svg" viewBox="0 0 900 430" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'+
 '<path class="district" d="M0 60L130 20 225 83 340 4 471 104 605 35 900 85 900 390 710 420 600 317 480 398 340 278 170 387 0 346Z"/>'+
 '<path d="M0 170L225 90 450 230 650 95 900 176M0 240L180 218 400 112 620 300 900 240M82 0L200 140 150 360 360 430M304 0L390 95 355 260 505 430M530 0L550 152 485 250 670 430M730 0L720 160 850 310M0 380L180 300 370 340 540 240 900 400"/>'+
 '<path class="minor" d="M20 0L125 105 290 205 388 430M0 86L300 310 590 120 900 60M400 0L305 110 585 397M680 0L650 160 805 430M0 285L240 420 520 312 900 330M0 110L220 260 490 30 840 425M160 0L260 150 190 430"/>'+
 '</svg><div class="radar-sweep"></div><div class="radar-pins">'+
 [[31,26],[42,41],[58,32],[65,56],[52,73],[35,67],[73,37],[23,47],[61,18],[78,67],[15,69],[84,19]].map((p,i)=>'<i class="radar-pin" style="left:'+p[0]+'%;top:'+p[1]+'%;animation-delay:-'+(i*.18)+'s"></i>').join('')+
 '</div></div>'+
 '<div class="radar-topline"><span>PORTAL INTELLIGENCE / RADAR</span><small id="radarMode">Aguardando busca</small></div>'+
 '<div class="radar-center-label"><strong id="radarCity">Mauá, São Paulo</strong><span id="radarMessage">Digite o segmento e a cidade para iniciar uma busca de empresas reais.</span></div>'+
 '<div class="radar-steps"><div class="head">ETAPAS DA PROSPECÇÃO</div><div id="radarStepRows"></div></div>';
 setStage('idle',-1,'Visualização ilustrativa do radar · não é um mapa geográfico.');
}
function setStage(state,active,msg){
 stage.dataset.state=state;
 const status=byId('radarStepRows');
 if(status)status.innerHTML=labels.map((t,i)=>{
  const cls=state==='error'&&i===active?'failed':state==='done'||i<active?'done':i===active?'active':'';
  return '<div class="radar-step '+cls+'"><span class="stepdot">'+(cls==='done'?'✓':cls==='failed'?'!':i+1)+'</span><span>'+t+'</span></div>';
 }).join('');
 if(msg)byId('radarMessage').textContent=msg;
 byId('radarMode').textContent=state==='working'?'Pesquisa em andamento':state==='done'?'Busca concluída':state==='error'?'Integração necessária':'Aguardando busca';
}
function renderOpportunityCard(x,i,context){
 const saved=leads.some(l=>(l.googleId&&x.googleId&&l.googleId===x.googleId)||(l.name===x.name&&l.address===x.address));
 const hasSite=!!x.website,loc=x.address||'Endereço não informado',phone=x.phone||'Telefone não informado';
 const map=x.maps||'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(x.name+' '+loc);
 return '<article class="opportunity-card"><div class="opp-head"><h4>'+escR(x.name)+'</h4><span class="opp-tag '+(hasSite?'site':'')+'">'+(hasSite?'Site informado':'Sem site informado')+'</span></div>'+
 '<div class="opp-meta"><div>📍 '+escR(loc)+'</div><div>☎ '+escR(phone)+'</div><div><strong>'+escR(lastTerm||'Negócio local')+'</strong> · <a target="_blank" rel="noopener noreferrer" style="color:#bda8ff;text-decoration:underline" href="'+escR(map)+'">Ver no Google Maps</a></div></div>'+
 '<p class="opp-note">'+(hasSite?'O Google informa um site para este estabelecimento.':'O perfil consultado não apresentou um website. Isso não comprova que a empresa não tenha site próprio.')+'</p>'+
 '<div class="opp-buttons"><button class="primary" data-radar-create="'+i+'">✦ Criar 3 sites para esta empresa</button>'+
 '<button data-radar-save="'+i+'">'+(saved?'✓ Salva no CRM':'+ Salvar no CRM')+'</button><button data-radar-message="'+i+'">Mensagem / proposta</button></div></article>';
}
function renderLive(){
 const searchCards=currentResults.filter(x=>filterMode==='all'||(filterMode==='no'?!x.website:!!x.website));
 const section=byId('autoOpportunitySection');
 const count=currentResults.filter(x=>!x.website).length;
 const all=currentResults.length;
 byId('radarFoundCount').textContent=all?'Pesquisa atual · '+count+' sem site informado':'Nenhuma busca realizada';
 byId('radarFoundCaption').textContent=all?all+' empresas retornadas pelo Google Places; '+count+' perfis sem website informado.':'As oportunidades encontradas aparecerão aqui assim que a busca automática estiver configurada.';
 byId('autoOppCards').innerHTML=searchCards.length?'<div class="opportunity-grid">'+searchCards.map((x)=>renderOpportunityCard(x,currentResults.indexOf(x),'leads')).join('')+'</div>':'<div class="radar-empty">'+(currentResults.length?'Nenhuma empresa corresponde ao filtro escolhido.':'Pesquise empresas na aba Prospecção. Os resultados serão listados automaticamente aqui durante esta sessão.')+'</div>';
 const visible=byId('searchResults');
 if(!currentResults.length){return}
 byId('radarCardsCount').textContent=count+' oportunidades sem site informado · '+all+' empresas consultadas';
 visible.innerHTML='<div class="radar-controls"><button class="radar-filter '+(filterMode==='no'?'active':'')+'" data-radar-filter="no">Sem site informado ('+count+')</button><button class="radar-filter '+(filterMode==='all'?'active':'')+'" data-radar-filter="all">Todas ('+all+')</button><button class="radar-filter '+(filterMode==='yes'?'active':'')+'" data-radar-filter="yes">Com site ('+(all-count)+')</button></div>'+
 (searchCards.length?'<div class="opportunity-grid">'+searchCards.map((x)=>renderOpportunityCard(x,currentResults.indexOf(x),'search')).join('')+'</div>':'<div class="radar-empty">Nenhum estabelecimento nesta categoria.</div>')+
 '<p class="muted" style="font-size:11px;margin:12px 0">Fonte: Google Maps Platform · Dados exibidos durante a pesquisa. Confirme site, contato e identidade antes de enviar uma proposta.</p>';
 $$r('[data-radar-filter]').forEach(b=>b.onclick=()=>{filterMode=b.dataset.radarFilter;renderLive()});
 $$r('[data-radar-create], [data-radar-save], [data-radar-message]').forEach(b=>{
  b.onclick=()=>{
   const idx=Number(b.dataset.radarCreate??b.dataset.radarSave??b.dataset.radarMessage);
   if(b.hasAttribute('data-radar-create'))createFromResult(idx);
   else if(b.hasAttribute('data-radar-save'))saveFromResult(idx);
   else messageFromResult(idx);
  };
 });
}
function saveFromResult(i){
 const x=currentResults[i];
 if(!x)return null;
 let lead=leads.find(l=>(x.googleId&&l.googleId===x.googleId)||(l.name===x.name&&l.address===x.address));
 if(lead)return lead;
 // Salvamento solicitado pelo operador: dados precisam ser confirmados antes de uso comercial.
 lead={id:uid(),googleId:x.googleId||'',name:x.name,address:x.address||'',phone:x.phone||'',website:x.website||'',maps:x.maps||'',category:lastTerm,stage:'Novo',origin:'google-places',reviewedAt:null};
 leads.unshift(lead);
 try{save()}catch(e){alert('Não foi possível salvar esta oportunidade no navegador. Libere espaço ou tente novamente.');return null}
 renderLive();
 return lead;
}
function createFromResult(i){const x=saveFromResult(i);if(x)location.href='/studio?lead='+encodeURIComponent(x.id)}
function publishedForLead(id){
 let ps=[];try{ps=JSON.parse(localStorage.getItem('prospect_library_projects')||'[]')}catch{}
 if(!Array.isArray(ps))return null;
 return ps.find(p=>p&&p.leadId===id&&p.publicSlug)||null;
}
function proposalLink(id){const p=publishedForLead(id);return p?location.origin+'/mvp/'+encodeURIComponent(p.publicSlug):''}
function messageFromResult(i){
 const l=saveFromResult(i);if(!l)return;
 offerWithPublishedLink(l.id);
}
const previousContact=contact;
function offerWithPublishedLink(id){
 const l=leads.find(x=>x.id===id);if(!l)return;
 const link=proposalLink(id);
 if(!link){
  modal('Proposta para '+l.name,'<p>Para enviar uma mensagem com o site, primeiro crie uma proposta e use <strong>Publicar prévia</strong>. O link será adicionado automaticamente depois da publicação.</p><p>Você pode criar o site agora, sem enviar nenhuma mensagem.</p>',()=>{location.href='/studio?lead='+encodeURIComponent(l.id)});
  return;
 }
 let p=(l.phone||'').replace(/\D/g,'');if(p.length===10||p.length===11)p='55'+p;
 if(!/^55\d{10,11}$/.test(p)){
  modal('WhatsApp não confirmado','<p>O número informado não é um WhatsApp válido com DDD. Confirme os dados da empresa e atualize o CRM antes de entrar em contato.</p><p><a href="'+escR(link)+'" target="_blank" rel="noopener noreferrer" style="color:#bba7ff">Abrir site demonstrativo publicado</a></p>',()=>byId('modal').classList.add('hidden'));
  return;
 }
 const msg='Olá! Tudo bem? Sou do Portal Central IA. Preparei uma demonstração de site para '+l.name+'. Se for do seu interesse, gostaria de mostrar uma possibilidade de presença digital para a empresa.\n\nPrévia: '+link+'\n\nPosso explicar como funcionaria? Sem compromisso. Se preferirem não receber esse tipo de contato, é só avisar.';
 modal('Proposta pronta · '+l.name,'<p>Confira o texto e o link antes de abrir o WhatsApp. A mensagem não é enviada automaticamente.</p><textarea id="message">'+escR(msg)+'</textarea><label style="display:block;margin-top:12px"><input id="permit" type="checkbox" style="width:auto"> Confirmo que o contato é apropriado e permitido.</label>',()=>{
  if(!byId('permit').checked)return alert('Confirme antes de prosseguir.');
  window.open('https://wa.me/'+p+'?text='+encodeURIComponent(byId('message').value),'_blank','noopener');
  l.stage='Contatado';save();byId('modal').classList.add('hidden');
 });
}
contact=offerWithPublishedLink;
function attachCurrentHandlers(){
 $$r('#autoOppCards [data-radar-create],#autoOppCards [data-radar-save],#autoOppCards [data-radar-message]').forEach(b=>{
  b.onclick=()=>{
   const i=Number(b.dataset.radarCreate??b.dataset.radarSave??b.dataset.radarMessage);
   if(b.hasAttribute('data-radar-create'))createFromResult(i);
   else if(b.hasAttribute('data-radar-save'))saveFromResult(i);
   else messageFromResult(i);
  };
 });
}
const originalRenderLive=renderLive;
renderLive=function(){originalRenderLive();attachCurrentHandlers()};
async function search(){
 if(loading)return;
 const term=byId('term').value.trim(),city=byId('city').value.trim();
 if(!term||!city){alert('Informe o ramo de atividade e a cidade.');return}
 const mode=byId('mode').value;
 let auth;try{auth=JSON.parse(sessionStorage.getItem('prospect_publisher_session_v1')||'null')}catch{}
 if(mode==='api'){
  let q;
  try{
   const checkHeaders={};if(auth?.access_token)checkHeaders.Authorization='Bearer '+auth.access_token;
   const qr=await fetch('/api/quota',{headers:checkHeaders,cache:'no-store'});q=await qr.json();
  }catch{q={enabled:false,reason:'Não foi possível verificar a configuração do Google.'}}
  if(!q.enabled){
   setStage('error',0,q.reason||'A integração Google Places ainda não foi habilitada.');
   byId('searchResults').innerHTML='<div class="radar-empty">'+escR(q.reason||'Configure a API Google Places para consultar empresas automaticamente.')+'</div>';
   return;
  }
  if(q.loginRequired){
   try{sessionStorage.removeItem('prospect_publisher_session_v1')}catch{}
   byId('prospectAuthPanel').hidden=false;
   setStage('idle',0,'Entre com a sua conta autorizada para iniciar a busca segura.');
   byId('searchResults').innerHTML='<div class="radar-empty">A busca automática exige login para proteger sua cota Google. Entre acima e clique em Buscar.</div>';
   return;
  }
 }
 if(mode==='free'){
  const url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(term+' em '+city);
  window.open(url,'_blank','noopener');
  stage.dataset.state='idle';byId('radarCity').textContent=city;
  setStage('idle',-1,'Pesquisa manual aberta no Google Maps. O modo gratuito não preenche empresas automaticamente.');
  byId('searchResults').innerHTML='<div class="radar-empty">O Google Maps foi aberto em outra aba. No modo manual, cadastre uma oportunidade que você conferir, ou ative a integração oficial para obter resultados automaticamente.</div>';
  return;
 }
 loading=true;
 byId('searchBtn').disabled=true;
 byId('radarCity').textContent=city;
 byId('radarCardsCount').textContent='Buscando empresas em '+city+'…';
 byId('searchResults').innerHTML='';
 stage.dataset.state='working';
 setStage('working',0,'Preparando a pesquisa de '+term+' em '+city+'…');
 byId('radarStage').scrollIntoView({block:'nearest',behavior:'smooth'});
 const progress=()=>setStage('working',1,'Consultando os perfis públicos por meio do Google Places…');
 requestAnimationFrame(progress);
 try{
  const headers={};if(auth?.access_token)headers.Authorization='Bearer '+auth.access_token;
  const r=await fetch('/api/search?term='+encodeURIComponent(term)+'&city='+encodeURIComponent(city),{headers,cache:'no-store'});
  const j=await r.json();
  if(!r.ok)throw Error(j.error||'Não foi possível buscar os estabelecimentos.');
  if(!Array.isArray(j.data))throw Error('O serviço não retornou empresas.');
  currentResults=j.data.map(x=>({...x,name:String(x.name||'Empresa'),website:String(x.website||'')}));
  lastTerm=term;filterMode='no';
  localStorage.setItem('prospect_last_segment',term);
  const missing=currentResults.filter(x=>!x.website).length;
  setStage('done',3,'Busca concluída: '+currentResults.length+' empresas encontradas, '+missing+' sem site informado.');
  renderLive();
  if(missing===0)byId('radarCardsCount').textContent='Nenhuma empresa sem website informado nessa pesquisa.';
  refreshQuota();
 }catch(e){
  setStage('error',1,e.message||'Não foi possível realizar a pesquisa.');
  byId('radarCardsCount').textContent='Pesquisa automática indisponível';
  byId('searchResults').innerHTML='<div class="radar-empty"><strong>Não foi possível consultar empresas agora.</strong><div style="margin-top:7px">'+escR(e.message||'Erro de integração')+'</div><div style="margin-top:9px">Você pode usar o modo manual do Google Maps até ativar a chave e o controle de consumo.</div></div>';
 }finally{loading=false;byId('searchBtn').disabled=false}
}
function setMode(){
 const mode=byId('mode').value;
 byId('searchBtn').textContent=mode==='api'?'⌕ Buscar empresas sem site':'⌕ Abrir Google Maps (manual)';
 byId('modeHelp').textContent=mode==='api'?
 'Consulta oficial de Google Places. O radar mostra etapas reais e filtra os perfis sem site informado. Pode exigir chave, login e cota configurados.':
 'Pesquisa gratuita manual, sem API: abre o Google Maps em outra aba. Não inventamos nem extraímos resultados.';
}
async function syncMode(){
 try{
  const r=await fetch('/api/quota',{cache:'no-store'});const q=await r.json();
  if(q.enabled){byId('mode').value='api'}else{byId('mode').value='api'}
  setMode();
  byId('radarMode').textContent=q.enabled?'Integração disponível':'Integração a configurar';
 }catch{setMode()}
}
byId('mode').onchange=setMode;
byId('searchBtn').onclick=search;
$$r('[data-page="leads"],[data-go="leads"]').forEach(b=>b.addEventListener('click',()=>{renderLive()}));
initRadar();
syncMode();
renderLive();
})();