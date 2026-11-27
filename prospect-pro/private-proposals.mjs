import {createHash, randomBytes} from 'node:crypto';
import {DomUtils, parseDocument} from 'htmlparser2';
import {RequestError} from './studio-ai.js';

const api = '/api/studio/proposals';
const portal = '/proposta';
const limit = 7 * 1024 * 1024;
const variantLimit = 2 * 1024 * 1024;
const tokenPattern = /^[a-zA-Z0-9_-]{43}$/;
const idPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const noIndex = 'noindex, nofollow, noarchive, nosnippet';
const baseHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': noIndex,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};
const portalCsp = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'";
const variantCsp = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data: https://fonts.gstatic.com; frame-ancestors 'self'; form-action 'none'; base-uri 'none'; sandbox allow-popups allow-popups-to-escape-sandbox";
const escapes = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => escapes[char]);
const hash = value => createHash('sha256').update(value).digest('hex');
const textual = (value, max) => typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
const dataImage = value => /^data:image\/(?:svg\+xml|avif|webp|png|gif|jpeg|x-icon|vnd\.microsoft\.icon)(?:[;,])/i.test(value);
const dataFont = value => /^data:(?:font\/(?:woff2?|ttf|otf)|application\/font-woff);base64,/i.test(value);
const googleFont = value => /^https:\/\/fonts\.gstatic\.com\/[a-z0-9_./-]+\.woff2?$/i.test(value);
const assetError = () => new RequestError(422, 'Incorpore as imagens autorizadas no documento antes de gerar o link privado.');

async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    req.resume();
    throw new RequestError(415, 'Envie os dados em formato JSON.');
  }
  if (Number(req.headers['content-length']) > limit) {
    req.resume();
    throw new RequestError(413, 'A proposta excede o tamanho máximo.');
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req.iterator({destroyOnReturn: false})) {
    bytes += chunk.length;
    if (bytes > limit) {
      req.resume();
      throw new RequestError(413, 'A proposta excede o tamanho máximo.');
    }
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {}
  throw new RequestError(400, 'Os dados da proposta são inválidos.');
}

function validateCss(css) {
  const cssText = css.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/@import\b/i.test(cssText)) throw assetError();
  for (const match of cssText.matchAll(/\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/gi)) {
    const url = match[1] ?? match[2] ?? match[3];
    if (!url.startsWith('#') && !dataImage(url) && !dataFont(url) && !googleFont(url)) throw assetError();
  }
}

function validateVariant(value) {
  const label = textual(value?.label, 70);
  const html = typeof value?.html === 'string' ? value.html.trim() : '';
  if (!label || !/^<!doctype html>/i.test(html) || !/<\/head>/i.test(html) || !/<\/body>/i.test(html)) {
    throw new RequestError(422, 'Cada modelo precisa de um nome e um documento HTML completo.');
  }
  if (Buffer.byteLength(html) > variantLimit) {
    throw new RequestError(413, 'Um dos modelos excede 2 MiB. Reduza o tamanho de suas imagens.');
  }

  const document = parseDocument(html);
  for (const node of DomUtils.findAll(() => true, document.children)) {
    const {name, attribs: attributes = {}} = node;
    if (['base', 'frame', 'frameset', 'iframe', 'object', 'embed', 'form', 'video', 'audio', 'source']
      .includes(name) || (name === 'script' && (attributes.type !== 'application/ld+json' || attributes.src))
      || (name === 'meta' && attributes['http-equiv'])
      || Object.keys(attributes).some(attribute => /^on[a-z]/.test(attribute))) {
      throw new RequestError(422, 'O modelo contém código ativo incompatível com o modo privado.');
    }
    if (attributes.style) validateCss(attributes.style);
    if (name === 'style') validateCss(DomUtils.textContent(node));
    if (name === 'img' && (!dataImage(attributes.src || '') || attributes.srcset)) throw assetError();
    if (name === 'link' &&
      (!['icon', 'apple-touch-icon'].includes(attributes.rel) || !dataImage(attributes.href || ''))) throw assetError();
    if (name === 'image' && !dataImage(attributes.href || attributes['xlink:href'] || '')) throw assetError();
    if (name === 'a') {
      const href = attributes.href || attributes['xlink:href'] || '';
      if (href && !/^(?:#|https:\/\/|mailto:|tel:)/i.test(href)) throw assetError();
      if (/^https:\/\//i.test(href) && (attributes.target !== '_blank' ||
          !/(?:^|\s)(?:noopener|noreferrer)(?:\s|$)/i.test(attributes.rel || ''))) {
        throw new RequestError(422, 'Os links externos dos modelos precisam ser abertos em outra aba.');
      }
    }
  }

  return {label, html: html.replace(/<\/head>/i, '<meta name="robots" content="' + noIndex + '"></head>')};
}

function proposalInput(body) {
  if (body.contactAuthorized !== true) {
    throw new RequestError(422, 'Confirme a autorização de contato antes de gerar o link.');
  }
  const leadId = textual(body.leadId, 90);
  if (leadId.length < 3) throw new RequestError(422, 'Selecione uma empresa cadastrada no CRM.');
  const days = body.expiresInDays === undefined ? 7 : body.expiresInDays;
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    throw new RequestError(422, 'Escolha uma validade entre 1 e 30 dias.');
  }
  if (!Array.isArray(body.variants) || body.variants.length !== 3) {
    throw new RequestError(422, 'Inclua os três modelos da empresa.');
  }
  const variants = body.variants.map(validateVariant);
  const signatures = new Set(variants.map(({html}) => hash(html.replace(/>\s+</g, '><'))));
  if (signatures.size !== 3 || new Set(variants.map(({label}) => label.toLowerCase())).size !== 3) {
    throw new RequestError(422, 'Use três modelos distintos, cada um com seu próprio nome.');
  }
  const offer = body.offer == null ? null : {
    title: textual(body.offer.title, 100),
    price: textual(body.offer.price, 80),
    conditions: textual(body.offer.conditions, 1800)
  };
  if (offer && Object.values(offer).some(value => !value)) {
    throw new RequestError(422, 'Informe título, valor e condições da oferta comercial.');
  }
  return {leadId, days, variants, offer};
}

function json(res, status, payload) {
  res.writeHead(status, {...baseHeaders, 'Content-Type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify(payload));
}

const shellCss = `
*{box-sizing:border-box}html{color-scheme:light}body{margin:0;background:#f2f0eb;color:#192f32;font:1rem/1.5 system-ui,sans-serif}
.panel{width:min(64rem,100%);margin:auto;padding:clamp(1rem,4vw,3.5rem)}h1{font:600 clamp(1.9rem,5vw,3.5rem)/1.05 Georgia,serif;margin:.4em 0;overflow-wrap:anywhere}
p{max-width:58ch}small{font-size:.875rem}nav,section.actions{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1.25rem}form{margin:0}
button,a.action{display:inline-flex;align-items:center;min-height:44px;max-width:100%;padding:.65rem .9rem;background:white;color:#192f32;border:1px solid #627676;border-radius:.35rem;text-decoration:none;font:inherit;cursor:pointer}
.primary,button[aria-current]{background:#192f32;color:#fff;border-color:#192f32}a{color:inherit}.danger{color:#862942}
button:focus-visible,a:focus-visible{outline:3px solid #876518;outline-offset:3px}.offer{padding:1rem;background:white;border-radius:.35rem;overflow-wrap:anywhere}.offer p{white-space:pre-wrap}
iframe{display:block;width:100%;height:max(68vh,29rem);border:0;background:white}
`;

function page(res, req, status, title, content, preview = '') {
  res.writeHead(status, {
    ...baseHeaders,
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': portalCsp,
    'X-Frame-Options': 'DENY'
  });
  if (req.method === 'HEAD') return res.end();
  res.end('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">' +
    '<meta name="robots" content="' + noIndex + '"><title>' + escape(title) + '</title><style>' + shellCss +
    '</style></head><body><main><div class="panel">' + content + '</div>' + preview + '</main></body></html>');
}

function button(path, text, attr = '') {
  return '<form method="post" action="' + path + '"><button type="submit"' + attr + '>' + escape(text) + '</button></form>';
}

export function createPrivateProposals({endpoint, serviceKey, authorizedOperator, getToken, fetcher = fetch}) {
  async function database(path, options = {}) {
    if (!endpoint || !serviceKey) throw new RequestError(503, 'As propostas privadas ainda precisam ser configuradas.');
    const headers = {apikey: serviceKey};
    if (!serviceKey.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + serviceKey;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetcher(new URL('/rest/v1/' + path, endpoint), {
      method: options.method || 'GET',
      headers: {...headers, ...options.headers},
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeout ?? 12000)
    });

    if ([404, 409, 422].includes(response.status)) {
      const result = await response.json().catch(() => null);
      if (result?.code === 'PT' + response.status) throw new RequestError(response.status, result.message);
    }
    if (!response.ok) throw new RequestError(503, 'Não foi possível acessar as propostas privadas.');
    return options.method === 'HEAD' || response.status === 204 ? null : response.json();
  }

  const rpc = (procedure, body) => database('rpc/prospect_' + procedure + '_private_proposal', {method: 'POST', body});

  async function admin(req, res, pathname) {
    const owner = await authorizedOperator(getToken(req), AbortSignal.timeout(10000));
    if (pathname === api + '/availability') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, {error: 'Método não permitido.'});
      }
      if (!endpoint || !serviceKey) return json(res, 200, {configured: false, ready: false});
      const query = new URLSearchParams({owner_id: 'eq.' + owner, select: 'id', limit: '1'});
      try {
        await database('prospect_private_proposals?' + query, {method: 'HEAD', timeout: 4000});
        return json(res, 200, {configured: true, ready: true});
      } catch {
        return json(res, 200, {configured: true, ready: false});
      }
    }
    if (req.method === 'GET' && pathname === api) {
      const proposals = [];
      const pageSize = 500;
      const expired = new URLSearchParams({
        owner_id: 'eq.' + owner,
        expires_at: 'lte.' + new Date().toISOString(),
        variants: 'not.is.null'
      });
      await database('prospect_private_proposals?' + expired, {
        method: 'PATCH',
        headers: {Prefer: 'return=minimal'},
        body: {variants: null, offer: null}
      });
      const query = new URLSearchParams({
        owner_id: 'eq.' + owner,
        select: 'id,lead_id,created_at,contact_authorized_at,expires_at,viewed_at,interested_at,refused_at,revoked_at',
        order: 'created_at.desc,id.desc',
        limit: String(pageSize)
      });
      for (let offset = 0; ; offset += pageSize) {
        query.set('offset', String(offset));
        const rows = await database('prospect_private_proposals?' + query);
        proposals.push(...rows);
        if (rows.length < pageSize) break;
      }
      return json(res, 200, {proposals});
    }
    if (req.method === 'POST' && pathname === api) {
      const {leadId, days, variants, offer} = proposalInput(await readJson(req));
      const token = randomBytes(32).toString('base64url');
      const result = await rpc('create', {
        p_owner_id: owner, p_lead_id: leadId, p_token_hash: hash(token), p_days: days,
        p_variants: variants, p_offer: offer
      });
      return json(res, 201, {...result, path: portal + '/' + token});
    }
    const match = /^\/api\/studio\/proposals\/([^/]+)\/revoke$/.exec(pathname);
    if (req.method === 'POST' && match && idPattern.test(match[1])) {
      const query = new URLSearchParams({id: 'eq.' + match[1], owner_id: 'eq.' + owner, select: 'id'});
      const rows = await database('prospect_private_proposals?' + query, {
        method: 'PATCH',
        headers: {Prefer: 'return=representation'},
        body: {revoked_at: new Date().toISOString(), variants: null, offer: null}
      });
      if (!rows.length) throw new RequestError(404, 'Proposta não encontrada.');
      return json(res, 200, {id: match[1], revoked: true});
    }
    res.setHeader('Allow', pathname === api ? 'GET, POST' : 'POST');
    return json(res, 405, {error: 'Método não permitido.'});
  }

  async function visit(req, res, pathname) {
    const [, , token, mode = '', index = ''] = pathname.split('/');
    if (!tokenPattern.test(token || '') || pathname !== [portal, token, mode, index].filter(Boolean).join('/')) {
      return page(res, req, 404, 'Proposta indisponível', '<h1>Proposta indisponível</h1>');
    }
    const model = /^[1-3]$/.test(index) ? Number(index) : 0;
    const hasModel = ['visualizar', 'modelo'].includes(mode);
    if ((!['', 'prosseguir', 'excluir', 'modelo', 'visualizar'].includes(mode)) || (hasModel ? !model : !!index)) {
      return page(res, req, 404, 'Proposta indisponível', '<h1>Proposta indisponível</h1>');
    }
    const post = req.method === 'POST';
    const allowPost = ['visualizar', 'prosseguir', 'excluir'].includes(mode);
    const allowGet = mode !== 'prosseguir';
    if ((post && !allowPost) || (!post && (!allowGet || !['GET', 'HEAD'].includes(req.method)))) {
      res.setHeader('Allow', allowPost ? (allowGet ? 'GET, HEAD, POST' : 'POST') : 'GET, HEAD');
      return page(res, req, 405, 'Ação indisponível', '<h1>Ação indisponível</h1>');
    }
    if (post && req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') {
      req.resume();
      return page(res, req, 403, 'Ação indisponível', '<h1>Abra o link e escolha a opção novamente</h1>');
    }
    if (post) req.resume();
    const action = mode === 'modelo' ? 'html' : post ? {
      visualizar: 'view', prosseguir: 'interest', excluir: 'refuse'
    }[mode] : 'read';
    const result = await rpc('access', {p_token_hash: hash(token), p_action: action, p_variant: model ? model - 1 : null});
    if (!result || result.inactive) return page(res, req, result ? 410 : 404, 'Proposta indisponível',
      '<h1>Proposta indisponível</h1><p>Este link pode ter expirado ou sido desativado.</p>');

    if (action === 'html') {
      if (typeof result !== 'string') throw new RequestError(503, 'Modelo indisponível.');
      res.writeHead(200, {
        ...baseHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': variantCsp,
        'X-Frame-Options': 'SAMEORIGIN'
      });
      return res.end(req.method === 'HEAD' ? undefined : result);
    }
    if (action === 'refuse') return page(res, req, 200, 'Preferência registrada',
      '<h1>Obrigado pelo seu tempo</h1><p>As prévias foram desativadas e o cadastro foi bloqueado para novos contatos comerciais pelo Prospect PRO.</p>');

    const root = portal + '/' + token;
    if (action === 'view') {
      res.writeHead(303, {...baseHeaders, Location: root + '/visualizar/' + model});
      return res.end();
    }
    if (mode === 'excluir') return page(res, req, 200, 'Excluir propostas',
      '<h1>Excluir e não receber mais</h1><p>Ao confirmar, você desativa os links e impede novos contatos comerciais pelo Prospect PRO.</p>' +
      '<section class="actions">' + button(root + '/excluir', 'Confirmar exclusão', ' class="primary"') +
      '<a class="action" href="' + root + '">Voltar</a></section>');

    const labels = result.labels || [];
    const expires = new Intl.DateTimeFormat('pt-BR', {dateStyle: 'long', timeZone: 'America/Sao_Paulo'}).format(new Date(result.expiresAt));
    const navigation = '<nav aria-label="Visualizar propostas">' + labels.map((label, i) =>
      button(root + '/visualizar/' + (i + 1), label, model === i + 1 ? ' aria-current="true"' : '')).join('') + '</nav>';
    const actions = '<section class="actions" aria-label="Ações da proposta">' +
      (result.interested ? '' : button(root + '/prosseguir', 'Prosseguir', ' class="primary"')) +
      '<a class="action danger" href="' + root + '/excluir">Excluir e não receber mais</a></section>';
    const offer = result.interested ? (result.offer ?
      '<section class="offer"><h2>' + escape(result.offer.title) + '</h2><strong>' +
        escape(result.offer.price) + '</strong><p>' + escape(result.offer.conditions) + '</p></section>' :
      '<p>Interesse registrado. Os valores e condições serão combinados com o atendimento.</p>') : '';
    const preview = model ? '<iframe sandbox="allow-popups allow-popups-to-escape-sandbox" title="' +
      escape(labels[model - 1]) + '" src="' + root + '/modelo/' + model + '"></iframe>' : '';
    return page(res, req, 200, result.businessName + ' | Propostas de site',
      '<small>Prévia privada · válida até ' + escape(expires) + '</small><h1>' +
      escape(result.businessName) + '</h1>' + offer + navigation + actions, preview);
  }

  return async (req, res, pathname) => {
    const isAdmin = pathname === api || pathname.startsWith(api + '/');
    try {
      if (isAdmin) return await admin(req, res, pathname);
      return await visit(req, res, pathname);
    } catch (error) {
      if (res.destroyed) return;
      const status = error instanceof RequestError ? error.status : 503;
      const message = error instanceof RequestError ? error.message : 'Não foi possível concluir o pedido de proposta.';
      if (isAdmin) return json(res, status, {error: message});
      return page(res, req, status, 'Proposta indisponível', '<h1>' + escape(message) + '</h1>');
    }
  };
}
