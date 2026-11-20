(function(){
'use strict';
const templates=window.SITE_TEMPLATES||[];
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=s=>String(s==null?'':s).trim();
const slug=s=>String(s||'site').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'site';
const palette=s=>/^#[0-9a-f]{6}$/i.test(String(s))?s:'#5a7399';
const photo=s=>{try{const v=new URL(String(s));if(v.protocol!=='https:'||v.username||v.password)return '';return v.href.replace(/["'<>\\()]/g,c=>encodeURIComponent(c));}catch{return ''}};
const phone=s=>{let n=String(s||'').replace(/\D/g,'');if(n.length===10||n.length===11)n='55'+n;return n.length>=12&&n.length<=13&&n.startsWith('55')?n:''};
function notify(message) {
 $('editorToast').hidden = true;
 $('toast').hidden = true;
 const toast = $($('editorOverlay').open ? 'editorToast' : 'toast');
 toast.textContent = message;
 toast.hidden = false;
 clearTimeout(notify.timer);
 notify.timer = setTimeout(() => { toast.hidden = true; }, 3200);
}
const loadProjects=()=>{try{const x=JSON.parse(localStorage.getItem('prospect_library_projects')||'[]');return Array.isArray(x)?x:[]}catch{return []}};
let projects=loadProjects(),selected=null,template=null,device='desktop',pendingLead=null;
try{const id=new URLSearchParams(location.search).get('lead');const a=JSON.parse(localStorage.getItem('prospect_pro_leads')||'[]');pendingLead=Array.isArray(a)?a.find(x=>String(x.id)===id):null}catch{}
const categories=[...new Set(templates.map(t=>t.category))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
$('templatesCount').textContent=templates.length;
$('category').innerHTML='<option value="all">Todos os segmentos</option>'+categories.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join('');
function renderCatalog(){
 const query=text($('filter').value).toLocaleLowerCase('pt-BR'),cat=$('category').value;
 const list=templates.filter(t=>(cat==='all'||t.category===cat)&&(!query||(t.label+' '+t.category+' '+t.example).toLocaleLowerCase('pt-BR').includes(query)));
 $('catalogInfo').textContent=list.length+' modelos profissionais disponíveis · O layout, a tipografia e a composição mudam conforme o segmento';
 $('catalog').innerHTML=list.map(t=>{
 const bg=palette(t.bg),accent=palette(t.accent),fg=palette(t.ink),inv=fg==='#ffffff'?'#131925':bg;
 return '<article class="template-card" style="--model-bg:'+bg+';--model-accent:'+accent+';--model-fg:'+fg+';--model-btntext:'+inv+'">'+
 '<div class="template-visual" data-layout="'+esc(t.layout)+'"><img class="template-photo" src="'+esc(photo(t.photo).replace(/w=1600&q=82/,'w=680&q=68'))+'" loading="lazy" decoding="async" alt="" width="680" height="440">'+
 '<div class="mock-header"><span>'+esc(t.example.toUpperCase())+'</span><i></i></div><div class="mock-content"><div class="mock-overline">'+esc(t.category.toUpperCase())+'</div><strong>'+esc(t.headline)+'</strong><span class="mock-cta">Conhecer mais</span></div><span class="mock-label">'+esc(t.layout.toUpperCase())+'</span></div>'+
 '<div class="card-info"><div class="card-line"><h3>'+esc(t.label)+'</h3><span class="category">'+esc(t.category)+'</span></div><p>'+esc(t.summary)+'</p><div class="card-footer"><span class="design-tag">'+esc({editorial:'Editorial',technical:'Industrial',serene:'Minimalista',immersive:'Imersivo',artisan:'Artesanal',catalog:'Galeria',kinetic:'Dinâmico',corporate:'Corporativo'}[t.layout])+'</span><button class="open-model" data-open="'+esc(t.id)+'">Personalizar →</button></div></div></article>';
 }).join('')||'<div class="custom-strip"><strong>Nenhum modelo encontrado.</strong> Tente outra palavra ou escolha o modelo personalizado.</div>';
 document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>start(b.dataset.open));
}
function switchView(view) {
 for (const [name, buttonId] of [['gallery', 'tabGallery'], ['projects', 'tabProjects']]) {
  const active = name === view;
  $(name + 'View').hidden = !active;
  $(buttonId).classList.toggle('selected', active);
  $(buttonId).setAttribute('aria-pressed', String(active));
 }
 if (view === 'projects') renderProjects();
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('filter').addEventListener('input',renderCatalog);
$('category').addEventListener('change',renderCatalog);
const editFields = {
 companyName: 'name', industryName: 'industry', cityName: 'city', phoneNumber: 'phone',
 headline: 'headline', summary: 'summary', services: 'services', logoUrl: 'logo',
 photoUrl: 'photo', brandColor: 'color', layoutVariant: 'variant', headingFont: 'headingFont',
 headingSize: 'headingSize', buttonStyle: 'buttonStyle', motionStyle: 'motionStyle',
 sectionSpacing: 'spacing', showServices: 'showServices', showLocation: 'showLocation'
};
const styleFields = ['logo', 'photo', 'color', 'variant', 'headingFont', 'headingSize', 'buttonStyle',
 'motionStyle', 'spacing', 'showServices', 'showLocation'];
const editor = $('editorOverlay');
const mobileEditor = matchMedia('(max-width: 760px)');
let edits = [];
let editIndex = 0;
let savedSnapshot = '';
let editTimer;
let renderTimer;
let projectOwner = null;
let versionRequest = 0;

function getDefault(t) {
 return {
  id: null, leadId: pendingLead?.id || null, templateId: t.id, name: pendingLead?.name || t.example,
  industry: t.label, city: (pendingLead?.city || pendingLead?.address || '').slice(0, 90),
  phone: pendingLead?.phone || '', headline: t.headline, summary: t.summary, services: t.services.join('\n'),
  photo: t.photo, logo: '', color: t.accent, variant: '0', headingFont: 'auto', headingSize: '1',
  buttonStyle: 'auto', motionStyle: t.motionStyle || 'soft', spacing: 'balanced', showServices: true, showLocation: true
 };
}

function readFields() {
 for (const [id, key] of Object.entries(editFields)) {
  const control = $(id);
  selected[key] = control.type === 'checkbox' ? control.checked : control.value;
 }
}

function writeFields() {
 for (const [id, key] of Object.entries(editFields)) {
  const control = $(id);
  if (control.type === 'checkbox') control.checked = selected[key] !== false;
  else control.value = selected[key] ?? '';
 }
}

function snapshot() {
 return Object.fromEntries(Object.values(editFields).map(key => [key, selected[key]]));
}

function reflectEditor() {
 const current = JSON.stringify(snapshot());
 const pending = current !== JSON.stringify(edits[editIndex]);
 $('undoEdit').disabled = editIndex === 0 && !pending;
 $('redoEdit').disabled = pending || editIndex >= edits.length - 1;
 $('editorTitle').textContent = text(selected.name) || 'Personalizar site';
 const message = current !== savedSnapshot
  ? 'Alterações por salvar'
  : selected.id ? 'Projeto salvo' : 'Novo projeto';
 if ($('editStatus').textContent !== message) $('editStatus').textContent = message;
}

function recordEdit() {
 clearTimeout(editTimer);
 if (!selected) return;
 const current = snapshot();
 if (JSON.stringify(current) !== JSON.stringify(edits[editIndex])) {
  edits.splice(editIndex + 1);
  edits.push(current);
  if (edits.length > 60) edits.shift();
  editIndex = edits.length - 1;
 }
 reflectEditor();
}

function navigateEdits(direction) {
 recordEdit();
 const index = editIndex + direction;
 if (!edits[index]) return;
 editIndex = index;
 Object.assign(selected, edits[index]);
 writeFields();
 reflectEditor();
 paint();
}

function start(id, project) {
 template = project?.templateSnapshot || (window.__generatedTemplates || []).find(t => t.id === id) ||
  templates.find(t => t.id === id) || templates[0];
 if (!template) return notify('Nenhum modelo disponível');
 selected = { ...getDefault(template), ...project };
 $('modelName').textContent = template.label;
 writeFields();
 readFields();
 edits = [snapshot()];
 editIndex = 0;
 savedSnapshot = JSON.stringify(edits[0]);
 editor.querySelector('.editor-form').scrollTop = 0;
 setMobilePane(false);
 setDevice(mobileEditor.matches ? 'mobile' : device);
 reflectEditor();
 if (!editor.open) {
  editor.showModal();
  document.body.style.overflow = 'hidden';
 }
 paint();
}

function closeEditor(discard = false) {
 if (!discard && JSON.stringify(snapshot()) !== savedSnapshot && !confirm('Fechar o editor com alterações por salvar?')) return;
 clearTimeout(editTimer);
 clearTimeout(renderTimer);
 editor.close();
 document.body.style.overflow = '';
 selected = null;
}

$('closeEditor').onclick = () => closeEditor();
editor.addEventListener('cancel', event => {
 event.preventDefault();
 closeEditor();
});
window.addEventListener('beforeunload', event => {
 if (selected && JSON.stringify(snapshot()) !== savedSnapshot) {
  event.preventDefault();
  event.returnValue = '';
 }
});

function setMobilePane(preview) {
 editor.classList.toggle('show-preview', preview);
 for (const [id, active] of [['editMobileView', !preview], ['previewMobileView', preview]]) {
  $(id).classList.toggle('active', active);
  $(id).setAttribute('aria-pressed', String(active));
 }
}
$('editMobileView').onclick = () => setMobilePane(false);
$('previewMobileView').onclick = () => setMobilePane(true);

function setDevice(next) {
 device = next;
 for (const button of editor.querySelectorAll('[data-device]')) {
  const active = button.dataset.device === device;
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
 }
 $('websitePreview').parentElement.classList.toggle('mobile', device === 'mobile');
 $('previewLabel').textContent = device === 'mobile' ? 'Celular · até 375 px' : 'Computador';
}
for (const button of editor.querySelectorAll('[data-device]')) button.onclick = () => setDevice(button.dataset.device);

for (const id of Object.keys(editFields)) {
 $(id).addEventListener('input', () => {
  if (!selected) return;
  readFields();
  reflectEditor();
  clearTimeout(renderTimer);
  clearTimeout(editTimer);
  renderTimer = setTimeout(paint, 200);
  editTimer = setTimeout(recordEdit, 450);
 });
 $(id).addEventListener('change', recordEdit);
}

function paint() {
 clearTimeout(renderTimer);
 if (selected) $('websitePreview').srcdoc = buildSite(selected, template);
}

$('undoEdit').onclick = () => navigateEdits(-1);
$('redoEdit').onclick = () => navigateEdits(1);
$('resetModel').onclick = () => {
 recordEdit();
 const defaults = getDefault(template);
 for (const key of styleFields) selected[key] = defaults[key];
 writeFields();
 recordEdit();
 paint();
 notify('Estilo original restaurado');
};

function updateProjectCount() {
 $('savedCount').textContent = projects.length;
}

function persistOne(project, remove = false) {
 const stored = loadProjects().filter(item => item.id !== project.id);
 if (!remove) stored.unshift(project);
 localStorage.setItem('prospect_library_projects', JSON.stringify(stored));
}

function saveSelected() {
 if (!selected) return false;
 readFields();
 const project = { ...selected, templateSnapshot: template };
 project.id ||= 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
 project.updatedAt = new Date().toISOString();
 const store = window.PortalProjectStore;
 try {
  if (store?.localize(project) !== false) persistOne(project);
 } catch {
  notify('O navegador não conseguiu salvar este projeto.');
  return false;
 }
 projects = [project, ...projects.filter(item => item.id !== project.id)];
 selected = project;
 savedSnapshot = JSON.stringify(snapshot());
 updateProjectCount();
 reflectEditor();
 if (!$('projectsView').hidden) renderProjects();
 notify('Projeto salvo');
 Promise.resolve(store?.save(project)).catch(() => {});
 return true;
}
$('saveProject').onclick = saveSelected;

function renderProjects() {
 const normalize = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
 const query = normalize($('projectSearch').value);
 const matching = [...projects].filter(project =>
  normalize([project.name, project.industry, project.city].join(' ')).includes(query)
 ).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

 $('projectsList').innerHTML = matching.map(project => {
  const details = [project.industry, project.city].filter(Boolean).map(esc).join(' · ');
  const date = new Date(project.updatedAt);
  const updated = Number.isNaN(date.getTime()) ? '' : '<p>Editado em ' +
    esc(date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })) + '</p>';
  const publicLink = project.publicSlug
   ? '<a class="button secondary" href="/mvp/' + encodeURIComponent(project.publicSlug) + '" target="_blank" rel="noopener">Abrir prévia</a>'
   : '';
  const historyButton = project.cloudOwned
   ? '<button type="button" class="button secondary" data-versions="' + esc(project.id) + '">Versões</button>'
   : '';
  return '<article class="project-row"><span class="project-state">' + (project.publicSlug ? 'Prévia publicada' : 'Rascunho') +
   '</span><h2>' + esc(project.name || 'Projeto sem nome') + '</h2><p>' + details + '</p>' + updated +
   '<div class="project-actions"><button type="button" class="button accent" data-load="' + esc(project.id) +
   '">Continuar editando</button>' + publicLink + historyButton + '<button type="button" class="plain-btn" data-remove="' +
   esc(project.id) + '">Excluir projeto</button></div></article>';
 }).join('') || (query
  ? '<p class="project-empty">Nenhum projeto corresponde à busca.</p>'
  : '<p class="project-empty">Nenhum projeto salvo. Ao salvar um site no editor, ele aparecerá aqui.</p>');

 for (const button of $('projectsList').querySelectorAll('[data-load]')) {
  button.onclick = () => {
   const project = projects.find(item => item.id === button.dataset.load);
   if (project) start(project.templateId, project);
  };
 }
 for (const button of $('projectsList').querySelectorAll('[data-versions]')) {
  button.onclick = () => showVersions(projects.find(item => item.id === button.dataset.versions));
 }
 for (const button of $('projectsList').querySelectorAll('[data-remove]')) {
  button.onclick = () => {
   const project = projects.find(item => item.id === button.dataset.remove);
   if (!project || !confirm('Excluir o projeto de edição de ' + (project.name || 'site') + '?')) return;
   try {
    persistOne(project, true);
   } catch {
    return notify('O navegador não conseguiu remover este projeto.');
   }
   projects = projects.filter(item => item.id !== project.id);
   updateProjectCount();
   renderProjects();
   Promise.resolve(window.PortalProjectStore?.remove(project)).catch(() => {});
  };
 }
}

async function showVersions(project) {
 if (!project) return;
 const request = ++versionRequest;
 const dialog = $('versionsOverlay');
 const status = $('versionsStatus');
 const list = $('versionsList');
 $('versionsTitle').textContent = 'Versões de ' + (project.name || 'projeto');
 list.replaceChildren();
 status.textContent = 'Carregando versões…';
 dialog.showModal();
 try {
  const versions = await window.PortalProjectStore.history(project.id);
  if (!dialog.open || request !== versionRequest) return;
  status.textContent = versions.length ? 'Selecione uma versão para abrir no editor.' : 'Nenhuma versão disponível.';
  const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' });
  for (const version of versions) {
   const button = document.createElement('button');
   button.type = 'button';
   button.className = 'button secondary';
   button.textContent = dateFormat.format(new Date(version.recordedAt));
   button.onclick = () => {
    dialog.close();
    start(version.project.templateId, {
     ...version.project,
     publicSlug: project.publicSlug,
     publishedId: project.publishedId
    });
    const current = { ...getDefault(template), ...project };
    savedSnapshot = JSON.stringify(Object.fromEntries(Object.values(editFields).map(key => [key, current[key]])));
    reflectEditor();
   };
   list.append(button);
  }
 } catch {
  if (dialog.open && request === versionRequest) status.textContent = 'Não foi possível carregar o histórico.';
 }
}

$('closeVersions').onclick = () => $('versionsOverlay').close();
$('projectSearch').oninput = renderProjects;
window.addEventListener('portal-projects-loaded', event => {
 const owner = event.detail.ownerId;
 const selectedOwner = selected?.cloudOwnerId || projectOwner;
 if (editor.open && selected?.cloudOwned && selectedOwner && owner !== selectedOwner) {
  if ($('publishOverlay').open) $('publishOverlay').close();
  closeEditor(true);
 }
 if (projectOwner && owner !== projectOwner && $('versionsOverlay').open) $('versionsOverlay').close();
 projectOwner = owner;
 projects = event.detail.projects;
 updateProjectCount();
 if (!$('projectsView').hidden) renderProjects();
});
window.addEventListener('portal-project-version', event => {
 const { id, version, previousVersion, ownerId } = event.detail;
 if (selected?.id === id && (selected.cloudVersion ?? null) === previousVersion) {
  selected.cloudVersion = version;
  selected.cloudOwned = true;
  selected.cloudOwnerId = ownerId;
 }
});

$('downloadSite').onclick = () => {
 const url = URL.createObjectURL(new Blob([buildSite(selected, template)], { type: 'text/html;charset=utf-8' }));
 const anchor = document.createElement('a');
 anchor.href = url;
 anchor.download = slug(selected.name) + '-site.html';
 editor.append(anchor);
 anchor.click();
 anchor.remove();
 setTimeout(() => URL.revokeObjectURL(url), 2000);
 notify('Arquivo HTML gerado');
};
$('copyHtml').onclick = async () => {
 try {
  await navigator.clipboard.writeText(buildSite(selected, template));
  notify('Código HTML copiado');
 } catch {
  notify('Não foi possível copiar. Use Baixar HTML.');
 }
};
$('customStart').onclick = () => {
 const base = templates.find(item => item.id === 'consultoria');
 if (!base) return;
 start(base.id, { ...getDefault(base), industry: 'Meu segmento', headline: 'Uma experiência feita para você.' });
};
function servicesMarkup(list,profile) {
 return '<section class="services section" id="servicos" aria-labelledby="service-title"><div class="container">'+
  '<h2 id="service-title">'+esc(profile.services)+'</h2><ul class="service-list">'+
  list.map(service=>'<li class="service-card">'+esc(service)+'</li>').join('')+
  '</ul></div></section>';
}

function storyMarkup(name,profile,image) {
 return '<section class="story section" id="sobre" aria-labelledby="story-title"><div class="container story-grid">'+
  '<div class="story-copy"><h2 id="story-title">Conheça '+esc(name)+'</h2><p>'+esc(profile.story)+'</p></div>'+
  (image?'<figure class="story-image"><img loading="lazy" decoding="async" width="850" height="650" src="'+esc(image)+'" alt=""><figcaption>Imagem ilustrativa</figcaption></figure>':'')+
  '</div></section>';
}

function readableInk(background) {
 const channels=[1,3,5].map(index=>{
  const channel=parseInt(background.slice(index,index+2),16)/255;
  return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;
 });
 const lightness=channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
 return lightness>0.179?'#000000':'#ffffff';
}
const css=[
'*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-width:0;background:var(--surface);color:var(--ink);font-family:Arial,Helvetica,sans-serif}a{text-decoration:none;color:inherit}button{font:inherit}img{display:block;max-width:100%}',
':root{--accent:#9a7860;--surface:#f7f4ef;--ink:#273239;--dark:#19242d;--light:#ffffff;--muted:#68717a}.container{width:min(1160px,calc(100% - 64px));margin-inline:auto}',
'.site-header{height:90px;display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid currentColor;position:relative;z-index:3}.brand{font-size:20px;font-weight:900;letter-spacing:-.055em}.brand .brand-dot{display:inline-block;width:8px;height:8px;background:var(--accent);border-radius:50%;margin-left:4px}.site-header nav{display:flex;gap:28px;align-items:center;font-size:12px;font-weight:700;letter-spacing:.035em}.site-header nav a:hover{text-decoration:underline;text-underline-offset:6px}.nav-cta{display:inline-flex;align-items:center;justify-content:center;border:1px solid currentColor;padding:12px 17px;font-weight:800;font-size:12px;border-radius:2px}',
'.hero{position:relative;overflow:hidden}.hero h1{font-size:clamp(48px,6.6vw,110px);line-height:.99;letter-spacing:-.075em;margin:18px 0 25px;max-width:960px}.hero h1.serif,h2.serif{font-family:Georgia,serif;font-weight:400;letter-spacing:-.055em}.hero .eyebrow{font-size:11px;letter-spacing:.19em;font-weight:800}.hero p{font-size:16px;line-height:1.7;max-width:530px;color:inherit;opacity:.79}.hero-button,.cta-button{display:inline-flex;align-items:center;justify-content:center;gap:18px;min-height:54px;background:var(--accent);color:var(--buttonInk);padding:15px 24px;border-radius:2px;font-size:13px;font-weight:800;margin-top:20px}.hero-button:hover,.cta-button:hover{filter:brightness(.9)}.hero-image img{width:100%;height:100%;object-fit:cover}.hero::before{pointer-events:none}',
'.editorial{display:grid;grid-template-columns:52% 48%;min-height:615px}.editorial .hero-text{padding:80px max(30px,6vw) 80px max(32px,calc((100vw - 1160px)/2));display:flex;flex-direction:column;justify-content:center}.editorial .hero-image{min-height:615px}.editorial h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(48px,6vw,92px)}.editorial .hero-image img{filter:saturate(.92)}',
'.immersive{height:min(83vh,790px);min-height:540px;background-color:var(--dark);color:#fff}.immersive>.hero-image{position:absolute;inset:0}.immersive>.hero-image img{filter:brightness(.6)}.immersive::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#0d1117cc,transparent 95%),linear-gradient(0deg,#090d17a8,transparent 58%)}.immersive .hero-text{position:absolute;z-index:1;left:max(36px,calc((100vw - 1160px)/2));right:26px;bottom:70px}.immersive h1{font-family:Georgia,serif;font-weight:400;max-width:840px;font-size:clamp(57px,8.2vw,124px)}',
'.technical{display:grid;grid-template-columns:51% 49%;background:var(--dark);color:#fff;min-height:610px}.technical .hero-text{padding:95px 5vw;align-self:center}.technical h1{font-weight:950;text-transform:uppercase;font-size:clamp(45px,6.5vw,97px)}.technical .hero-image{min-height:580px;clip-path:polygon(6% 0,100% 0,100% 100%,0 100%)}.technical .hero-image img{filter:grayscale(.2)}.technical .hero-button{border-radius:0;text-transform:uppercase}',
'.serene{text-align:center;padding:75px 30px 0;background:var(--surface)}.serene .hero-text{margin:auto;max-width:920px}.serene h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(55px,7vw,108px)}.serene p{margin:0 auto}.serene .hero-image{width:min(1000px,90%);height:min(45vw,440px);min-height:230px;margin:45px auto 0;overflow:hidden;border-radius:220px 220px 0 0}.serene .hero-image img{object-position:center 45%}',
'.catalog-hero{display:grid;grid-template-columns:46% 54%;align-items:center;gap:0;min-height:650px;padding:65px max(32px,calc((100vw - 1160px)/2))}.catalog-hero .hero-text{padding:40px 45px 40px 0}.catalog-hero h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(50px,5.7vw,92px)}.catalog-gallery{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:235px 240px;gap:13px}.catalog-gallery img{width:100%;height:100%;object-fit:cover}.catalog-gallery img:first-child{grid-row:span 2}.catalog-gallery img:last-child{filter:saturate(.7)}',
'.artisan{display:grid;grid-template-columns:49% 51%;align-items:center;padding:60px max(35px,calc((100vw - 1160px)/2));gap:40px;min-height:680px;background:var(--surface)}.artisan .hero-image{height:560px;transform:rotate(-3deg);box-shadow:18px 17px 0 var(--accent)}.artisan .hero-image img{filter:saturate(.9)}.artisan .hero-text{order:2}.artisan h1{font-family:Georgia,serif;font-weight:400;font-style:italic;font-size:clamp(49px,6vw,90px)}.artisan .hero-button{border-radius:100px}',
'.kinetic{display:grid;grid-template-columns:53% 47%;align-items:center;min-height:640px;padding:65px max(35px,calc((100vw - 1160px)/2));background:var(--dark);color:#fff}.kinetic .hero-text{position:relative;z-index:1;padding-right:15px}.kinetic h1{font-weight:950;font-style:italic;text-transform:uppercase;font-size:clamp(50px,7.6vw,116px);transform:skewY(-4deg)}.kinetic .hero-image{height:510px;transform:rotate(3deg);box-shadow:18px 18px 0 var(--accent)}.kinetic .hero-image img{filter:contrast(1.1)}',
'.corporate{display:grid;grid-template-columns:54% 46%;min-height:600px;align-items:center}.corporate .hero-text{padding:70px 5vw 70px max(35px,calc((100vw - 1160px)/2))}.corporate h1{font-family:Arial,sans-serif;font-size:clamp(48px,6.1vw,89px);font-weight:900}.corporate .hero-image{height:600px}.corporate .hero-image img{filter:saturate(.75)}',
'.section{padding:110px 0}.section-overline{font-size:11px;font-weight:900;color:var(--accent);letter-spacing:.22em}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:45px;margin:25px 0 35px}.section h2{font-size:clamp(36px,4.2vw,64px);letter-spacing:-.06em;font-weight:800;line-height:1.07;margin:0}.section p{line-height:1.7;color:var(--muted)}.section-heading h2{max-width:730px}.section-heading p{max-width:310px;font-size:14px}.services{background:#fff}.service-list{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.service-card{min-height:240px;border:1px solid #e9e7e4;padding:27px;display:flex;flex-direction:column}.service-number{font-size:11px;color:var(--accent);font-weight:900}.service-card h3{font-size:23px;letter-spacing:-.045em;margin:28px 0 7px}.service-card p{margin:0;font-size:13px}.service-card>span:last-child{margin-top:auto;font-size:22px;color:var(--accent)}',
'.story .story-copy p{color:var(--muted)}.story-grid{display:grid;grid-template-columns:48% 52%;align-items:center;gap:8%}.story-image img{width:100%;height:510px;object-fit:cover}.story-copy{padding-right:8vw}.story-copy h2{font-family:Georgia,serif;font-weight:400;margin:20px 0}.story-copy p{font-size:15px}.textlink{display:inline-block;margin-top:20px;font-weight:800;font-size:13px;border-bottom:1px solid var(--accent);padding-bottom:7px}',
'.contact{background:var(--dark);color:#fff;padding:95px 0}.contact .contact-grid{display:grid;grid-template-columns:65% 35%;gap:18px;align-items:center}.contact h2{font-family:Georgia,serif;font-weight:400}.contact p{max-width:550px;color:#d6dce5}.contact .contact-actions{text-align:right}.contact .smallnote{font-size:11px;color:#bdc8d2}.footer{padding:27px 0;color:var(--muted);font-size:12px;display:flex;justify-content:space-between;gap:12px}',
'.variant-1 .editorial{grid-template-columns:43% 57%}.variant-1 .editorial .hero-image{order:-1}.variant-1 .catalog-hero{grid-template-columns:54% 46%}.variant-1 .catalog-gallery{order:-1}.variant-1 .technical .hero-image{order:-1;clip-path:none}.variant-1 .kinetic .hero-image{order:-1;transform:rotate(-3deg)}.variant-1 .corporate .hero-image{order:-1}.variant-1 .serene .hero-image{border-radius:0}.variant-1 .artisan .hero-image{order:2;transform:rotate(3deg)}',
'.variant-2 .hero h1{text-transform:uppercase;font-family:Arial,sans-serif;font-style:normal;letter-spacing:-.085em;font-weight:900}.variant-2 .hero-button{border-radius:50px}.variant-2 .editorial,.variant-2 .corporate,.variant-2 .technical{grid-template-columns:60% 40%}.variant-2 .catalog-hero{grid-template-columns:55% 45%}.variant-2 .serene .hero-image{border-radius:0;width:100%}.variant-2 .artisan .hero-image{transform:none;box-shadow:none}.variant-2 .kinetic .hero-image{transform:rotate(-4deg)}',
'@media(max-width:850px){.container{width:calc(100% - 40px)}.site-header{height:75px}.site-header nav{gap:10px;font-size:11px}.hero h1{font-size:clamp(39px,8vw,74px)}.editorial,.technical,.corporate,.catalog-hero,.kinetic,.artisan{grid-template-columns:1fr;min-height:0}.editorial .hero-text,.technical .hero-text,.corporate .hero-text,.catalog-hero .hero-text,.kinetic .hero-text,.artisan .hero-text{padding:55px 25px}.editorial .hero-image,.technical .hero-image,.corporate .hero-image{height:370px;min-height:0}.catalog-hero,.kinetic,.artisan{padding:35px 20px;gap:20px}.kinetic .hero-image,.artisan .hero-image{height:360px;transform:none;box-shadow:none}.catalog-gallery{grid-template-rows:180px 200px}.serene{padding:60px 20px 0}.section{padding:70px 0}.story-grid{grid-template-columns:1fr;gap:25px}.story-copy{padding:0}.story-image img{height:360px}.service-list{grid-template-columns:1fr 1fr}.contact .contact-grid{grid-template-columns:1fr}.contact .contact-actions{text-align:left}.variant-1 .editorial .hero-image,.variant-1 .technical .hero-image,.variant-1 .corporate .hero-image,.variant-1 .kinetic .hero-image,.variant-1 .catalog-gallery{order:0}}',
'@media(max-width:520px){.container{width:calc(100% - 32px)}.site-header{height:auto;min-height:69px;gap:9px}.brand{font-size:16px}.site-header nav a:not(:last-child){display:none}.site-header nav{gap:0}.nav-cta{font-size:10px;padding:10px 11px}.hero h1{font-size:clamp(40px,12vw,62px)!important}.hero .hero-text{padding:46px 19px}.hero p{font-size:14px}.editorial .hero-image,.technical .hero-image,.corporate .hero-image{height:290px}.immersive{min-height:610px;height:80svh}.immersive .hero-text{bottom:48px;left:22px;right:22px;padding:0}.serene .hero-text{padding:0!important}.serene .hero-image{height:230px;min-height:0;width:100%}.kinetic,.artisan,.catalog-hero{padding:20px}.kinetic .hero-image,.artisan .hero-image{height:290px}.catalog-gallery{grid-template-rows:140px 150px}.section-heading{display:block}.section h2{font-size:35px}.service-list{grid-template-columns:1fr}.service-card{min-height:195px}.section{padding:58px 0}.story-image img{height:250px}.contact{padding:65px 0}.contact .contact-actions .cta-button{width:100%}.footer{display:block}.footer span{display:block;padding:4px 0}}',
'@media(prefers-reduced-motion:no-preference){.hero-text{animation:site-intro .75s ease both}.hero-image img,.catalog-gallery img{animation:site-image 1.1s ease both}.service-card{transition:transform .22s ease,box-shadow .22s ease}.service-card:hover{transform:translateY(-7px);box-shadow:0 16px 30px #00000014}.hero-button,.cta-button{transition:transform .2s ease,filter .2s ease}.hero-button:hover,.cta-button:hover{transform:translateY(-3px)}}@keyframes site-intro{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}@keyframes site-image{from{opacity:.35;transform:scale(1.04)}to{opacity:1;transform:scale(1)}}',
'@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}'
].join('');
const compositionCss=[
 'body{overflow-wrap:anywhere}.skip-link{position:absolute;z-index:5;top:0;left:1rem;transform:translateY(-125%);padding:12px;background:#fff;color:#000}.skip-link:focus{transform:none}a:focus-visible{outline:3px solid currentColor;outline-offset:4px}',
 '.site-header{border-bottom-color:var(--line)}.brand{display:inline-flex;align-items:center;gap:12px;text-wrap:balance}.brand-logo{width:52px;height:52px;object-fit:contain}.brand .brand-dot{margin-left:0}.nav-cta{min-height:44px}.hero-text{min-width:0}.hero h1{line-height:1.04;text-wrap:balance}.hero .eyebrow{font-size:12px;line-height:1.45;letter-spacing:.12em}.hero .hero-button{align-self:flex-start}.hero-actions{display:flex;align-items:center;flex-wrap:wrap;gap:14px}.serene .hero-actions{justify-content:center}.hero-button,.cta-button{max-width:100%;line-height:1.4;text-align:center}.hero-image,.story-image,.catalog-gallery{position:relative;margin:0;background:linear-gradient(145deg,var(--dark),var(--accent))}.hero-image figcaption,.story-image figcaption,.catalog-gallery figcaption{position:absolute;right:12px;bottom:12px;z-index:2;padding:5px 8px;border-radius:4px;background:#131a23;color:#fff;font:11px/1.2 Arial,sans-serif}.immersive .hero-image figcaption{z-index:2}',
 '.story-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(24px,6vw,85px)}.story-copy{padding:0}.story-copy h2{margin:0 0 20px}.story-copy p{margin:0;max-width:42ch}.story .story-image img{height:clamp(230px,35vw,440px)}.services{color:#182431;background:#fff}.services .service-list{list-style:none;padding:0;margin:32px 0 0}.services .service-card{min-height:112px;align-items:flex-start;justify-content:center;color:inherit;font-size:clamp(19px,2vw,24px);line-height:1.25;font-weight:750;letter-spacing:-.03em;border-color:#d5dce3;box-shadow:none}.services .service-card:hover{transform:none;box-shadow:none}',
 '.contact{padding:clamp(52px,8vw,100px) 0}.contact .contact-grid{grid-template-columns:minmax(0,1fr) auto;gap:clamp(24px,5vw,72px)}.contact h2{font-size:clamp(32px,5vw,64px);line-height:1.08;letter-spacing:-.045em;margin:0}.contact p{margin:14px 0 0}.contact .cta-button{margin:0}.contact .map-link{display:inline-block;margin-top:16px;text-decoration:underline;text-underline-offset:5px}.footer{color:var(--ink);opacity:.85}',
 '.direction-assinatura .hero h1{font-family:"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;font-weight:500;letter-spacing:-.055em}.direction-assinatura .services .service-card{border-radius:4px;border-top:3px solid var(--accent)}.direction-assinatura .story-copy{order:1}.direction-assinatura .story-image img{aspect-ratio:4/3}',
 '.direction-experiencia .hero h1{font-family:"Trebuchet MS",Arial,sans-serif;font-weight:800;font-style:normal;letter-spacing:-.061em}.direction-experiencia .hero-image{background:var(--dark)}.direction-experiencia .story .story-image img{height:clamp(200px,26vw,360px)}.direction-experiencia .story{border-bottom:1px solid var(--line)}.direction-experiencia .services{color:var(--ink);background:var(--surface)}.direction-experiencia .services .service-card{min-height:0;padding:18px 0;border:0;border-top:1px solid var(--line)}.direction-experiencia .services .service-list{gap:20px}.direction-experiencia .hero-button{border-radius:100px}',
 '.directory{display:grid;grid-template-columns:1fr;gap:30px;padding:clamp(39px,7vw,86px) max(16px,calc((100vw - 1160px)/2)) clamp(22px,5vw,60px)}.directory .hero-text{max-width:830px}.directory h1{font-family:Arial,Helvetica,sans-serif;font-size:clamp(43px,6.8vw,92px);font-weight:850;letter-spacing:-.07em}.directory .hero-image{height:clamp(190px,29vw,360px);border-radius:12px;overflow:hidden}.directory .hero-button,.direction-pratico .nav-cta,.direction-pratico .cta-button{border-radius:7px}.direction-pratico .services .container{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(24px,5vw,70px)}.direction-pratico .services .service-list{grid-template-columns:1fr;gap:0;margin:0;border-top:1px solid #d5dce3}.direction-pratico .services .service-card{min-height:0;padding:20px 0;border:none;border-bottom:1px solid #d5dce3}.direction-pratico .story-grid{grid-template-columns:minmax(0,640px)}',
 '.variant-1 .immersive .hero-text{text-align:right}.variant-1 .immersive h1,.variant-1 .immersive p{margin-inline-start:auto}.variant-1 .immersive .hero-actions{justify-content:flex-end}.variant-1 .immersive::after{background:linear-gradient(270deg,#0d1117cc,transparent 95%),linear-gradient(0deg,#090d17a8,transparent 58%)}.variant-2 .hero h1{font-family:Arial,Helvetica,sans-serif;font-weight:900}.variant-2 .directory .hero-text{margin-inline:auto;text-align:center}.variant-2 .directory .hero-text p{margin-inline:auto}.variant-2 .directory .hero-actions{justify-content:center}',
 '@media(min-width:851px){.variant-1 .directory{grid-template-columns:minmax(0,.95fr) minmax(0,1fr);align-items:center;gap:clamp(30px,6vw,75px)}.variant-1 .directory h1{font-size:clamp(40px,5vw,74px)}.variant-1 .directory .hero-image{order:-1;height:clamp(300px,38vw,500px)}}',
 'body.spacing-compact .section{padding-block:clamp(36px,5vw,70px)}body.spacing-spacious .section{padding-block:clamp(80px,11vw,150px)}',
 '@media(max-width:850px){body .hero:is(.editorial,.corporate,.technical,.catalog-hero,.kinetic,.artisan){grid-template-columns:minmax(0,1fr)}.story-grid,.contact .contact-grid,.direction-pratico .services .container{grid-template-columns:minmax(0,1fr)}.direction-assinatura .story-copy,.direction-experiencia .artisan .hero-text{order:0}.direction-experiencia .artisan .hero-image{order:1}.direction-experiencia .story .story-image img{height:clamp(200px,50vw,325px)}.direction-pratico .services .service-list{max-width:680px}}',
 '@media(max-width:520px){.brand-logo{width:36px;height:36px}.brand{gap:7px}.hero .eyebrow{font-size:10px}.hero .hero-text{padding-inline:16px}.immersive .hero-text{padding:24px 0}.directory .hero-text{padding:0}.immersive .hero-image figcaption{font-size:10px}.hero h1{font-size:clamp(36px,10.5vw,54px)!important}.services .service-list{margin-top:22px}.services .service-card{min-height:74px;padding:18px}.contact .contact-actions .cta-button{width:auto}}',
 '@keyframes scene-text{from{opacity:.3;transform:translateX(-22px)}to{opacity:1;transform:translateX(0)}}@keyframes quick-focus{from{opacity:.35}to{opacity:1}}',
 '@media(prefers-reduced-motion:no-preference){.direction-experiencia .hero-text{animation:scene-text .9s cubic-bezier(.16,1,.3,1) .14s both}.direction-experiencia .hero-image img{animation-duration:1.6s}.direction-pratico .hero-text,.direction-pratico .hero-image img{animation:quick-focus .32s ease-out both}}'
].join('');

function buildSite(info,t) {
 const name=text(info.name)||t.example,kind=text(info.industry)||t.label;
 const city=info.showLocation===false?'':text(info.city);
 const headline=text(info.headline)||t.headline,summary=text(info.summary)||t.summary;
 const profile=t.profile||{
  services:'Serviços',action:'Falar pelo WhatsApp',
  story:'Conheça as opções de atendimento e esclareça suas dúvidas antes de marcar uma visita.'
 };
 const direction=['assinatura','experiencia','pratico'].includes(t.direction)?t.direction:'';
 const services=typeof info.services==='string'
  ?info.services.split(/\r?\n/).map(text).filter(Boolean).slice(0,8)
  :t.services||[];
 const hasServices=info.showServices!==false&&services.length>0;
 const number=phone(info.phone);
 const whatsapp=number?'https://wa.me/'+number+'?text='+encodeURIComponent('Olá! Conheci o site da '+name+' e gostaria de saber mais.'):null;
 const map=city?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(name+' '+city):null;
 const contact=!!(whatsapp||map);
 const external=' target="_blank" rel="noopener noreferrer"';
 const heroAction=whatsapp?profile.action:hasServices?profile.services:map?'Ver localização':'Sobre a empresa';
 const heroHref=whatsapp||(hasServices?'#servicos':map?'#contato':'#sobre');

 const image=photo(info.photo)||photo(t.photo),logo=photo(info.logo);
 const related=templates.filter(item=>item.category===t.category&&item.id!==t.id).map(item=>item.photo);
 const supporting=[...new Set([t.detailPhoto,...(t.photos||[]),...related].map(photo))].filter(url=>url&&url!==image);
 const [secondary,tertiary]=supporting;
 const illustrative=image===photo(t.photo);
 const imageNote='<figcaption>Imagem ilustrativa</figcaption>';
 const mainPhoto=image?'<img src="'+esc(image)+'" width="1200" height="900" decoding="async" fetchpriority="high" alt="">':'';
 const heroBody='<div class="hero-text"><div class="eyebrow">'+esc([kind,city].filter(Boolean).join(' · '))+'</div>'+
  '<h1>'+esc(headline)+'</h1><p>'+esc(summary)+'</p><div class="hero-actions">'+
  '<a class="hero-button" href="'+esc(heroHref)+'"'+(whatsapp?external:'')+'>'+esc(heroAction)+'</a></div></div>';
 const layout=['editorial','technical','immersive','serene','artisan','kinetic','corporate','catalog','directory'].includes(t.layout)?t.layout:'corporate';
 const supportingPhoto=src=>src?'<img src="'+esc(src)+'" width="600" height="600" decoding="async" loading="lazy" alt="">':'';
 const heroImage=layout==='catalog'
  ?'<figure class="catalog-gallery">'+mainPhoto+supportingPhoto(secondary)+supportingPhoto(tertiary)+(illustrative||secondary||tertiary?imageNote:'')+'</figure>'
  :'<figure class="hero-image">'+mainPhoto+(illustrative&&image?imageNote:'')+'</figure>';
 const hero='<section class="hero '+(layout==='catalog'?'catalog-hero':layout)+'">'+heroBody+heroImage+'</section>';

 const details=hasServices?servicesMarkup(services,profile):'';
 const story=storyMarkup(name,profile,direction==='pratico'?'':secondary);
 const sections=direction==='experiencia'||(!direction&&['catalog','artisan'].includes(layout))
  ?story+details
  :details+story;
 const mapLink=map?'<a class="map-link" href="'+esc(map)+'"'+external+'>Abrir no Google Maps</a>':'';
 const contactHtml=contact
  ?'<section class="contact" id="contato"><div class="container contact-grid"><div>'+
   '<h2>'+(whatsapp?'Fale com '+esc(name):'Localização')+'</h2>'+
   (city?'<p>'+esc(city)+'</p>':'')+mapLink+'</div>'+
   (whatsapp?'<div class="contact-actions"><a class="cta-button" href="'+esc(whatsapp)+'"'+external+'>WhatsApp</a></div>':'')+
   '</div></section>'
  :'';

 const accent=palette(info.color||t.accent),bg=palette(t.bg),ink=palette(t.ink);
 const dark=readableInk(bg)==='#ffffff'?bg:'#202a32',buttonInk=readableInk(accent);
 const muted=readableInk(bg)==='#ffffff'?'#f0f3f6':'#4a5561';
 const line=readableInk(bg)==='#ffffff'?'#ffffff52':'#17253342';
 const fonts={editorial:'Georgia,serif',modern:'Arial,Helvetica,sans-serif',luxury:'Times New Roman,Georgia,serif',impact:'Impact,Arial Black,sans-serif'};
 const family=Object.hasOwn(fonts,info.headingFont)?fonts[info.headingFont]:'';
 const factor=Math.min(1.3,Math.max(.85,Number(info.headingSize)||1));
 const designOverrides=(family?'.hero h1,.section h2{font-family:'+family+'!important}':'')+
  (factor!==1?'.hero h1{font-size:clamp('+Math.round(38*factor)+'px,'+(7.5*factor).toFixed(2)+'vw,'+Math.round(110*factor)+'px)!important}'+
   '@media(max-width:520px){.hero h1{font-size:clamp('+Math.round(35*factor)+'px,'+(10*factor).toFixed(2)+'vw,'+Math.round(54*factor)+'px)!important}}':'')+
  (info.buttonStyle==='pill'?'.hero-button,.cta-button,.nav-cta{border-radius:100px!important}':'')+
  (info.buttonStyle==='square'?'.hero-button,.cta-button,.nav-cta{border-radius:0!important}':'')+
  (info.motionStyle==='none'?'html{scroll-behavior:auto}*,*::before,*::after{animation:none!important;transition:none!important}':'')+
  (info.motionStyle==='strong'?'@media(prefers-reduced-motion:no-preference){.hero-text{animation-duration:.5s!important}.hero-image img{animation-duration:.65s!important}}':'');
 const pageStyle=css+':root{--accent:'+accent+';--surface:'+bg+';--ink:'+ink+';--dark:'+dark+
  ';--buttonInk:'+buttonInk+';--muted:'+muted+';--line:'+line+';}'+compositionCss+designOverrides;
 const meta=summary.slice(0,155);
 const title=name+' | '+kind+(city?' · '+city:'');
 const schema={'@context':'https://schema.org','@type':'LocalBusiness',name,description:meta,
  ...(city?{areaServed:city}:{}),...(number?{telephone:'+'+number}:{})};
 // Prevent user content in structured data from closing the script element.
 const schemaSafe=JSON.stringify(schema).replace(/</g,'\\u003c');
 const variant=['0','1','2'].includes(info.variant)?info.variant:'0';
 const spacing=['compact','spacious'].includes(info.spacing)?' spacing-'+info.spacing:'';

 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta name="theme-color" content="'+bg+'"><meta name="description" content="'+esc(meta)+'">'+
  '<meta name="robots" content="noindex,nofollow"><title>'+esc(title)+'</title>'+
  '<script type="application/ld+json">'+schemaSafe+'</script><style>'+pageStyle+'</style></head>'+
  '<body class="variant-'+variant+(direction?' direction-'+direction:'')+spacing+'" data-direction="'+direction+'">'+
  '<a class="skip-link" href="#inicio">Ir para o conteúdo</a>'+
  '<header class="site-header container"><a class="brand" href="#inicio">'+
  (logo?'<img class="brand-logo" src="'+esc(logo)+'" width="52" height="52" alt="">':'')+
  esc(name)+(logo?'':'<span class="brand-dot"></span>')+'</a><nav aria-label="Navegação principal">'+
  (hasServices?'<a href="#servicos">'+esc(profile.services)+'</a>':'')+
  '<a href="#sobre">Sobre</a>'+(contact?'<a class="nav-cta" href="#contato">Contato</a>':'')+'</nav></header>'+
  '<main id="inicio">'+hero+sections+contactHtml+'</main><footer class="footer container"><span>© '+new Date().getFullYear()+
  ' '+esc(name)+'</span><span>'+esc([kind,city].filter(Boolean).join(' · '))+'</span></footer></body></html>';
}
window.PortalSiteStudio={
 start,buildSite,getDefault,pendingLead,templates,renderProjects,save:saveSelected,
 getCurrent:()=>{if(!selected||!template)return null;readFields();return {data:{...selected},template:{...template}};},
 updatePublished:(id,pubSlug)=>{if(selected){selected.publishedId=id;selected.publicSlug=pubSlug}}
};
updateProjectCount();
if (location.pathname.startsWith('/studio')) {
 const projectsPage = new URLSearchParams(location.search).get('view') === 'projects';
 $(projectsPage ? 'studioNavProjects' : 'studioNavCreate').setAttribute('aria-current', 'page');
 if (projectsPage) document.title = 'Meus projetos | Portal Prospect PRO';
} else {
 renderCatalog();
 switchView('gallery');
 if (pendingLead) notify('Empresa selecionada: ' + pendingLead.name + '. Escolha um modelo para criar o site.');
}
})();
