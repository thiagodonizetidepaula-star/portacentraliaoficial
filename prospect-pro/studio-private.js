(function () {
'use strict';

const $ = id => document.getElementById(id);
const dialog = $('privateProposalDialog');
const form = $('privateProposalForm');
const start = $('privateProposalStart');
const status = message => { $('privateProposalStatus').textContent = message; };
const base = '/api/studio/proposals';
const limit = 2 * 1024 * 1024;
let proposals = [];
let active;
let busy = false;

function canPrepare(items) {
 return items.length === 3 && Boolean(items[0].data.leadId) && items.every(item => item.data.sourcesOnly);
}

function token() {
 try { return JSON.parse(sessionStorage.getItem('prospect_publisher_session_v1') || 'null')?.access_token; }
 catch { return ''; }
}

async function request(path = '', body) {
 const authorization = token();
 if (!authorization) throw Error('Entre na sua conta para preparar a proposta.');
 const response = await fetch(base + path, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { Authorization: 'Bearer ' + authorization, 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
  cache: 'no-store',
  signal: AbortSignal.timeout(20000)
 });
 const result = await response.json().catch(() => ({}));
 if (!response.ok) throw Error(result.error || 'O serviço de propostas está indisponível.');
 return result;
}

function dataUrl(blob) {
 return new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
 });
}

async function embedImage(source, cache) {
 if (/^data:image\/(?:avif|webp|png|jpeg|gif|svg\+xml)[;,]/i.test(source)) return source;
 if (!/^https:\/\//i.test(source)) throw Error('Há uma imagem sem origem válida.');
 if (!cache.has(source)) cache.set(source, (async () => {
  try {
   const response = await fetch(source, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000) });
   if (!response.ok || Number(response.headers.get('content-length')) > limit) throw Error();
   const blob = await response.blob();
   if (!/^image\/(?:avif|webp|png|jpeg|gif)$/i.test(blob.type) || blob.size > limit) throw Error();
   return await dataUrl(blob);
  } catch {
   throw Error('Uma imagem não pôde ser incorporada. Importe o arquivo original autorizado e gere as propostas novamente.');
  }
 })());
 return cache.get(source);
}

async function checkViewport(html, width, height) {
 const frame = document.createElement('iframe');
 frame.setAttribute('sandbox', 'allow-same-origin');
 frame.title = 'Verificação de qualidade';
 frame.tabIndex = -1;
 frame.setAttribute('aria-hidden', 'true');
 Object.assign(frame.style, { position: 'fixed', left: '-20000px', width: width + 'px', height: height + 'px', border: '0' });
 try {
  const loaded = new Promise((resolve, reject) => {
   const timer = setTimeout(() => reject(Error('A prévia demorou demais para carregar.')), 10000);
   frame.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
  frame.srcdoc = html;
  document.body.append(frame);
  await loaded;
  const doc = frame.contentDocument;
  const title = doc.querySelector('main h1');
  if (!title?.textContent.trim() || !title.getClientRects().length) throw Error('O site abre sem título visível.');
  if ([...doc.images].some(img => !img.complete || img.naturalWidth === 0)) throw Error('Há uma imagem que não carrega.');
  if (doc.documentElement.scrollWidth > width + 2) throw Error('Há conteúdo fora da tela em ' + width + ' px.');
 } finally {
  frame.remove();
 }
}

async function prepare(proposal, cache) {
 const html = window.PortalSiteStudio.buildSite(proposal.data, proposal.template, { finalSite: true });
 const doc = new DOMParser().parseFromString(html, 'text/html');
 doc.querySelectorAll('script,meta[property^="og:"],meta[name^="twitter:"],meta[http-equiv],link[rel="canonical"]').forEach(item => item.remove());
 for (const link of doc.querySelectorAll('.portfolio-strip figure a')) link.replaceWith(...link.childNodes);
 const assets = [...doc.querySelectorAll('img[src],link[rel="icon"],link[rel="apple-touch-icon"]')];
 for (const asset of assets) {
  const attribute = asset.tagName === 'IMG' ? 'src' : 'href';
  asset.setAttribute(attribute, await embedImage(asset.getAttribute(attribute), cache));
  if (asset.tagName === 'IMG') asset.loading = 'eager';
 }
 for (const link of doc.querySelectorAll('a[href]')) {
  const href = link.getAttribute('href');
  if (href.startsWith('#')) {
   if (!doc.getElementById(href.slice(1))) throw Error('Um botão leva a uma seção inexistente.');
  } else if (!/^(?:https:\/\/|mailto:|tel:)/i.test(href)) {
   throw Error('Há um link externo inválido.');
  }
 }
 const checked = '<!doctype html>' + doc.documentElement.outerHTML;
 if (new Blob([checked]).size > limit) throw Error('A prévia ultrapassa 2 MB. Reduza o tamanho das imagens.');
 await checkViewport(checked, 390, 844);
 await checkViewport(checked, 1440, 900);
 return { label: proposal.direction.title, html: checked };
}

function setBusy(value) {
 busy = value;
 $('privateProposalClose').disabled = value;
 $('privateProposalGenerate').disabled = value;
 $('privateProposalRevoke').disabled = value;
 $('privateProposalWhatsapp').disabled = value;
}

start.onclick = () => {
 if (!canPrepare(proposals)) return;
 if (!token()) {
  $('manageProjectAccount').click();
  return;
 }
 if (!active) {
  $('privateProposalResult').hidden = true;
  form.hidden = false;
  status('');
 }
 dialog.showModal();
};

$('privateProposalClose').onclick = () => dialog.close();
dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });

form.onsubmit = async event => {
 event.preventDefault();
 if (busy || !canPrepare(proposals)) return;
 const selection = [...proposals];
 setBusy(true);
 try {
  const variants = [];
  const cache = new Map();
  for (const proposal of selection) {
   status('Verificando ' + proposal.direction.title + ' no celular e no computador…');
   try { variants.push(await prepare(proposal, cache)); }
   catch (error) { throw Error(proposal.direction.title + '. ' + error.message); }
  }
  const data = selection[0].data;
  const result = await request('', {
   leadId: data.leadId,
   expiresInDays: Number($('privateProposalDays').value),
   contactAuthorized: $('privateProposalConsent').checked,
   offer: { title: 'Criação do site', price: $('privateProposalPrice').value.trim(), conditions: $('privateProposalTerms').value.trim() },
   variants
  });
  if (!/^\/proposta\/[A-Za-z0-9_-]+$/.test(result.path || '')) throw Error('O servidor não confirmou o link.');
  const link = new URL(result.path, location.origin).href;
  const number = window.ProspectLinks.whatsappNumber(data);
  active = { id: result.id, link, name: data.name, number };
  $('privateProposalLink').value = link;
  $('privateProposalOpen').href = link;
  $('privateProposalWhatsapp').hidden = !number;
  form.hidden = true;
  $('privateProposalResult').hidden = false;
  status('Link criado. A mensagem pode ser preparada no WhatsApp.');
 } catch (error) {
  status(error.message);
 } finally {
  setBusy(false);
 }
};

$('privateProposalCopy').onclick = async () => {
 if (!active) return;
 try {
  await navigator.clipboard.writeText(active.link);
  status('Link copiado.');
 } catch {
  $('privateProposalLink').select();
  status('Use o comando Copiar do navegador.');
 }
};

$('privateProposalRevoke').onclick = async () => {
 if (!active || busy || !confirm('Revogar o link e excluir as três prévias desta proposta?')) return;
 setBusy(true);
 try {
  await request('/' + encodeURIComponent(active.id) + '/revoke', {});
  clearResult();
  status('Link revogado.');
 } catch (error) { status(error.message); }
 finally { setBusy(false); }
};

$('privateProposalWhatsapp').onclick = async () => {
 if (!active?.number || busy) return;
 setBusy(true);
 try {
  const { proposals: records } = await request();
  const item = records.find(record => record.id === active.id);
  if (!item || item.revoked_at || item.refused_at || Date.parse(item.expires_at) <= Date.now()) {
   clearResult();
   throw Error('O link está indisponível para envio.');
  }
  const message = 'Olá! Aqui é do Portal Central IA. Conforme combinado, seguem três opções de site para ' +
   active.name + ': ' + active.link;
  const url = 'https://wa.me/' + active.number + '?text=' + encodeURIComponent(message);
  window.open(url, '_blank', 'noopener,noreferrer');
  status('Mensagem preparada. Confirme o envio em Oportunidades depois de enviá-la.');
 } catch (error) { status(error.message); }
 finally { setBusy(false); }
};

function clearResult() {
 active = undefined;
 $('privateProposalLink').value = '';
 $('privateProposalOpen').removeAttribute('href');
 $('privateProposalResult').hidden = true;
 form.reset();
 form.hidden = false;
}

window.ProspectPrivateStudio = {
 setProposals(items) {
  proposals = items;
  start.hidden = !canPrepare(items);
  if (!busy) clearResult();
 }
};
})();
