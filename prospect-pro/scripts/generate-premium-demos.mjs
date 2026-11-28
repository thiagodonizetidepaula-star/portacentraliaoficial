import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {strFromU8, unzipSync, zipSync} from 'fflate';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:3000');
assert.ok(origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname),
  'Use um estúdio local sem credenciais.');
const output = resolve(process.argv[3] || 'demo-previews');
await mkdir(output, {recursive: true});

const samples = [
  {
    slug: 'salao-casa-iris', name: 'Casa Íris', segment: 'Salão de beleza', variant: 1,
    artwork: '.composition-graphic-assinatura i:first-child',
    summary: 'Cortes, cor e tratamentos com atendimento marcado.',
    services: 'Corte e finalização | Corte e modelagem para diferentes texturas.\nColoração | Consultoria de tom e manutenção da cor.\nTratamento capilar | Hidratação e cuidados para a rotina.',
    about: 'A Casa Íris é um salão fictício criado para demonstrar o estúdio. A proposta organiza o atendimento em três áreas: corte, cor e tratamento.'
  },
  {
    slug: 'hamburgueria-brasa-alta', name: 'Brasa Alta', segment: 'Hamburgueria', variant: 2,
    artwork: '.composition-burger span',
    summary: 'Pão tostado, hambúrguer na chapa e um cardápio de combinações da casa.',
    services: 'Brasa Clássico | Hambúrguer, queijo e picles no pão tostado.\nDa Horta | Hambúrguer vegetal com cebola roxa e rúcula.\nBatata da casa | Batatas rústicas com páprica.',
    about: 'Brasa Alta é uma hamburgueria fictícia. Este cardápio foi criado para demonstrar como os itens e seus ingredientes aparecem no site.'
  },
  {
    slug: 'energia-limiar-solar', name: 'Limiar Solar', segment: 'Energia solar', variant: 3,
    artwork: '.composition-solar svg',
    summary: 'Projetos fotovoltaicos para residências e pequenos negócios.',
    services: 'Estudo de viabilidade | Avaliação do consumo e das condições do telhado.\nProjeto fotovoltaico | Dimensionamento dos módulos e do inversor.\nInstalação | Montagem e orientação sobre acompanhamento da geração.',
    about: 'Limiar Solar é uma empresa fictícia. A ilustração mostra a forma de módulos fotovoltaicos. As três etapas ajudam a organizar a primeira conversa sobre um projeto.'
  }
];
const {chromium} = await import(process.env.PROSPECT_PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium'});
const review = [];
const sites = {};
try {
  const context = await browser.newContext({acceptDownloads: true});
  await context.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    return url.origin === origin.origin && request.method() === 'GET' && !url.pathname.startsWith('/api/studio/proposals/')
      ? route.continue() : route.abort();
  });
  const studio = await context.newPage();
  for (const sample of samples) {
    await studio.goto(new URL('/studio', origin).href);
    await studio.locator('#studioCompany').fill(sample.name);
    await studio.locator('#studioSegment').fill(sample.segment);
    await studio.locator('#studioSummary').fill(sample.summary);
    await studio.locator('#studioServices').fill(sample.services);
    await studio.locator('#studioAbout').fill(sample.about);
    await studio.locator('#generateThree').click();
    const chosen = studio.locator('.proposal-card').nth(sample.variant - 1);
    const frame = chosen.frameLocator('iframe');
    await frame.locator(sample.artwork).waitFor();
    assert.doesNotMatch(await chosen.locator('iframe').getAttribute('sandbox'), /allow-scripts/);

    const downloading = studio.waitForEvent('download');
    await studio.locator('#privateProposalDownload').click();
    const archive = new Uint8Array(await readFile(await (await downloading).path()));
    await writeFile(resolve(output, sample.slug + '-revisao.zip'), archive);
    const html = strFromU8(unzipSync(archive)['modelo-' + sample.variant + '.html']);
    assert.doesNotMatch(html, /<script\b/i);
    const filename = sample.slug + '.html';
    await writeFile(resolve(output, filename), html);
    sites[filename] = new TextEncoder().encode(html);

    const page = await context.newPage();
    for (const width of [390, 1440]) {
      await page.setViewportSize({width, height: width === 390 ? 844 : 900});
      await page.emulateMedia({reducedMotion: 'no-preference'});
      await page.setContent(html);
      assert.equal(await page.locator('main h1').textContent(), sample.name);
      assert.ok(await page.locator(sample.artwork).isVisible());
      assert.notEqual(await page.locator(sample.artwork).evaluate(el => getComputedStyle(el).animationName), 'none');
      assert.ok(await page.locator('html').evaluate(el => el.scrollWidth <= el.clientWidth + 2));
      const scrollCard = page.locator('.service-card').first();
      assert.equal(await scrollCard.evaluate(el => getComputedStyle(el).animationName), 'composition-service-arrival');
      await page.locator('.hero-button[href="#servicos"]').click();
      assert.ok(await page.locator('#servicos').isVisible());
      const question = page.locator('#perguntas summary').first();
      await page.locator('nav a[href="#perguntas"]').click();
      await question.focus();
      await page.keyboard.press('Enter');
      assert.ok(await question.evaluate(el => el.parentElement.open));
      await page.emulateMedia({reducedMotion: 'reduce'});
      assert.equal(await page.evaluate(() => document.getAnimations().some(a => a.playState === 'running')), false);
      await page.goto('about:blank');
      await page.setContent(html);
      const screenshot = sample.slug + '-' + width + '.png';
      await page.screenshot({path: resolve(output, screenshot), fullPage: true, animations: 'disabled'});
      review.push({site: sample.name, largura: width, captura: screenshot, problemas: []});
    }
    await page.close();

    await chosen.getByRole('button', {name: /^Personalizar proposta/}).click();
    await studio.locator('#editorFieldsPanel').getByText('Identidade visual', {exact: true}).click();
    await studio.locator('#motionStyle').selectOption('none');
    const editor = studio.frameLocator('#websitePreview');
    await editor.locator('body.motion-none').waitFor();
    assert.equal(await editor.locator(sample.artwork).evaluate(el => getComputedStyle(el).animationName), 'none');
  }
  await writeFile(resolve(output, 'demonstracoes-prospect-pro.zip'), zipSync(sites, {level: 6}));
  await writeFile(resolve(output, 'relatorio.json'), JSON.stringify(review, null, 2) + '\n');
} finally {
  await browser.close();
}
