// npm install --no-save --no-package-lock playwright-core@1.61.0
// CHROMIUM_PATH=/usr/bin/chromium node --test tests/flow.test.mjs
// Usa o servidor da aplicação com serviços simulados em loopback.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {unzipSync, strFromU8} from 'fflate';
import {createServer} from 'node:net';
import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {business, openaiKey, operator, publishableKey, startProviders, token, viewOnlyToken} from './fixtures/providers.mjs';
import { websiteMetadata, instagramProfile } from '../brand-sources.js';

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

async function startApp(t, providers, googleEnabled, {aiEnabled = false, metaEnabled = false, netlifyEnabled = false} = {}) {
  const port = await availablePort();
  const origin = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, ['--import', guardPath, serverPath], {
    env: {
      NODE_ENV: 'test',
      PORT: String(port),
      PREVIEW_PUBLIC_ORIGIN: origin,
      PROSPECT_PUBLICATION_ORIGIN: netlifyEnabled ? providers.origin : '',
      PROSPECT_PROVIDER_FIXTURE_ORIGIN: providers.origin,
      PROSPECT_PROVIDER_PUBLIC_ORIGIN: providers.publicOrigin,
      SUPABASE_URL: aiEnabled || metaEnabled ? providers.publicOrigin : providers.origin,
      SUPABASE_PUBLISHABLE_KEY: publishableKey,
      GOOGLE_PLACES_API_KEY: googleEnabled ? 'only_local_fixture_google_key' : '',
      OPENAI_API_KEY: aiEnabled ? openaiKey : '',
      OPENAI_BASE_URL: providers.origin + '/v1',
      INSTAGRAM_BUSINESS_ACCOUNT_ID: metaEnabled ? '123456' : '',
      INSTAGRAM_GRAPH_ACCESS_TOKEN: metaEnabled ? 'only_local_fixture_meta' : '',
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
    if (url.origin === providers.publicOrigin) {
      const response = await route.fetch({url: providers.origin + url.pathname + url.search, maxRedirects: 0});
      await route.fulfill({response});
      return;
    }
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

const mockOutput = result => [200, {
  output: [{type: 'message', content: [{type: 'output_text', text: JSON.stringify(result)}]}],
}];

test('IA valida o operador, preserva os contatos e gera três propostas no servidor', {timeout: 20000}, async t => {
  const providers = await startProviders();
  t.after(providers.close);
  const unconfigured = await startApp(t, providers, false);
  const statusRoute = '/api/studio/ai/status';
  const textRoute = '/api/studio/ai/text';
  const company = {
    name: business.displayName.text,
    industry: 'Salão de beleza',
    city: 'Mauá, SP',
    address: business.formattedAddress,
    phone: business.internationalPhoneNumber,
    email: 'contato-privado@example.test',
    services: ['Corte | Lavagem e finalização'],
  };
  const proposalRequest = {mode: 'generate', company};
  async function requestText(base, body, bearer) {
    const headers = {'Content-Type': 'application/json'};
    if (bearer) headers.Authorization = 'Bearer ' + bearer;
    return fetch(base + textRoute, {method: 'POST', headers, body: JSON.stringify(body)});
  }
  assert.deepEqual(await fetch(unconfigured + statusRoute).then(res => res.json()), {text: false, images: false});
  assert.equal((await requestText(unconfigured, proposalRequest, token)).status, 503);
  const origin = await startApp(t, providers, false, {aiEnabled: true});
  assert.deepEqual(await fetch(origin + statusRoute).then(res => res.json()), {text: true, images: true});
  assert.equal((await requestText(origin, proposalRequest)).status, 401);
  assert.equal((await requestText(origin, proposalRequest, 'invalid-token')).status, 401);
  assert.equal((await requestText(origin, proposalRequest, viewOnlyToken)).status, 403);
  assert.equal((await fetch(origin + '/api/studio/ai/image', {method: 'POST'})).status, 401);
  assert.equal(providers.state.aiTexts.length, 0);
  assert.equal(providers.state.aiImages.length, 0);

  const proposals = [
    {
      headline: 'Corte pensado para a rotina em Mauá',
      summary: 'O Salão Aurora oferece corte com lavagem e finalização.',
      about: 'Converse com o Salão Aurora sobre como adaptar o corte ao tempo que você tem para finalizar o cabelo.',
      cta: 'Consultar horários', services: company.services, faq: [],
    },
    {
      headline: 'Da lavagem à finalização no mesmo atendimento',
      summary: 'Confira como o corte é preparado e finalizado no Salão Aurora.',
      about: 'Use a conversa antes do atendimento para mostrar suas referências e explicar como costuma arrumar seu cabelo.',
      cta: 'Conversar com o salão', services: company.services, faq: [],
    },
    {
      headline: 'Conheça as etapas do próximo corte',
      summary: 'Veja o que o salão informou sobre corte, lavagem e finalização.',
      about: 'Peça os detalhes do corte e confirme com a equipe o horário mais adequado antes de ir ao salão.',
      cta: 'Pedir mais detalhes', services: company.services, faq: [],
    },
  ];
  providers.controlAiText(() => mockOutput({proposals}));
  const generated = await requestText(origin, proposalRequest, token);
  assert.equal(generated.status, 200);
  assert.deepEqual(await generated.json(), {proposals});
  const payload = providers.state.aiTexts[0];
  assert.equal(payload.store, false);
  assert.equal(payload.text.format.name, 'site_proposals');
  assert.match(payload.instructions,/prospect-premium/);
  const context = JSON.parse(payload.input).company;
  assert.equal(context.name, company.name);
  assert.deepEqual(context.services, company.services);
  assert.equal(context.phone, undefined);
  assert.equal(context.email, undefined);

  providers.controlAiText(() => mockOutput({
    changes: {
      headline: 'Cortes no Salão Aurora', color: '#267841', headingSize: '1.15',
      phone: '1111111111', name: 'Outro estabelecimento', photo: 'https://example.test/imagem.webp',
    },
    summary: 'Ajuste de título e destaque.',
  }));
  const edited = await requestText(origin, {
    mode: 'edit', company, request: 'Ajuste o título e a cor.',
    draft: {headline: proposals[0].headline, phone: company.phone, email: company.email},
  }, token);
  assert.equal(edited.status, 200);
  assert.deepEqual(await edited.json(), {
    changes: {headline: 'Cortes no Salão Aurora', color: '#267841', headingSize: '1.15'},
    summary: 'Ajuste de título e destaque.',
  });
  assert.equal(providers.state.aiTexts[1].text.format.name, 'site_edit');
  const editedDraft = JSON.parse(providers.state.aiTexts[1].input).draft;
  assert.deepEqual(editedDraft, {headline: proposals[0].headline});
  providers.controlAiText(() => mockOutput({proposals: proposals.slice(0, 2)}));
  assert.equal((await requestText(origin, proposalRequest, token)).status, 502);
  assert.equal(providers.state.aiImages.length, 0);
  assert.equal(providers.state.googleQueries.length, 0);
  assert.deepEqual(providers.state.failures, []);
});

async function openSampleStudio(page, origin) {
  await page.goto(origin + '/studio');
  await page.locator('#studioCompany').fill(business.displayName.text);
  await page.locator('#studioSegment').fill('Salão de beleza');
  await page.locator('#studioCity').fill('Mauá, SP');
  await page.locator('#generateThree').click();
  const choices = page.locator('#threeProposals .proposal-card [data-choose]');
  await choices.nth(2).waitFor();
  await choices.first().click();
}

test('Assistente sugere texto e imagem sem alterar o site até aplicar', {timeout: 45000}, async t => {
  const providers = await startProviders();
  t.after(providers.close);
  const requestedHeadline = 'Cuidado capilar para a rotina em Mauá';
  providers.controlAiText(() => mockOutput({
    changes: {headline: requestedHeadline},
    summary: 'Título revisado para destacar o cuidado capilar no Salão Aurora.',
  }));
  const origin = await startApp(t, providers, false, {aiEnabled: true});
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium'});
  t.after(() => browser.close());
  const {context} = await browserContext(browser, origin, providers, {viewport: {width: 1440, height: 1000}});
  const page = await context.newPage();
  await openSampleStudio(page, origin);
  const preview = page.frameLocator('#websitePreview');
  const oldHeadline = await preview.locator('h1').textContent();
  const oldPhoto = await preview.locator('.hero img').first().getAttribute('src');

  await page.locator('#editorAssistantTab').click();
  await page.locator('#aiConnect').click();
  await page.locator('#pubEmail').fill(operator.email);
  await page.locator('#pubPass').fill('senha-do-teste-local');
  await page.locator('#pubLogin').click();
  await page.locator('#publishReady').waitFor();
  await page.locator('#closePublish').click();

  const request = page.locator('#aiRequest');
  await request.fill('Ajuste o título para destacar cuidado capilar em Mauá.');
  await page.locator('#aiRequestButton').click();
  await page.locator('input[data-ai-field="headline"]').waitFor();
  assert.equal(await preview.locator('h1').textContent(), oldHeadline);
  assert.equal(providers.state.aiTexts.length, 1);
  const textRequest = JSON.stringify(providers.state.aiTexts[0]);
  assert.match(textRequest, /cuidado capilar/i);
  assert.match(textRequest, /Salão Aurora/);
  await page.locator('#aiPreviewChanges').click();
  await visibleText(preview.locator('h1'), requestedHeadline);
  assert.equal(await page.locator('#headline').inputValue(), oldHeadline);
  await page.locator('#aiApply').click();
  await visibleText(preview.locator('h1'), requestedHeadline);
  await page.locator('#undoEdit').click();
  await visibleText(preview.locator('h1'), oldHeadline);
  assert.equal(providers.state.aiTexts.length, 1);

  await page.locator('#editorAssistantTab').click();
  await page.locator('#aiImageMode').click();
  await request.fill('Fotografia horizontal de um salão com luz natural.');
  await page.locator('#aiRequestButton').click();
  const suggestion = page.locator('#aiImagePreview');
  await suggestion.waitFor();
  const generatedImage = await suggestion.getAttribute('src');
  assert.equal(new URL(generatedImage).origin, providers.publicOrigin);
  assert.match(generatedImage, /\/storage\/v1\/object\/public\/prospect-site-images\//);
  assert.equal(await preview.locator('.hero img').first().getAttribute('src'), oldPhoto);
  assert.equal(providers.state.aiImages.length, 1);
  assert.equal(providers.state.uploadedImages.size, 1);
  await page.locator('#aiApply').click();
  await eventually(
    async () => await preview.locator('.hero img').first().getAttribute('src') === generatedImage,
    'A imagem revisada não entrou na prévia.'
  );
  await visibleText(preview.locator('.hero figcaption'), /gerada por IA/i);
  await page.locator('#undoEdit').click();
  await eventually(
    async () => await preview.locator('.hero img').first().getAttribute('src') === oldPhoto,
    'Desfazer não restaurou a imagem anterior.'
  );

  let releaseEdit;
  const waitForEdit = new Promise(resolve => {releaseEdit = resolve;});
  t.after(releaseEdit);
  providers.controlAiText(async () => {
    await waitForEdit;
    return mockOutput({changes: {headline: 'Sugestão para a versão anterior'}, summary: 'Título para outra revisão.'});
  });
  await page.locator('#aiTextMode').click();
  await request.fill('Sugira um título mais curto.');
  await page.locator('#aiRequestButton').click();
  await eventually(() => providers.state.aiTexts.length === 2, 'A segunda sugestão não chegou à IA simulada.');
  await page.locator('#editorFieldsTab').click();
  const manualHeadline = 'Novo título escrito no editor';
  await page.locator('#headline').fill(manualHeadline);
  await page.locator('#editorAssistantTab').click();
  releaseEdit();
  await visibleText(page.locator('#aiStatus'), /rascunho mudou/i);
  assert.equal(await page.locator('#aiSuggestion').isVisible(), false);
  await visibleText(preview.locator('h1'), manualHeadline);
  assert.equal(providers.state.googleQueries.length, 0);
  assert.deepEqual(providers.state.failures, []);
});

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
  const origin = await startApp(t, providers, true, {netlifyEnabled:true});
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
  assert.equal(await page.locator('#searchResults .opp-map-link').getAttribute('href'), business.googleMapsUri);
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
  assert.equal(lead.phone, business.internationalPhoneNumber);
  assert.equal(lead.address, business.formattedAddress);
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
  assert.equal(await page.locator('#studioAddress').inputValue(), business.formattedAddress);
  assert.equal(await page.locator('#studioPhone').inputValue(), business.internationalPhoneNumber);
  assert.equal(await page.locator('#studioWhatsApp').inputValue(), '');
  const proposals = page.locator('#threeProposals .proposal-card');
  await proposals.nth(2).waitFor();
  const automaticPreview = proposals.first().frameLocator('iframe');
  assert.equal(await automaticPreview.locator('.hero-button').getAttribute('href'), 'tel:+5511900000001');
  assert.equal(await automaticPreview.locator('a[href^="https://wa.me/"]').count(), 0);

  await page.locator('#studioWhatsAppConfirmed').check();
  await page.locator('details summary').filter({hasText: /horário.*redes sociais.*mapa/i}).click();
  await page.locator('#studioHours').fill('Segunda a sexta, 09:00 às 18:00');
  await page.locator('#studioEmail').fill('recepcao+site@aurora.example.test');
  await page.locator('#studioInstagram').fill('https://www.instagram.com/salaoaurora.example/');
  await page.locator('#generateThree').click();
  await proposals.nth(2).waitFor();
  assert.equal(await proposals.count(), 3);
  const directions = [], headlines = [], summaries = [], images = [], layouts = [];
  for (let index = 0; index < 3; index++) {
    const preview = proposals.nth(index).frameLocator('iframe');
    const hero = preview.locator('.hero');
    await hero.waitFor({state: 'attached'});
    directions.push(await preview.locator('body').getAttribute('data-direction'));
    headlines.push(await hero.locator('h1').textContent());
    summaries.push(await hero.locator('.hero-summary').textContent());
    images.push(await hero.locator('img').first().getAttribute('src'));
    layouts.push(await hero.getAttribute('class'));
    assert.match(await preview.locator('body').textContent(), /Salão Aurora/);
    await visibleText(preview.locator('.content-reference'), /confirme a disponibilidade/i);
    assert.match(await preview.locator('.service-detail').first().textContent(), /cabelo|coloração|tratamento/i);
    await visibleText(preview.locator('#contato address'), business.formattedAddress);
    await visibleText(preview.locator('#contato .business-hours'), 'Segunda a sexta');
    const map = new URL(await preview.locator('#contato .map-link').getAttribute('href'));
    assert.equal(map.hostname, 'www.google.com');
    assert.equal(map.searchParams.get('query_place_id'), business.id);
    assert.ok(map.searchParams.get('query').includes('Rua das Flores'));
    assert.equal(await preview.locator('[data-contact="phone"]').getAttribute('href'), 'tel:+5511900000001');
    assert.equal(await preview.locator('[data-contact="email"]').getAttribute('href'), 'mailto:recepcao%2Bsite@aurora.example.test');
    assert.equal(await preview.locator('[data-contact="instagram"]').getAttribute('href'), 'https://www.instagram.com/salaoaurora.example/');
    const whatsappLink = await hero.locator('.hero-button').getAttribute('href');
    const whatsapp = new URL(whatsappLink);
    assert.equal(whatsapp.origin + whatsapp.pathname, 'https://wa.me/5511900000001');
    assert.match(whatsapp.searchParams.get('text'), /Olá!.*Salão Aurora/is);
    assert.match(whatsapp.searchParams.get('text'), /corte|cabelo|atendimento/i);
    assert.match(whatsappLink, /Ol%C3%A1/);
  }
  for (const values of [directions, headlines, summaries, images, layouts]) {
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
  assert.equal(link, providers.origin + '/p/salao-aurora');
  const record = [...providers.state.previews.values()][0];
  const legacy = await fetch(origin + '/mvp/' + record.slug);
  assert.equal(legacy.status, 200);
  assert.ok((await legacy.text()).includes(customHeadline));
  assert.equal((await fetch(origin + '/mvp/salao-aurora')).status, 200);
  assert.equal((await fetch(origin + '/mvp/nao-publicado')).status, 404);
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
  await visibleText(publicPage.locator('#contato address'), business.formattedAddress);
  assert.notEqual(await publicPage.locator('.hero-text').evaluate(element => getComputedStyle(element).animationName), 'none');
  await publicPage.emulateMedia({reducedMotion: 'reduce'});
  assert.equal(await publicPage.locator('.hero-text').evaluate(element => getComputedStyle(element).animationName), 'none');
  assert.equal(providers.state.previews.size, 1);
  await publicPage.close();

  assert.match(await page.locator('#publicMessage').inputValue(), /Salão Aurora/);
  assert.ok((await page.locator('#publicMessage').inputValue()).includes(link));
  await page.locator('#openBusinessWhatsapp').click();
  await eventually(() => openedUrls.some(url => url.hostname === 'wa.me'), 'O WhatsApp simulado não foi aberto.');
  const whatsapp = openedUrls.find(url => url.hostname === 'wa.me');
  assert.equal(whatsapp.pathname, '/5511900000001');
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
  const updatedHeadline = 'Uma nova coleção de cortes no Salão Aurora';
  await secondPage.locator('#headline').fill(updatedHeadline);
  await secondPage.locator('#publishPreview').click();
  const updateButton = secondPage.getByRole('button', {name:'Atualizar link publicado'});
  // An old 200 from the CDN must not release the share button before this version arrives.
  let checks = 0;
  await secondPage.route(link, async route => {
    if (route.request().method() !== 'HEAD' || ++checks > 1) return route.continue();
    await route.fulfill({status:200, headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'X-Prospect-Updated','X-Prospect-Updated':'1'}});
  });
  await updateButton.click();
  await secondPage.locator('#publishResult').waitFor();
  assert.ok(checks >= 2);
  assert.equal(await secondPage.locator('#publicLink').inputValue(), link);
  assert.ok((await (await fetch(link)).text()).includes(updatedHeadline));
  assert.equal(providers.state.previews.size, 1);
  assert.equal(providers.state.leads.get(lead.id).preview_slug, 'salao-aurora');
  await secondPage.getByText('Usar o domínio da empresa', {exact:true}).click();
  const download = secondPage.waitForEvent('download');
  await secondPage.locator('#downloadApprovedZip').click();
  const archive = await download;
  assert.equal(archive.suggestedFilename(), 'salao-aurora-site.zip');
  const files = unzipSync(await readFile(await archive.path()));
  assert.deepEqual(Object.keys(files), ['index.html']);
  const finalHtml = strFromU8(files['index.html']);
  assert.ok(finalHtml.includes(updatedHeadline));
  assert.ok(finalHtml.includes('property="og:title"'));
  assert.doesNotMatch(finalHtml, /Proposta de site ·|noindex|Demonstração Portal Central IA/);
  await secondPage.locator('#closePublish').click();
  await secondPage.locator('#closeEditor').click();
  await secondPage.goto(origin + '/studio?lead=' + encodeURIComponent(lead.id));
  await secondPage.locator('#threeProposals .proposal-card').nth(2).waitFor();
  assert.equal(await secondPage.locator('#studioAddress').inputValue(), business.formattedAddress);
  assert.equal(await secondPage.locator('#studioPhone').inputValue(), business.internationalPhoneNumber);
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
  await page.locator('#studioServices').fill('Revisão preventiva | Conferência de freios e fluidos\nDiagnóstico de motor');
  await page.locator('#generateThree').click();
  const workshop = page.locator('#threeProposals .proposal-card').first().frameLocator('iframe');
  await visibleText(workshop.locator('body'), 'Oficina Pinheiro');
  await visibleText(workshop.locator('body'), 'Revisão preventiva');
  await visibleText(workshop.locator('.service-detail').first(), 'Conferência de freios e fluidos');
  assert.equal(await workshop.locator('.content-reference').count(), 0);
  assert.doesNotMatch(await workshop.locator('body').textContent(), /cuidado capilar|Salão Aurora/i);
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

test('Identifica marca e perfis na página da empresa', () => {
  const result = websiteMetadata('<html><head><meta name="theme-color" content="#bc6022">' +
    '<meta property="og:image" content="/capa.webp"><meta property="og:description" content="Cerâmica &amp; arte">' +
    '<script type="application/ld+json">'+JSON.stringify({'@graph':[
      {'@type':'LocalBusiness',logo:{url:'/logo.svg'},image:['/capa.webp','/loja.jpg'],sameAs:'https://instagram.com/atelieroficial/?hl=pt'},
      {'@type':'Person',image:'/autor.jpg'}]})+'</script></head>' +
    '<body><img class="logo" src="/outro.png"><a href="https://www.instagram.com/p/post/">Post</a></body></html>', 'https://atelier.example.com/');
  assert.equal(result.logo,'https://atelier.example.com/logo.svg');
  assert.equal(result.color,'#bc6022');
  assert.deepEqual(result.photos,['https://atelier.example.com/capa.webp','https://atelier.example.com/loja.jpg']);
  assert.equal(result.description,'Cerâmica & arte');
  assert.deepEqual(result.profiles,['https://www.instagram.com/atelieroficial/']);
  assert.equal(instagramProfile('https://www.instagram.com/reels/'),'');
});

test('Consulta a unidade por ID, conta uma busca e exige operador para importar mídia', async t => {
  const providers=await startProviders();
  t.after(providers.close);
  const origin=await startApp(t,providers,true,{metaEnabled:true,aiEnabled:true});
  const place='/api/studio/place?id='+business.id;
  assert.equal((await fetch(origin+place)).status,401);
  const found=await fetch(origin+place,{headers:authorization}).then(r=>r.json());
  assert.equal(found.data[0].googleId,business.id);
  assert.ok(found.data[0].photosUrl);
  assert.equal(providers.state.used,1);
  const post=(path,body,auth=token)=>fetch(origin+path,{method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth},body:JSON.stringify(body)});
  const social={url:'https://www.instagram.com/salaoaurora/'};
  assert.equal((await post('/api/studio/brand/instagram',social,viewOnlyToken)).status,403);
  const data=await post('/api/studio/brand/instagram',social).then(r=>r.json());
  assert.equal(data.profiles[0],social.url);
  assert.equal(data.photos.length,2);
  assert.equal((await post('/api/studio/brand/media',{ticket:data.photos[0].ticket})).headers.get('content-type'),'image/webp');
  providers.controlAiText(()=>[200,{output:[
    {type:'web_search_call',action:{sources:[{url:social.url},{url:'https://instagram.com/p/abc/'}]}},
    {type:'message',content:[{type:'output_text',text:'https://www.instagram.com/naoverificado/'}]}]}]);
  const profiles=await post('/api/studio/ai/instagram',{company:{name:'Salão Aurora',city:'Mauá'}}).then(r=>r.json());
  assert.deepEqual(profiles.profiles,[social.url]);
  assert.deepEqual(providers.state.failures,[]);
});

test('No celular, confirma a unidade e aplica a marca nas prévias, no rascunho e no HTML', {timeout:45000}, async t => {
  const providers=await startProviders(); t.after(providers.close);
  providers.controlGoogle(()=>[200,{places:[{...business, websiteUri:'https://www.instagram.com/salaoaurora/'},
    {...business,id:'outra-unidade-aurora',formattedAddress:'Outra cidade'}]}]);
  const origin=await startApp(t,providers,true,{metaEnabled:true});
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
  t.after(()=>browser.close());
  const {context}=await browserContext(browser,origin,providers,{viewport:{width:375,height:812},reducedMotion:'reduce'});
  await context.addInitScript(token=>{if (window.top===window && location.protocol.startsWith('http')) sessionStorage.setItem('prospect_publisher_session_v1',JSON.stringify({access_token:token}));},token);
  const page=await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/studio');
  await page.locator('#studioCompany').fill('Salão Aurora');
  await page.locator('#studioSegment').fill('Salão de beleza');
  await page.locator('#studioCity').fill('Mauá');
  await page.locator('#brandGoogleAtGenerate').check();
  await page.locator('#generateThree').click();
  const units=page.getByRole('button',{name:'Usar esta unidade'});
  await units.first().waitFor(); assert.equal(await units.count(),2);
  assert.equal(await page.locator('.proposal-card').count(),0);
  assert.equal(await page.locator('#studioAddress').inputValue(),'');
  await units.first().click();
  await page.getByRole('button',{name:'Aplicar seleção autorizada'}).click();
  await eventually(()=>providers.state.uploadedImages.size===3,'As fotos selecionadas não foram armazenadas.');
  const choices=page.locator('[data-choose]');
  await choices.nth(2).waitFor();
  const mark=await page.locator('#brandLogo').inputValue();
  const photos=(await page.locator('#brandPhotos').inputValue()).split('\n');
  assert.equal(photos.length,2); assert.ok(photos.every(link=>link.startsWith(providers.publicOrigin)));
  for(let i=0;i<3;i++){
    const frame=page.locator('.proposal-card').nth(i).frameLocator('iframe');
    assert.equal(await frame.locator('.brand-logo').getAttribute('src'),mark);
    assert.equal(await frame.locator('.hero img').first().getAttribute('src'),photos[i%2]);
    assert.equal(await frame.locator('[data-contact=instagram]').getAttribute('href'),'https://www.instagram.com/salaoaurora/');
    assert.ok(!(await frame.locator('body').textContent()).includes('Outra cidade'));
  }
  assert.equal(providers.state.used,1);
  await choices.first().click();
  const snapshot=await page.evaluate(()=>window.PortalSiteStudio.getCurrent().data);
  assert.equal(snapshot.googlePlaceId,business.id); assert.equal(snapshot.logo,mark);
  assert.ok(snapshot.brandSources.includes('https://www.instagram.com/p/example1/'));
  const html=await page.evaluate(()=>{const {data,template}=window.PortalSiteStudio.getCurrent();return window.PortalSiteStudio.buildSite(data,template);});
  assert.ok(html.includes(mark)); assert.ok(html.includes('Ver galeria'));
  assert.ok(!html.includes('cdninstagram.com')); assert.ok(!html.includes('/p/example1/'));
  await page.locator('#saveProject').click();
  await eventually(()=>providers.state.projectVersions.size===1,'O rascunho da marca não foi salvo.');
  const [versions]=providers.state.projectVersions.values();
  assert.equal(versions[0].snapshot.brandGallery,photos.join('\n'));
  await page.locator('#closeEditor').click();
  await page.locator('#studioCompany').fill('Outro negócio');
  assert.equal(await page.locator('#brandLogo').inputValue(),'');
  assert.equal(await page.locator('#studioInstagram').inputValue(),'');
  assert.equal(await page.locator('#studioSummary').inputValue(),'');
  await page.goto(origin+'/studio?view=projects');
  await page.locator('#projectsView [data-load]').click();
  assert.equal(await page.locator('#logoUrl').inputValue(),mark);
  assert.equal(await page.locator('#brandGallery').inputValue(),photos.join('\n'));
  assert.ok(await page.locator('#brandEvidence a').count()>=1);
  await page.locator('#closeEditor').click();
  await page.goto(origin+'/?view=search');
  await searchInputs(page);
  await page.locator('#searchBtn').click();
  await visibleText(page.locator('#searchResults .opp-tag'),'Apenas Instagram');
  assert.equal(await page.locator('#searchResults [data-radar-filter=no]').getAttribute('aria-pressed'),'true');
  assert.equal(providers.state.messages.length,0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
  assert.deepEqual(errors,[]); assert.deepEqual(providers.state.failures,[]);
});

test('Página oficial, arquivos próprios e cor do logo funcionam sem geração por IA', {timeout:30000}, async t=>{
  const providers=await startProviders(); t.after(providers.close);
  const origin=await startApp(t,providers,false,{metaEnabled:true});
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
  t.after(()=>browser.close());
  const {context}=await browserContext(browser,origin,providers,{viewport:{width:1440,height:960}});
  const page=await context.newPage();
  await page.goto(origin+'/studio');
  await page.evaluate(token=>sessionStorage.setItem('prospect_publisher_session_v1',JSON.stringify({access_token:token})),token);
  const source='https://atelier.example.com/';
  const sourceData=websiteMetadata('<meta property="og:image" content="/colecao.jpg"><img src="/logo.png" alt="Logo">'+
    '<a href="https://www.instagram.com/atelieroficial/">Instagram</a>',source);
  let reads=0;
  await page.route('**/api/studio/brand/website',async route=>{
    assert.equal(route.request().postDataJSON().url,source); reads++;
    await route.fulfill({json:sourceData});
  });
  await page.locator('#studioCompany').fill('Ateliê Amora');
  await page.locator('#studioSegment').fill('Fotografia');
  await page.locator('#studioCity').fill('Santo André');
  await page.locator('#studioWebsite').fill(source);
  await page.locator('#generateThree').click();
  await page.getByRole('button',{name:'Aplicar seleção autorizada'}).click();
  await page.locator('[data-choose="2"]').waitFor();
  assert.equal(reads,1); assert.equal(await page.locator('#brandLogo').inputValue(),sourceData.logo);
  const png=await page.evaluate(()=>{
    const canvas=document.createElement('canvas'); canvas.width=canvas.height=20;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#347a55';ctx.fillRect(0,0,20,20);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('.brand-materials summary').click();
  const file={name:'marca.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')};
  await page.locator('#brandLogoFile').setInputFiles(file);
  await page.locator('#brandPhotoFiles').setInputFiles(file);
  await page.locator('#brandUpload').click();
  await visibleText(page.locator('#brandStatus'),'Arquivos da empresa prontos');
  assert.equal(await page.locator('#brandColorHex').inputValue(),'#347a55');
  await page.locator('#generateThree').click();
  await page.locator('[data-choose="0"]').click();
  assert.equal(await page.locator('#brandColor').inputValue(),'#347a55');
  assert.equal(await page.locator('#photoOrigin').inputValue(),'business');
  assert.equal(await page.locator('#brandEvidence a').count(),1);
  assert.ok((await page.locator('#logoUrl').inputValue()).startsWith(providers.publicOrigin));
  assert.equal(reads,1); assert.equal(providers.state.used,0);
  assert.deepEqual(providers.state.aiTexts,[]); assert.deepEqual(providers.state.aiImages,[]);
  assert.deepEqual(providers.state.failures,[]);
});
