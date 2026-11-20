(function () {
'use strict';

const $ = id => document.getElementById(id);
const engine = window.PortalSiteStudio;
const dialog = $('publishOverlay');
const authKey = 'prospect_publisher_session_v1';
const leadKey = 'prospect_pro_leads';
const leadFields = 'id,opted_out,proposal_sent_at,message_opened_at,stage';
let configCache;
let session;
let userCheck;
let lastPublic;
let draftSlug;
let publishing = false;
let accountMode = false;
try { session = JSON.parse(sessionStorage.getItem(authKey) || 'null'); } catch {}

function status(message) {
 $('publishStatus').textContent = message;
}

function saveSession(value) {
 session = value;
 if (value) sessionStorage.setItem(authKey, JSON.stringify(value));
 else sessionStorage.removeItem(authKey);
 reflectAccountButton();
 window.PortalProjectStore?.refresh();
}

function reflectAccountButton() {
 $('manageProjectAccount').textContent = session?.access_token ? 'Minha conta' : 'Entrar na conta';
}
reflectAccountButton();

function showPanel(panel) {
 for (const [state, id] of [['auth', 'publishAuth'], ['ready', 'publishReady'], ['result', 'publishResult']]) {
  $(id).hidden = state !== panel;
 }
}

async function config() {
 if (configCache) return configCache;
 const response = await fetch('/api/public-config', { cache: 'no-store' });
 if (!response.ok) throw Error('Configuração da publicação indisponível.');
 const data = await response.json();
 if (!data.configured) throw Error('Publicação indisponível. A conexão com o banco precisa ser configurada.');
 configCache = data;
 return configCache;
}

async function request(endpoint, { method = 'GET', body, token, returning } = {}) {
 const { supabaseUrl, publishableKey } = await config();
 const headers = { apikey: publishableKey };
 if (body !== undefined) headers['Content-Type'] = 'application/json';
 if (token) headers.Authorization = 'Bearer ' + token;
 if (returning) headers.Prefer = 'return=representation';
 const response = await fetch(supabaseUrl + endpoint, {
  method,
  headers,
  body: body === undefined ? undefined : JSON.stringify(body)
 });
 const data = await response.json().catch(() => null);
 if (!response.ok) {
  const message = data?.msg || data?.error_description || data?.message || data?.error || 'Falha HTTP ' + response.status;
  const error = new Error(message);
  error.status = response.status;
  throw error;
 }
 return data;
}

async function verifyUser() {
 if (!session?.access_token) return null;
 const url = '/auth/v1/user';
 try {
  return await request(url, { token: session.access_token });
 } catch (error) {
  if (![401, 403].includes(error.status)) throw error;
 }
 if (!session.refresh_token) {
  saveSession(null);
  return null;
 }
 try {
  const renewed = await request('/auth/v1/token?grant_type=refresh_token', {
   method: 'POST',
   body: { refresh_token: session.refresh_token }
  });
  if (!renewed?.access_token) throw Error('O serviço de login retornou uma sessão inválida.');
  saveSession(renewed);
  return await request(url, { token: renewed.access_token });
 } catch (error) {
  if (![400, 401, 403].includes(error.status)) throw error;
  saveSession(null);
  return null;
 }
}

function activeUser() {
 userCheck ||= verifyUser().finally(() => { userCheck = null; });
 return userCheck;
}

function showReady(user) {
 if (!dialog.open) return;
 showPanel('ready');
 $('publishAccount').textContent = user.email ? 'Conectado como ' + user.email : 'Conta autorizada.';
 if (accountMode) {
  $('closePublish').focus();
  return;
 }
 $('confirmPublish').textContent = engine.getCurrent()?.data.publicSlug ? 'Atualizar link publicado' : 'Publicar link';
 $('confirmPublish').focus();
}

async function openAccountOrPublish(openAccount) {
 if (!openAccount && !engine.getCurrent()) return;
 accountMode = openAccount;
 $('publishTitle').textContent = accountMode ? 'Conta dos projetos' : 'Publicar demonstração';
 $('publishAuthCopy').textContent = accountMode
  ? 'Entre com a sua conta do Portal Central IA para acessar seus projetos e versões na nuvem.'
  : 'Entre com a sua conta do Portal Central IA para criar um link público para esta demonstração.';
 $('publishReviewCopy').textContent = accountMode
  ? 'Os projetos sincronizados com esta conta ficam disponíveis nos seus dispositivos.'
  : 'Revise o conteúdo, a imagem e o telefone. Qualquer pessoa com o link poderá ver a demonstração.';
 $('confirmPublish').hidden = accountMode;
 lastPublic = null;
 showPanel('');
 status('Verificando acesso…');
 dialog.showModal();
 try {
  const user = await activeUser();
  if (!dialog.open) return;
  if (user) {
   showReady(user);
   status('');
  } else {
   showPanel('auth');
   status('');
   $('pubEmail').focus();
  }
 } catch (error) {
  if (!dialog.open) return;
  showPanel('auth');
  status(error.message);
 }
}

$('publishPreview').onclick = () => openAccountOrPublish(false);
$('manageProjectAccount').onclick = () => openAccountOrPublish(true);
$('closePublish').onclick = () => {
 if (!publishing) dialog.close();
};
dialog.addEventListener('cancel', event => {
 if (publishing) event.preventDefault();
});
$('editorOverlay').addEventListener('close', () => {
 draftSlug = null;
 lastPublic = null;
});

$('publishLoginForm').onsubmit = async event => {
 event.preventDefault();
 const email = $('pubEmail').value.trim();
 const password = $('pubPass').value;
 const button = $('pubLogin');
 button.disabled = true;
 status('Conferindo o acesso…');
 try {
  const result = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  if (!result?.access_token) throw Error('Login sem sessão.');
  saveSession(result);
  $('pubPass').value = '';
  const user = await activeUser();
  if (!user) throw Error('Não foi possível verificar a conta.');
  showReady(user);
  status('');
 } catch (error) {
  status('Não foi possível entrar. ' + error.message);
 } finally {
  button.disabled = false;
 }
};

$('pubEmailLink').onclick = async () => {
 const email = $('pubEmail');
 if (!email.reportValidity()) return;
 const button = $('pubEmailLink');
 button.disabled = true;
 status('Solicitando link por e-mail…');
 try {
  const current = accountMode ? null : engine.getCurrent();
  const redirect = encodeURIComponent(location.origin + (accountMode ? '/studio?view=projects' : '/studio'));
  await request('/auth/v1/otp?redirect_to=' + redirect, {
   method: 'POST',
   body: { email: email.value.trim(), create_user: false }
  });
  if (current) {
   const saved = engine.save();
   try {
    sessionStorage.setItem('prospect_pending_publish', JSON.stringify(engine.getCurrent() || current));
   } catch {}
   status(saved
    ? 'Link solicitado. Se ele abrir em outra aba, encontre seu rascunho em Meus projetos.'
    : 'Link solicitado. Use o código recebido ou abra o link nesta aba para recuperar seus ajustes.');
  } else {
   status('Abra o link recebido para acessar seus projetos ou digite o código abaixo.');
  }
  $('otpGroup').hidden = false;
 } catch (error) {
  status('Não foi possível solicitar o link. ' + error.message);
 } finally {
  button.disabled = false;
 }
};

$('verifyOtp').onclick = async () => {
 const email = $('pubEmail');
 const token = $('pubOtp').value.trim();
 if (!email.reportValidity()) return;
 if (!/^\d{6,8}$/.test(token)) {
  status('Informe o código recebido por e-mail.');
  return;
 }
 const button = $('verifyOtp');
 button.disabled = true;
 try {
  const result = await request('/auth/v1/verify', {
   method: 'POST',
   body: { email: email.value.trim(), token, type: 'email' }
  });
  if (!result?.access_token) throw Error('Código sem sessão.');
  saveSession(result);
  sessionStorage.removeItem('prospect_pending_publish');
  const user = await activeUser();
  if (!user) throw Error('Não foi possível verificar a conta.');
  showReady(user);
  status('');
 } catch (error) {
  status('Não foi possível verificar o código. ' + error.message);
 } finally {
  button.disabled = false;
 }
};

$('pubLogout').onclick = () => {
 saveSession(null);
 showPanel('auth');
 status('Sessão encerrada.');
 $('pubEmail').focus();
};

function makeSlug(name) {
 const base = String(name || 'empresa').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 63).replace(/^-+|-+$/g, '') || 'empresa';
 const code = Array.from(crypto.getRandomValues(new Uint8Array(4)), value => value.toString(16).padStart(2, '0')).join('');
 return base + '-' + code;
}

function safePhoto(value) {
 try {
  const url = new URL(value);
  if (url.protocol === 'https:' && !url.username && !url.password && url.href.length <= 1000) {
   return url.href.replace(/["'<>\\()]/g, character => encodeURIComponent(character));
  }
 } catch {}
 return '';
}

function localLead(id) {
 try {
  const leads = JSON.parse(localStorage.getItem(leadKey) || '[]');
  return leads.find(lead => lead.id === id);
 } catch {
  return null;
 }
}

function localLeadUpdate(id, fields) {
 try {
  const leads = JSON.parse(localStorage.getItem(leadKey) || '[]');
  const lead = leads.find(item => item.id === id);
  if (!lead) return;
  if (fields.preview_slug) lead.previewSlug = fields.preview_slug;
  if (fields.stage) lead.stage = fields.stage;
  if (fields.message_opened_at) lead.messageOpenedAt = fields.message_opened_at;
  lead.updatedAt = fields.updated_at;
  localStorage.setItem(leadKey, JSON.stringify(leads));
 } catch {}
}

function leadEndpoint(id, user) {
 return '/rest/v1/prospect_crm_leads?id=eq.' + encodeURIComponent(id) + '&owner_id=eq.' + encodeURIComponent(user.id);
}

async function checkLead(id, user) {
 if (!id) return {};
 const local = localLead(id);
 const rows = await request(leadEndpoint(id, user) + '&select=' + leadFields + '&limit=1', { token: session.access_token });
 const cloud = rows?.[0];
 return {
  cloud: Boolean(cloud),
  known: Boolean(cloud || local),
  optedOut: Boolean(cloud?.opted_out || local?.optedOut || cloud?.stage === 'Não contatar' || local?.stage === 'Não contatar'),
  proposalSentAt: cloud?.proposal_sent_at || local?.proposalSentAt,
  messageOpenedAt: cloud?.message_opened_at || local?.messageOpenedAt,
  stage: cloud?.stage || local?.stage
 };
}

async function markLead(id, user, lead, fields) {
 if (!id) return;
 const endpoint = leadEndpoint(id, user);
 const data = { ...fields, updated_at: new Date().toISOString() };
 localLeadUpdate(id, data);
 if (!lead.cloud) throw Error('A oportunidade ainda não está sincronizada com a sua conta.');
 const rows = await request(endpoint, {
  method: 'PATCH', body: data, token: session.access_token, returning: true
 });
 if (!rows?.length) throw Error('O registro da oportunidade não foi atualizado.');
}

function businessMessage(data, link) {
 return 'Olá! Sou do Portal Central IA. Preparei uma demonstração de site para ' + data.name +
  ' e gostaria de apresentar a proposta.\n\nVocê pode abrir o site aqui: ' + link +
  '\n\nSe fizer sentido para vocês, posso explicar como seria a versão final. Se preferirem não receber outros contatos, é só me avisar.';
}

function contactNumber(value) {
 const number = String(value || '').replace(/\D/g, '');
 if (/^[1-9]\d{9,10}$/.test(number)) return '55' + number;
 return /^55[1-9]\d{9,10}$/.test(number) ? number : '';
}

function reflectContact() {
 const item = lastPublic;
 const control = $('openBusinessWhatsapp');
 const duplicate = Boolean(item?.lead?.proposalSentAt || item?.lead?.messageOpenedAt);
 const permitted = item && !item.checking && (!item.data.leadId || item.lead?.known) && !item.lead?.optedOut;
 const number = contactNumber(item?.data.phone);
 $('publishDuplicate').hidden = !permitted || !number || !duplicate;
 control.disabled = !permitted || !number || (duplicate && !$('publishRepeat').checked);
 $('copyPublicMessage').disabled = !permitted;
 const message = item?.checking ? 'Verificando o histórico de contato…'
  : !permitted ? item?.lead?.optedOut
    ? 'Esta empresa foi marcada para não receber novas propostas.'
    : 'O estado desta oportunidade não pôde ser verificado. Consulte Oportunidades.'
  : !number ? 'Adicione um WhatsApp com DDD no editor para abrir a conversa.'
  : duplicate ? 'Já existe um registro de contato para esta empresa. Confira o histórico antes de preparar outra mensagem.'
  : 'Revise o texto. Após enviar pelo WhatsApp, confirme o envio em Oportunidades.';
 $('publishContactStatus').textContent = message;
}

async function writePreview(payload, user, publishingId, retry) {
 const base = '/rest/v1/prospect_site_previews';
 const selection = 'select=id,slug';
 const owner = '&owner_id=eq.' + encodeURIComponent(user.id);
 const token = session.access_token;
 let id = publishingId;
 if (!id && retry) {
  const existing = await request(base + '?slug=eq.' + encodeURIComponent(payload.slug) + owner + '&' + selection, { token });
  id = existing?.[0]?.id;
 }
 const query = id ? 'id=eq.' + encodeURIComponent(id) + owner + '&' + selection : selection;
 const rows = await request(base + '?' + query, {
  method: id ? 'PATCH' : 'POST', body: payload, token, returning: true
 });
 const row = rows?.[0];
 if (!row?.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)) throw Error('O serviço não confirmou o link publicado.');
 return row;
}

async function publish() {
 if (publishing || accountMode) return;
 const current = engine.getCurrent();
 if (!current) return;
 const { data, template } = current;
 const name = String(data.name || '').trim();
 if (name.length < 2) {
  status('Informe o nome da empresa no editor antes de publicar.');
  return;
 }
 publishing = true;
 $('confirmPublish').disabled = true;
 $('closePublish').disabled = true;
 $('pubLogout').disabled = true;
 status('Publicando a demonstração…');
 try {
  const user = await activeUser();
  if (!user) {
   showPanel('auth');
   status('Sua sessão expirou. Entre novamente.');
   return;
  }
  const retry = Boolean(draftSlug || data.publicSlug);
  draftSlug ||= data.publicSlug || makeSlug(name);
  const timestamp = new Date().toISOString();
  const payload = {
   owner_id: user.id,
   slug: draftSlug,
   business_name: name.slice(0, 120),
   business_category: String(data.industry || '').slice(0, 120),
   city: String(data.city || '').slice(0, 120),
   description: String(data.summary || '').slice(0, 300),
   cover_image: safePhoto(data.photo) || safePhoto(template.photo),
   template_id: String(template.id || '').slice(0, 120),
   variant: String(data.variant || '0'),
   design: { templateId: template.id, color: data.color, variant: data.variant },
   html: engine.buildSite(data, template),
   status: 'published',
   published_at: timestamp,
   updated_at: timestamp
  };
  const row = await writePreview(payload, user, data.publishedId, retry);
  engine.updatePublished(row.id, row.slug);
  const saved = engine.save();
  const link = location.origin + '/mvp/' + encodeURIComponent(row.slug);
  const result = lastPublic = { link, data: { ...data, name }, user, checking: Boolean(data.leadId) };
  $('publicLink').value = link;
  $('publicMessage').value = businessMessage(result.data, link);
  $('publishRepeat').checked = false;
  $('reviewOpportunity').hidden = !data.leadId;
  showPanel('result');
  reflectContact();
  $('publicLink').focus();
  const notes = saved ? [] : ['Não foi possível salvar o projeto neste navegador.'];
  status(notes.join(' '));
  if (data.leadId) {
   try {
    result.lead = await checkLead(data.leadId, user);
    const fields = { preview_slug: row.slug };
    if (!result.lead.proposalSentAt && !result.lead.optedOut &&
     (!result.lead.stage || ['Novo', 'Em análise'].includes(result.lead.stage))) fields.stage = 'Site criado';
    await markLead(data.leadId, user, result.lead, fields);
   } catch {
    notes.push('O link está disponível. O vínculo com a oportunidade está pendente.');
   }
   result.checking = false;
   if (lastPublic === result) {
    reflectContact();
    status(notes.join(' '));
   }
  }
 } catch (error) {
  status('Falha ao publicar. ' + error.message);
 } finally {
  publishing = false;
  $('confirmPublish').disabled = false;
  $('closePublish').disabled = false;
  $('pubLogout').disabled = false;
 }
}

$('confirmPublish').onclick = publish;

async function copy(field, message) {
 try {
  await navigator.clipboard.writeText($(field).value);
  status(message);
 } catch {
  $(field).focus();
  $(field).select();
  status('Use o comando Copiar do navegador.');
 }
}

$('copyPublicLink').onclick = () => copy('publicLink', 'Link copiado.');
$('openPublicLink').onclick = () => {
 if (lastPublic) window.open(lastPublic.link, '_blank', 'noopener');
};
$('copyPublicMessage').onclick = () => copy('publicMessage', 'Mensagem copiada.');
$('publishRepeat').onchange = reflectContact;
$('openBusinessWhatsapp').onclick = () => {
 const item = lastPublic;
 if (!item || $('openBusinessWhatsapp').disabled) return;
 const message = $('publicMessage').value.trim();
 if (!message) {
  status('Escreva uma mensagem para a empresa.');
  $('publicMessage').focus();
  return;
 }
 const number = contactNumber(item.data.phone);
 if (!number) return;
 window.open('https://wa.me/' + number + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
 status('WhatsApp aberto. Após enviar a mensagem, confirme o envio em Oportunidades.');
 if (!item.data.leadId) return;
 const fields = { message_opened_at: new Date().toISOString() };
 if (!item.lead.proposalSentAt && (!item.lead.stage || ['Novo', 'Em análise', 'Site criado'].includes(item.lead.stage))) {
  fields.stage = 'Proposta pronta';
 }
 item.lead.messageOpenedAt = fields.message_opened_at;
 $('publishRepeat').checked = false;
 reflectContact();
 markLead(item.data.leadId, item.user, item.lead, fields).catch(() => {
  if (lastPublic === item) status('WhatsApp aberto. O registro ainda não foi sincronizado em Oportunidades.');
 });
};

(function restoreEmailLogin() {
 const hash = new URLSearchParams(location.hash.slice(1));
 const accessToken = hash.get('access_token');
 if (!accessToken) return;
 saveSession({ access_token: accessToken, refresh_token: hash.get('refresh_token') || '' });
 history.replaceState(null, '', location.pathname + location.search);
 let raw;
 try {
  raw = sessionStorage.getItem('prospect_pending_publish') || localStorage.getItem('prospect_pending_publish');
  sessionStorage.removeItem('prospect_pending_publish');
  localStorage.removeItem('prospect_pending_publish');
 } catch {}
 if (!raw || !location.pathname.startsWith('/studio')) return;
 try {
  const { data, template } = JSON.parse(raw);
  if (data && template) engine.start(template.id, { ...data, templateSnapshot: template });
 } catch {}
})();

})();
