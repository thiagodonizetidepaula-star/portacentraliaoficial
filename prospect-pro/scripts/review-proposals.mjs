import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {unzipSync, strFromU8} from 'fflate';

const limit = 2 * 1024 * 1024;
const viewports = [
  {width: 390, height: 844},
  {width: 1440, height: 900}
];
const googleFont = /^https:\/\/fonts\.gstatic\.com\/[a-z0-9._/-]+\.woff2?$/i;

async function readModels(archive) {
  if ((await stat(archive)).size > 7 * 1024 * 1024) throw Error('O pacote excede o tamanho esperado.');
  const files = unzipSync(new Uint8Array(await readFile(archive)), {
    filter: ({name, originalSize}) =>
      (/^modelo-[1-3]\.html$/.test(name) && originalSize <= limit) ||
      (name === 'revisao.json' && originalSize < 4096)
  });
  const manifest = JSON.parse(strFromU8(files['revisao.json'] || new Uint8Array()));
  if (manifest.version !== 1 || manifest.models?.length !== 3) throw Error('Use um pacote de revisão do Prospect PRO com três modelos.');
  return manifest.models.map(({label, file}, index) => {
    if (typeof label !== 'string' || !label.trim() || file !== 'modelo-' + (index + 1) + '.html' || !files[file]) {
      throw Error('O pacote contém um modelo inválido.');
    }
    return {label, file, html: strFromU8(files[file])};
  });
}

async function inspect(page) {
  return page.evaluate(() => {
    const issues = [];
    if (!document.querySelector('meta[name="robots"]')?.content.includes('noindex')) {
      issues.push('O HTML precisa indicar noindex.');
    }
    const heading = document.querySelector('main h1');
    const box = heading?.getBoundingClientRect();
    if (!heading?.textContent.trim() || !box?.width || !box.height ||
        box.left < -2 || box.right > innerWidth + 2) {
      issues.push('O título principal não cabe na tela.');
    }
    if (document.documentElement.scrollWidth > innerWidth + 2 || document.body.scrollWidth > innerWidth + 2) {
      issues.push('Há rolagem horizontal.');
    }
    if (document.querySelector('script, iframe, form, object, embed')) {
      issues.push('O HTML inclui conteúdo ativo incompatível com a prévia.');
    }
    for (const image of document.images) {
      if (!image.complete || !image.naturalWidth) issues.push('Uma imagem não foi carregada.');
    }
    for (const link of document.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href');
      if (href.startsWith('#')) {
        if (!document.getElementById(href.slice(1))) issues.push('Seção ausente para o link ' + href + '.');
      } else if (!/^(?:https:\/\/|mailto:|tel:)/i.test(href)) {
        issues.push('O site contém um destino externo inválido.');
      }
    }
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.getAnimations().some(animation => animation.playState === 'running')) {
      issues.push('Há movimento ativo na preferência de movimento reduzido.');
    }
    return issues;
  });
}

async function capture(browser, model, viewport, output) {
  const page = await browser.newPage({viewport, reducedMotion: 'reduce', javaScriptEnabled: false});
  const issues = [];
  const screenshot = model.file.replace('.html', '-' + viewport.width + '.png');
  await page.route('**/*', route => {
    if (route.request().resourceType() === 'font' && googleFont.test(route.request().url())) {
      return route.continue();
    }
    issues.push('O navegador tentou carregar um recurso externo bloqueado.');
    return route.abort();
  });
  page.on('pageerror', error => issues.push(error.message));
  page.on('requestfailed', request => {
    if (request.resourceType() === 'font') issues.push('Uma fonte externa não foi carregada.');
  });
  const started = performance.now();
  let loadMs = null;
  let captured = false;
  try {
    await page.setContent(model.html, {waitUntil: 'load', timeout: 10000});
    loadMs = Math.round(performance.now() - started);
    await page.waitForLoadState('networkidle', {timeout: 10000});
    issues.push(...await inspect(page));
    await page.screenshot({path: resolve(output, screenshot), fullPage: true, animations: 'disabled', timeout: 10000});
    captured = true;
    const mainAction = page.locator('main .hero-button').first();
    const href = await mainAction.getAttribute('href', {timeout: 1000}).catch(() => null);
    if (href?.startsWith('#')) {
      await mainAction.click({timeout: 3000});
      if (!(await page.evaluate(target => location.hash === target, href))) {
        issues.push('O botão principal não levou à seção indicada.');
      }
    }
  } catch (error) {
    issues.push(error.message.split('\n')[0]);
  } finally {
    await page.close();
  }
  return {
    modelo: model.label,
    tela: viewport,
    tamanhoHtmlBytes: Buffer.byteLength(model.html),
    carregamentoLocalMs: loadMs,
    captura: captured ? screenshot : null,
    problemas: [...new Set(issues)]
  };
}

async function run(archive, folder) {
  if (!archive || !folder) throw Error('Informe o ZIP de revisão e a pasta de saída.');
  const models = await readModels(archive);
  if (new Set(models.map(model => model.html)).size !== 3) throw Error('Os três modelos precisam ser diferentes.');
  const {chromium} = await import(process.env.PROSPECT_PLAYWRIGHT_MODULE || 'playwright-core');
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  const output = resolve(folder);
  const report = [];
  try {
    await mkdir(output, {recursive: true});
    for (const model of models) {
      for (const viewport of viewports) report.push(await capture(browser, model, viewport, output));
    }
  } finally {
    await browser.close();
  }
  const file = resolve(output, 'relatorio.json');
  await writeFile(file, JSON.stringify(report, null, 2) + '\n');
  const passed = report.filter(item => !item.problemas.length).length;
  process.stdout.write(passed + '/' + report.length + ' verificações aprovadas. ' + file + '\n');
  if (passed !== report.length) process.exitCode = 1;
}

try {
  await run(...process.argv.slice(2));
} catch (error) {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
}
