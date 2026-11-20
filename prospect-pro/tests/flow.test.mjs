// npm install --no-save --no-package-lock playwright-core@1.61.0
// CHROMIUM_PATH=/usr/bin/chromium node --test tests/flow.test.mjs
// Usa o servidor da aplicação com serviços simulados em loopback.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {business, operator, publishableKey, startProviders, token} from './fixtures/providers.mjs';

const playwrightModule = process.env.PROSPECT_PLAYWRIGHT_MODULE || 'playwright-core';
const {chromium} = await import(playwrightModule);
const serverPath = fileURLToPath(new URL('../server.js', import.meta.url));
const guardPath = fileURLToPath(new URL('./fixtures/network-guard.mjs', import.meta.url));
const fakeImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOAMAAAAASUVORK5CYII=', 'base64');
const authorization = {Authorization: 'Bearer ' + token};

async function availablePort() {
  const socket = createServer().listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

async function startApp(t, providers, googleEnabled) {
  const port = await availablePort();
  const origin = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, ['--import', guardPath, serverPath], {
    env: {
      NODE_ENV: 'test',
      PORT: String(port),
      PREVIEW_PUBLIC_ORIGIN: origin,
      PROSPECT_PROVIDER_FIXTURE_ORIGIN: providers.origin,
      SUPABASE_URL: providers.origin,
      SUPABASE_PUBLISHABLE_KEY: publishableKey,
      GOOGLE_PLACES_API_KEY: googleEnabled ? 'only_local_fixture_google_key' : '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', chunk => {logs += chunk;});
  child.stderr.on('data', chunk => {logs += chunk;});
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await once(child, 'exit');
    }
  });
  for (let attempt = 0; attempt < 30; attempt++) {
    if (child.exitCode !== null) break;
    const health = await fetch(origin + '/health').catch(() => null);
    if (health?.ok) return origin;
    await delay(60);
  }
  assert.fail('Servidor local indisponível: ' + logs);
}

async function browserContext(browser, origin, providers, options = {}) {
  const context = await browser.newContext(options);
  context.setDefaultTimeout(10000);
  const openedUrls = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if ([origin, providers.origin].includes(url.origin)) {
      await route.continue();
      return;
    }
    if (route.request().isNavigationRequest()) {
      openedUrls.push(url);
      await route.fulfill({contentType: 'text/html', body: '<title>Destino externo simulado</title>'});
      return;
    }
    if (route.request().resourceType() === 'image') {
      await route.fulfill({contentType: 'image/png', body: fakeImage});
      return;
    }
    await route.abort();
  });
  return {context, openedUrls};
}

async function eventually(check, message) {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (await check()) return;
    await delay(60);
  }
  assert.fail(message);
}

async function searchInputs(page) {
  await page.locator('#mode').selectOption('api');
  await page.locator('#term').fill('salões de beleza');
  await page.locator('#city').fill('Mauá, SP');
}

async function visibleText(locator, text) {
  await locator.filter({hasText: text}).waitFor();
}

test('API protege a chave e bloqueia a 51ª consulta antes de chamar Google', {timeout: 20000}, async t => {
  const providers = await startProviders();
  t.after(providers.close);
  const unconfigured = await startApp(t, providers, false);
  const search = '/api/search?term=sal%C3%A3o&city=Mau%C3%A1';
  const disabled = await fetch(unconfigured + '/api/quota');
  assert.deepEqual(await disabled.json().then(q => [q.limit, q.enabled]), [50, false]);
  assert.equal((await fetch(unconfigured + search, {headers: authorization})).status, 503);
  assert.equal(providers.state.googleQueries.length, 0);

  const origin = await startApp(t, providers, true);
  assert.equal((await fetch(origin + search)).status, 401);
  providers.state.used = 49;
  const [first, second] = await Promise.all([
    fetch(origin + search, {headers: authorization}),
    fetch(origin + search, {headers: authorization}),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [200, 429]);
  const result = await (first.ok ? first : second).json();
  assert.equal(result.usage.used, 50);
  assert.equal(result.data[0].googleId, business.id);
  assert.equal(providers.state.googleQueries.length, 1);
  const quota = await fetch(origin + '/api/quota', {headers: authorization}).then(res => res.json());
  assert.equal(quota.remaining, 0);
  const config = await fetch(origin + '/api/public-config').then(res => res.text());
  assert.equal(config.includes('only_local_fixture_google_key'), false);
  assert.deepEqual(providers.state.failures, []);
});

test('Prospecção, três propostas, edição, publicação e confirmação de envio', {timeout: 65000}, async t => {
  const providers = await startProviders();
  t.after(providers.close);
  const origin = await startApp(t, providers, true);
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium'});
  t.after(() => browser.close());
  const {context, openedUrls} = await browserContext(browser, origin, providers, {viewport: {width: 1440, height: 1000}});
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error));
  await page.goto(origin);
  await page.locator('[data-page="search"]').click();
  await page.waitForURL('**/?view=search');
  await page.locator('#prospectAuthPanel').waitFor();
  await page.locator('#radarEmail').fill(operator.email);
  await page.locator('#radarPassword').fill('senha-do-teste-local');
  await page.locator('#radarLogin').click();
  await page.locator('#prospectAuthPanel').waitFor({state: 'hidden'});

  await searchInputs(page);
  let releaseGoogle;
  const waitForGoogle = new Promise(resolve => {releaseGoogle = resolve;});
  t.after(releaseGoogle);
  providers.controlGoogle(async () => {
    await waitForGoogle;
    return [200, {places: [business, {id: 'other-result', displayName: {text: 'Salão Horizonte'}, websiteUri: 'https://horizonte.example.test'}]}];
  });
  await page.locator('#radarForm #city').press('Enter');
  await page.locator('#radarStage[data-state="working"][data-phase="google"]').waitFor();
  const currentStep = page.locator('#radarStage [aria-current="step"]');
  assert.match(await currentStep.textContent(), /Google/i);
  assert.equal(await page.locator('.radar-sweep').evaluate(element => getComputedStyle(element).animationName), 'radar-spin');
  assert.equal(await page.locator('#searchBtn').isDisabled(), true);
  await eventually(() => providers.state.googleQueries.length === 1, 'O Google simulado não recebeu a busca.');
  releaseGoogle();
  await page.locator('#radarStage[data-state="done"]').waitFor();
  await visibleText(page.locator('#searchResults'), business.displayName.text);
  assert.equal(await page.locator('#searchResults').getByText('Salão Horizonte').count(), 0);
  await page.locator('#searchResults [data-radar-filter="yes"]').click();
  await visibleText(page.locator('#searchResults'), 'Salão Horizonte');
  await page.locator('#searchResults [data-radar-filter="no"]').click();
  assert.deepEqual(providers.state.googleQueries[0].textQuery, 'salões de beleza em Mauá, SP');
  await eventually(() => providers.state.bookmarks.length === 1, 'O histórico não recebeu os Place IDs.');
  assert.deepEqual(providers.state.bookmarks[0].place_ids, [business.id, 'other-result']);

  await page.locator('#searchResults [data-radar-save]').first().click();
  await page.locator('#crm-verified').check();
  await page.locator('#confirm').click();
  await eventually(() => providers.state.leads.size === 1, 'O CRM não recebeu a empresa confirmada.');
  const lead = [...providers.state.leads.values()][0];
  assert.equal(lead.google_place_id, business.id);
  assert.equal(lead.operator_confirmed, true);
  const saveAgain = page.locator('#searchResults [data-radar-save]').first();
  if (await saveAgain.isEnabled()) await saveAgain.click();
  assert.equal(await page.locator('#crm-verified').isVisible(), false);
  assert.equal(providers.state.leads.size, 1);

  await page.locator('[data-page="leads"]').click();
  const leadRow = page.locator('#leadRows tr').filter({hasText: business.displayName.text});
  await leadRow.waitFor();
  assert.equal(await leadRow.count(), 1);
  await leadRow.locator('[data-site]').click();
  await page.waitForURL('**/studio?lead=*');
  assert.equal(await page.locator('#studioCompany').inputValue(), business.displayName.text);
  const proposals = page.locator('#threeProposals .proposal-card');
  await proposals.nth(2).waitFor();
  assert.equal(await proposals.count(), 3);
  const directions = [], headlines = [], images = [], layouts = [];
  for (let index = 0; index < 3; index++) {
    const preview = proposals.nth(index).frameLocator('iframe');
    const hero = preview.locator('.hero');
    await hero.waitFor({state: 'attached'});
    directions.push(await preview.locator('body').getAttribute('data-direction'));
    headlines.push(await hero.locator('h1').textContent());
    images.push(await hero.locator('img').first().getAttribute('src'));
    layouts.push(await hero.getAttribute('class'));
    assert.match(await preview.locator('body').textContent(), /Salão Aurora/);
  }
  for (const values of [directions, headlines, images, layouts]) {
    assert.ok(values.every(Boolean), 'Cada proposta precisa renderizar o elemento avaliado.');
    assert.equal(new Set(values).size, 3, 'As três propostas devem ser distintas.');
  }

  await proposals.first().locator('[data-choose]').click();
  const headline = page.locator('#headline');
  const initialHeadline = await headline.inputValue();
  const customHeadline = 'Cortes, cor e cuidado no Salão Aurora';
  await headline.fill(customHeadline);
  await page.locator('#undoEdit').click();
  assert.equal(await headline.inputValue(), initialHeadline);
  await page.locator('#redoEdit').click();
  assert.equal(await headline.inputValue(), customHeadline);
  await page.locator('#editorOverlay [data-device="mobile"]').click();
  await visibleText(page.locator('#previewLabel'), /375|celular/i);
  const editorPreview = page.frameLocator('#websitePreview');
  await visibleText(editorPreview.locator('h1'), customHeadline);
  await page.locator('#saveProject').click();
  await eventually(() => providers.state.projectVersions.size === 1, 'A versão do rascunho não chegou à nuvem simulada.');
  await page.locator('#closeEditor').click();

  await page.goto(origin);
  await page.locator('a[href="/studio?view=projects"]').click();
  await page.waitForURL('**/studio?view=projects');
  await visibleText(page.locator('#projectsView'), business.displayName.text);
  await page.locator('#projectsView [data-load]').click();
  assert.equal(await headline.inputValue(), customHeadline);
  await page.locator('#publishPreview').click();
  await page.locator('#confirmPublish').click();
  await page.locator('#publishResult').waitFor();
  const link = await page.locator('#publicLink').inputValue();
  assert.match(new URL(link).pathname, /^\/mvp\/salao-aurora-/);
  const opened = context.waitForEvent('page');
  await page.locator('#openPublicLink').click();
  const publicPage = await opened;
  await publicPage.waitForURL(link);
  await visibleText(publicPage.locator('h1'), customHeadline);
  assert.equal(await publicPage.locator('meta[property="og:url"]').getAttribute('content'), link);
  assert.match(await publicPage.locator('meta[property="og:image"]').getAttribute('content'), /^https:\/\//);
  assert.match(await publicPage.locator('meta[property="og:title"]').getAttribute('content'), /Salão Aurora/);
  await publicPage.setViewportSize({width: 375, height: 812});
  assert.equal(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(providers.state.previews.size, 1);
  await publicPage.close();

  assert.match(await page.locator('#publicMessage').inputValue(), /Salão Aurora/);
  assert.ok((await page.locator('#publicMessage').inputValue()).includes(link));
  await page.locator('#openBusinessWhatsapp').click();
  await eventually(() => openedUrls.some(url => url.hostname === 'wa.me'), 'O WhatsApp simulado não foi aberto.');
  const whatsapp = openedUrls.find(url => url.hostname === 'wa.me');
  assert.ok(whatsapp.searchParams.get('text').includes(link));
  await eventually(() => providers.state.messages.length === 1, 'A abertura do WhatsApp não foi registrada.');
  assert.equal(providers.state.leads.get(lead.id).proposal_sent_at, null);

  const secondBrowser = await browserContext(browser, origin, providers);
  await secondBrowser.context.addInitScript(({accessToken, appOrigin}) => {
    if (location.origin === appOrigin) {
      sessionStorage.setItem('prospect_publisher_session_v1', JSON.stringify({access_token: accessToken}));
    }
  }, {accessToken: token, appOrigin: origin});
  const secondPage = await secondBrowser.context.newPage();
  await secondPage.goto(origin + '/studio?view=projects');
  await visibleText(secondPage.locator('#projectsView'), business.displayName.text);
  await visibleText(secondPage.locator('#projectsList'), 'Prévia publicada');
  await secondPage.locator('#projectsView [data-load]').click();
  assert.equal(await secondPage.locator('#headline').inputValue(), customHeadline);
  await secondPage.locator('#closeEditor').click();
  await secondPage.goto(origin);
  await secondPage.locator('[data-page="leads"]').click();
  await visibleText(secondPage.locator('#leadRows'), /WhatsApp aberto/);
  await secondPage.locator('[data-page="sent"]').click();
  assert.equal(await secondPage.locator('#sentProposalRows').getByText(business.displayName.text).count(), 0);
  await secondPage.locator('[data-page="leads"]').click();
  await secondPage.locator('[data-crm-confirm]').click();
  await secondPage.locator('#sent-confirm-checkbox').check();
  await secondPage.locator('#confirm').click();
  await eventually(() => Boolean(providers.state.leads.get(lead.id).proposal_sent_at), 'A confirmação de envio não foi sincronizada.');
  await secondPage.locator('[data-page="sent"]').click();
  await visibleText(secondPage.locator('#sentProposalRows'), business.displayName.text);
  await secondPage.locator('[data-page="leads"]').click();
  await secondPage.locator('#filter').selectOption('all');
  await secondPage.locator('#leadRows [data-wa]').click();
  await visibleText(secondPage.locator('#modalTitle'), /proposta já enviada/i);
  await secondPage.locator('#cancel').click();
  assert.equal(providers.state.messages.length, 1);
  await secondPage.locator('[data-page="sent"]').click();
  const archivePrompt = secondPage.waitForEvent('dialog').then(dialog => dialog.accept());
  await secondPage.locator('[data-sent-archive]').click();
  await archivePrompt;
  await eventually(() => Boolean(providers.state.leads.get(lead.id).archived_at), 'O arquivamento não foi sincronizado.');
  await secondPage.locator('[data-page="leads"]').click();
  await secondPage.locator('#filter').selectOption('archived');
  await secondPage.locator('[data-crm-restore]').click();
  await eventually(() => providers.state.leads.get(lead.id).archived_at === null, 'A recuperação não foi sincronizada.');
  assert.ok(providers.state.leads.get(lead.id).proposal_sent_at);

  await page.goto(origin + '/studio');
  await page.locator('#studioCompany').fill('Oficina Pinheiro');
  await page.locator('#studioSegment').fill('Oficina mecânica');
  await page.locator('#studioCity').fill('São Caetano do Sul, SP');
  await page.locator('.studio-brief summary').click();
  await page.locator('#studioServices').fill('Revisão preventiva\nDiagnóstico de motor');
  await page.locator('#generateThree').click();
  const workshop = page.locator('#threeProposals .proposal-card').first().frameLocator('iframe');
  await visibleText(workshop.locator('body'), 'Oficina Pinheiro');
  await visibleText(workshop.locator('body'), 'Revisão preventiva');
  assert.equal(headlines.includes(await workshop.locator('h1').textContent()), false);
  assert.equal(images.includes(await workshop.locator('.hero img').first().getAttribute('src')), false);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(providers.state.failures, []);
});

test('No celular, respeita movimento reduzido e separa busca vazia de erro', {timeout: 30000}, async t => {
  const providers = await startProviders();
  t.after(providers.close);
  const origin = await startApp(t, providers, true);
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium'});
  t.after(() => browser.close());
  const {context} = await browserContext(browser, origin, providers, {viewport: {width: 375, height: 812}, isMobile: true, hasTouch: true, reducedMotion: 'reduce'});
  await context.addInitScript(({accessToken, appOrigin}) => {
    if (location.origin === appOrigin) {
      sessionStorage.setItem('prospect_publisher_session_v1', JSON.stringify({access_token: accessToken}));
    }
  }, {accessToken: token, appOrigin: origin});
  const page = await context.newPage();
  await page.goto(origin);
  const navigation = page.locator('[data-page="search"]');
  if (!(await navigation.isVisible())) {
    const menu = page.locator('#menuToggle');
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  }
  await navigation.click();
  assert.equal(await page.locator('#menuToggle').getAttribute('aria-expanded'), 'false');
  await searchInputs(page);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  let releaseGoogle;
  const waitForGoogle = new Promise(resolve => {releaseGoogle = resolve;});
  t.after(releaseGoogle);
  providers.controlGoogle(async () => {
    await waitForGoogle;
    return [200, {places: []}];
  });
  await page.locator('#searchBtn').click();
  await page.locator('#radarStage[data-state="working"][data-phase="google"]').waitFor();
  assert.equal(await page.locator('.radar-sweep').evaluate(element => getComputedStyle(element).animationName), 'none');
  releaseGoogle();
  await page.locator('#radarStage[data-state="done"]').waitFor();
  assert.equal(await page.locator('#searchResults [data-radar-save]').count(), 0);
  await visibleText(page.locator('#radarMessage'), /nenhum|0 /i);

  providers.controlGoogle(() => [503, {error: {message: 'Provedor de teste indisponível'}}]);
  await page.locator('#searchBtn').click();
  await page.locator('#radarStage[data-state="error"]').waitFor();
  await visibleText(page.locator('#searchResults'), 'Provedor de teste indisponível');
  assert.equal(await page.locator('#searchResults [data-radar-save]').count(), 0);
  assert.equal(await page.locator('#searchBtn').isEnabled(), true);
  await page.locator('#mode').selectOption('free');
  const mapTab = context.waitForEvent('page');
  await page.locator('#searchBtn').click();
  const map = await mapTab;
  await map.waitForURL('https://www.google.com/maps/search/**');
  assert.equal(providers.state.googleQueries.length, 2);
  assert.equal(await page.locator('#searchResults [data-radar-save]').count(), 0);
  assert.deepEqual(providers.state.failures, []);
});
