import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const { chromium } = await import(process.env.PROSPECT_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = 'http://prospect.test';
const token = 'isolated-dashboard-test';
const timestamp = new Date().toISOString();
const soon = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
const fixtureLead = (id, fields) => ({
  id, business_name: `Empresa ${id}`, city: 'Mauá', stage: 'Novo', updated_at: timestamp,
  phone: '11 94777-1234', operator_confirmed: true, ...fields,
});

test('Indicadores comerciais, confirmação privada e bloqueio de contato no navegador', { timeout: 30000 }, async t => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  t.after(() => context.close());
  const leads = new Map([
    ['a', fixtureLead('a', { stage: 'Fechado', proposal_sent_at: timestamp })],
    ['b', fixtureLead('b', { stage: 'Proposta enviada', proposal_sent_at: timestamp })],
    ['c', fixtureLead('c', { stage: 'Site criado', preview_slug: 'empresa-c' })],
    ['d', fixtureLead('d', { stage: 'Proposta pronta' })],
    ['e', fixtureLead('e', { stage: 'Fechado' })],
    ['f', fixtureLead('f', { stage: 'Site criado', preview_slug: 'empresa-f' })],
  ]);
  const proposals = [
    { id: 'pa', lead_id: 'a', expires_at: past, viewed_at: past, interested_at: past },
    { id: 'pb', lead_id: 'b', expires_at: past, viewed_at: past, refused_at: past, revoked_at: past },
    { id: 'pd', lead_id: 'd', expires_at: soon, viewed_at: timestamp },
  ];
  const external = [];
  const revocations = [];
  const staticFiles = new Map([
    ['/', 'index.html'], ['/social-profiles.js', 'social-profiles.cjs'],
    ...['prospect-links.js', 'prospect-dashboard.js', 'prospect-crm.js', 'prospect-radar.js',
      'prospect-auth.js', 'prospect-dashboard.css', 'prospect-radar.css'].map(name => [`/${name}`, name])
  ]);
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (url.origin !== origin) {
      external.push(url.href);
      return route.abort();
    }
    if (staticFiles.has(path)) {
      const contentType = path === '/' ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'application/javascript';
      return route.fulfill({ contentType, body: await readFile(new URL('../' + staticFiles.get(path), import.meta.url)) });
    }
    if (path === '/publication-config.js') return route.fulfill({ contentType: 'application/javascript', body: '' });
    if (path === '/api/public-config') return route.fulfill({ json: { configured: true, supabaseUrl: origin, publishableKey: 'fixture' } });
    if (path === '/api/quota') return route.fulfill({ json: { enabled: true, used: 5 } });
    assert.equal(request.headers().authorization, 'Bearer ' + token);
    if (path === '/auth/v1/user') return route.fulfill({ json: { id: 'operator', app_metadata: { prospect_operator: true } } });
    if (path === '/api/studio/proposals') return route.fulfill({ json: { proposals } });
    if (path === '/api/studio/proposals/pd/revoke') {
      assert.equal(request.method(), 'POST');
      revocations.push('pd');
      proposals.find(proposal => proposal.id === 'pd').revoked_at = timestamp;
      return route.fulfill({ json: { id: 'pd', revoked: true } });
    }
    if (path === '/rest/v1/rpc/prospect_studio_current_projects') return route.fulfill({ json: [{ project_id: 'cloud' }, { project_id: 'both' }] });
    if (path === '/rest/v1/prospect_search_bookmarks') return route.fulfill({ json: [{ place_ids: ['place-a', 'place-b'] }, { place_ids: ['place-a', 'place-c'] }] });
    if (path === '/rest/v1/prospect_crm_leads') {
      if (request.method() === 'POST') {
        const payload = request.postDataJSON();
        for (const lead of payload) leads.set(lead.id, lead);
        return route.fulfill({ json: payload });
      }
      const id = url.searchParams.get('id')?.slice(3);
      return route.fulfill({ json: id ? [leads.get(id)].filter(Boolean) : [...leads.values()] });
    }
    return route.fulfill({ status: 404 });
  });

  await context.addInitScript(({ app, accessToken }) => {
    if (location.origin !== app) return;
    sessionStorage.setItem('prospect_publisher_session_v1', JSON.stringify({ access_token: accessToken }));
    localStorage.setItem('prospect_library_projects', JSON.stringify([{ id: 'local' }, { id: 'both' }]));
  }, { app: origin, accessToken: token });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.getByText('Indicadores atualizados.', { exact: true }).waitFor();
  const figures = new Map(await page.locator('#stats .stat-card').evaluateAll(cards => cards.map(card => [card.querySelector('span').textContent, card.querySelector('strong').textContent])));
  assert.deepEqual(Object.fromEntries(figures), {
    'Empresas encontradas': '3',
    'Sites criados': '3',
    'Propostas enviadas': '2',
    'Propostas visualizadas': '3',
    'Clientes interessados': '1',
    'Propostas recusadas': '1',
    'Propostas expiradas': '1',
    'Vendas realizadas': '2',
    'Taxa de conversão': '50%',
  });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.locator('.nav[data-page="leads"]').click();
  await page.locator('[data-crm-confirm="d"]').click();
  await page.locator('#sent-confirm-checkbox').check();
  await page.getByRole('button', { name: 'Registrar envio' }).click();
  await page.locator('#filter').selectOption('sent');
  await page.locator('[data-crm-sent="d"]').waitFor();
  assert.equal(await page.locator('#stats .stat-card').filter({ hasText: 'Propostas enviadas' }).locator('strong').textContent(), '3');
  await page.locator('[data-crm-revoke="d"]').click();
  await page.locator('#cancel').click();
  assert.deepEqual(revocations, []);
  await page.locator('[data-crm-revoke="d"]').click();
  await page.getByRole('button', { name: 'Revogar e excluir prévias' }).click();
  await page.getByText('Link privado revogado. As três prévias foram excluídas.', { exact: true }).waitFor();
  assert.deepEqual(revocations, ['pd']);
  assert.equal(await page.locator('[data-crm-revoke="d"]').count(), 0);

  await page.locator('#filter').selectOption('pending');
  await page.locator('[data-wa="c"]').click();
  await page.getByRole('button', { name: 'Abrir WhatsApp' }).click();
  await page.getByText('Confirme a autorização prévia da empresa para continuar.', { exact: true }).waitFor();
  await page.locator('#permit').check();
  Object.assign(leads.get('c'), { opted_out: true, stage: 'Não contatar' });
  await page.getByRole('button', { name: 'Abrir WhatsApp' }).click();
  await page.getByText('Esta oportunidade está bloqueada ou não pôde ser confirmada na nuvem.', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-wa="c"]').count(), 0);
  assert.deepEqual(external, []);
  await page.locator('#cancel').click();
  await page.locator('[data-wa="f"]').click();
  await page.locator('#permit').check();
  const simulated = context.waitForEvent('requestfailed', request => new URL(request.url()).hostname === 'wa.me');
  await page.getByRole('button', { name: 'Abrir WhatsApp' }).click();
  const prepared = new URL((await simulated).url());
  assert.equal(prepared.pathname, '/5511947771234');
  assert.match(prepared.searchParams.get('text'), /Empresa f/);
  assert.deepEqual(external, [prepared.href]);
  assert.equal(leads.get('f').proposal_sent_at ?? null, null);
  assert.deepEqual(errors, []);
});
