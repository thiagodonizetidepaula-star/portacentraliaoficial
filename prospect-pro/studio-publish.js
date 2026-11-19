(function(){
'use strict';
const $=id=>document.getElementById(id),engine=window.PortalSiteStudio;
const authKey='prospect_publisher_session_v1';
let cfg=null,session=null,lastPublic=null;
try{session=JSON.parse(sessionStorage.getItem(authKey)||'null')}catch{}
const status=(msg)=>{$('publishStatus').textContent=msg||''};
function saveSession(s){session=s;if(s)sessionStorage.setItem(authKey,JSON.stringify(s));else sessionStorage.removeItem(authKey)}
function showAuth(ready){
 $('publishAuth').hidden=!!ready;$('publishReady').hidden=!ready;$('publishResult').hidden=true;
 $('publishAccount').textContent=ready?'Conta autenticada · somente o responsável pode publicar':'';
}
async function config(){
 if(cfg)return cfg;
 const r=await fetch('/api/public-config',{cache:'no-store'});
 if(!r.ok)throw Error('Configuração da publicação indisponível');
 cfg=await r.json();
 if(!cfg.configured)throw Error('Banco de dados de prévias não configurado');
 return cfg;
}
async function api(endpoint,payload,method='POST',token=null){
 const c=await config();
 const headers={'Content-Type':'application/json',apikey:c.publishableKey};
 if(token)headers.Authorization='Bearer '+token;
 const r=await fetch(c.supabaseUrl+endpoint,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)});
 const content=await r.text();let j;try{j=JSON.parse(content)}catch{j={message:content}};
 if(!r.ok)throw Error(j.msg||j.error_description||j.message||j.error||('Erro HTTP '+r.status));
 return j;
}
async function activeUser(){
 if(!session?.access_token)return null;
 try{
  const c=await config();
  const r=await fetch(c.supabaseUrl+'/auth/v1/user',{headers:{apikey:c.publishableKey,Authorization:'Bearer '+session.access_token}});
  if(r.ok)return await r.json();
  if(session.refresh_token){
   const newSession=await api('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});
   saveSession(newSession);
   const next=await fetch(c.supabaseUrl+'/auth/v1/user',{headers:{apikey:c.publishableKey,Authorization:'Bearer '+session.access_token}});
   if(next.ok)return await next.json();
  }
 }catch(e){status(e.message)}
 saveSession(null);return null;
}
async function openPublish(){
 if(!engine.getCurrent()){alert('Abra uma das propostas no editor antes de publicar');return}
 $('publishOverlay').hidden=false;document.body.style.overflow='hidden';
 status('Verificando acesso seguro…');
 const user=await activeUser();showAuth(!!user);
 if(user)status('Pronto para publicar uma demonstração.');
 else status('Entre com sua conta autorizada para publicar. A chave de acesso nunca fica no site do cliente.');
}
$('publishPreview').addEventListener('click',openPublish);
$('closePublish').onclick=()=>{$('publishOverlay').hidden=true;status('')};
async function login(){
 const email=$('pubEmail').value.trim(),password=$('pubPass').value;
 if(!email||!password){status('Digite o e-mail e a senha do seu acesso.');return}
 status('Conferindo o acesso…');$('pubLogin').disabled=true;
 try{
  const result=await api('/auth/v1/token?grant_type=password',{email,password});
  saveSession(result);
  const user=await activeUser();
  if(!user)throw Error('Não foi possível verificar a conta');
  showAuth(true);status('Acesso confirmado. Revise os dados e clique em Publicar link individual.');
 }catch(e){status('Não foi possível entrar: '+e.message)}
 finally{$('pubLogin').disabled=false}
}
$('pubLogin').onclick=login;
$('pubEmailLink').onclick=async()=>{
 const email=$('pubEmail').value.trim();if(!email){status('Informe seu e-mail cadastrado.');return}
 const current=engine.getCurrent();
 if(current){try{localStorage.setItem('prospect_pending_publish',JSON.stringify(current))}catch{}}
 status('Solicitando link de acesso por e-mail…');
 try{
  await api('/auth/v1/otp?redirect_to='+encodeURIComponent(location.origin+'/studio'),{email,create_user:false});
  $('otpGroup').hidden=false;
  status('Confira o e-mail. Se receber um código, digite abaixo. Se receber um link, abra-o no mesmo navegador. Pode ser necessário configurar a URL de redirecionamento no Supabase.');
 }catch(e){status('E-mail não enviado: '+e.message)}
};
$('verifyOtp').onclick=async()=>{
 const email=$('pubEmail').value.trim(),token=$('pubOtp').value.trim();
 if(!email||token.length<6){status('Informe e-mail e código válido.');return}
 try{
  const result=await api('/auth/v1/verify',{email,token,type:'email'});
  if(!result.access_token)throw Error('Resposta sem sessão');
  saveSession(result);showAuth(true);status('Código aceito. Pode publicar a prévia.');
 }catch(e){status('Não foi possível verificar o código: '+e.message)}
};
$('pubLogout').onclick=()=>{saveSession(null);showAuth(false);status('Sessão encerrada.');};
function makeSlug(name){const base=String(name||'empresa').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,63)||'empresa';const rand=Math.random().toString(36).slice(2,8);return base+'-'+rand}
async function markLead(data,fields){
 const id=data?.leadId;if(!id)return;
 // The owner should see the preview immediately in the browser he used to build it.
 try{
  const leads=JSON.parse(localStorage.getItem('prospect_pro_leads')||'[]');
  if(Array.isArray(leads)){
   const l=leads.find(x=>x.id===id);
   if(l){if(fields.preview_slug)l.previewSlug=fields.preview_slug;
    if(fields.stage)l.stage=fields.stage;
    if(fields.message_opened_at)l.messageOpenedAt=fields.message_opened_at;
    l.updatedAt=new Date().toISOString();
    localStorage.setItem('prospect_pro_leads',JSON.stringify(leads));
   }
  }
 }catch{}
 const user=await activeUser();if(!user)return;
 const c=await config();
 const r=await fetch(c.supabaseUrl+'/rest/v1/prospect_crm_leads?id=eq.'+encodeURIComponent(id)+'&owner_id=eq.'+encodeURIComponent(user.id),{
  method:'PATCH',headers:{'Content-Type':'application/json',apikey:c.publishableKey,Authorization:'Bearer '+session.access_token,Prefer:'return=representation'},
  body:JSON.stringify({...fields,updated_at:new Date().toISOString()})
 });
 if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.message||'Não foi possível vincular o lead ao site')}
 // No record could mean that the lead was not saved to the cloud yet.
 const rows=await r.json();if(!Array.isArray(rows)||!rows.length)throw Error('Site publicado; este lead ainda não consta na nuvem. Abra Oportunidades e confirme o cadastro para sincronizar.');
}
function businessMsg(p,link){
 return 'Olá! Tudo bem? Sou do Portal Central IA. Preparei uma proposta demonstrativa de site para '+p.name+' e gostaria de apresentar uma ideia que pode ajudar na presença digital da empresa.\n\nAqui está a prévia: '+link+'\n\nPosso explicar como funcionaria? Sem compromisso. Se não for do seu interesse, basta me avisar.';
}
async function publish(){
 const user=await activeUser();
 if(!user){showAuth(false);status('Sua sessão expirou. Entre novamente.');return}
 const current=engine.getCurrent();if(!current){status('Nenhum site selecionado');return}
 const {data,template}=current;
 const html=engine.buildSite(data,template);
 const slug=data.publicSlug||makeSlug(data.name);
 const payload={owner_id:user.id,slug,business_name:String(data.name||'Empresa').slice(0,120),business_category:String(data.industry||'').slice(0,120),city:String(data.city||'').slice(0,120),description:String(data.summary||'').slice(0,300),cover_image:String(data.photo||'').slice(0,1000),template_id:String(template.id||'').slice(0,120),variant:String(data.variant||'0'),design:{templateId:template.id,name:data.name,industry:data.industry,city:data.city,color:data.color,variant:data.variant},html,status:'published',published_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 $('confirmPublish').disabled=true;status('Salvando e publicando a prévia…');
 try{
  let rows;
  if(data.publishedId){
   const c=await config();
   const r=await fetch(c.supabaseUrl+'/rest/v1/prospect_site_previews?id=eq.'+encodeURIComponent(data.publishedId)+'&select=id,slug',{
     method:'PATCH',headers:{'Content-Type':'application/json',apikey:c.publishableKey,Authorization:'Bearer '+session.access_token,Prefer:'return=representation'},body:JSON.stringify(payload)
   });
   const j=await r.json();if(!r.ok||!Array.isArray(j)||!j.length)throw Error(j.message||'A atualização não foi autorizada');
   rows=j;
  }else{
   const c=await config();
   const r=await fetch(c.supabaseUrl+'/rest/v1/prospect_site_previews?select=id,slug',{
     method:'POST',headers:{'Content-Type':'application/json',apikey:c.publishableKey,Authorization:'Bearer '+session.access_token,Prefer:'return=representation'},body:JSON.stringify(payload)
   });
   const j=await r.json();if(!r.ok)throw Error(j.message||j.error||('Falha HTTP '+r.status));rows=j;
  }
  const row=rows[0];if(!row?.id)throw Error('Não foi possível confirmar o registro');
  engine.updatePublished(row.id,row.slug);
  $('saveProject').click();
  try{await markLead(data,{preview_slug:row.slug,stage:'Site criado'})}catch(e){status('Site publicado; vínculo com oportunidade pendente: '+e.message)}
  const link=location.origin+'/mvp/'+row.slug;lastPublic={link,data};
  $('publicLink').value=link;$('publicMessage').value=businessMsg(data,link);
  $('publishAuth').hidden=true;$('publishReady').hidden=true;$('publishResult').hidden=false;
  status('Prévia salva no servidor. O link pode ser acessado publicamente.');
 }catch(e){status('Falha ao publicar: '+e.message)}
 finally{$('confirmPublish').disabled=false}
}
$('confirmPublish').onclick=publish;
$('copyPublicLink').onclick=async()=>{try{await navigator.clipboard.writeText($('publicLink').value);status('Link copiado')}catch{status('Selecione o link para copiar')}};
$('openPublicLink').onclick=()=>{if(lastPublic)window.open(lastPublic.link,'_blank','noopener')};
$('copyPublicMessage').onclick=async()=>{try{await navigator.clipboard.writeText($('publicMessage').value);status('Mensagem copiada')}catch{status('Selecione a mensagem para copiar')}};
$('openBusinessWhatsapp').onclick=()=>{
 if(!lastPublic)return;
 let number=String(lastPublic.data.phone||'').replace(/\D/g,'');
 if(number.length===10||number.length===11)number='55'+number;
 if(!/^55\d{10,11}$/.test(number)){status('Informe um WhatsApp com DDD no editor. Sem número válido não é possível abrir uma conversa.');return}
 const message=$('publicMessage').value.trim();
 window.open('https://wa.me/'+number+'?text='+encodeURIComponent(message),'_blank','noopener');
 markLead(lastPublic.data,{stage:'Proposta pronta',message_opened_at:new Date().toISOString()}).catch(e=>status('WhatsApp aberto. Não foi possível sincronizar o estado: '+e.message));
 status('WhatsApp aberto: clique em Enviar e depois confirme o envio na aba Oportunidades.');
};
// If the email link returns with a session, restore the working draft in this browser.
(function restoreEmailLogin(){
 if(location.hash.includes('access_token=')){
  const h=new URLSearchParams(location.hash.slice(1));
  if(h.get('access_token')){
   saveSession({access_token:h.get('access_token'),refresh_token:h.get('refresh_token')||''});
   history.replaceState(null,'',location.pathname+location.search);
  }
 }
 let pending;try{pending=JSON.parse(localStorage.getItem('prospect_pending_publish')||'null')}catch{}
 if(pending&&location.pathname.startsWith('/studio')&&session?.access_token){
  localStorage.removeItem('prospect_pending_publish');
  if(pending.template&&pending.data)engine.start(pending.template.id,{...pending.data,templateSnapshot:pending.template});
 }
})();
})();
