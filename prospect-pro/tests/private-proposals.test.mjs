import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {test} from 'node:test';
import {createPrivateProposals} from '../private-proposals.mjs';
import {studioOperator} from '../studio-ai.js';

const fixtureOwner = '0149f43d-a1a1-44b1-ab12-aac2aa935526';
const fixtureId = 'ad49f43d-a1a1-44b1-ab12-aac2aa935526';
const serviceKey = 'sb_secret_only_test';
const recipient = '/proposta';
const api = '/api/studio/proposals';
const palette = ['#292522', '#531e3d', '#142c5c'];

function model(index) {
  const label = ['Editorial', 'Escultural', 'Minimal'][index];
  return {
    label,
    html: '<!doctype html><html lang="pt-BR"><head><title>'+label+'</title><style>body{color:'+palette[index]+'}</style></head><body><main><h1>'+label+'</h1><img alt="" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOAMAAAAASUVORK5CYII="></main></body></html>'
  };
}

async function listen(t, handler) {
  const server = createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return 'http://127.0.0.1:' + server.address().port;
}

async function setup(t) {
  const state = {writes: 0, blocked: false, expired: false};
  function respond(res, status, data) {
    res.writeHead(status, {'Content-Type': 'application/json'});
    return res.end(JSON.stringify(data));
  }

  const endpoint = await listen(t, async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/auth/v1/user') {
        const authenticated = ['Bearer operator-session', 'Bearer viewer-session'].includes(req.headers.authorization);
        return respond(res, authenticated ? 200 : 401, {
          id: fixtureOwner, app_metadata: {prospect_operator: req.headers.authorization === 'Bearer operator-session'}
        });
      }
      assert.equal(req.headers.apikey, serviceKey);
      assert.equal(req.headers.authorization, undefined);
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : null;
      if (url.pathname.endsWith('/prospect_create_private_proposal')) {
        assert.equal(body.p_owner_id, fixtureOwner);
        if (body.p_lead_id !== 'valid-lead') return respond(res, 404, {code: 'PT404', message: 'Empresa não cadastrada nesta conta.'});
        if (state.blocked) return respond(res, 409, {code: 'PT409', message: 'Contato bloqueado.'});
        state.writes++;
        state.proposal = {...body, expires_at: new Date(Date.now() + body.p_days * 86400000).toISOString()};
        return respond(res, 200, {id: fixtureId, expiresAt: state.proposal.expires_at});
      }
      if (url.pathname.endsWith('/prospect_access_private_proposal')) {
        if (body.p_token_hash !== state.proposal?.p_token_hash) return respond(res, 200, null);
        if (state.expired || state.proposal.revoked_at) {
          if (state.expired) state.proposal.p_variants = null;
          return respond(res, 200, {inactive: true});
        }
        const proposal = state.proposal;
        switch (body.p_action) {
          case 'refuse':
            state.blocked = true;
            proposal.refused_at = proposal.revoked_at = 'now';
            proposal.p_variants = proposal.p_offer = null;
            return respond(res, 200, {refused: true});
          case 'html':
            return respond(res, 200, proposal.p_variants[body.p_variant].html);
          case 'interest':
            proposal.interested_at ??= 'now';
            // Interest proves the recipient intentionally opened the portal.
          case 'view':
            proposal.viewed_at ??= 'now';
        }
        return respond(res, 200, {
          businessName: 'Salão <Piloto>', expiresAt: proposal.expires_at,
          labels: proposal.p_variants.map(variant => variant.label),
          offer: proposal.interested_at ? proposal.p_offer : null, interested: !!proposal.interested_at
        });
      }
      if (url.pathname.endsWith('/prospect_private_proposals')) {
        assert.equal(url.searchParams.get('owner_id'), 'eq.' + fixtureOwner);
        const proposal = state.proposal;
        if (req.method === 'PATCH') {
          if (url.searchParams.has('expires_at')) {
            if (state.expired && proposal) proposal.p_variants = proposal.p_offer = null;
            res.writeHead(204);
            return res.end();
          }
          if (url.searchParams.get('id') !== 'eq.' + fixtureId) return respond(res, 200, []);
          assert.equal(body.offer, null);
          assert.equal(body.variants, null);
          proposal.revoked_at = body.revoked_at;
          proposal.p_variants = proposal.p_offer = null;
          return respond(res, 200, [{id: fixtureId}]);
        }
        return respond(res, 200, proposal ? [{
          id: fixtureId, lead_id: proposal.p_lead_id, expires_at: proposal.expires_at,
          viewed_at: proposal.viewed_at, interested_at: proposal.interested_at,
          refused_at: proposal.refused_at, revoked_at: proposal.revoked_at
        }] : []);
      }
      return respond(res, 404, null);
    } catch (error) {
      state.fixtureFailure = error;
      return respond(res, 500, null);
    }
  });
  t.after(() => assert.equal(state.fixtureFailure, undefined));

  const route = createPrivateProposals({
    endpoint, serviceKey, authorizedOperator: studioOperator(endpoint, 'publishable-key-fixture'),
    getToken: req => req.headers.authorization?.slice(7) || ''
  });
  const origin = await listen(t, (req, res) => route(req, res, new URL(req.url, endpoint).pathname));
  const get = (path, options = {}) => fetch(origin + path, options);
  const valid = {
    leadId: 'valid-lead', contactAuthorized: true, variants: [model(0), model(1), model(2)],
    offer: {title: 'Site sob medida', price: 'R$ 1.900', conditions: 'Duas parcelas'}
  };
  const auth = {authorization: 'Bearer operator-session', 'Content-Type': 'application/json'};
  const send = (body = valid, authorization = auth.authorization) => get(api, {
    method: 'POST', headers: {...auth, authorization}, body: JSON.stringify(body)
  });

  return {get, send, auth, valid, state, origin};
}

test('cria um link privado com três HTMLs isolados, registra interação real e exclui materiais na recusa', async t => {
  const {get, send, auth, state} = await setup(t);
  const response = await send();
  assert.equal(response.status, 201);
  const {id, path, expiresAt} = await response.json();
  assert.equal(id, fixtureId);
  assert.match(path, /^\/proposta\/[\w-]{43}$/);
  const token = path.slice(recipient.length + 1);
  assert.equal(state.proposal.p_token_hash, createHash('sha256').update(token).digest('hex'));
  assert.ok(Math.abs(Date.parse(expiresAt) - Date.now() - 7 * 86400000) < 1000);
  assert.equal(state.proposal.p_days, 7);

  const portal = await get(path);
  assert.equal(portal.status, 200);
  assert.match(portal.headers.get('x-robots-tag'), /noindex/);
  assert.match(portal.headers.get('cache-control'), /no-store/);
  assert.equal(portal.headers.get('referrer-policy'), 'no-referrer');
  const landing = await portal.text();
  assert.match(landing, /Salão &lt;Piloto&gt;/);
  for (const label of ['Editorial', 'Escultural', 'Minimal']) assert.match(landing, new RegExp(label));
  assert.doesNotMatch(landing, /R\$ 1.900/);
  assert.ok(!state.proposal.viewed_at, 'uma leitura de robô não é uma visualização');

  const crossSite = await get(path + '/excluir', {method: 'POST', headers: {'sec-fetch-site': 'cross-site'}});
  assert.equal(crossSite.status, 403);
  const view = await get(path + '/visualizar/2', {method: 'POST', redirect: 'manual'});
  assert.equal(view.status, 303);
  assert.equal(view.headers.get('location'), path + '/visualizar/2');
  assert.match(await (await get(path + '/visualizar/2')).text(), /<iframe sandbox=.*\/modelo\/2/);
  const frame = await get(path + '/modelo/2');
  assert.match(frame.headers.get('content-security-policy'), /sandbox.+allow-popups/);
  assert.match(frame.headers.get('content-security-policy'), /img-src data:/);
  assert.match(await frame.text(), /<h1>Escultural<\/h1>/);
  assert.equal(state.proposal.viewed_at, 'now');

  const proceed = await get(path + '/prosseguir', {method: 'POST'});
  assert.match(await proceed.text(), /R\$ 1.900/);
  assert.equal(state.proposal.interested_at, 'now');
  const listed = await (await get(api, {headers: auth})).text();
  assert.match(listed, /interested_at/);
  assert.ok(!listed.includes(state.proposal.p_token_hash));
  assert.doesNotMatch(listed, /(?:variants|html|token_hash|R\$ 1.900)/);

  assert.match(await (await get(path + '/excluir')).text(), /Confirmar exclusão/);
  assert.equal(state.blocked, false);
  const refused = await get(path + '/excluir', {method: 'POST'});
  assert.match(await refused.text(), /Obrigado pelo seu tempo/);
  assert.equal(state.proposal.p_variants, null);
  assert.equal(state.proposal.p_offer, null);
  assert.equal((await get(path)).status, 410);
  assert.equal((await get(path + '/modelo/2')).status, 410);
  assert.equal((await send()).status, 409);
});

test('recusa acessos indevidos, compartilhamentos sem consentimento e modelos inválidos', async t => {
  const {get, send, valid, state} = await setup(t);
  assert.equal((await send(valid, '')).status, 401);
  assert.equal((await send(valid, 'Bearer viewer-session')).status, 403);
  assert.equal((await send({...valid, contactAuthorized: false})).status, 422);
  assert.equal((await send({...valid, variants: [model(0), model(0), model(2)]})).status, 422);
  assert.equal((await send({...valid, expiresInDays: 0})).status, 422);
  for (const markup of [
    '<img src="https://foto.example/teste.jpg">',
    '<div style="background:url(https://foto.example/teste.jpg)">Foto</div>',
    '<script>console.log("ativo")</script>',
    '<meta http-equiv="refresh" content="0;url=https://other.test">'
  ]) {
    const variant = {...model(0), html: model(0).html.replace('</body>', markup + '</body>')};
    assert.equal((await send({...valid, variants: [variant, model(1), model(2)]})).status, 422);
  }
  assert.equal((await send({...valid, leadId: 'other-lead'})).status, 404);
  assert.equal(state.writes, 0);
  assert.equal((await get(recipient + '/' + 'a'.repeat(43))).status, 404);
});

test('validades configuradas e revogação pelo operador bloqueiam também a URL do modelo', async t => {
  const {get, send, auth, valid, state} = await setup(t);
  let {path, id} = await (await send({...valid, expiresInDays: 2})).json();
  assert.equal(state.proposal.p_days, 2);
  state.expired = true;
  assert.equal((await get(path + '/modelo/1')).status, 410);
  assert.equal(state.proposal.p_variants, null);
  state.expired = false;
  ({path, id} = await (await send()).json());
  assert.equal((await get(api + '/' + id + '/revoke', {method: 'POST', headers: auth})).status, 200);
  assert.equal(state.proposal.p_variants, null);
  assert.equal((await get(path + '/modelo/1')).status, 410);
});

test('a página navega pelos modelos e confirma a recusa no Chromium', {
  skip: !process.env.PROSPECT_PLAYWRIGHT_MODULE,
  timeout: 25000
}, async t => {
  const {chromium} = await import(process.env.PROSPECT_PLAYWRIGHT_MODULE);
  const pilotDir = process.env.PROSPECT_PROPOSAL_TEST_HTML_DIR;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox']
  });
  t.after(() => browser.close());
  for (const viewport of [{width: 390, height: 844}, {width: 1440, height: 900}]) {
    const {origin, send, valid} = await setup(t);
    const variants = pilotDir ? await Promise.all(['identidade', 'experiencia', 'localizacao'].map(async (file, i) => ({
      label: valid.variants[i].label,
      html: await readFile(join(pilotDir, file + '.html'), 'utf8')
    }))) : valid.variants;
    const response = await send({...valid, variants});
    assert.equal(response.status, 201, response.ok ? '' : await response.text());
    const {path} = await response.json();
    const page = await browser.newPage({viewport});
    try {
      await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
      await page.goto(origin + path);
      for (const {label} of variants) {
        await page.getByRole('button', {name: label}).click();
        const frame = page.frameLocator('iframe[title="' + label + '"]');
        await frame.locator('main h1').waitFor();
        const assets = frame.locator('img');
        for (const asset of await assets.all()) {
          await asset.evaluate(img => { img.loading = 'eager'; });
          await asset.evaluate(img => img.decode());
          assert.equal(await asset.evaluate(img => img.naturalWidth > 0), true);
        }
        assert.equal(await frame.locator('html').evaluate(html => html.scrollWidth <= window.innerWidth + 2), true);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.getByRole('button', {name: 'Prosseguir'}).click();
      await page.getByText('R$ 1.900', {exact: true}).waitFor();
      await page.getByRole('link', {name: 'Excluir e não receber mais'}).click();
      await page.getByRole('button', {name: 'Confirmar exclusão'}).click();
      await page.getByRole('heading', {name: 'Obrigado pelo seu tempo'}).waitFor();
      assert.equal((await page.goto(origin + path)).status(), 410);
    } finally {
      await page.close();
    }
  }
});
