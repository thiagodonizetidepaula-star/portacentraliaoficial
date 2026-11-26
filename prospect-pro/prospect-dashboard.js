const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const stages = [
  'Novo', 'Em análise', 'Site criado', 'Proposta pronta', 'Proposta enviada',
  'Respondeu', 'Contatado', 'Em negociação', 'Fechado', 'Arquivado', 'Não contatar'
];
const screenDetails = {
  dashboard: ['Visão geral', 'Acompanhe suas oportunidades e prepare a próxima proposta.'],
  search: ['Prospecção', 'Encontre empresas por segmento e região.'],
  leads: ['Oportunidades', 'Revise os dados das empresas, crie sites e acompanhe os contatos.'],
  sent: ['Propostas enviadas', 'Consulte as propostas cujo envio você confirmou.'],
  pipeline: ['Funil comercial', 'Veja em que etapa está cada negociação.'],
  settings: ['Configurações', 'Gerencie a busca e a mensagem comercial.']
};
const leadsKey = 'prospect_pro_leads';
const templateKey = 'prospect_pro_template';
const sessionKey = 'prospect_publisher_session_v1';
const defaultTemplate = $('#tpl').value;
let leads = readList(leadsKey);
let proposalMetrics = null;
let cloudProjectIds = null;
let savedSearchIds = [];
const sessionSearchIds = new Set();
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
let currentScreen;
let onConfirm;
let modalOpener;

function readList(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(stored)) return stored.filter(row => row && typeof row === 'object');
  } catch {}
  return [];
}

function readTemplate() {
  try { return localStorage.getItem(templateKey) || defaultTemplate; }
  catch { return defaultTemplate; }
}

function formatProposalMessage(lead, link) {
  const template = readTemplate();
  const message = template.replace(/\{empresa\}|\{link\}/g, field => field === '{empresa}' ? lead.name : link);
  return template.includes('{link}') ? message : message + '\n\n' + link;
}

function save() {
  try { localStorage.setItem(leadsKey, JSON.stringify(leads)); }
  catch { /* Keep the current view usable if browser storage is unavailable. */ }
  render();
}

function screenFromURL() {
  return new URLSearchParams(location.search).get('view') || 'dashboard';
}

function screenHref(name) {
  return name === 'dashboard' ? '/' : '/?view=' + encodeURIComponent(name);
}

function setMenuOpen(open) {
  $('#workspaceMenu').classList.toggle('is-open', open);
  $('#menuToggle').setAttribute('aria-expanded', String(open));
}

function page(name, { push = true, focus = true } = {}) {
  const screen = Object.hasOwn(screenDetails, name) ? name : 'dashboard';
  if (push && screen !== currentScreen) history.pushState(null, '', screenHref(screen));
  currentScreen = screen;

  $$('[data-screen]').forEach(section => section.classList.toggle('hidden', section.id !== screen));
  $$('[data-page]').forEach(link => {
    const active = link.dataset.page === screen;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const [heading, intro] = screenDetails[screen];
  $('#title').textContent = heading;
  $('#subtitle').textContent = intro;
  $('#headerAction').classList.toggle('hidden', screen !== 'dashboard');
  document.title = heading + ' | Portal Prospect PRO';
  setMenuOpen(false);
  render();
  if (screen === 'dashboard') void window.PortalCRM?.refreshMetrics();
  if (focus) {
    window.scrollTo(0, 0);
    $('#title').focus({ preventScroll: true });
  }
}

function progressRow(label, count, total) {
  const width = count / Math.max(1, total) * 100;
  return `<div>
    <div class="flex"><span>${esc(label)}</span><strong>${count}</strong></div>
    <div class="track" aria-hidden="true"><div class="fill" style="width:${width}%"></div></div>
  </div>`;
}

function hasPrivateProposal(id) {
  return Boolean(proposalMetrics?.some(item => String(item.lead_id) === String(id)));
}

function activePrivateProposal(id) {
  const now = Date.now();
  // The server returns the newest proposals first.
  return proposalMetrics?.find(item => String(item.lead_id) === String(id)
    && !item.revoked_at && !item.refused_at && Date.parse(item.expires_at) > now);
}

function contactRefused(lead) {
  return Boolean(lead.privateProposalRefusedAt
    || proposalMetrics?.some(item => item.refused_at && String(item.lead_id) === String(lead.id)));
}

function contactBlocked(lead) {
  return !lead || lead.optedOut || lead.archivedAt || ['Não contatar', 'Arquivado'].includes(lead.stage) || contactRefused(lead);
}

function renderOverview() {
  const noWebsite = leads.filter(lead => !window.ProspectLinks.hasWebsite(lead)).length;
  const sentLeads = leads.filter(lead => lead.proposalSentAt);
  const wonLeads = leads.filter(lead => lead.stage === 'Fechado');
  const projects = new Set([
    ...(cloudProjectIds || []),
    ...readList('prospect_library_projects').map(project => project.id).filter(Boolean)
  ]);
  const found = new Set([...savedSearchIds, ...sessionSearchIds]);
  const now = Date.now();
  const countProposals = predicate => proposalMetrics?.filter(predicate).length ?? '—';
  const interested = proposalMetrics && new Set(proposalMetrics.filter(item => item.interested_at && !item.refused_at)
    .map(item => item.lead_id)).size;
  const conversion = sentLeads.length ? percent.format(sentLeads.filter(lead => lead.stage === 'Fechado').length / sentLeads.length) : '—';
  const metrics = [
    [found.size, 'Empresas encontradas', 'search', 'Resultados únicos desta sessão e das últimas 30 buscas salvas.'],
    [projects.size, 'Sites criados', '/studio?view=projects', cloudProjectIds ? 'Projetos salvos no Studio.' : 'Projetos salvos neste navegador.'],
    [sentLeads.length, 'Propostas enviadas', 'sent', 'Envios confirmados no CRM, um por empresa.'],
    [countProposals(item => item.viewed_at), 'Propostas visualizadas', null, 'Links privados abertos ao menos uma vez.'],
    [interested ?? '—', 'Clientes interessados', null, 'Empresas que escolheram prosseguir.'],
    [countProposals(item => item.refused_at), 'Propostas recusadas', null, 'Recusas registradas pelo link privado.'],
    [countProposals(item => !item.refused_at && !item.revoked_at && Date.parse(item.expires_at) <= now), 'Propostas expiradas', null, 'Links privados que chegaram ao fim da validade.'],
    [wonLeads.length, 'Vendas realizadas', 'pipeline', 'Empresas na etapa Fechado.'],
    [conversion, 'Taxa de conversão', null, 'Empresas fechadas entre as que receberam uma proposta.']
  ];
  $('#stats').innerHTML = metrics.map(([count, label, target, description]) => {
    const content = `<span>${label}</span><strong>${count}</strong><small>${description}</small>`;
    if (!target) return `<div class="stat-card">${content}</div>`;
    if (target.startsWith('/')) return `<a class="stat-card" href="${target}">${content}</a>`;
    return `<a class="stat-card" href="${screenHref(target)}" data-go="${target}">${content}</a>`;
  }).join('');
  $('#radar').innerHTML = progressRow('Sem site informado', noWebsite, leads.length)
    + progressRow('Com site informado', leads.length - noWebsite, leads.length);

  const stageCounts = new Map(stages.map(stage => [stage, 0]));
  for (const lead of leads) {
    if (stageCounts.has(lead.stage)) stageCounts.set(lead.stage, stageCounts.get(lead.stage) + 1);
  }
  const stagesWithLeads = [...stageCounts].filter(([, count]) => count > 0);
  $('#overview').innerHTML = stagesWithLeads.length
    ? stagesWithLeads.map(([stage, count]) => progressRow(stage, count, leads.length)).join('')
    : '<p>Nenhuma empresa no funil.</p>';
  $('#fullFunnel').innerHTML = [...stageCounts].map(([stage, count]) => progressRow(stage, count, leads.length)).join('');
  const recent = [...leads].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 5);
  $('#recent').innerHTML = recent.map(lead => `<tr>
    <td>${esc(lead.name)}</td><td>${websiteTag(lead)}</td><td>${esc(lead.stage || 'Novo')}</td>
  </tr>`).join('') || '<tr><td colspan="3" class="empty">Nenhuma empresa cadastrada.</td></tr>';
}

function websiteTag(lead) {
  if (window.ProspectLinks.whatsappLinkNumber(lead.website)) return '<span class="tag no">Apenas WhatsApp</span>';
  const social=window.ProspectSocial.profile(lead.website);
  if (social) return '<span class="tag no">Apenas '+social.label+'</span>';
  return window.ProspectLinks.hasWebsite(lead) ? '<span class="tag yes">Com site</span>' : '<span class="tag no">Não informado</span>';
}

function leadMatches(lead, filter) {
  if (filter === 'all') return true;
  if (filter === 'archived') return lead.stage === 'Arquivado';
  if (filter === 'sent') return !!lead.proposalSentAt;
  if (lead.stage === 'Arquivado') return false;
  if (filter === 'no') return !window.ProspectLinks.hasWebsite(lead);
  if (filter === 'yes') return window.ProspectLinks.hasWebsite(lead);
  return !lead.proposalSentAt && !lead.optedOut && lead.stage !== 'Não contatar';
}

function publishedSlugs() {
  const local = new Map();
  for (const project of readList('prospect_library_projects')) {
    if (project.leadId && project.publicSlug) local.set(String(project.leadId), project.publicShareSlug || project.publicSlug);
  }
  return local;
}

function renderLeadRows() {
  const filter = $('#filter').value;
  const localSlugs = publishedSlugs();
  const list = leads.filter(lead => leadMatches(lead, filter));
  $('#leadRows').innerHTML = list.map(lead => {
    const id = esc(lead.id);
    const name = esc(lead.name);
    const previewUrl = window.ProspectLinks.previewUrl(lead.previewSlug || localSlugs.get(String(lead.id)));
    const refusalRecorded = contactRefused(lead);
    const editableStages = refusalRecorded
      ? ['Não contatar']
      : stages.filter(stage => stage !== 'Proposta enviada' || lead.proposalSentAt || lead.stage === stage);
    const options = editableStages.map(stage => `<option${(lead.stage || 'Novo') === stage ? ' selected' : ''}>${stage}</option>`).join('');
    const details = [lead.category, lead.address || lead.city].filter(Boolean).map(esc).join(' · ');
    const whatsapp=window.ProspectLinks.whatsappNumber(lead);
    const contactLine=whatsapp?'<div class="lead-meta muted">WhatsApp +'+esc(whatsapp)+'</div>':'';
    return `<tr>
      <td><strong>${name}</strong>${details ? '<div class="lead-meta muted">' + details + '</div>' : ''}</td>
      <td data-label="Contato">${esc(lead.phone || (whatsapp ? '' : '—'))}${contactLine}</td>
      <td data-label="Site">${websiteTag(lead)}</td>
      <td data-label="Etapa"><select data-stage="${id}" aria-label="Etapa de ${name}"${refusalRecorded ? ' disabled' : ''}>${options}</select></td>
      <td><div class="actions">
        <button class="mini primary" type="button" data-site="${id}">Criar 3 sites</button>
        <button class="mini" type="button" data-edit="${id}">Editar empresa</button>
        ${previewUrl ? '<a class="mini" target="_blank" rel="noopener noreferrer" href="' + esc(previewUrl) + '">Ver prévia</a>' : ''}
        ${contactBlocked(lead) ? '' : '<button class="mini" type="button" data-wa="' + id + '">Preparar mensagem</button>'}
      </div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty">Nenhuma empresa neste filtro.</td></tr>';
}

function render() {
  renderOverview();
  renderLeadRows();
}

function modal(title, body, confirm, labels = {}) {
  const dialog = $('#modal');
  if (dialog.classList.contains('hidden')) modalOpener = document.activeElement;
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = body;
  $('#confirm').textContent = labels.confirm || 'Confirmar';
  $('#cancel').textContent = labels.cancel || 'Cancelar';
  $('#modalStatus').hidden = true;
  onConfirm = confirm;
  dialog.classList.remove('hidden');
  $('.sidebar').inert = true;
  $('#mainContent').inert = true;
  ($('#modalBody input:not([type="checkbox"])') || $('#cancel')).focus();
}

function modalError(message) {
  const feedback = $('#modalStatus');
  feedback.textContent = message;
  feedback.hidden = false;
}

function closeModal() {
  $('#modal').classList.add('hidden');
  $('.sidebar').inert = false;
  $('#mainContent').inert = false;
  onConfirm = undefined;
  if (modalOpener?.isConnected) modalOpener.focus();
  else $('#title').focus({ preventScroll: true });
}

function editOpportunity(lead) {
  const fields = [
    ['Name', 'Nome da empresa', 'text', 190, lead?.name],
    ['Category', 'Segmento', 'text', 100, lead?.category],
    ['City', 'Cidade ou região', 'text', 100, lead?.city],
    ['Address', 'Endereço (opcional)', 'text', 300, lead?.address],
    ['Phone', 'Telefone com DDD (opcional)', 'tel', 40, lead?.phone],
    ['Whatsapp', 'WhatsApp da empresa (se for outro número)', 'tel', 160, lead?.whatsapp],
    ['Site', 'Site (opcional)', 'text', 350, lead?.website]
  ];
  const body = fields.map(([key, label, type, max, value]) => `
    <label for="new${key}">${label}</label>
    <input id="new${key}" type="${type}" maxlength="${max}" value="${esc(value)}">`).join('');
  const contactChoice='<label><input type="checkbox" id="crmUsePhone" style="width:auto" '+(lead?.whatsappUsePhone===false?'':'checked')+'> Usar o telefone no WhatsApp quando o campo estiver vazio</label>';
  modal(lead ? 'Editar empresa' : 'Nova oportunidade', body+contactChoice, () => {
    const value = key => $('#new' + key).value.trim();
    const name = value('Name');
    if (!name) {
      modalError('Informe o nome da empresa.');
      $('#newName').focus();
      return;
    }
    const details = {
      name, category: value('Category'), city: value('City'), address: value('Address'),
      phone:value('Phone'),whatsapp:value('Whatsapp'),whatsappUsePhone:$('#crmUsePhone').checked,website:value('Site')
    };
    if(details.whatsapp&&!window.ProspectLinks.whatsappNumber(details))return modalError('Confira o número ou o link de WhatsApp da empresa.');
    if (lead) Object.assign(lead, details);
    else leads.unshift({ id: uid(), stage: 'Novo', origin: 'manual', operatorConfirmed: true, ...details });
    save();
    closeModal();
  }, { confirm: 'Salvar empresa' });
}

function openStudioForLead(lead) {
  const open = confirmed => { location.href = '/studio?lead=' + encodeURIComponent(confirmed.id); };
  if ((lead.googleId || lead.origin === 'google-places') && !lead.operatorConfirmed) {
    window.PortalCRM?.confirmGoogleLead(lead, lead.category, open, true, lead.city);
    return;
  }
  open(lead);
}

function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^\s*[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

let quotaRequest = 0;
async function refreshQuota() {
  const requestId = ++quotaRequest;
  try {
    let token;
    try { token = JSON.parse(sessionStorage.getItem(sessionKey) || 'null')?.access_token; }
    catch {}
    const headers = token ? { Authorization: 'Bearer ' + token } : {};
    const response = await fetch('/api/quota', { headers, cache: 'no-store' });
    if (!response.ok) throw new Error();
    const quota = await response.json();
    if (requestId !== quotaRequest) return;
    const used = Number.isFinite(quota.used) ? Math.min(50, Math.max(0, quota.used)) : null;
    const message = used === null ? quota.reason || 'Entre para consultar sua cota.'
      : used >= 50 ? 'Limite atingido. Novas buscas bloqueadas.'
      : (50 - used) + ' buscas restantes neste mês.';
    $('#quotaCount').textContent = (used ?? '—') + ' / 50';
    $('#quotaFill').style.width = (used ?? 0) * 2 + '%';
    $('#quotaFill').classList.toggle('quota-warning', used !== null && used >= 40);
    if (used === null) $('#quotaProgress').removeAttribute('aria-valuenow');
    else $('#quotaProgress').setAttribute('aria-valuenow', String(used));
    $('#quotaRemaining').textContent = message;
    $('#quotaStatus').textContent = message;
  } catch {
    if (requestId !== quotaRequest) return;
    $('#quotaRemaining').textContent = 'Não foi possível consultar a cota.';
  }
}

document.addEventListener('click', event => {
  const entry = event.target.closest('[data-page], [data-go]');
  if (!entry || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (entry.dataset.filter) $('#filter').value = entry.dataset.filter;
  page(entry.dataset.page || entry.dataset.go);
});
window.addEventListener('popstate', () => page(screenFromURL(), { push: false }));
$('#menuToggle').addEventListener('click', () => setMenuOpen($('#menuToggle').getAttribute('aria-expanded') !== 'true'));
$('#filter').addEventListener('change', () => render());
$('#addBtn').addEventListener('click', () => editOpportunity());
$('#cancel').addEventListener('click', closeModal);
$('#confirm').addEventListener('click', () => onConfirm?.());
$('#modal').addEventListener('click', event => { if (event.target.id === 'modal') closeModal(); });
$('#modal').addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal();
  }
  if (event.key === 'Tab') {
    const items = $$('#modal :is(a, button, input, select, textarea):not([disabled])');
    if (event.shiftKey && document.activeElement === items[0]) {
      event.preventDefault();
      items.at(-1).focus();
    } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
      event.preventDefault();
      items[0].focus();
    }
  }
});
$('#leadRows').addEventListener('click', event => {
  const button = event.target.closest('[data-site], [data-edit], [data-wa]');
  if (!button) return;
  const id = button.dataset.site ?? button.dataset.edit ?? button.dataset.wa;
  const lead = leads.find(item => String(item.id) === id);
  if (!lead) return;
  if (button.hasAttribute('data-site')) openStudioForLead(lead);
  else if (button.hasAttribute('data-edit')) editOpportunity(lead);
  else window.PortalCRM?.composeMessage(lead.id);
});
$('#leadRows').addEventListener('change', event => {
  const id = event.target.dataset.stage;
  const lead = leads.find(item => String(item.id) === id);
  if (!lead) return;
  lead.stage = event.target.value;
  lead.optedOut = lead.stage === 'Não contatar' || contactRefused(lead);
  lead.archivedAt = lead.stage === 'Arquivado' ? lead.archivedAt || new Date().toISOString() : null;
  save();
});
$('#tpl').value = readTemplate();
$('#refreshCommercial').addEventListener('click', () => void window.PortalCRM?.refreshCommercial());
$('#saveTpl').addEventListener('click', () => {
  try {
    localStorage.setItem(templateKey, $('#tpl').value.trim() || defaultTemplate);
    $('#templateStatus').textContent = 'Modelo salvo.';
  } catch {
    $('#templateStatus').textContent = 'Não foi possível salvar o modelo.';
  }
});
$('#csv').addEventListener('click', () => {
  const csv = '\uFEFFEmpresa;Telefone;Site;Etapa\r\n' + leads.map(lead => [
    lead.name, lead.phone, lead.website, lead.stage
  ].map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const download = document.createElement('a');
  download.href = url;
  download.download = 'oportunidades.csv';
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

page(screenFromURL(), { push: false, focus: false });
refreshQuota();
