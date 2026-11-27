/* Prospect PRO: operador, CRM e histórico de prospecção persistentes.
  Google Maps data is not bulk cached here. Search bookmarks contain only permitted Place IDs. */
(function(){
'use strict';
const KEY='prospect_publisher_session_v1',el=id=>document.getElementById(id);
const plain=s=>String(s||'').trim();
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cfg=null,account=null,cloudRows=new Map(),persistTimer=null,syncing=false,bookmarks=[];
let loadingCRM=null,pendingPersist=false;
let metricsRequest;
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
 const r=await fetch(c.supabaseUrl+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(10000)});
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
 whatsapp:plain(l.whatsapp).slice(0,160),whatsapp_use_phone:l.whatsappUsePhone!==false,
 address:plain(l.address).slice(0,320),website:plain(l.website).slice(0,400),
 origin:plain(l.origin)||(l.googleId?'google-places':'manual'),stage:plain(l.stage)||'Novo',
 preview_slug:plain(l.previewSlug)||null,
 proposal_sent_at:l.proposalSentAt||null,message_opened_at:l.messageOpenedAt||null,
 archived_at:l.archivedAt||null,opted_out:!!l.optedOut,
 operator_confirmed:!!(l.operatorConfirmed||(!l.googleId&&l.origin!=='google-places')),notes:plain(l.notes).slice(0,2000),
 updated_at:l.updatedAt||new Date().toISOString()
});
const fromRow=r=>({
 id:r.id,googleId:r.google_place_id||'',name:r.business_name,category:r.business_category,
 city:r.city,phone:r.phone,whatsapp:r.whatsapp||'',whatsappUsePhone:r.whatsapp_use_phone!==false,address:r.address,website:r.website,
 stage:r.stage,origin:r.origin,previewSlug:r.preview_slug||'',
 proposalSentAt:r.proposal_sent_at,messageOpenedAt:r.message_opened_at,archivedAt:r.archived_at,
 optedOut:!!r.opted_out,privateProposalRefusedAt:r.private_proposal_refused_at||null,
 operatorConfirmed:!!r.operator_confirmed,notes:r.notes,
 updatedAt:r.updated_at
});
function approved(l){return !!(l.name&&(l.operatorConfirmed||(!l.googleId&&l.origin!=='google-places')))}
const originalSave=save,originalRender=render;
let lastSerialized=new Map();
function snapshot(){
 return leads.map(l=>({id:l.id,object:{id:l.id,googleId:l.googleId||'',name:l.name,phone:l.phone||'',whatsapp:l.whatsapp||'',whatsappUsePhone:l.whatsappUsePhone!==false,address:l.address||'',website:l.website||'',category:l.category||'',city:l.city||'',stage:l.stage||'Novo',previewSlug:l.previewSlug||'',proposalSentAt:l.proposalSentAt||null,messageOpenedAt:l.messageOpenedAt||null,archivedAt:l.archivedAt||null,optedOut:!!l.optedOut,operatorConfirmed:!!l.operatorConfirmed,origin:l.origin||'manual',notes:l.notes||''}}));
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
function rememberState(){
 lastSerialized=new Map(snapshot().map(({id,object})=>[id,JSON.stringify(object)]));
}
function schedule(){
 if(!account)return;
 pendingPersist=true;
 if(syncing||loadingCRM)return;
 clearTimeout(persistTimer);
 persistTimer=setTimeout(syncChanges,650);
}
save=function(){
 updateModified();originalSave();schedule();
};
function decorated(){
 const rows=el('leadRows');if(rows){
  for(const tr of rows.querySelectorAll('tr')){
   const stageSelect=tr.querySelector('[data-stage]');if(!stageSelect)continue;
   const l=find(stageSelect.dataset.stage);if(!l)continue;
   const td=tr.querySelector('td:first-child');if(!td)continue;
   const refusal = contactRefused(l);
   const privateProposal = !contactBlocked(l) && activePrivateProposal(l.id);
   const notice=refusal?'Contato recusado pela empresa':l.proposalSentAt?'✓ Proposta enviada em '+new Date(l.proposalSentAt).toLocaleDateString('pt-BR'):
    l.messageOpenedAt?'WhatsApp aberto — envio ainda não confirmado':
    privateProposal?'Link privado ativo':hasPrivateProposal(l.id)?'Proposta privada no histórico':l.previewSlug?'Site publicado · mensagem pendente':'Aguardando proposta';
   td.insertAdjacentHTML('beforeend','<div class="crm-lead-note '+(l.proposalSentAt?'crm-sent':'')+'">'+escape(notice)+'</div>');
   const actions=tr.querySelector('.actions');
   if(actions){
    if(l.proposalSentAt)actions.insertAdjacentHTML('beforeend','<button class="mini" data-crm-sent="'+escape(l.id)+'">✓ Enviada</button>');
    else if(hasPrivateProposal(l.id)||l.previewSlug||l.messageOpenedAt)actions.insertAdjacentHTML('beforeend','<button class="mini" data-crm-confirm="'+escape(l.id)+'">Confirmar envio</button>');
    if(privateProposal)actions.insertAdjacentHTML('beforeend','<button class="mini" type="button" data-crm-revoke="'+escape(l.id)+'">Revogar link privado</button>');
    if(!refusal){
     if(l.stage==='Arquivado')actions.insertAdjacentHTML('beforeend','<button class="mini" data-crm-restore="'+escape(l.id)+'">Restaurar</button>');
     else actions.insertAdjacentHTML('beforeend','<button class="mini" data-crm-archive="'+escape(l.id)+'">Arquivar</button>');
    }
    if(l.origin==='google-places'&&!l.operatorConfirmed)actions.insertAdjacentHTML('beforeend','<button class="mini" data-crm-review="'+escape(l.id)+'">Confirmar dados</button>');
   }
  }
 }
 document.querySelectorAll('[data-crm-confirm]').forEach(e=>e.onclick=()=>confirmSent(e.dataset.crmConfirm));
 document.querySelectorAll('[data-crm-sent]').forEach(e=>e.onclick=()=>alert('Esta proposta já foi registrada como enviada. Antes de reenviar outra mensagem, confirme que a empresa deseja recebê-la.'));
 document.querySelectorAll('[data-crm-archive]').forEach(e=>e.onclick=()=>archive(e.dataset.crmArchive));
 document.querySelectorAll('[data-crm-restore]').forEach(e=>e.onclick=()=>restore(e.dataset.crmRestore));
 document.querySelectorAll('[data-crm-review]').forEach(e=>e.onclick=()=>reviewOld(e.dataset.crmReview));
 document.querySelectorAll('[data-crm-revoke]').forEach(e=>e.onclick=()=>revokePrivate(e.dataset.crmRevoke));
 renderSent();
 inform(statusText);
}
rememberState();
render=function(){originalRender();decorated()};
function find(id){return leads.find(l=>String(l.id)===String(id))}
function archive(id){const l=find(id);if(!l||contactRefused(l))return;if(!confirm('Arquivar '+l.name+'? Ela sairá da lista de oportunidades ativas, mas continuará no histórico.'))return;l.stage='Arquivado';l.archivedAt=new Date().toISOString();save()}
function restore(id){
 const l=find(id);if(!l||contactRefused(l))return;
 if(l.optedOut)l.stage='Não contatar';
 else if(l.proposalSentAt)l.stage='Proposta enviada';
 else if(l.messageOpenedAt)l.stage='Proposta pronta';
 else if(l.previewSlug)l.stage='Site criado';
 else l.stage='Novo';
 l.archivedAt=null;save();
}
function reviewOld(id){
 const l=find(id);if(!l)return;
 confirmGoogleLead(l,l.category,()=>{l.operatorConfirmed=true;save()},true);
}

function revokePrivate(leadId) {
 const lead = find(leadId);
 const proposal = activePrivateProposal(leadId);
 if (contactBlocked(lead) || !proposal) return;
 modal('Revogar link privado', '<p>O link de <strong>' + escape(lead.name)
  + '</strong> será desativado e as três prévias serão excluídas.</p>', async () => {
  const accessToken = token();
  if (!accessToken) return modalError('Entre na sua conta para revogar o link.');
  const submission = el('confirm');
  const message = el('modalBody').firstElementChild;
  submission.disabled = true;
  try {
   await privateRequest(accessToken, `/${encodeURIComponent(proposal.id)}/revoke`, 'POST');
   if (token() !== accessToken) return;
   proposal.revoked_at = new Date().toISOString();
   if (message.isConnected && !el('modal').classList.contains('hidden')) closeModal();
   metricsRequest = null;
   render();
   await refreshMetrics();
   if (token() === accessToken) inform('Link privado revogado. As três prévias foram excluídas.');
  } catch (error) {
   if (message.isConnected && !el('modal').classList.contains('hidden')) modalError(error.message);
  } finally {
   submission.disabled = false;
  }
 }, { confirm: 'Revogar e excluir prévias' });
}
function confirmSent(id){
 const l=find(id);if(!l)return;
 if(l.proposalSentAt){alert('Já existe um registro de proposta enviada para esta empresa.');return}
 if(!hasPrivateProposal(id)&&!l.previewSlug&&!publishedLink(id)){alert('Crie uma proposta antes de registrar o envio.');return}
 modal('Confirmar proposta enviada','<p>Marque como enviada <strong>somente se você já clicou em Enviar no WhatsApp</strong>. Abrir a conversa não confirma a entrega.</p><p>Empresa: <strong>'+escape(l.name)+'</strong></p><p>O registro ficará salvo com a data de hoje e aparecerá na aba Propostas enviadas.</p><label><input id="sent-confirm-checkbox" type="checkbox" style="width:auto"> Confirmo que enviei a mensagem para a empresa</label>',()=>{
  if(!el('sent-confirm-checkbox')?.checked)return modalError('Confirme que realmente enviou a mensagem.');
  l.proposalSentAt=new Date().toISOString();
  if(!contactBlocked(l))l.stage='Proposta enviada';
  save();closeModal();
 },{confirm:'Registrar envio'});
}
function publishedLink(id){
 const l=find(id);if(!l)return null;
 if(l.previewSlug)return window.ProspectLinks.previewUrl(l.previewSlug);
 try{
  const p=readList('prospect_library_projects').find(p=>String(p.leadId)===String(id)&&p.publicSlug);
  if(p){l.previewSlug=p.publicShareSlug||p.publicSlug;save();return window.ProspectLinks.previewUrl(p.publicSlug,p.publicShareSlug)}
 }catch{}
 return null;
}
function composeMessage(id){
 const l=find(id);if(!l)return;
 if(contactBlocked(l))return alert('Esta oportunidade está arquivada ou sinalizada para não receber propostas.');
 if(l.proposalSentAt){
  modal('Proposta já enviada','<p>Uma proposta para <strong>'+escape(l.name)+'</strong> já foi registrada como enviada em '+escape(new Date(l.proposalSentAt).toLocaleString('pt-BR'))+'.</p>',closeModal,{confirm:'Entendi'});return;
 }
 const link=hasPrivateProposal(id) ? null : publishedLink(id);
 if(!link){
  modal('Preparar um link privado','<p>No Studio, gere três opções e selecione Preparar link privado para abrir a mensagem comercial.</p>',()=>openStudioForLead(l),{confirm:'Ir para o Studio'});
  return;
 }
 const number=window.ProspectLinks.whatsappNumber(l);
 if(!number){alert('Informe o WhatsApp com DDD em Editar empresa.');return}
 const msg=formatProposalMessage(l,link);
 modal('Mensagem personalizada · '+l.name,
  '<p>Confira os dados e o link. A mensagem será aberta no WhatsApp para envio manual.</p><textarea id="message" aria-label="Mensagem para a empresa">'+escape(msg)+'</textarea><label><input id="permit" type="checkbox" style="width:auto"> A empresa autorizou previamente o contato comercial por WhatsApp no número +'+escape(number)+'.</label>'+
  '<p class="muted">Depois de enviar, volte a Oportunidades e clique em <strong>Confirmar envio</strong>.</p>',
  () => openAuthorizedWhatsApp(l, number), {confirm:'Abrir WhatsApp'});
}

async function openAuthorizedWhatsApp(lead, number) {
 const consent = el('permit');
 if (!consent?.checked) return modalError('Confirme a autorização prévia da empresa para continuar.');
 const message = el('message').value.trim();
 if (!message) return modalError('Preencha a mensagem antes de abrir o WhatsApp.');
 if (contactBlocked(lead)) return modalError('Esta oportunidade está bloqueada para contato.');
 const accessToken = token();
 if (!accessToken) return modalError('Entre na sua conta para verificar se a empresa permite contato.');
 const popup = window.open('', '_blank');
 if (!popup) return modalError('Permita a abertura de uma nova aba para continuar.');
 popup.opener = null;
 const submit = el('confirm');
 submit.disabled = true;
 try {
  const query = new URLSearchParams({ id: `eq.${lead.id}`, select: 'id,opted_out,archived_at,stage', limit: '1' });
  const [row] = await request('/rest/v1/prospect_crm_leads?' + query);
  if (token() !== accessToken || !consent.isConnected || el('modal').classList.contains('hidden')) return popup.close();
  const current = find(lead.id);
  if (row?.id !== lead.id || contactBlocked(fromRow(row)) || contactBlocked(current)) {
   popup.close();
   if (current && row?.id === current.id && row.opted_out) {
    current.optedOut = true;
    current.stage = row.stage;
    save();
   }
   return modalError('Esta oportunidade está bloqueada ou não pôde ser confirmada na nuvem.');
  }
  if (popup.closed) return;
  popup.location.replace('https://wa.me/'+number+'?text='+encodeURIComponent(message));
  current.messageOpenedAt = new Date().toISOString();
  if (['Novo', 'Em análise', 'Site criado'].includes(current.stage)) current.stage = 'Proposta pronta';
  save();
  closeModal();
 } catch {
  popup.close();
  if (consent.isConnected && !el('modal').classList.contains('hidden')) modalError('Não foi possível verificar o contato. Tente novamente.');
 } finally {
  submit.disabled = false;
 }
}
function confirmGoogleLead(x,category,callback,existing=false,searchCity='',placeId=x?.googleId){
 const source=x||{};
 const name=plain(source.name),phone=plain(source.phone),address=plain(source.address);
 modal('Confirmar dados do estabelecimento',
  '<p>Para armazenar permanentemente uma oportunidade, confirme os dados comerciais que você verificou. O Google permite armazenar o <strong>Place ID</strong>, mas não copiar em massa seu conteúdo para um CRM. <a href="https://developers.google.com/maps/documentation/places/web-service/policies" target="_blank" rel="noopener noreferrer">Regras do Google Maps</a>.</p>'+
  '<label>Nome confirmado da empresa<input id="crm-name" maxlength="190" value="'+escape(name)+'"></label>'+
  '<label>Telefone comercial confirmado<input id="crm-phone" maxlength="40" value="'+escape(phone)+'"></label>'+
  '<label>WhatsApp da empresa (se for outro número)<input id="crm-whatsapp" type="tel" maxlength="160" value="'+escape(source.whatsapp||window.ProspectLinks.whatsappLinkNumber(source.website))+'"></label>'+
  '<label>Endereço confirmado<input id="crm-address" maxlength="300" value="'+escape(address)+'"></label>'+
  '<label>Site identificado fora do perfil (opcional)<input id="crm-site" maxlength="350" value="'+escape(plain(source.website))+'"></label>'+
  '<label><input id="crm-verified" type="checkbox" style="width:auto"> Conferi essas informações e quero manter este cadastro comercial</label>',()=>{
  if(!el('crm-verified')?.checked)return modalError('Confirme que revisou os dados comerciais.');
  const name=plain(el('crm-name').value),phone=plain(el('crm-phone').value),address=plain(el('crm-address').value),website=plain(el('crm-site').value);
  if(name.length<2)return modalError('Informe o nome do estabelecimento.');
  const entered=plain(el('crm-whatsapp').value);
  const whatsapp=entered||window.ProspectLinks.whatsappLinkNumber(website);
  if(whatsapp&&!window.ProspectLinks.whatsappNumber({whatsapp}))return modalError('Confira o número ou o link de WhatsApp da empresa.');
  const lead=existing?source:leads.find(l=>placeId&&l.googleId===placeId);
  const city=plain(searchCity)||plain(el('city')?.value);
  if(lead){lead.name=name;lead.phone=phone;lead.whatsapp=whatsapp;lead.address=address;lead.website=website;lead.category=category||lead.category;lead.city=lead.city||city;lead.googleId||=placeId||'';lead.operatorConfirmed=true;lead.origin='google-places';save()}
  else{
   const leadNew={id:uid(),googleId:placeId||'',name,phone,whatsapp,address,website:'',category:category||'',city,origin:'google-places',operatorConfirmed:true,stage:'Novo',previewSlug:'',proposalSentAt:null};
   leadNew.website=website;leads.unshift(leadNew);save();
  }
  closeModal();
  const out=existing?source:leads.find(l=>l.googleId&&l.googleId===placeId);
  if(callback)callback(out||leads[0]);
 },{confirm:'Salvar empresa'});
}
function renderSent(){
 const box=el('sentProposalRows');if(!box)return;
 const list=leads.filter(l=>!!l.proposalSentAt).sort((a,b)=>String(b.proposalSentAt).localeCompare(String(a.proposalSentAt)));
 el('sentCounter').textContent=list.length+' propostas registradas como enviadas';
 box.innerHTML=list.map(l=>'<article class="sent-row"><div><strong>'+escape(l.name)+'</strong><div class="crm-lead-note">Enviada: '+escape(new Date(l.proposalSentAt).toLocaleString('pt-BR'))+' · Status: '+escape(l.stage)+'</div></div><div class="sent-actions">'+(publishedLinkForDisplay(l)?'<a class="mini" href="'+escape(publishedLinkForDisplay(l))+'" target="_blank" rel="noopener noreferrer">Ver prévia</a>':'')+'<button class="mini" data-sent-archive="'+escape(l.id)+'">Arquivar</button></div></article>').join('')||'<div class="radar-empty">Nenhuma proposta marcada como enviada. Ao enviar uma mensagem pelo WhatsApp, volte ao lead e confirme o envio.</div>';
 box.querySelectorAll('[data-sent-archive]').forEach(e=>e.onclick=()=>archive(e.dataset.sentArchive));
}
function publishedLinkForDisplay(l){return l.previewSlug?window.ProspectLinks.previewUrl(l.previewSlug):''}
async function syncChanges(){
 if(!account||syncing)return;
 pendingPersist=false;
 syncing=true;
 try{
  const rows=leads.filter(approved).map(l=>toRow(l,account));
  const delta=rows.filter(r=>{const remote=cloudRows.get(r.id);return !remote||Date.parse(r.updated_at)>Date.parse(remote.updated_at||'1970-01-01')});
  if(delta.length){
   const saved = await request('/rest/v1/prospect_crm_leads?on_conflict=id','POST',delta,'resolution=merge-duplicates,return=representation');
   let blocked = false;
   for (const row of saved || []) {
    cloudRows.set(row.id, row);
    const lead = find(row.id);
    if (lead && row.opted_out && (!lead.optedOut || lead.stage !== row.stage || (row.private_proposal_refused_at && !lead.privateProposalRefusedAt))) {
     lead.optedOut = true;
     lead.stage = row.stage;
     if (row.private_proposal_refused_at) lead.privateProposalRefusedAt = row.private_proposal_refused_at;
     blocked = true;
    }
   }
   if (blocked) { rememberState(); originalSave(); }
  }
  inform('Sincronizado com Supabase · '+rows.length+' oportunidades confirmadas salvas.');
 }catch(e){inform('Armazenamento local ativo · falha na nuvem: '+e.message)}
 finally{syncing=false;if(pendingPersist)schedule()}
}
function sync(){
 if(loadingCRM)return loadingCRM;
 loadingCRM=loadCRM().finally(()=>{
  loadingCRM=null;
  if(pendingPersist)schedule();
 });
 return loadingCRM;
}
async function loadCRM(){
 try{
  const authorized=await authorize();
  if(account?.id!==authorized?.id) { cloudRows.clear(); savedSearchIds = []; }
  account=authorized;
  if(!account){inform('Entre com sua conta para recuperar as oportunidades da nuvem.');return false}
  const rows=await request('/rest/v1/prospect_crm_leads?select=*&order=updated_at.desc&limit=1000');
  for(const row of rows||[]){
   cloudRows.set(row.id,row);
   const i=leads.findIndex(l=>l.id===row.id);
   if(i<0)leads.push(fromRow(row));
   else if(Date.parse(row.updated_at||'1970-01-01')>=Date.parse(leads[i].updatedAt||'1970-01-01'))leads[i]={...leads[i],...fromRow(row)};
   else if (row.private_proposal_refused_at) Object.assign(leads[i], {
    optedOut: true, stage: 'Não contatar', privateProposalRefusedAt: row.private_proposal_refused_at
   });
  }
  // Preserve existing manually confirmed local records from the older version.
  rememberState();originalSave();
  await syncChanges();await refreshMetrics();
  return true;
 }catch(e){inform('Falha ao recuperar oportunidades: '+e.message);return false}
}
async function recordSearch(term,city,rows){
 const ids=[...new Set((rows||[]).map(x=>plain(x.googleId)).filter(Boolean))].slice(0,20);
 if(!ids.length)return;
 for (const id of ids) sessionSearchIds.add(id);
 renderOverview();
 if(!account){try{account=await authorize()}catch{}}
 if(!account)return;
 try{
  await request('/rest/v1/prospect_search_bookmarks','POST',{owner_id:account.id,search_term:term,search_city:city,place_ids:ids},'return=minimal');
  await loadHistory();
 }catch(e){inform('Busca realizada, mas histórico não sincronizado: '+e.message)}
}
async function loadHistory(){
 if(!account)return;
 const accessToken = token();
 try{
  const result=await request('/rest/v1/prospect_search_bookmarks?select=id,search_term,search_city,place_ids,created_at&order=created_at.desc&limit=30');
  if (token() !== accessToken) return;
  bookmarks=Array.isArray(result)?result:[];renderHistory();
  savedSearchIds = bookmarks.flatMap(bookmark => Array.isArray(bookmark.place_ids) ? bookmark.place_ids : []);
  renderOverview();
 }catch(e){inform('Não foi possível carregar o histórico de buscas: '+e.message)}
}

async function privateRequest(accessToken, suffix = '', method = 'GET') {
 const response = await fetch('/api/studio/proposals' + suffix, {
  method, headers: { Authorization: 'Bearer ' + accessToken }, cache: 'no-store', signal: AbortSignal.timeout(10000)
 });
 const result = await response.json().catch(() => ({}));
 if (!response.ok) throw Object.assign(Error(result?.error || 'O serviço de propostas está indisponível.'), { status: response.status });
 return result;
}

async function readPrivateMetrics(accessToken) {
 try {
  const { proposals } = await privateRequest(accessToken);
  if (!Array.isArray(proposals)) throw Error('Dados de propostas indisponíveis');
  return { rows: proposals, issue: '' };
 } catch (error) {
  if (error.status === 401) return { rows: null, issue: 'Entre novamente para consultar as propostas privadas.' };
  if (error.status === 403) return { rows: null, issue: 'A consulta de propostas privadas exige acesso de operador.' };
 }
 const availability = await privateRequest(accessToken, '/availability').catch(() => null);
 if (availability?.configured === false && availability?.ready === false) {
  return { rows: null, issue: 'Propostas privadas aguardam a configuração do serviço.' };
 }
 if (availability?.configured === true && availability?.ready === false) {
  return { rows: null, issue: 'O serviço de propostas privadas está configurado e ainda indisponível.' };
 }
 return { rows: null, issue: 'Não foi possível consultar as propostas privadas. Atualize os indicadores para tentar novamente.' };
}

function showPrivateMetricsIssue(issue) {
 const notice = el('privateProposalConnectionStatus');
 notice.textContent = issue;
 notice.hidden = !issue;
}

function refreshMetrics() {
 const accessToken = token();
 const status = el('commercialStatus');
 if (!accessToken) {
  metricsRequest = null;
  proposalMetrics = cloudProjectIds = null;
  savedSearchIds = [];
  el('refreshCommercial').removeAttribute('aria-busy');
  showPrivateMetricsIssue('');
  status.textContent = 'Entre na sua conta para consultar projetos e propostas na nuvem.';
  renderOverview();
  return Promise.resolve();
 }
 if (metricsRequest?.token === accessToken) return metricsRequest.run;
 const refresh = el('refreshCommercial');
 refresh.setAttribute('aria-busy', 'true');
 status.textContent = 'Atualizando indicadores…';
 const activeProjects = request('/rest/v1/rpc/prospect_studio_current_projects?select=project_id&snapshot=not.is.null').catch(() => null);
 const run = Promise.all([readPrivateMetrics(accessToken), activeProjects, loadHistory()]).then(([privateMetrics, projectRows]) => {
  if (token() !== accessToken || metricsRequest?.run !== run) return;
  proposalMetrics = privateMetrics.rows;
  cloudProjectIds = Array.isArray(projectRows)
   ? projectRows.filter(row => row.snapshot !== null).map(row => row.project_id).filter(Boolean) : null;
  showPrivateMetricsIssue(privateMetrics.issue);
  const issues = [privateMetrics.issue, cloudProjectIds ? '' : 'Não foi possível consultar os projetos na nuvem.'].filter(Boolean);
  status.textContent = issues.join(' ') || 'Indicadores atualizados.';
  render();
 }).finally(() => {
  if (metricsRequest?.run === run) {
   metricsRequest = null;
   refresh.removeAttribute('aria-busy');
  }
 });
 metricsRequest = { token: accessToken, run };
 return run;
}

async function refreshCommercial() {
 if (!token()) return refreshMetrics();
 el('commercialStatus').textContent = 'Atualizando indicadores…';
 if (!(await sync())) el('commercialStatus').textContent = 'Não foi possível atualizar os indicadores da nuvem.';
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
window.PortalCRM={sync,refreshMetrics,refreshCommercial,recordSearch,composeMessage,confirmGoogleLead,confirmSent,renderHistory,archive,restore,publishedLink,hasSent:id=>!!find(id)?.proposalSentAt};
function initialize() { render(); if (token()) void sync(); else void refreshMetrics(); }
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);
else initialize();
})();
