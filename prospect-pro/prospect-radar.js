(() => {
'use strict';

const hasWebsite = window.ProspectLinks.hasWebsite;
const byId = id => document.getElementById(id);
const stage = byId('radarStage');
const mode = byId('mode');
const termField = byId('term');
const cityField = byId('city');
const searchButton = byId('searchBtn');
const searchResults = byId('searchResults');
const opportunityResults = byId('autoOppCards');
const steps = [
 { id: 'access', label: 'Verificar acesso e cota' },
 { id: 'google', label: 'Consultar o Google Places' },
 { id: 'results', label: 'Organizar os resultados' }
];
const states = {
 idle: 'Aguardando busca', working: 'Busca em andamento', done: 'Busca concluída',
 login: 'Login necessário', error: 'Busca interrompida', manual: 'Pesquisa manual'
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
 '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
let completedSearch = null;
let searchView = 'initial';
let filterMode = 'no';
let loading = false;
let modeChosen = false;

function initRadar() {
 stage.removeAttribute('aria-live');
 stage.innerHTML = `
  <div class="radar-topline">
   <span class="radar-legend">Mapa ilustrativo</span>
   <span id="radarMode"></span>
  </div>
  <div class="radar-viewport">
   <div class="radar-hero-bg" aria-hidden="true">
    <svg class="radar-map-svg" viewBox="0 0 900 430" preserveAspectRatio="xMidYMid slice" focusable="false">
     <path class="district" d="M0 60L130 20 225 83 340 4 471 104 605 35 900 85 900 390 710 420 600 317 480 398 340 278 170 387 0 346Z"/>
     <path d="M0 170L225 90 450 230 650 95 900 176M0 240L180 218 400 112 620 300 900 240M82 0L200 140 150 360 360 430M304 0L390 95 355 260 505 430M530 0L550 152 485 250 670 430M730 0L720 160 850 310M0 380L180 300 370 340 540 240 900 400"/>
     <path class="minor" d="M20 0L125 105 290 205 388 430M0 86L300 310 590 120 900 60M400 0L305 110 585 397M680 0L650 160 805 430M0 285L240 420 520 312 900 330M0 110L220 260 490 30 840 425M160 0L260 150 190 430"/>
    </svg>
    <div class="radar-orbit"></div><div class="radar-sweep"></div><div class="radar-target"></div>
   </div>
   <div class="radar-center-label">
    <strong id="radarCity">Região da busca</strong>
    <span id="radarTerm">Informe o segmento e a cidade</span>
   </div>
  </div>
  <div class="radar-progress-panel">
   <ol class="radar-steps" aria-label="Etapas da busca">
    ${steps.map(({ id, label }, index) => `
     <li class="radar-step" data-step="${id}">
      <span class="stepdot" aria-hidden="true">${index + 1}</span><span>${label}</span>
     </li>`).join('')}
   </ol>
   <div class="radar-feedback">
    <p id="radarMessage" role="status" aria-atomic="true"></p>
    <a id="radarMapLink" class="radar-map-link" target="_blank" rel="noopener noreferrer" hidden>Abrir pesquisa no Google Maps ↗</a>
   </div>
  </div>`;
 setStage('idle', '', 'Escolha entre a pesquisa manual no mapa e a busca automática pelo Google Places.');
}

function setStage(state, phase, message) {
 stage.dataset.state = state;
 stage.dataset.phase = phase;
 const activeIndex = steps.findIndex(step => step.id === phase);
 for (const [index, step] of Array.from(stage.querySelectorAll('.radar-step')).entries()) {
  const done = state === 'done' || index < activeIndex;
  const failed = (state === 'error' || state === 'login') && index === activeIndex;
  const active = state === 'working' && index === activeIndex;
  step.classList.toggle('done', done);
  step.classList.toggle('failed', failed);
  step.classList.toggle('active', active);
  if (active) step.setAttribute('aria-current', 'step');
  else step.removeAttribute('aria-current');
  step.querySelector('.stepdot').textContent = done ? '✓' : failed ? '!' : String(index + 1);
 }
 byId('radarMode').textContent = states[state];
 byId('radarMessage').textContent = message;
}

function mapsSearchLink(query) {
 return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}

function mapsBusinessLink(business) {
 try {
  const candidate = new URL(business.maps);
  const googleMaps = candidate.hostname === 'www.google.com' && /^\/maps(?:\/|$)/.test(candidate.pathname);
  const googleMapsHost = ['maps.google.com', 'maps.app.goo.gl'].includes(candidate.hostname);
  if (candidate.protocol === 'https:' && !candidate.username && !candidate.password && (googleMaps || googleMapsHost)) {
   return candidate.href;
  }
 } catch {
  // Older records may have no Maps URL. A search link still opens the business on Google Maps.
 }
 const search = mapsSearchLink([business.name, business.address].filter(Boolean).join(' '));
 return business.googleId ? search + '&query_place_id=' + encodeURIComponent(business.googleId) : search;
}

function showLocation(term, city) {
 byId('radarCity').textContent = city;
 byId('radarTerm').textContent = term;
 const link = byId('radarMapLink');
 link.href = mapsSearchLink(term + ' em ' + city);
 link.hidden = false;
 return link.href;
}

function findLead(business) {
 return leads.find(lead => {
  if (lead.googleId && business.googleId) return lead.googleId === business.googleId;
  return business.address && lead.address === business.address && lead.name === business.name;
 });
}

function renderCard(business, index) {
 const existing = findLead(business);
 const saved = existing?.operatorConfirmed && (!business.googleId || existing.googleId === business.googleId);
 const placeName = escapeHtml(business.name);
 const street = escapeHtml(business.address || 'Endereço não informado');
 const phone = escapeHtml(business.phone || 'Telefone não informado');
 const site = hasWebsite(business);
 const social=window.ProspectSocial.profile(business.website);
 const status = site ? 'Site informado' : social ? 'Apenas '+social.label : window.ProspectLinks.whatsappLinkNumber(business.website) ? 'Apenas WhatsApp' : 'Sem site informado';
 return `<article class="opportunity-card">
  <div class="opp-head"><h4>${placeName}</h4><span class="opp-tag${site ? ' site' : ''}">${status}</span></div>
  <div class="opp-meta"><div>${street}</div><div>${phone}</div>
   <a class="opp-map-link" target="_blank" rel="noopener noreferrer" href="${escapeHtml(mapsBusinessLink(business))}">Ver no Google Maps ↗</a>
  </div>
  ${site ? '' : '<p class="opp-note">Confira se a empresa possui um site antes de preparar uma proposta.</p>'}
  <div class="opp-buttons">
   <button type="button" class="primary" data-radar-create="${index}">Criar 3 sites</button>
   <button type="button" ${saved ? 'class="ready" disabled' : ''} data-radar-save="${index}">${saved ? '✓ Salva no CRM' : 'Salvar no CRM'}</button>
   <button type="button" data-radar-message="${index}">Preparar proposta</button>
  </div>
 </article>`;
}

function renderCards(matches) {
 const cards = completedSearch.results.flatMap((business, index) => matches(business) ? [renderCard(business, index)] : []);
 return cards.length ? `<div class="opportunity-grid">${cards.join('')}</div>` : '';
}

const businessCount = count => count === 1 ? '1 empresa' : `${count} empresas`;
const noSiteCount = count => count === 1 ? '1 perfil sem site informado' : `${count} perfis sem site informado`;
const emptyPanel = (title, message = '') => `<div class="radar-empty"><strong>${escapeHtml(title)}</strong>${message ? `<p>${escapeHtml(message)}</p>` : ''}</div>`;
const attribution = '<p class="radar-attribution"><img src="/google-maps-attribution.png" alt="Google Maps" translate="no" width="98" height="18"></p>';

function renderSessionOpportunities() {
 const countLabel = byId('radarFoundCount');
 const caption = byId('radarFoundCaption');
 if (!completedSearch) {
  countLabel.textContent = 'Aguardando busca';
  caption.textContent = 'Perfis sem site informado na última busca automática.';
  opportunityResults.innerHTML = emptyPanel('Nenhuma busca automática nesta sessão.');
  return;
 }
 const { term, city, results } = completedSearch;
 countLabel.textContent = noSiteCount(results.filter(business => !hasWebsite(business)).length);
 caption.textContent = `${term} · ${city}`;
 const cards = renderCards(business => !hasWebsite(business));
 opportunityResults.innerHTML = cards ? attribution + cards : emptyPanel('Nenhum perfil sem site informado nesta pesquisa.');
}

function renderSearchResults() {
 if (searchView !== 'completed') return;
 const { results, city } = completedSearch;
 const total = results.length;
 const noSite = results.filter(business => !hasWebsite(business)).length;
 const caption = byId('radarCardsCount');
 if (!total) {
  caption.textContent = `Nenhuma empresa encontrada em ${city}.`;
  searchResults.innerHTML = emptyPanel('Nenhum resultado para esses termos.', 'Experimente um segmento mais amplo ou uma cidade próxima.');
  return;
 }
 caption.textContent = `${businessCount(total)} no resultado · ${noSiteCount(noSite)}`;
 const filters = [
  { id: 'no', label: 'Sem site informado', count: noSite },
  { id: 'all', label: 'Todas', count: total },
  { id: 'yes', label: 'Com site informado', count: total - noSite }
 ];
 const controls = filters.map(({ id, label, count }) => `<button type="button" class="radar-filter${id === filterMode ? ' active' : ''}" data-radar-filter="${id}" aria-pressed="${id === filterMode}">${label} (${count})</button>`);
 const cards = renderCards(business => filterMode === 'all' || (filterMode === 'no' ? !hasWebsite(business) : hasWebsite(business)));
 searchResults.innerHTML = `<div class="radar-controls" role="group" aria-label="Filtrar empresas">${controls.join('')}</div>` +
  attribution + (cards || emptyPanel('Nenhuma empresa neste filtro.'));
}

function withConfirmedLead(index, callback) {
 const business = completedSearch?.results[index];
 if (!business) return;
 const existing = findLead(business);
 if (existing?.operatorConfirmed && (!business.googleId || existing.googleId === business.googleId)) {
  callback?.(existing);
  return;
 }
 const crm = window.PortalCRM;
 if (!crm?.confirmGoogleLead) {
  alert('O CRM está indisponível. Atualize a página para confirmar e salvar esta empresa.');
  return;
 }
 crm.confirmGoogleLead(existing || business, completedSearch.term, lead => {
  renderSearchResults();
  renderSessionOpportunities();
  callback?.(lead);
 }, Boolean(existing), completedSearch.city, business.googleId);
}

function handleResultAction(event) {
 const button = event.target.closest('button');
 if (!button) return;
 if (button.dataset.radarFilter) {
  const selected = button.dataset.radarFilter;
  filterMode = selected;
  renderSearchResults();
  searchResults.querySelector(`[data-radar-filter="${selected}"]`)?.focus();
  return;
 }
 const { radarCreate, radarSave, radarMessage } = button.dataset;
 const index = radarCreate ?? radarSave ?? radarMessage;
 if (index === undefined) return;
 const resultArea = event.currentTarget;
 withConfirmedLead(Number(index), lead => {
  if (!lead) return;
  if (radarCreate !== undefined) location.href = '/studio?lead=' + encodeURIComponent(lead.id);
  if (radarMessage !== undefined) window.PortalCRM?.composeMessage(lead.id);
  if (radarSave !== undefined) resultArea.querySelector(`[data-radar-create="${Number(index)}"]`)?.focus();
 });
}

function sessionHeaders() {
 try {
  const session = JSON.parse(sessionStorage.getItem('prospect_publisher_session_v1') || 'null');
  if (session?.access_token) return { Authorization: 'Bearer ' + session.access_token };
 } catch {
  // An inaccessible or invalid session is handled by the quota endpoint.
 }
 return {};
}

async function readApi(path, headers) {
 const response = await fetch(path, { headers, cache: 'no-store', signal: AbortSignal.timeout(30000) });
 const result = await response.json();
 if (!response.ok) {
  const error = new Error(result.error || 'O servidor não conseguiu concluir esta etapa.');
  error.status = response.status;
  throw error;
 }
 return result;
}

function setBusy(busy) {
 loading = busy;
 for (const input of [searchButton, mode, termField, cityField]) input.disabled = busy;
 searchResults.setAttribute('aria-busy', String(busy));
 searchButton.textContent = busy ? 'Buscando empresas…' : mode.value === 'api' ? 'Buscar empresas' : 'Abrir Google Maps';
}

function finishWithoutResults(state, phase, title, message) {
 searchView = state;
 setStage(state, phase, message);
 byId('radarCardsCount').textContent = title;
 searchResults.innerHTML = emptyPanel(title, message);
}

async function search(event) {
 event.preventDefault();
 if (loading) return;
 const term = termField.value.trim();
 const city = cityField.value.trim();
 if (!term || !city || term.length > 100 || city.length > 100) {
  const invalid = !term || term.length > 100 ? termField : cityField;
  invalid.setCustomValidity('Informe o segmento e a cidade com até 100 caracteres por campo.');
  invalid.reportValidity();
  invalid.setCustomValidity('');
  return;
 }
 modeChosen = true;
 const link = showLocation(term, city);
 if (mode.value === 'free') {
  window.open(link, '_blank', 'noopener,noreferrer');
  finishWithoutResults('manual', '', 'Pesquisa manual no Google Maps', 'Confira os perfis no mapa e cadastre as oportunidades que quiser guardar no CRM.');
  return;
 }
 setBusy(true);
 searchView = 'working';
 setStage('working', 'access', 'Verificando a integração, seu acesso e a cota mensal.');
 byId('radarCardsCount').textContent = `Buscando empresas em ${city}…`;
 searchResults.replaceChildren();
 stage.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
 const headers = sessionHeaders();
 let phase = 'access';
 try {
  const quota = await readApi('/api/quota', headers);
  if (!quota.enabled) {
   finishWithoutResults('error', phase, 'Busca automática indisponível', quota.reason || 'A integração com o Google Places ainda precisa ser configurada.');
   return;
  }
  if (quota.loginRequired) {
   byId('prospectAuthPanel').hidden = false;
   finishWithoutResults('login', phase, 'Entre na sua conta para pesquisar', quota.reason || 'A busca automática exige uma conta autorizada.');
   return;
  }
  if (quota.remaining === 0 || (Number.isFinite(quota.used) && quota.used >= quota.limit)) {
   finishWithoutResults('error', phase, 'Limite mensal atingido', 'A busca automática volta no primeiro dia do próximo mês. Você pode usar a pesquisa manual no mapa.');
   return;
  }
  phase = 'google';
  setStage('working', phase, 'Solicitando a consulta ao Google Places. Aguardando a resposta.');
  const query = new URLSearchParams({ term, city });
  const result = await readApi('/api/search?' + query, headers);
  if (!Array.isArray(result.data)) throw new Error('O serviço não retornou uma lista válida de empresas.');
  phase = 'results';
  setStage('working', phase, 'Separando os perfis com e sem site informado.');
  const results = result.data.filter(row => row && typeof row === 'object').map(row => ({
   ...row, name: String(row.name || 'Empresa'), website: typeof row.website === 'string' ? row.website.trim() : ''
  }));
  completedSearch = { term, city, results };
  searchView = 'completed';
  filterMode = 'no';
  renderSearchResults();
  renderSessionOpportunities();
  const missing = results.filter(business => !hasWebsite(business)).length;
  const summary = results.length ? `${businessCount(results.length)} no resultado · ${noSiteCount(missing)}.` : `Nenhuma empresa encontrada em ${city}.`;
  setStage('done', '', summary);
  try { localStorage.setItem('prospect_last_segment', term); } catch { /* Search remains available without storage. */ }
  void window.PortalCRM?.recordSearch(term, city, results);
 } catch (error) {
  if (error.status === 401 || error.status === 403) {
   byId('prospectAuthPanel').hidden = false;
   finishWithoutResults('login', phase, 'Verifique seu acesso', error.message);
  } else {
   const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
   const title = error.status === 429 ? 'Limite mensal atingido' : 'A busca não pôde ser concluída';
   let message = error.message;
   if (timedOut) message = 'O serviço demorou para responder. Confira a cota antes de consultar novamente.';
   else if (error instanceof TypeError) message = 'Não foi possível se conectar ao serviço de busca.';
   else if (error instanceof SyntaxError) message = 'O serviço de busca retornou uma resposta inválida.';
   finishWithoutResults('error', phase, title, message);
  }
 } finally {
  setBusy(false);
  if (typeof refreshQuota === 'function') void refreshQuota();
 }
}

function updateMode() {
 if (loading) return;
 setBusy(false);
 byId('modeHelp').textContent = mode.value === 'api'
  ? 'Busca oficial com Google Places. Cada consulta usa uma busca da sua cota mensal.'
  : 'Abre o Google Maps em outra aba, sem usar sua cota mensal.';
}

async function chooseInitialMode() {
 const quota = await readApi('/api/quota', {}).catch(() => null);
 if (!modeChosen && !loading) {
  mode.value = quota?.enabled ? 'api' : 'free';
  updateMode();
 }
}

mode.addEventListener('change', () => { modeChosen = true; updateMode(); });
byId('radarForm').addEventListener('submit', search);
searchResults.addEventListener('click', handleResultAction);
opportunityResults.addEventListener('click', handleResultAction);
for (const button of document.querySelectorAll('[data-page="leads"], [data-go="leads"]')) {
 button.addEventListener('click', renderSessionOpportunities);
}
initRadar();
updateMode();
renderSessionOpportunities();
void chooseInitialMode();
})();
