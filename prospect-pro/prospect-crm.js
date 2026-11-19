/* Prospect PRO: operador, CRM e histórico de prospecção persistentes.
  Google Maps data is not bulk cached here. Search bookmarks contain only permitted Place IDs. */
(function(){
'use strict';
const KEY='prospect_publisher_session_v1',el=id=>document.getElementById(id);
const plain=s=>String(s||'').trim();
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cfg=null,account=null,cloudRows=new Map(),persistTimer=null,syncing=false,bookmarks=[];
let statusText='Dados locais — faça login para sincronizar com a nuvem.';
function inform(text){statusText=text;const node=el('crmSyncStatus');if(node)node.textContent=text;}
function token(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null')?.access_token||''}catch{return ''}}
async function client(){
 if(cfg)return cfg;
 const r=await fetch('/api/public-config',{cache:'no-store'});if(!r.ok)throw Error('Configuração Supabase indisponível.');
 cfg=await r.json();if(!cfg?.configured)throw Error('Armazenamento Supabase não configurado.');
 return cfg;
}
async function request(path,method='GET',body,prefer){
 const c=await client(),jwt=token();
 if(!jwt)throw Error('Faça login no Portal Prospect PRO.');
 const headers={apikey:c.publishableKey,Authorization:'Bearer '+jwt};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(prefer)headers.Prefer=prefer;
 const r=await fetch(c.supabaseUrl+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 let j=null;const t=await r.text();if(t){try{j=JSON.parse(t)}catch{j={message:t}}}
 if(!r.ok)throw Error(j?.message||j?.error||('Erro '+r.status));
 return j;
}
async function authorize(){
 const c=await client(),jwt=token();if(!jwt)return null;
 const r=await fetch(c.supabaseUrl+'/auth/v1/user',{headers:{apikey:c.publishableKey,Authorization:'Bearer '+jwt},cache:'no-store'});
 if(!r.ok)throw Error('Sessão expirada. Entre novamente.');
 const u=await r.json();return u?.id?u:null;
}
const toRow=(l,user)=>({
 id:plain(l.id),owner_id:user.id,google_place_id:plain(l.googleId)||null,
 business_name:plain(l.name).slice(0,200),
 business_category:plain(l.category).slice(0,150),
 city:plain(l.city).slice(0,150),phone:plain(l.phone).slice(0,45),
 address:plain(l.address).slice(0,320),website:plain(l.website).slice(0,400),
 origin:plain(l.origin)||'manual',stage:plain(l.stage)||'Novo',
 preview_slug:plain(l.previewSlug)||null,
 proposal_sent_at:l.proposalSentAt||null,message_opened_at:l.messageOpenedAt||null,
 archived_at:l.archivedAt||null,opted_out:!!l.optedOut,
 operator_confirmed:!!(l.operatorConfirmed||l.origin==='manual'),notes:plain(l.notes).slice(0,2000),
 updated_at:l.updatedAt||new Date().toISOString()
});
const fromRow=r=>({
 id:r.id,googleId:r.google_place_id||'',name:r.business_name,category:r.business_category,
 city:r.city,phone:r.phone,address:r.address,website:r.website,
 stage:r.stage,origin:r.origin,previewSlug:r.preview_slug||'',
 proposalSentAt:r.proposal_sent_at,messageOpenedAt:r.message_opened_at,archivedAt:r.archived_at,
 optedOut:!!r.opted_out,operatorConfirmed:!!r.operator_confirmed,notes:r.notes,
 updatedAt:r.updated_at
});
function approved(l){return !!(l.name&&l.operatorConfirmed||l.origin==='manual')}
const originalSave=save,originalRender=render,originalPage=page;
let lastSerialized=new Map();
function snapshot(){
 return leads.map(l=>({id:l.id,object:{id:l.id,googleId:l.googleId||'',name:l.name,phone:l.phone||'',address:l.address||'',website:l.website||'',category:l.category||'',city:l.city||'',stage:l.stage||'Novo',previewSlug:l.previewSlug||'',proposalSentAt:l.proposalSentAt||null,messageOpenedAt:l.messageOpenedAt||null,archivedAt:l.archivedAt||null,optedOut:!!l.optedOut,operatorConfirmed:!!l.operatorConfirmed,origin:l.origin||'manual',notes:l.notes||''}}));
}
function updateModified(){
 const now=new Date().toISOString();
 for(const v of snapshot()){
  const signature=JSON.stringify(v.object);
  if(lastSerialized.get(v.id)!==signature){
   const l=leads.find(x=>x.id===v.id);if(l)l.updatedAt=now;
  }
  lastSerialized.set(v.id,signature);
 }
}
function schedule(){
 if(!account||syncing)return;
 clearTimeout(persistTimer);persistTimer=setTimeout(()=>{syncChanges().catch(e=>inform('Falha ao sincronizar: '+e.message))},650);
}
save=function(){
 updateModified();originalSave();schedule();
};
function decorated(){
 const rows=el('leadRows');if(rows){
  for(const tr of rows.querySelectorAll('tr')){
   const stageSelect=tr.querySelector('[data-stage]');if(!stageSelect)continue;
   const l=leads.find(x=>x.id===stageSelect.dataset.stage);if(!l)continue;
   const td=tr.querySelector('td:first-child');if(!td)continue;
   const notice=l.proposalSentAt?'✓ Proposta enviada em '+new Date(l.proposalSentAt).toLocaleDateString('pt-BR'):
    l.messageOpenedAt?'WhatsApp aberto — envio ainda não confirmado':
    l.previewSlug?'Site publicado · mensagem pendente':'Aguardando proposta';
   td.insertAdjacentHTML('beforeend','<div class="crm-lead-note '+(l.proposalSentAt?'crm-sent':'')+'">'+escape(notice)+'</div>');
   const actions=tr.querySelector('.actions');
   if(actions){
    if(l.proposalSentAt)actions.insertAdjacentHTML('beforeend','<button class="mini" data-crm-sent="'+escape(l.id)+'">✓ Enviada</button>');
    else if(l.previewSlug||l.messageOpenedAt)actions.insertAdjacentHTML('beforeend','<button class="mini" data-crm-confirm="'+escape(l.id)+'">Confirmar envio</button>');
    if(l.stage==='Arquivado')actions.insertAdjacentHTML('beforeend','<button class="mini" data-crm-restore="'+escape(l.id)+'">Restaurar</button>');
    else actions.insertAdjacentHTML('beforeend','<button class="mini" data-crm-archive="'+escape(l.id)+'">Arquivar</button>');
    if(l.origin==='google-places'&&!l.operatorConfirmed)actions.insertAdjacentHTML('beforeend','<button class="mini" data-crm-review="'+escape(l.id)+'">Confirmar dados</button>');
   }
  }
 }
 document.querySelectorAll('[data-crm-confirm]').forEach(e=>e.onclick=()=>confirmSent(e.dataset.crmConfirm));
 document.querySelectorAll('[data-crm-sent]').forEach(e=>e.onclick=()=>alert('Esta proposta já foi registrada como enviada. Antes de reenviar outra mensagem, confirme que a empresa deseja recebê-la.'));
 document.querySelectorAll('[data-crm-archive]').forEach(e=>e.onclick=()=>archive(e.dataset.crmArchive));
 document.querySelectorAll('[data-crm-restore]').forEach(e=>e.onclick=()=>restore(e.dataset.crmRestore));
 document.querySelectorAll('[data-crm-review]').forEach(e=>e.onclick=()=>reviewOld(e.dataset.crmReview));
 renderSent();
 inform(statusText);
}
render=function(){originalRender();decorated()};
page=function(p){originalPage(p);if(p==='sent')renderSent()};
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>page(b.dataset.page));
function find(id){return leads.find(l=>l.id===id)}
function archive(id){const l=find(id);if(!l)return;if(!confirm('Arquivar '+l.name+'? Ela sairá da lista de oportunidades ativas, mas continuará no histórico.'))return;l.stage='Arquivado';l.archivedAt=new Date().toISOString();save()}
function restore(id){const l=find(id);if(!l)return;l.stage=l.proposalSentAt?'Proposta enviada':'Novo';l.archivedAt=null;save()}
function reviewOld(id){
 const l=find(id);if(!l)return;
 confirmGoogleLead(l,l.category,()=>{l.operatorConfirmed=true;save()},true);
}
function confirmSent(id){
 const l=find(id);if(!l)return;
 if(l.proposalSentAt){alert('Já existe um registro de proposta enviada para esta empresa.');return}
 if(!l.previewSlug&&!publishedLink(id)){alert('Publique uma prévia de site antes de registrar uma proposta enviada.');return}
 modal('Confirmar proposta enviada','<p>Marque como enviada <strong>somente se você já clicou em Enviar no WhatsApp</strong>. Abrir a conversa não confirma a entrega.</p><p>Empresa: <strong>'+escape(l.name)+'</strong></p><p>O registro ficará salvo com a data de hoje e aparecerá na aba Propostas enviadas.</p><label><input id="sent-confirm-checkbox" type="checkbox" style="width:auto"> Confirmo que enviei a mensagem para a empresa</label>',()=>{
  if(!el('sent-confirm-checkbox')?.checked)return alert('Confirme que realmente enviou a mensagem.');
  l.proposalSentAt=new Date().toISOString();l.stage='Proposta enviada';l.messageOpenedAt=l.messageOpenedAt||new Date().toISOString();
  save();el('modal').classList.add('hidden');
 });
}
function publishedLink(id){
 const l=find(id);if(!l)return null;
 if(l.previewSlug)return location.origin+'/mvp/'+encodeURIComponent(l.previewSlug);
 try{
  const p=JSON.parse(localStorage.getItem('prospect_library_projects')||'[]').find(p=>p.leadId===id&&p.publicSlug);
  if(p){l.previewSlug=p.publicSlug;save();return location.origin+'/mvp/'+encodeURIComponent(p.publicSlug)}
 }catch{}
 return null;
}
function composeMessage(id){
 const l=find(id);if(!l)return;
 if(l.optedOut||l.stage==='Não contatar')return alert('Empresa sinalizada para não receber novas propostas.');
 if(l.proposalSentAt){
  modal('Proposta já enviada','<p>Uma proposta para <strong>'+escape(l.name)+'</strong> já foi registrada como enviada em '+escape(new Date(l.proposalSentAt).toLocaleString('pt-BR'))+'.</p><p>Evite abordagens repetidas. Você pode consultar o link ou acompanhar a resposta no funil de vendas.</p>',()=>el('modal').classList.add('hidden'));return;
 }
 const link=publishedLink(id);
 if(!link){
  modal('Site ainda não publicado','<p>Crie as três propostas, escolha a melhor, ajuste o design e clique em <strong>Publicar prévia</strong> antes de preparar a mensagem.</p>',()=>{location.href='/studio?lead='+encodeURIComponent(id)});
  return;
 }
 let number=plain(l.phone).replace(/\D/g,'');if(number.length===10||number.length===11)number='55'+number;
 if(!/^55\d{10,11}$/.test(number)){alert('Confirme o telefone com DDD da empresa no cadastro antes de abrir o WhatsApp.');return}
 const msg='Olá! Tudo bem? Sou do Portal Central IA. Preparei uma demonstração de site para '+l.name+', com uma proposta de presença digital para a empresa.\n\nVocê pode conferir aqui: '+link+'\n\nPosso explicar a ideia? Sem compromisso. Se não desejar contatos, basta avisar.';
 modal('Mensagem personalizada · '+l.name,
  '<p>Confira os dados e o link. Esta ação apenas <strong>abre o WhatsApp com a mensagem pronta</strong>, sem enviar automaticamente.</p><textarea id="message">'+escape(msg)+'</textarea><label><input id="permit" type="checkbox" style="width:auto"> Tenho motivo legítimo para contatar esta empresa e respeitarei qualquer recusa.</label>'+
  '<p class="muted">Depois de enviar no WhatsApp, volte à aba Oportunidades e clique em <strong>Confirmar envio</strong>. Nenhum envio é presumido.</p>',()=>{
   if(!el('permit')?.checked)return alert('Confirme antes de prosseguir.');
   const url='https://wa.me/'+number+'?text='+encodeURIComponent(el('message').value);
   const opened=window.open(url,'_blank','noopener');
   l.messageOpenedAt=new Date().toISOString();if(!l.proposalSentAt)l.stage='Proposta pronta';save();
   el('modal').classList.add('hidden');
   if(!opened)alert('O navegador pode ter bloqueado o WhatsApp. Permita pop-ups para abrir a conversa.');
  });
}
function confirmGoogleLead(x,category,callback,existing=false){
 const source=x||{};
 const name=plain(source.name),phone=plain(source.phone),address=plain(source.address);
 modal('Confirmar dados do estabelecimento',
  '<p>Para armazenar permanentemente uma oportunidade, confirme os dados comerciais que você verificou. O Google permite armazenar o <strong>Place ID</strong>, mas não copiar em massa seu conteúdo para um CRM. <a href="https://developers.google.com/maps/documentation/places/web-service/policies" target="_blank" rel="noopener noreferrer">Regras do Google Maps</a>.</p>'+
  '<label>Nome confirmado da empresa<input id="crm-name" maxlength="190" value="'+escape(name)+'"></label>'+
  '<label>Telefone comercial confirmado<input id="crm-phone" maxlength="40" value="'+escape(phone)+'"></label>'+
  '<label>Endereço confirmado<input id="crm-address" maxlength="300" value="'+escape(address)+'"></label>'+
  '<label><input id="crm-verified" type="checkbox" style="width:auto"> Conferi essas informações e quero manter este cadastro comercial</label>',()=>{
  if(!el('crm-verified')?.checked)return alert('Confirme a verificação dos dados.');
  const name=plain(el('crm-name').value),phone=plain(el('crm-phone').value),address=plain(el('crm-address').value);
  if(name.length<2)return alert('Informe o nome do estabelecimento.');
  const lead=existing?source:leads.find(l=>source.googleId&&l.googleId===source.googleId);
  if(lead){lead.name=name;lead.phone=phone;lead.address=address;lead.category=category||lead.category;lead.operatorConfirmed=true;lead.origin='google-places';save()}
  else{
   const leadNew={id:uid(),googleId:source.googleId||'',name,phone,address,website:'',category:category||'',city:plain(el('city')?.value),origin:'google-places',operatorConfirmed:true,stage:'Novo',previewSlug:'',proposalSentAt:null};
   leads.unshift(leadNew);save();
  }
  el('modal').classList.add('hidden');
  const out=existing?source:leads.find(l=>l.googleId&&l.googleId===source.googleId);
  if(callback)callback(out||leads[0]);
 });
}
function renderSent(){
 const box=el('sentProposalRows');if(!box)return;
 const list=leads.filter(l=>!!l.proposalSentAt).sort((a,b)=>String(b.proposalSentAt).localeCompare(String(a.proposalSentAt)));
 el('sentCounter').textContent=list.length+' propostas registradas como enviadas';
 box.innerHTML=list.map(l=>'<article class="sent-row"><div><strong>'+escape(l.name)+'</strong><div class="crm-lead-note">Enviada: '+escape(new Date(l.proposalSentAt).toLocaleString('pt-BR'))+' · Status: '+escape(l.stage)+'</div></div><div class="sent-actions">'+(publishedLinkForDisplay(l)?'<a class="mini" href="'+escape(publishedLinkForDisplay(l))+'" target="_blank" rel="noopener noreferrer">Ver prévia</a>':'')+'<button class="mini" data-sent-archive="'+escape(l.id)+'">Arquivar</button></div></article>').join('')||'<div class="radar-empty">Nenhuma proposta marcada como enviada. Ao enviar uma mensagem pelo WhatsApp, volte ao lead e confirme o envio.</div>';
 box.querySelectorAll('[data-sent-archive]').forEach(e=>e.onclick=()=>archive(e.dataset.sentArchive));
}
function publishedLinkForDisplay(l){return l.previewSlug?location.origin+'/mvp/'+encodeURIComponent(l.previewSlug):''}
async function syncChanges(){
 if(!account||syncing)return;
 syncing=true;
 try{
  const rows=leads.filter(approved).map(l=>toRow(l,account));
  const delta=rows.filter(r=>{const remote=cloudRows.get(r.id);return !remote||Date.parse(r.updated_at)>Date.parse(remote.updated_at||'1970-01-01')});
  if(delta.length){
   await request('/rest/v1/prospect_crm_leads?on_conflict=id','POST',delta,'resolution=merge-duplicates,return=representation');
   for(const row of delta)cloudRows.set(row.id,row);
  }
  inform('Sincronizado com Supabase · '+rows.length+' oportunidades confirmadas salvas.');
 }catch(e){inform('Armazenamento local ativo · falha na nuvem: '+e.message)}
 finally{syncing=false}
}
async function sync(){
 if(syncing)return;
 try{
  account=await authorize();
  if(!account){inform('Entre com sua conta para recuperar as oportunidades da nuvem.');return}
  const rows=await request('/rest/v1/prospect_crm_leads?select=*&order=updated_at.desc&limit=1000');
  for(const row of rows||[]){
   cloudRows.set(row.id,row);
   const i=leads.findIndex(l=>l.id===row.id);
   if(i<0)leads.push(fromRow(row));
   else if(Date.parse(row.updated_at||'1970-01-01')>=Date.parse(leads[i].updatedAt||'1970-01-01'))leads[i]={...leads[i],...fromRow(row)};
  }
  // Preserve existing manually confirmed local records from the older version.
  updateModified();originalSave();
  await syncChanges();await loadHistory();
 }catch(e){inform('Falha ao recuperar oportunidades: '+e.message)}
}
async function recordSearch(term,city,rows){
 const ids=[...new Set((rows||[]).map(x=>plain(x.googleId)).filter(Boolean))].slice(0,20);
 if(!account||!ids.length)return;
 try{
  await request('/rest/v1/prospect_search_bookmarks','POST',{owner_id:account.id,search_term:term,search_city:city,place_ids:ids},'return=minimal');
  await loadHistory();
 }catch(e){inform('Busca realizada, mas histórico não sincronizado: '+e.message)}
}
async function loadHistory(){
 if(!account)return;
 try{
  const result=await request('/rest/v1/prospect_search_bookmarks?select=id,search_term,search_city,place_ids,created_at&order=created_at.desc&limit=30');
  bookmarks=Array.isArray(result)?result:[];renderHistory();
 }catch(e){inform('Não foi possível carregar o histórico de buscas: '+e.message)}
}
function renderHistory(){
 const target=el('storedSearches');if(!target)return;
 target.innerHTML=bookmarks.length?bookmarks.map(b=>'<div class="search-bookmark"><div><strong>'+escape(b.search_term)+' · '+escape(b.search_city)+'</strong><div class="crm-lead-note">'+escape(new Date(b.created_at).toLocaleString('pt-BR'))+' · '+(b.place_ids?.length||0)+' identificadores Google guardados</div></div><button class="mini" data-repeat-search="'+escape(b.id)+'">Atualizar pesquisa</button></div>').join(''):'<p class="crm-lead-note">Nenhuma pesquisa salva ainda. O histórico manterá as buscas e IDs dos locais; os dados de empresas precisam ser consultados novamente para respeitar os termos do Google.</p>';
 target.querySelectorAll('[data-repeat-search]').forEach(button=>button.onclick=()=>{
  const run=bookmarks.find(x=>x.id===button.dataset.repeatSearch);if(!run)return;
  if(!confirm('Atualizar esta pesquisa faz uma nova consulta ao Google e consome 1 das suas 50 buscas mensais. Continuar?'))return;
  el('term').value=run.search_term;el('city').value=run.search_city;
  el('mode').value='api';el('mode').dispatchEvent(new Event('change'));
  page('search');el('searchBtn').click();
 });
}
window.PortalCRM={sync,recordSearch,composeMessage,confirmGoogleLead,confirmSent,renderHistory,archive,restore,publishedLink,hasSent:id=>!!find(id)?.proposalSentAt};
document.addEventListener('DOMContentLoaded',()=>{render();if(token())sync();});
if(document.readyState!=='loading'){render();if(token())sync()}
})();
