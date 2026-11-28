(function(){
'use strict';
const templates=window.SITE_TEMPLATES||[];
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=s=>String(s==null?'':s).trim();
const slug=s=>String(s||'site').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'site';
const palette=s=>/^#[0-9a-f]{6}$/i.test(String(s))?s:'#5a7399';
const photo=s=>{try{const v=new URL(String(s));if(v.protocol!=='https:'||v.username||v.password)return '';return v.href.replace(/["'<>\\()]/g,c=>encodeURIComponent(c));}catch{return ''}};
const {phoneNumber, whatsappNumber, whatsappLinkNumber}=window.ProspectLinks;
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
 const image=photo(t.photo).replace(/w=1600&q=82/,'w=680&q=68');
 const visual=image?'<img class="template-photo" src="'+esc(image)+'" loading="lazy" decoding="async" alt="" width="680" height="440">':
  t.id==='solar'&&window.ProspectPremiumArt?'<div class="template-photo" aria-hidden="true">'+window.ProspectPremiumArt.model+'</div>':'';
 return '<article class="template-card" style="--model-bg:'+bg+';--model-accent:'+accent+';--model-fg:'+fg+';--model-btntext:'+inv+'">'+
 '<div class="template-visual" data-layout="'+esc(t.layout)+'">'+visual+
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
 companyName: 'name', industryName: 'industry', cityName: 'city', phoneNumber: 'phone', whatsappNumber: 'whatsapp', phoneAsWhatsapp: 'whatsappUsePhone',
 addressName: 'address', companyWebsite: 'website', companyMapsUrl: 'mapsUrl', companyEmail: 'email',
 companyInstagram: 'instagram', companySocialLinks:'socialLinks', companyHours: 'hours',
 headline: 'headline', summary: 'summary', aboutCopy: 'about', ctaCopy: 'cta', services: 'services',
 serviceDetails: 'serviceDetails', faqCopy: 'faq', logoUrl: 'logo', brandGallery: 'brandGallery',
 photoUrl: 'photo', photoOrigin: 'photoOrigin', brandColor: 'color', layoutVariant: 'variant', headingFont: 'headingFont',
 headingSize: 'headingSize', buttonStyle: 'buttonStyle', motionStyle: 'motionStyle',
 sectionSpacing: 'spacing', showServices: 'showServices', showLocation: 'showLocation'
};
const styleFields = ['logo', 'photo', 'photoOrigin', 'brandGallery', 'color', 'variant', 'headingFont', 'headingSize', 'buttonStyle',
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
  industry: t.label, city: (pendingLead?.city || '').slice(0, 90), address: pendingLead?.address || '',
  phone: pendingLead?.phone || '', whatsapp: pendingLead?.whatsapp || whatsappLinkNumber(pendingLead?.website), whatsappUsePhone:pendingLead?.whatsappUsePhone!==false, website: pendingLead?.website || '',
  mapsUrl: pendingLead?.mapsUrl || '', email: '', instagram: '', socialLinks:'', hours: '',
  headline: t.headline, summary: t.summary, about: '', cta: '', services: (t.services || []).join('\n'),
  serviceDetails: '', faq: '', photo: t.photo, photoOrigin: t.photoOrigin || 'reference',
  logo: photo(t.logo), brandGallery: t.brandGallery || '', color: t.accent, variant: '0', headingFont: 'auto', headingSize: '1',
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
 $('phoneAsWhatsapp').disabled = !whatsappNumber({phone:selected.phone});
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
 const detected=window.ProspectMatchSegment?.(selected.industry)||window.ProspectMatchSegment?.(selected.name);
 const currentSegment=String(template.id).split('-studio-')[0];
 if(detected&&detected.id!==currentSegment&&['consultoria','generico'].includes(currentSegment)){
  const old=template,direction=old.direction,index=direction==='experiencia'?1:direction==='pratico'?2:0;
  const stock=window.ProspectImageLibrary.select(detected.id,selected.name+' '+selected.city,new Set(),12);
  const isStock=window.ProspectImageLibrary.owners(selected.photo).length>0||selected.photo===old.photo;
  template={...detected,id:detected.id+'-studio-'+index,direction,layout:direction==='pratico'?'directory':direction==='experiencia'?(detected.layout==='immersive'?'artisan':'immersive'):detected.layout,photo:stock[index%stock.length]||detected.photo,photos:stock,detailPhoto:stock[(index+1)%stock.length]||'',motionStyle:old.motionStyle};
  selected.templateId=template.id;
  if(!selected.sourcesOnly&&selected.photoOrigin!=='business'&&selected.photoOrigin!=='generated'&&(!selected.photo||isStock)){selected.photo=template.photo;selected.photoOrigin='reference';}
  const generic=value=>!value||String(value).trim().toLowerCase()===String(selected.industry).trim().toLowerCase()||value===old.headline||value===old.summary||value===old.profile?.story;
  if(!selected.sourcesOnly){
   if(generic(selected.headline))selected.headline=detected.headline;
   if(generic(selected.summary))selected.summary=detected.summary;
   if(generic(selected.about))selected.about=detected.profile.story;
  }
  if(!selected.color||selected.color===old.accent)selected.color=detected.accent;
 }
 const preferred=selected.whatsapp||whatsappLinkNumber(selected.website);
 const shared=whatsappNumber({phone:selected.phone});
 selected.whatsappUsePhone=selected.whatsappUsePhone!==false && (!preferred || whatsappNumber({whatsapp:preferred})===shared);
 selected.whatsapp=preferred || (selected.whatsappUsePhone && shared ? selected.phone : '');
 resetAssistant();
 setEditorTool(false);
 $('modelName').textContent = template.label;
 const evidence = $('brandEvidence');
 const sourceLinks = (Array.isArray(selected.brandSources) ? selected.brandSources : []).map(photo).filter(Boolean);
 evidence.hidden = !sourceLinks.length;
 evidence.replaceChildren();
 if (sourceLinks.length) {
  evidence.append('Fontes conferidas para este projeto');
  for (const url of sourceLinks) {
   const link=document.createElement('a'); link.href=url; link.textContent=new URL(url).hostname;
   link.target='_blank'; link.rel='noopener noreferrer';
   evidence.append(document.createElement('br'),link);
  }
 }
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
 resetAssistant();
 $('websitePreview').removeAttribute('srcdoc');
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
  if (id === 'photoUrl' && $('photoOrigin').value === 'generated') $('photoOrigin').value = 'reference';
  if (id === 'whatsappNumber') $('phoneAsWhatsapp').checked=false;
  if (id === 'phoneAsWhatsapp' || id === 'phoneNumber' && $('phoneAsWhatsapp').checked) {
   $('whatsappNumber').value = $('phoneAsWhatsapp').checked && whatsappNumber({phone:$('phoneNumber').value}) ? $('phoneNumber').value : '';
  }
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
 if (!selected) return;
 if (assistantPreview && !currentSuggestion()) {
  clearSuggestion();
  assistantStatus('O rascunho mudou. Peça uma nova sugestão.');
 }
 const data = assistantPreview ? { ...selected, ...selectedChanges() } : selected;
 $('aiPreviewBadge').hidden = !assistantPreview;
 showInFrame($('websitePreview'),buildSite(data,template));
}

function showInFrame(frame,html) {
 // Resolve local fragments in this sandbox instead of navigating back to the studio.
 frame.srcdoc=html.replace('<head>','<head><base href="about:srcdoc">');
}
function fullPreview(html,name) {
 $('fullSiteTitle').textContent=name;
 showInFrame($('fullSiteFrame'),html);
 $('fullSiteDialog').showModal();
}
$('closeFullSite').onclick=()=>$('fullSiteDialog').close();
$('editorFullSite').onclick=()=>{
 if(selected)fullPreview(buildSite(assistantPreview?{...selected,...selectedChanges()}:selected,template),selected.name);
};
$('fullSiteDialog').addEventListener('close',()=>{
 $('fullSiteFrame').removeAttribute('srcdoc');
});

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

const assistantFields = {
 headline: ['headline', 'Título principal'], summary: ['summary', 'Descrição curta'],
 about: ['aboutCopy', 'Sobre a empresa'], cta: ['ctaCopy', 'Texto do botão principal'],
 color: ['brandColor', 'Cor de destaque'], variant: ['layoutVariant', 'Composição'],
 headingFont: ['headingFont', 'Fonte dos títulos'], headingSize: ['headingSize', 'Tamanho do título'],
 buttonStyle: ['buttonStyle', 'Estilo dos botões'], motionStyle: ['motionStyle', 'Animação'],
 spacing: ['sectionSpacing', 'Espaçamento'], showServices: ['showServices', 'Seção de serviços'],
 showLocation: ['showLocation', 'Localização']
};
let assistantMode = 'text';
let assistantCapabilities;
let assistantConfigRequest;
let assistantRequest;
let assistantResult;
let assistantPreview = false;
let rejectedAssistantToken;

function assistantToken() {
 try {
  const token = JSON.parse(sessionStorage.getItem('prospect_publisher_session_v1') || 'null')?.access_token;
  return token !== rejectedAssistantToken ? token : null;
 } catch {
  return null;
 }
}

function assistantStatus(message) {
 $('aiStatus').textContent = message;
}

function assistantAvailable(mode = assistantMode) {
 return assistantCapabilities?.[mode === 'image' ? 'images' : 'text'] === true;
}

function reflectAssistant() {
 const configured = assistantAvailable();
 const busy = Boolean(assistantRequest);
 $('aiConnect').hidden = !configured || Boolean(assistantToken());
 $('aiRequestButton').disabled = !configured || !assistantToken() || busy;
 $('aiTextMode').disabled = busy;
 $('aiImageMode').disabled = busy;
}

async function configureAssistant() {
 if (!selected || $('editorAssistantPanel').hidden) return;
 reflectAssistant();
 if (assistantRequest) return;
 if (!assistantCapabilities) {
  assistantStatus('Verificando disponibilidade da IA…');
  assistantConfigRequest ||= fetch('/api/studio/ai/status', { cache: 'no-store' }).then(response => {
   if (!response.ok) throw Error('Status indisponível.');
   return response.json();
  });
  try {
   const configured = await assistantConfigRequest;
   assistantCapabilities = { text: configured?.text === true, images: configured?.images === true };
  } catch {
   assistantStatus('Não foi possível verificar a IA. Reabra o assistente para tentar de novo.');
   return;
  } finally {
   assistantConfigRequest = null;
  }
 }
 reflectAssistant();
 if (assistantResult || assistantRequest) return;
 assistantStatus(!assistantAvailable()
  ? (assistantMode === 'image' ? 'A geração de imagens ainda não está habilitada.' : 'A edição por IA ainda não está habilitada.')
  : assistantToken() ? '' : 'Entre na sua conta para usar a IA.');
}

function setEditorTool(assistant) {
 $('editorFieldsPanel').hidden = assistant;
 $('editorAssistantPanel').hidden = !assistant;
 for (const [id, active] of [['editorFieldsTab', !assistant], ['editorAssistantTab', assistant]]) {
  $(id).classList.toggle('active', active);
  $(id).setAttribute('aria-pressed', String(active));
 }
 if (assistant) configureAssistant();
 else if (assistantPreview) {
  assistantPreview = false;
  reflectSuggestion();
  paint();
 }
}

function clearSuggestion() {
 assistantResult = null;
 assistantPreview = false;
 $('aiSuggestion').hidden = true;
 $('aiChanges').replaceChildren();
 $('aiImageResult').hidden = true;
 $('aiImagePreview').removeAttribute('src');
}

function setAssistantMode(mode) {
 assistantMode = mode;
 const image = mode === 'image';
 clearSuggestion();
 $('aiRequest').value = '';
 $('aiRequestLabel').textContent = image ? 'Que imagem você quer na capa?' : 'O que você quer ajustar?';
 $('aiRequest').placeholder = image
  ? 'Ex.: Mostre uma bancada de barbearia, com luz natural e fundo escuro.'
  : 'Ex.: Encurte o título e deixe o botão arredondado.';
 $('aiRequestButton').textContent = image ? 'Gerar imagem' : 'Pedir sugestão';
 for (const [id, active] of [['aiTextMode', !image], ['aiImageMode', image]]) {
  $(id).classList.toggle('active', active);
  $(id).setAttribute('aria-pressed', String(active));
 }
 configureAssistant();
 paint();
}

function resetAssistant() {
 assistantRequest?.abort();
 assistantRequest = null;
 clearSuggestion();
 $('aiRequest').value = '';
 assistantStatus('');
}

$('editorFieldsTab').onclick = () => setEditorTool(false);
$('editorAssistantTab').onclick = () => setEditorTool(true);
$('aiTextMode').onclick = () => setAssistantMode('text');
$('aiImageMode').onclick = () => setAssistantMode('image');
$('studioAiConnect').onclick = $('aiConnect').onclick = () => $('manageProjectAccount').click();
$('publishOverlay').addEventListener('close', configureAssistant);

const lines = value => String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
function pairs(value, leftKey, rightKey) {
 return lines(value).map(line => {
  const [left, ...rest] = line.split('|');
  return { [leftKey]: text(left), [rightKey]: text(rest.join('|')) };
 }).filter(entry => entry[leftKey] && entry[rightKey]);
}

function assistantDraft() {
 const draft = Object.fromEntries(Object.keys(assistantFields).map(field => [field, selected[field]]));
 const descriptions = new Map(pairs(selected.serviceDetails, 'name', 'description').map(pair => [pair.name, pair.description]));
 draft.services = lines(selected.services).map(name => {
  const description = descriptions.get(name);
  return description ? name + ' | ' + description : name;
 });
 draft.faq = pairs(selected.faq, 'question', 'answer');
 return draft;
}

function textChoices(changes) {
 const choices = [];
 function add(key, label, values, preview) {
  if (Object.entries(values).some(([field, value]) => selected[field] !== value)) {
   choices.push({ key, label, values, preview, checked: true });
  }
 }
 for (const [key, [id, label]] of Object.entries(assistantFields)) {
  const value = changes?.[key];
  const field = $(id);
  if (field.type === 'checkbox') {
   if (typeof value === 'boolean') add(key, label, { [key]: value }, value ? 'Exibir' : 'Ocultar');
  } else if (field.tagName === 'SELECT') {
   const option = Array.from(field.options).find(item => item.value === value);
   if (option) add(key, label, { [key]: value }, option.textContent);
  } else if (key === 'color') {
   if (/^#[a-f\d]{6}$/i.test(value)) add(key, label, { [key]: value.toLowerCase() }, value);
  } else if (typeof value === 'string') {
   const next = value.slice(0, field.maxLength);
   add(key, label, { [key]: next }, next || 'Remover texto');
  }
 }
 if (Array.isArray(changes?.services)) {
  const items = changes.services.filter(item => typeof item === 'string').map(item => item.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const services = items.map(item => text(item.split('|')[0])).filter(Boolean).join('\n').slice(0, $('services').maxLength);
  const serviceDetails = items.filter(item => item.includes('|')).join('\n').slice(0, $('serviceDetails').maxLength);
  add('services', 'Serviços', { services, serviceDetails }, items.join('\n') || 'Remover serviços');
 }
 if (Array.isArray(changes?.faq)) {
  const faq = changes.faq.filter(item => text(item?.question) && text(item?.answer)).map(item =>
   text(item.question).replace(/[|\n]/g, ' ') + ' | ' + text(item.answer).replace(/\n/g, ' ')
  ).join('\n').slice(0, $('faqCopy').maxLength);
  add('faq', 'Perguntas frequentes', { faq }, faq || 'Remover perguntas');
 }
 return choices;
}

function currentSuggestion() {
 return assistantResult && JSON.stringify(snapshot()) === assistantResult.fingerprint;
}

function selectedChanges() {
 return Object.assign({}, ...assistantResult.choices.filter(choice => choice.checked).map(choice => choice.values));
}

function reflectSuggestion() {
 if (!assistantResult) return;
 const usable = Boolean(currentSuggestion()) && assistantResult.ready && assistantResult.choices.some(choice => choice.checked);
 $('aiApply').disabled = !usable;
 $('aiPreviewChanges').disabled = !usable;
 $('aiPreviewChanges').textContent = assistantPreview ? 'Voltar ao rascunho' : 'Ver na prévia';
}

function renderSuggestion() {
 $('aiSuggestion').hidden = false;
 $('aiSuggestionSummary').textContent = assistantResult.summary;
 if (assistantResult.image) {
  $('aiImageResult').hidden = false;
  $('aiImagePreview').src = assistantResult.image;
 } else {
  for (const choice of assistantResult.choices) {
   const row = document.createElement('label');
   row.className = 'assistant-change';
   const control = document.createElement('input');
   control.type = 'checkbox';
   control.checked = true;
   control.dataset.aiField = choice.key;
   const name = document.createElement('strong');
   name.textContent = choice.label;
   const value = document.createElement('span');
   value.textContent = choice.preview;
   control.onchange = () => {
    choice.checked = control.checked;
    if (assistantPreview && !assistantResult.choices.some(item => item.checked)) assistantPreview = false;
    reflectSuggestion();
    paint();
   };
   row.append(control, name, value);
   $('aiChanges').append(row);
  }
 }
 reflectSuggestion();
}

async function askAssistant() {
 const request = text($('aiRequest').value);
 const token = assistantToken();
 if (!selected || !token || assistantRequest || !assistantAvailable()) return;
 if (!request) {
  assistantStatus(assistantMode === 'image' ? 'Descreva a imagem que você quer gerar.' : 'Descreva a alteração que você quer fazer.');
  $('aiRequest').focus();
  return;
 }
 if (!text(selected.name) || !text(selected.industry)) {
  assistantStatus('Preencha o nome e o segmento da empresa em Ajustes.');
  return;
 }
 clearSuggestion();
 paint();
 const fingerprint = JSON.stringify(snapshot());
 const mode = assistantMode;
 const controller = assistantRequest = new AbortController();
 const facts = selected.companyFacts;
 const company = {
  name: selected.name, industry: selected.industry, city: selected.city, address: selected.address,
  summary: [facts?.summary, facts?.about].filter(Boolean).join('\n'), services: facts?.services || []
 };
 const payload = mode === 'image'
  ? { request, company, direction: template.direction || template.layout }
  : { mode: 'edit', request, company, draft: assistantDraft() };
 reflectAssistant();
 assistantStatus(mode === 'image' ? 'Gerando a imagem ilustrativa…' : 'Preparando sua sugestão…');
 try {
  const response = await fetch('/api/studio/ai/' + mode, {
   method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
   body: JSON.stringify(payload), signal: controller.signal
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
   if (response.status === 401) rejectedAssistantToken = token;
   throw Error(result?.error || 'Não foi possível concluir o pedido de IA.');
  }
  if (assistantRequest !== controller || !selected) return;
  if (fingerprint !== JSON.stringify(snapshot())) {
   assistantStatus('O rascunho mudou. Peça uma nova sugestão.');
   return;
  }
  const image = mode === 'image' ? photo(result.url) : '';
  if (mode === 'image' && !image) throw Error('O serviço não retornou uma imagem válida.');
  const choices = image ? [{ checked: true, values: { photo: image, photoOrigin: 'generated' } }] : textChoices(result.changes);
  if (!choices.length) {
   assistantStatus(result.summary || 'O pedido não resultou em alterações para o rascunho.');
   return;
  }
  assistantResult = { fingerprint, image, choices, ready: !image, summary: result.summary || '' };
  assistantStatus('');
  renderSuggestion();
 } catch (error) {
  if (assistantRequest === controller) assistantStatus(error.message);
 } finally {
  if (assistantRequest === controller) {
   assistantRequest = null;
   reflectAssistant();
  }
 }
}

$('aiRequestButton').onclick = askAssistant;
$('aiImagePreview').onload = () => {
 if (assistantResult?.image) {
  assistantResult.ready = true;
  reflectSuggestion();
 }
};
$('aiImagePreview').onerror = () => {
 if (assistantResult?.image) assistantStatus('Não foi possível carregar a imagem gerada.');
};
$('aiPreviewChanges').onclick = () => {
 if (!currentSuggestion()) return;
 assistantPreview = !assistantPreview;
 if (assistantPreview && mobileEditor.matches) setMobilePane(true);
 reflectSuggestion();
 paint();
};
$('aiApply').onclick = () => {
 if (!currentSuggestion()) {
  clearSuggestion();
  paint();
  return assistantStatus('O rascunho mudou. Peça uma nova sugestão.');
 }
 recordEdit();
 Object.assign(selected, selectedChanges());
 writeFields();
 clearSuggestion();
 recordEdit();
 paint();
 assistantStatus('Sugestão aplicada ao rascunho. Você pode desfazer a alteração.');
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
  const url = window.ProspectLinks.previewUrl(project.publicSlug, project.publicShareSlug);
  const publicLink = url
   ? '<a class="button secondary" href="' + esc(url) + '" target="_blank" rel="noopener">Visualizar site</a>' +
    '<button type="button" class="button secondary" data-copy-link="' + esc(project.id) + '">Copiar link</button>' +
    '<button type="button" class="button secondary" data-republish="' + esc(project.id) + '">Atualizar publicação</button>'
   : '';
  const historyButton = project.cloudOwned
   ? '<button type="button" class="button secondary" data-versions="' + esc(project.id) + '">Versões</button>'
   : '';
  return '<article class="project-row"><span class="project-state">' + (project.publicSlug ? 'Prévia publicada' : 'Rascunho') +
   '</span><h2>' + esc(project.name || 'Projeto sem nome') + '</h2><p>' + details + '</p>' + updated +
   '<div class="project-actions"><button type="button" class="button accent" data-load="' + esc(project.id) +
   '">Editar site</button>' + publicLink + historyButton + '<button type="button" class="plain-btn" data-remove="' +
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
 for (const button of $('projectsList').querySelectorAll('[data-copy-link]')) {
  button.onclick = async () => {
   const project = projects.find(item => item.id === button.dataset.copyLink);
   const link = project && window.ProspectLinks.previewUrl(project.publicSlug, project.publicShareSlug);
   if (!link) return;
   try { await navigator.clipboard.writeText(link); notify('Link do site copiado.'); }
   catch { window.prompt('Copie o endereço do site:', link); }
  };
 }
 for (const button of $('projectsList').querySelectorAll('[data-republish]')) {
  button.onclick = () => {
   const project = projects.find(item => item.id === button.dataset.republish);
   if (project) { start(project.templateId, project); $('publishPreview').click(); }
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
     publicShareSlug: project.publicShareSlug,
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

function downloadFile(blob, name, container) {
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement('a');
 anchor.href = url;
 anchor.download = name;
 container.append(anchor);
 anchor.click();
 anchor.remove();
 setTimeout(() => URL.revokeObjectURL(url), 2000);
}
$('downloadSite').onclick = () => {
 readFields();
 downloadFile(new Blob([buildSite(selected, template)], {type:'text/html;charset=utf-8'}), slug(selected.name) + '-site.html', editor);
 notify('Arquivo HTML gerado');
};
async function downloadApprovedSite(event) {
 const button = event.currentTarget;
 button.disabled = true;
 try {
  readFields();
  const html = buildSite(selected, template, {finalSite:true});
  const filename = (slug(selected.name) || 'empresa') + '-site.zip';
  const {zipSync, strToU8} = await import('/vendor/fflate.mjs');
  const zip = zipSync({'index.html':strToU8(html)});
  downloadFile(new Blob([zip], {type:'application/zip'}), filename, button.parentElement);
  notify('Site pronto para o domínio da empresa');
 } catch { notify('Não foi possível baixar o site. Tente novamente.'); }
 finally { button.disabled = false; }
}
$('downloadFinalSite').onclick = downloadApprovedSite;
$('downloadApprovedZip').onclick = downloadApprovedSite;
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
function fieldLines(value,limit) {
 return String(value||'').split(/\r?\n/).map(text).filter(Boolean).slice(0,limit);
}

function fieldPairs(value,limit) {
 return fieldLines(value,limit).flatMap(line=>{
  const split=line.indexOf('|');
  if(split<1)return [];
  const key=text(line.slice(0,split)),value=text(line.slice(split+1));
  return key&&value?[[key,value]]:[];
 });
}

function contactEmail(value) {
 const address=text(value);
 return /^[A-Z0-9._+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(address)?address:'';
}

function suppliedMap(value) {
 const safe=photo(value);
 if(!safe)return '';
 const {hostname,pathname}=new URL(safe);
 if(['maps.app.goo.gl','maps.google.com','maps.google.com.br'].includes(hostname))return safe;
 if(['www.google.com','google.com','www.google.com.br','google.com.br','goo.gl'].includes(hostname)
   &&/^\/maps(?:\/|$)/.test(pathname))return safe;
 return '';
}

function servicesMarkup(list,profile,info,isSuggested) {
 const normalize=value=>text(value).toLocaleLowerCase('pt-BR');
 const supplied=new Map(fieldPairs(info.serviceDetails,8).map(([name,details])=>[normalize(name),details]));
 const details=info.sourcesOnly?{}:profile.serviceDescriptions||{};
 return '<section class="services section" id="servicos" aria-labelledby="service-title"><div class="container">'+
  '<div class="section-lead"><h2 id="service-title">'+esc(profile.services)+'</h2>'+
  (isSuggested?'<p class="content-reference">Opções ilustrativas do segmento. Confirme a disponibilidade com a empresa.</p>':'')+
  '</div><ul class="service-list">'+list.map(service=>{
   const value=supplied.get(normalize(service))||(Object.hasOwn(details,service)?details[service]:'');
   const price=value.match(/\s*\|\s*(R\$\s?[\d.]+,\d{2})\s*$/);
   const description=price?value.slice(0,price.index):value;
   return '<li class="service-card"><div class="service-label"><strong class="service-name">'+esc(service)+'</strong>'+
    (price?'<span class="service-price">'+esc(price[1])+'</span>':'')+'</div>'+
    (description?'<p class="service-detail">'+esc(description)+'</p>':'')+'</li>';
  }).join('')+'</ul></div></section>';
}

function storyMarkup(heading,copy,image,businessImage=false) {
 return '<section class="story section" id="sobre" aria-labelledby="story-title"><div class="container story-grid">'+
  '<div class="story-copy"><h2 id="story-title">'+esc(heading||'Sobre a empresa')+'</h2>'+
  fieldLines(copy,8).map(line=>'<p>'+esc(line)+'</p>').join('')+'</div>'+
  (image?'<figure class="story-image"><img loading="lazy" decoding="async" width="850" height="650" src="'+esc(image)+'" alt="">'+(businessImage?'':'<figcaption>Imagem ilustrativa</figcaption>')+'</figure>':'')+
  '</div></section>';
}

function faqMarkup(items) {
 return '<section class="site-faq section" id="perguntas" aria-labelledby="faq-title"><div class="container faq-grid">'+
  '<h2 id="faq-title">Perguntas frequentes</h2><div class="faq-items">'+items.map(([question,answer])=>
   '<details><summary>'+esc(question)+'</summary><p>'+esc(answer)+'</p></details>'
  ).join('')+'</div></div></section>';
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

const displayEnsembles={
 bodoni:['Bodoni Moda','500 700','https://fonts.gstatic.com/s/bodonimoda/v28/aFTQ7PxzY382XsXX63LUYJSKSKg.woff2','Georgia,serif'],
 barlow:['Barlow Condensed','700','https://fonts.gstatic.com/s/barlowcondensed/v13/HTxwL3I-JCGChYJ8VI-L6OO_au7B46r2z3bWuQ.woff2','Arial Narrow,Arial,sans-serif'],
 fraunces:['Fraunces','500 800','https://fonts.gstatic.com/s/fraunces/v38/6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxC9TeA.woff2','Georgia,serif'],
 manrope:['Manrope','400 800','https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggexSg.woff2','system-ui,sans-serif'],
 instrument:['Instrument Serif','400','https://fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-6zUTjg.woff2','Georgia,serif'],
 bricolage:['Bricolage Grotesque','400 800','https://fonts.gstatic.com/s/bricolagegrotesque/v9/3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGIInE.woff2','system-ui,sans-serif'],
 dm:['DM Sans','400 700','https://fonts.gstatic.com/s/dmsans/v17/rP2Hp2ywxg089UriCZOIHQ.woff2','system-ui,sans-serif']
};
const siteFonts=Object.fromEntries(Object.entries(displayEnsembles).map(([key,[name,weight,url,fallback]])=>[key,{
 family:'"'+name+'",'+fallback,
 rule:'@font-face{font-family:"'+name+'";font-style:normal;font-weight:'+weight+
 ';font-display:swap;src:url("'+url+'") format("woff2")}'
}]));
const siteArt={
 salon:{signature:'bodoni',experience:'bricolage',practical:'dm',material:'#f5eaf0',ink:'#371d32'},
 barber:{signature:'barlow',experience:'instrument',practical:'bricolage',material:'#262621',ink:'#f6eee3'},
 care:{signature:'dm',experience:'instrument',practical:'manrope',material:'#e9f3ef',ink:'#1a3d37'},
 pet:{signature:'bricolage',experience:'fraunces',practical:'dm',material:'#fae9d9',ink:'#422b23'},
 food:{signature:'fraunces',experience:'barlow',practical:'dm',material:'#f6ecd9',ink:'#3c2519'},
 counter:{signature:'bricolage',experience:'barlow',practical:'dm',material:'#edd2a4',ink:'#402518'},
 oven:{signature:'fraunces',experience:'barlow',practical:'dm',material:'#f8ece0',ink:'#491f21'},
 coffee:{signature:'fraunces',experience:'instrument',practical:'dm',material:'#eae5d8',ink:'#2e3d32'},
 editorial:{signature:'instrument',experience:'bricolage',practical:'manrope',material:'#e8eae5',ink:'#26352f'},
 architect:{signature:'instrument',experience:'bodoni',practical:'dm',material:'#e8e8e0',ink:'#35372f'},
 workshop:{signature:'barlow',experience:'bricolage',practical:'manrope',material:'#e5e9ec',ink:'#1c3240'},
 practice:{signature:'manrope',experience:'instrument',practical:'dm',material:'#e7edf1',ink:'#233949'},
 modern:{signature:'bricolage',experience:'dm',practical:'manrope',material:'#e7e6fb',ink:'#292448'},
 creative:{signature:'bodoni',experience:'bricolage',practical:'dm',material:'#e9e7f2',ink:'#331f49'},
 academy:{signature:'bricolage',experience:'fraunces',practical:'manrope',material:'#e8eddc',ink:'#243724'},
 training:{signature:'barlow',experience:'bricolage',practical:'dm',material:'#d9ebe6',ink:'#112f2b'}
};
const premiumCss=[
 'body{font-family:system-ui,sans-serif}.site-header{height:76px}.brand{min-width:0;font-size:clamp(17px,2vw,23px);line-height:1.12;letter-spacing:-.035em}.site-header nav{gap:clamp(10px,2vw,25px);letter-spacing:0}.nav-cta,.hero-button,.cta-button{font-size:14px;min-height:48px;letter-spacing:0}.hero h1,.direction-assinatura .hero h1,.direction-experiencia .hero h1,.variant-2 .hero h1,.section h2,.contact h2{font-family:var(--display);font-synthesis:none;font-optical-sizing:auto}.hero h1{font-weight:660;letter-spacing:-.055em}.hero .eyebrow{margin:0;letter-spacing:0;font-size:13px;line-height:1.3;font-weight:650;opacity:1;max-width:52ch}.hero .hero-summary{max-width:51ch;font-size:clamp(15px,1.45vw,18px);opacity:.9;line-height:1.65}.hero .hero-actions{margin-top:22px}.hero .hero-button{margin-top:0}.section h2{font-size:clamp(34px,5.5vw,70px);font-weight:620;line-height:1.05;text-wrap:balance}',
 '.art-salon .editorial,.art-architect .editorial,.art-editorial .editorial,.art-creative .editorial{width:min(1360px,calc(100% - 48px));margin:24px auto 0;min-height:auto;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr)}.art-salon .editorial .hero-text,.art-architect .editorial .hero-text,.art-editorial .editorial .hero-text,.art-creative .editorial .hero-text{padding:clamp(40px,7vw,106px) clamp(24px,6.6vw,96px);align-self:center}.art-salon .editorial .hero-image,.art-architect .editorial .hero-image,.art-editorial .editorial .hero-image,.art-creative .editorial .hero-image{min-height:0;max-height:780px;aspect-ratio:4/5;align-self:stretch}.art-salon .hero h1,.art-architect .hero h1,.art-editorial .hero h1{font-weight:520;letter-spacing:-.042em}',
 '.art-barber .hero h1,.art-workshop .hero h1,.art-training .hero h1{letter-spacing:-.035em}.art-barber .technical,.art-workshop .technical{margin-top:0}.art-barber .technical .hero-image,.art-workshop .technical .hero-image{clip-path:none}.art-barber .technical .hero-text,.art-workshop .technical .hero-text{padding-left:max(28px,calc((100vw - 1160px)/2))}.art-oven .immersive .hero-image img,.art-food .immersive .hero-image img,.art-counter .immersive .hero-image img{object-position:center 62%}.art-oven .artisan .hero-image,.art-food .artisan .hero-image,.art-counter .artisan .hero-image{border-radius:6px;transform:rotate(-1.5deg);box-shadow:13px 14px 0 color-mix(in srgb,var(--accent) 66%,transparent)}.art-coffee .artisan .hero-image{border-radius:50% 50% 2px 2px}.art-care .serene .hero-image{border-radius:36px 36px 0 0}',
 '.direction-pratico .directory{gap:clamp(22px,4vw,52px)}.direction-pratico .directory .hero-image{height:clamp(185px,29vw,405px);border-radius:3px}.direction-pratico .directory .hero-summary{max-width:66ch}.direction-experiencia .immersive{height:min(78vh,760px)}.direction-experiencia .immersive .hero-text{bottom:clamp(42px,8vw,106px)}.direction-experiencia .hero h1{letter-spacing:-.04em}.direction-assinatura .story-image img{object-fit:cover}',
 '.services{background:var(--material);color:var(--material-ink)}.services .section-lead h2{max-width:15ch}.services .content-reference{color:currentColor;margin:15px 0 0;opacity:.83;max-width:54ch;font-size:14px}.services .service-list{gap:0;border-top:1px solid currentColor}.services .service-card{padding:22px clamp(16px,3vw,38px) 24px;min-height:0;border:0;border-bottom:1px solid currentColor;border-radius:0;justify-content:flex-start;text-align:left}.services .service-card:first-child{padding-left:0}.services .service-card:last-child{padding-right:0}.service-name{font-size:clamp(18px,2.3vw,27px);font-weight:680}.services .service-detail{color:currentColor;opacity:.87;margin:10px 0 0;font-size:15px;font-weight:425;letter-spacing:0;line-height:1.55;max-width:45ch}.direction-assinatura .services .service-card{border-top:0;border-radius:0}.direction-assinatura .services .service-card+.service-card{border-inline-start:1px solid color-mix(in srgb,currentColor 26%,transparent)}.direction-experiencia .services .service-card,.direction-pratico .services .service-card{padding:18px 0;border-top:0;border-bottom:1px solid color-mix(in srgb,currentColor 32%,transparent)}.direction-experiencia .services{background:var(--surface);color:var(--ink)}.direction-experiencia .services .service-list{grid-template-columns:1fr;max-width:880px}.direction-experiencia .services .service-card{display:grid;grid-template-columns:minmax(0,.65fr) minmax(0,1.35fr);gap:22px}.direction-experiencia .services .service-detail{margin:0}.direction-pratico .services .service-list{border-top:1px solid currentColor}',
 '.story .story-image{border-radius:2px;overflow:hidden}.story .story-copy p{font-size:clamp(16px,1.65vw,20px);max-width:48ch;line-height:1.65}.site-faq{background:var(--surface);border-top:1px solid var(--line)}.faq-grid{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:clamp(30px,8vw,110px)}.faq-items{border-top:1px solid var(--line)}.faq-items details{border-bottom:1px solid var(--line);padding:18px 4px}.faq-items summary{font-size:17px;line-height:1.4;font-weight:650;cursor:pointer}.faq-items details[open] summary{margin-bottom:8px}.faq-items details p{margin:0;padding:0 19px;color:var(--muted)}',
 '.contact{background:var(--dark);color:#fff}.contact-heading{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:clamp(18px,6vw,78px)}.contact-heading h2{max-width:17ch}.contact-heading .cta-button{justify-self:end;max-width:100%}.contact-details{border-top:1px solid #ffffff55;margin-top:clamp(22px,5vw,56px);padding-top:clamp(20px,4vw,40px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:clamp(15px,5vw,60px)}.contact-detail h3{margin:0 0 12px;font-size:17px;font-weight:675}.contact-detail address{font-style:normal}.contact-detail p{margin:3px 0 0}.business-hours,.contact-channels{list-style:none;padding:0;margin:0;line-height:1.8}.contact-channels a,.contact .map-link{display:inline-block;text-decoration:underline;text-underline-offset:4px}.contact .map-link{margin-top:12px}.contact-detail p,.contact-detail address,.business-hours{color:#e1e7ee}.footer{margin-block:0;min-height:66px;align-items:center}',
 '@media(max-width:850px){body .hero.editorial{grid-template-columns:minmax(0,1fr)}.hero.editorial .hero-text{padding:clamp(35px,7vw,72px) 24px}.hero.editorial .hero-image{aspect-ratio:auto;max-height:460px}.services .service-list{grid-template-columns:1fr}.services .service-card,.services .service-card:first-child,.services .service-card:last-child{padding:18px 0}.direction-assinatura .services .service-card+.service-card{border-inline-start:0}.faq-grid{grid-template-columns:minmax(0,1fr)}.contact-heading{align-items:start}}',
 '@media(max-width:520px){.site-header{height:auto;min-height:64px;gap:12px}.site-header .brand{font-size:16px}.site-header .nav-cta{min-height:40px;font-size:13px}.site-header nav a{font-size:13px}.hero .eyebrow{font-size:12px}.hero .hero-summary{font-size:15px;line-height:1.55}.hero .hero-actions{margin-top:17px}.hero h1{line-height:1.04}.hero.editorial{width:100%;margin-top:0}.hero.editorial .hero-image{height:clamp(235px,76vw,365px)}.direction-experiencia .immersive{min-height:510px;height:min(82svh,680px)}.direction-experiencia .services .service-card{grid-template-columns:1fr;gap:9px}.hero-image figcaption,.story-image figcaption,.catalog-gallery figcaption{font-size:10px;max-width:80%}.contact-heading{grid-template-columns:minmax(0,1fr)}.contact-heading .cta-button{justify-self:start}}',
 '@keyframes scene-rise{from{opacity:.65;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes scene-focus{from{transform:scale(1.034)}to{transform:scale(1)}}',
 '@media(prefers-reduced-motion:no-preference){.hero-text{animation:scene-rise .58s ease-out both}.hero-image img,.catalog-gallery img{animation:none}.direction-experiencia .hero-text{animation:scene-rise .72s .09s cubic-bezier(.22,.7,.4,1) both}.direction-experiencia .hero-image img{animation:scene-focus 1.15s ease-out both}.direction-pratico .hero-text{animation:scene-rise .4s ease-out both}.direction-pratico .hero-image img{animation:none}.services .service-card{transition:none}.hero-button,.cta-button{transition:filter .16s ease}.hero-button:hover,.cta-button:hover{transform:none}}'
].join('');
// Native motion also runs in the script-free public preview and in the downloadable site.
const motionCss=`
.site-header .brand-logo{width:auto;max-width:min(180px,42vw);max-height:52px;object-fit:contain}
.gallery-social{display:inline-flex;align-items:center;min-height:44px;margin-top:16px;text-decoration:underline;text-underline-offset:.25em}
.portfolio-strip figure a{display:block;overflow:hidden}
body{--entry-distance:18px;--entry-scale:1.045;--entry-time:600ms;--panel-time:340ms;--curve:cubic-bezier(.16,.75,.22,1)}
body.motion-strong{--entry-distance:36px;--entry-scale:1.11;--entry-time:950ms;--panel-time:560ms}
@keyframes brand-headline{from{opacity:.24;transform:translateY(var(--entry-distance))}to{opacity:1;transform:translateY(0)}}
@keyframes brand-photo{from{transform:scale(var(--entry-scale));filter:saturate(.72)}to{transform:scale(1);filter:saturate(1)}}
@keyframes brand-tab{from{opacity:.46;transform:translateY(calc(var(--entry-distance)*.6))}to{opacity:1;transform:translateY(0)}}
@keyframes brand-answer{from{opacity:.25;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
@keyframes brand-scroll{from{transform:translateY(12px) scale(.985)}to{transform:none}}
@media(prefers-reduced-motion:no-preference){
 body:not(.motion-none) .hero .hero-text{animation:none}
 body:not(.motion-none) .hero h1{animation:brand-headline var(--entry-time) var(--curve) both}
 body:not(.motion-none) .hero .hero-actions{animation:brand-headline var(--entry-time) 80ms var(--curve) backwards}
 body:not(.motion-none) .hero .hero-image img,body:not(.motion-none) .hero .catalog-gallery img:first-child{animation:brand-photo calc(var(--entry-time) + 280ms) var(--curve) both}
 body:not(.motion-none) main>section:target>.container{animation:brand-tab var(--panel-time) var(--curve) both}
 body:not(.motion-none) .faq-items details[open]>p{animation:brand-answer 230ms var(--curve) both}
 body:not(.motion-none) .site-header nav a{transition:color .18s ease}
 body:not(.motion-none) :is(.hero-button,.cta-button,.gallery-social){transition:transform .19s var(--curve),box-shadow .19s ease}
 body:not(.motion-none) :is(.hero-button,.cta-button,.gallery-social):active{transform:scale(.96)}
 @media(hover:hover){body:not(.motion-none) .portfolio-strip a img{transition:transform .5s var(--curve)}body:not(.motion-none) .portfolio-strip a:hover img{transform:scale(1.055)}}
 @supports(animation-timeline:view()){
  body:not(.motion-none) main:not(:has(>section:target)) .portfolio-strip figure{animation:brand-scroll linear both;animation-timeline:view();animation-range:entry 0% entry 100%}
 }
}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}*,*::before,*::after{animation:none!important;transition:none!important}}
@media(max-width:760px){.site-header .brand-logo{max-height:36px}}
`;

function brandImage(value) {
 const s=String(value||'');
 if(!/^https:\/\/[^<>"'\s\\]+$/i.test(s)||s.length>2000)return '';
 try {
  const u=new URL(s);
  if(u.username||u.password||/(^|\.)portalcentralia\.com\.br$|(^|\.)resonant-puffpuff-6de5a0\.netlify\.app$|(^|\.)portal-prospect-pro\.onrender\.com$/i.test(u.hostname))return '';
  return u.href.replace(/[()]/g,c=>encodeURIComponent(c));
 }catch{return ''}
}
function brandIconSvg(name,category) {
 const k=String(category||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const pet=/pet\s*shop|veterin|animal|banho\s*e\s*tosa|\bpet\b/.test(k);
 const food=/restaur|pizz|hamburg|padaria|cafeter|gastronom/.test(k);
 const auto=/automotiv|oficina|mecanica|veiculo/.test(k);
 const beauty=/beleza|estetic|salao|barbear|manicure/.test(k);
 const initial=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().match(/[A-Z0-9]/)?.[0]||'•';
 const art=pet?'<g fill="#fff"><ellipse cx="17" cy="24" rx="5" ry="7" transform="rotate(-25 17 24)"/><ellipse cx="27" cy="16" rx="5" ry="7"/><ellipse cx="39" cy="16" rx="5" ry="7"/><ellipse cx="49" cy="24" rx="5" ry="7" transform="rotate(25 49 24)"/><path d="M32 28c-7 0-9 7-15 12-7 7-2 15 6 13 4-1 6-3 9-3s5 2 9 3c8 2 13-6 6-13-6-5-8-12-15-12Z"/></g>':food?'<path d="M17 12v15m6-15v15m6-15v15q0 9-6 9v16m24-40q-10 7-10 19h10v21" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>':auto?'<g fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"><path d="m15 30 5-13h24l5 13 5 5v12H10V35z"/><path d="M16 47v5m32-5v5M16 30h32M16 38h7m18 0h7"/></g>':beauty?'<path d="M32 10q3 17 20 22-17 4-20 22-4-18-20-22 16-5 20-22Z" fill="#fff"/>':'<text x="32" y="44" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="36" fill="#fff">'+initial+'</text>';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="'+(pet?'#16766c':food?'#9a552d':auto?'#334155':beauty?'#85557c':'#344d68')+'"/>'+art+'</svg>';
}

const qualityCss="/* prospect-design-quality-v1 */\n.site-header.container{gap:clamp(12px,3vw,36px);min-height:70px;border-bottom:1px solid color-mix(in srgb,var(--ink) 14%,transparent);padding-block:10px}\n.site-header .brand{font-size:clamp(17px,2vw,23px);font-weight:750;letter-spacing:-.035em;line-height:1.2}\n.site-header nav{gap:clamp(8px,1.7vw,24px);font-weight:600}\n.site-header nav a,.site-header nav a:not(:last-child){border:0!important;box-shadow:none!important;min-height:44px;padding:0 4px;font-size:14px;font-weight:600;line-height:1.2}\n.site-header nav a.nav-cta{background:var(--accent);color:var(--buttonInk,var(--ink));border-radius:999px!important;padding-inline:19px;text-decoration:none}\n.site-header nav a:focus-visible{outline:2px solid currentColor;outline-offset:4px}\n.site-header nav a:hover{text-underline-offset:5px}\n.hero h1{overflow-wrap:break-word;text-wrap:balance;line-height:1.07;letter-spacing:-.04em}\n.hero .hero-summary{line-height:1.6;max-width:52ch;text-wrap:pretty}\n.hero-button,.cta-button{min-height:48px;line-height:1.35;font-size:clamp(14px,1.3vw,16px)}\n.story-copy p+p{margin-top:1em}\n.brand-portfolio .portfolio-strip img{border-radius:12px}\n.footer{border-top:1px solid color-mix(in srgb,var(--ink) 14%,transparent)}\n@media(max-width:850px){\n .site-header.container{display:block;padding:12px 20px 5px}\n .site-header .brand{display:inline-flex;min-height:28px;max-width:100%}\n .site-header nav{display:flex;flex-wrap:wrap;justify-content:flex-start;gap:0 15px;margin-top:3px}\n .site-header nav a,.site-header nav a:not(:last-child){display:inline-flex;min-height:44px;padding:0;font-size:13px}\n .site-header nav a.nav-cta{background:transparent;color:inherit;padding:0;border-radius:0!important}\n .site-header nav a.nav-cta:hover{text-decoration:underline}\n main,main>section[id]{scroll-margin-top:148px}\n body .hero.immersive{height:auto;min-height:clamp(460px,72svh,620px);display:flex;align-items:flex-end}\n body .hero.immersive .hero-text{position:relative;inset:auto;padding:clamp(26px,5vw,48px);width:100%}\n body .hero.immersive .hero-image{position:absolute;inset:0}\n body .hero.immersive::after{background:linear-gradient(0deg,rgba(0,0,0,.79),rgba(0,0,0,.34) 58%,rgba(0,0,0,.12))}\n body .hero.immersive h1{max-width:18ch}\n .art-pet .hero.immersive{display:flex;flex-direction:column;align-items:stretch;min-height:0;height:auto;background:var(--surface);color:var(--ink)}\n .art-pet .hero.immersive::after{display:none}\n .art-pet .hero.immersive .hero-image{position:relative;inset:auto;order:-1;height:clamp(180px,54vw,320px);margin:14px 20px 0;border-radius:18px;overflow:hidden}\n .art-pet .hero.immersive .hero-image img{height:100%;object-fit:cover;object-position:center 42%;filter:none}\n .art-pet .hero.immersive .hero-text{padding:22px 20px 32px;text-align:left}\n .art-pet .hero.immersive .hero-text h1,.art-pet .hero.immersive .hero-text p{margin-inline-start:0}\n .art-pet .hero.immersive .hero-actions{justify-content:flex-start}\n .art-pet .hero h1{text-transform:none}\n}\n@media(max-width:520px){\n .site-header.container{padding-inline:16px}\n .site-header nav{gap:0 12px}\n .site-header nav a,.site-header nav a:not(:last-child){font-size:13px}\n body .hero h1{font-size:clamp(32px,9vw,45px)!important;line-height:1.09;letter-spacing:-.04em;margin:12px 0 14px}\n body .hero .hero-summary{font-size:15px;line-height:1.55;margin:0}\n body .hero .hero-actions{margin-top:17px}\n body .hero .hero-button{margin-top:0;padding:12px 19px}\n body .hero:not(.immersive):not(.serene) .hero-text{padding:30px 20px}\n body .art-pet .hero.immersive .hero-text{padding:22px 20px 32px}\n .art-pet .hero.immersive .hero-image{margin-inline:16px}\n .section{padding-block:42px}\n .section h2,.contact h2{font-size:clamp(27px,8vw,36px);line-height:1.12}\n .story-grid,.faq-grid{grid-template-columns:minmax(0,1fr)!important;gap:22px}\n .contact{padding-block:44px}\n .hero-image figcaption,.story-image figcaption,.catalog-gallery figcaption{font-size:10px;padding:4px 6px;border-radius:6px;opacity:.86}\n}\n@media(max-width:360px){.site-header nav{gap:0 9px}.site-header nav a,.site-header nav a:not(:last-child){font-size:12px}}\n@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}}";
const motionEnhancements="/* prospect-motion-v2 */\n@keyframes prospect-reveal{from{opacity:.35;transform:translateY(24px)}to{opacity:1;transform:none}}\n@keyframes prospect-slide{from{opacity:.35;transform:translateX(-22px)}to{opacity:1;transform:none}}\n@keyframes prospect-photo{from{opacity:.55;transform:scale(.96)}to{opacity:1;transform:none}}\n@keyframes prospect-panel{from{opacity:.6;transform:translateY(12px)}to{opacity:1;transform:none}}\n@keyframes prospect-shimmer{from{transform:translateX(-150%) skewX(-18deg)}to{transform:translateX(230%) skewX(-18deg)}}\n.brand-portfolio .portfolio-strip{grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(12px,2vw,24px)}\n.portfolio-strip figure{min-width:0}\n.portfolio-strip figure a{border-radius:12px;background:var(--surface);isolation:isolate}\n.portfolio-strip img{aspect-ratio:4/3;object-fit:cover}\n.portfolio-strip figcaption{font-size:12px;opacity:.83}\n@media(max-width:760px){.brand-portfolio .portfolio-strip{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.portfolio-strip figcaption{font-size:11px}}\n@media(prefers-reduced-motion:no-preference){\n body:not(.motion-none) .hero .eyebrow{animation:prospect-reveal .55s var(--curve,ease) both}\n body:not(.motion-none) .hero .hero-summary{animation:prospect-reveal .65s var(--curve,ease) .12s both}\n body:not(.motion-none) main>section:target{animation:prospect-panel .38s var(--curve,ease) both}\n body:not(.motion-none) .hero-button,body:not(.motion-none) .cta-button{position:relative;overflow:hidden;isolation:isolate;transition:transform .25s ease,box-shadow .25s ease,filter .25s ease}\n body:not(.motion-none) .hero-button::after,body:not(.motion-none) .cta-button::after{content:\"\";position:absolute;inset:0 auto 0 0;width:42%;background:linear-gradient(90deg,transparent,#ffffff38,transparent);pointer-events:none;transform:translateX(-150%)}\n @media(hover:hover){body:not(.motion-none) .hero-button:hover::after,body:not(.motion-none) .cta-button:hover::after{animation:prospect-shimmer .75s ease both}body:not(.motion-none) .portfolio-strip figure a:hover img{transform:scale(1.045)}body:not(.motion-none) .service-card{transition:transform .25s ease,background-color .25s ease}body:not(.motion-none) .service-card:hover{transform:translateY(-3px)}}\n @supports(animation-timeline:view()){\n  body:not(.motion-none) main:not(:has(>section:target)) :is(.section h2,.story-copy,.contact-heading){animation:prospect-reveal linear both;animation-timeline:view();animation-range:entry 0% entry 80%}\n  body:not(.motion-none) main:not(:has(>section:target)) :is(.story-image,.portfolio-strip figure){animation:prospect-photo linear both;animation-timeline:view();animation-range:entry 0% entry 85%}\n  body:not(.motion-none) main:not(:has(>section:target)) .service-card{animation:prospect-reveal linear both;animation-timeline:view();animation-range:entry 0% entry 85%}\n  body.direction-experiencia:not(.motion-none) main:not(:has(>section:target)) .story-copy{animation-name:prospect-slide}\n  body.direction-pratico:not(.motion-none) main:not(:has(>section:target)) :is(.section h2,.service-card){animation-name:prospect-panel}\n }\n}\n@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}";
const motionCraftCss="/* prospect-motion-craft-v1 */\n@media(prefers-reduced-motion:no-preference){\n body.direction-assinatura.motion-soft{--entry-distance:12px;--entry-time:460ms;--curve:cubic-bezier(.22,1,.36,1)}\n body.direction-experiencia.motion-soft{--entry-distance:24px;--entry-time:680ms;--curve:cubic-bezier(.16,1,.3,1)}\n body.direction-pratico.motion-soft{--entry-distance:8px;--entry-time:280ms;--curve:cubic-bezier(.2,.8,.2,1)}\n @keyframes craft-rise{from{opacity:.64;transform:translateY(var(--entry-distance))}to{opacity:1;transform:translateY(0)}}\n @keyframes craft-photo{from{transform:scale(1.045)}to{transform:scale(1)}}\n body:not(.motion-none) .hero h1{animation:craft-rise var(--entry-time) var(--curve) both}\n body:not(.motion-none) .hero .eyebrow{animation:craft-rise 360ms var(--curve) both}\n body:not(.motion-none) .hero .hero-summary{animation:craft-rise var(--entry-time) var(--curve) 90ms both}\n body:not(.motion-none) .hero .hero-actions{animation:craft-rise var(--entry-time) var(--curve) 140ms both}\n body.direction-experiencia:not(.motion-none) .hero .hero-image img{animation:craft-photo 960ms var(--curve) both}\n body.direction-pratico:not(.motion-none) .hero .hero-image img{animation:none}\n body:not(.motion-none) :is(.hero-button,.cta-button,.gallery-social){transition:transform 160ms var(--curve),box-shadow 180ms ease,background-color 180ms ease}\n body:not(.motion-none) :is(.hero-button,.cta-button,.gallery-social):active{transform:scale(.98)}\n @media(hover:hover) and (pointer:fine){\n  body:not(.motion-none) .portfolio-strip a img{transition:transform 360ms var(--curve)}\n  body:not(.motion-none) .portfolio-strip a:hover img{transform:scale(1.035)}\n }\n @media(max-width:600px){\n  body:not(.motion-none){--entry-distance:10px;--entry-time:360ms}\n  body.direction-pratico.motion-soft{--entry-time:240ms}\n  body.direction-experiencia:not(.motion-none) .hero .hero-image img{animation-duration:560ms}\n }\n}\n.hero a:focus-visible,.service-card a:focus-visible,.portfolio-strip a:focus-visible,.cta-button:focus-visible,.gallery-social:focus-visible{outline:2px solid currentColor;outline-offset:4px}\n@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}\n";
const distinctCss="/* prospect-distinct-directions-v1 */\nbody.direction-assinatura .hero-button{border-radius:6px}\nbody.direction-assinatura .portfolio-strip{grid-template-columns:repeat(2,minmax(0,1fr))}\nbody.direction-assinatura .portfolio-strip img{border-radius:2px}\nbody.direction-assinatura .story-image{border-radius:2px}\nbody.direction-experiencia .hero-button{border-radius:100px}\nbody.direction-experiencia .portfolio-strip{grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(12px,2vw,28px)}\nbody.direction-experiencia .portfolio-strip img{border-radius:18px;aspect-ratio:4/5}\nbody.direction-pratico .hero-button{border-radius:10px}\nbody.direction-pratico .portfolio-strip{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}\nbody.direction-pratico .portfolio-strip img{border-radius:8px;aspect-ratio:5/3}\nbody.direction-pratico .hero.directory .hero-image{border-radius:12px}\n@keyframes distinct-editorial{from{opacity:.45;transform:translateY(16px)}to{opacity:1;transform:none}}\n@keyframes distinct-experience{from{opacity:.35;transform:scale(1.07)}to{opacity:1;transform:none}}\n@keyframes distinct-practical{from{opacity:.5;transform:translateX(-12px)}to{opacity:1;transform:none}}\n@media(prefers-reduced-motion:no-preference){\n body.direction-assinatura:not(.motion-none) .hero h1{animation:distinct-editorial .7s ease-out both}\n body.direction-experiencia:not(.motion-none) .hero h1{animation:distinct-experience .85s cubic-bezier(.16,.75,.22,1) both}\n body.direction-pratico:not(.motion-none) .hero h1{animation:distinct-practical .42s ease-out both}\n}\n@media(max-width:520px){body.direction-experiencia .portfolio-strip,body.direction-pratico .portfolio-strip{grid-template-columns:repeat(2,minmax(0,1fr))}}";
const premiumVisualCss=".premium-visual .hero-button,.premium-visual .cta-button{border-radius:999px;min-height:50px;padding:14px 26px;font-size:15px;box-shadow:0 8px 24px #00000018}\n.premium-visual .site-header.container{border-bottom:1px solid var(--line);padding-block:14px}\n.premium-visual .hero h1{font-size:clamp(42px,6vw,86px);line-height:1.02;letter-spacing:-.055em;text-wrap:balance}\n.premium-visual .hero .hero-summary{font-size:clamp(15px,1.6vw,20px);line-height:1.65;opacity:.95}\n.premium-visual .hero .eyebrow{font-size:12px;font-weight:700;letter-spacing:.13em}\n.premium-visual .hero.editorial{padding:clamp(20px,4vw,56px);gap:clamp(20px,4vw,56px);grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;min-height:0}\n.premium-visual .hero.editorial .hero-text{padding:clamp(16px,3vw,44px)}\n.premium-visual .hero.editorial .hero-image{height:clamp(320px,44vw,590px);min-height:0;border-radius:26px;overflow:hidden;order:0}\n.premium-visual .hero.immersive{min-height:570px}.premium-visual .hero.immersive .hero-text{max-width:740px}\n.premium-visual .hero.immersive .hero-image img{filter:brightness(.8)}.premium-visual .hero.immersive .hero-image figcaption{z-index:4}\n.premium-visual .hero.serene{padding:clamp(32px,5vw,76px) 20px 0}.premium-visual .hero.serene .hero-image{border-radius:24px 24px 0 0;width:min(1040px,95%);height:clamp(240px,43vw,480px)}\n.premium-visual.direction-pratico .hero.serene h1{font-family:Georgia,serif;font-weight:400;text-transform:none}\n.premium-visual .section{padding-block:clamp(42px,6vw,88px)}\n.premium-visual .portfolio-strip img{border-radius:16px;aspect-ratio:4/3;object-fit:cover}\n.premium-visual .story-image{border-radius:20px;overflow:hidden}\n.premium-visual .premium-inquiries .service-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;border:0}\n.premium-visual .premium-inquiries .service-card{border:1px solid var(--line);border-radius:14px;padding:22px;min-height:96px}\n.premium-visual .premium-inquiries a{display:flex;align-items:center;gap:10px;justify-content:space-between;width:100%;font-size:18px}\n.premium-visual .premium-inquiries a:hover{text-decoration:underline}\n@media(max-width:760px){.premium-visual .hero.editorial{grid-template-columns:minmax(0,1fr);padding:20px;gap:20px}.premium-visual .hero.editorial .hero-text{padding:18px 0 0}.premium-visual .hero.editorial .hero-image{height:clamp(245px,75vw,390px);border-radius:18px}.premium-visual .hero.immersive{min-height:540px}.premium-visual .hero.immersive .hero-text{padding:0;bottom:42px}.premium-visual .premium-inquiries .service-list{grid-template-columns:1fr}.premium-visual .hero.serene .hero-image{width:100%}.premium-visual .site-header nav{gap:0 12px}}\n@media(prefers-reduced-motion:no-preference){@supports(animation-timeline:view()){.premium-visual:not(.motion-none) main:not(:has(>section:target)) .portfolio-strip figure,.premium-visual:not(.motion-none) main:not(:has(>section:target)) .service-card{animation:premium-enter linear both;animation-timeline:view();animation-range:entry 0% entry 65%}}@keyframes premium-enter{from{transform:translateY(14px);opacity:.65}to{transform:none;opacity:1}}}\n";
function buildSite(info,t,{finalSite=false}={}) {
 const name=text(info.name)||t.example,kind=text(info.industry)||t.label;
 const sourcesOnly=info.sourcesOnly===true;
 const premiumVisuals=info.premiumVisuals===true;
 const showLocation=info.showLocation!==false;
 const city=showLocation?text(info.city):'',address=showLocation?text(info.address):'';
 const proposedHeadline=text(info.headline)||t.headline;
 const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const duplicate=[name,'Conheça '+name,kind+' com '+name].some(s=>normal(s)===normal(proposedHeadline));
 const firstService=fieldLines(info.services,1)[0];
 const headline=sourcesOnly?(proposedHeadline||name):duplicate?(firstService && normal(firstService)!==normal(name)?firstService:normal(kind)!==normal(name)?kind:'Conheça os serviços'):proposedHeadline;
 const originalSummary=text(info.summary)||t.summary||'';
 const oldIntro=name+' atua no segmento de '+kind.toLowerCase()+(city?' em '+city:'')+'.';
 let summary=originalSummary.startsWith(oldIntro)?originalSummary.slice(oldIntro.length).trim():originalSummary;
 const petCategory=/pet\s*shop|veterin|animal|banho\s*e\s*tosa|\bpet\b/.test(normal(kind));
 const genericPet=/^conte o que seu pet precisa para saber quais servicos estao disponiveis e como funciona o atendimento$/.test(normal(summary));
 if(petCategory&&genericPet)summary='Conheça '+name+(city?' em '+city:'')+' e encontre o canal de atendimento para cuidar do seu pet.';
 const templateSegment=String(t.id).split('-studio-')[0];
 const detected=window.ProspectMatchSegment?.(kind)||window.ProspectMatchSegment?.(name);
 const base=detected||templates.find(item=>item.id===templateSegment);
 const profile=(detected&&detected.id!==templateSegment?detected.profile:t.profile)||base?.profile||{
  services:'Serviços',action:'Fale com a empresa',
  story:'Consulte as opções de atendimento e esclareça suas dúvidas.'
 };
 const direction=['assinatura','experiencia','pratico'].includes(t.direction)?t.direction:'';
 const rawServices=typeof info.services==='string'?fieldLines(info.services,8):t.services||[];
 const isSuggested=info.servicesSuggested===true||(!Object.hasOwn(info,'servicesSuggested')
  &&rawServices.join('\n')===(t.services||[]).join('\n'));
 const hasServices=info.showServices!==false&&rawServices.length>0&&(!finalSite||!isSuggested);
 const faq=fieldPairs(info.faq,8);
 const demo=info.illustrativeBusiness===true;
 const isMenu=['hamburgueria','restaurante','pizzaria','cafeteria','padaria'].includes(base?.id);
 const serviceNav=isMenu?'Cardápio':'Serviços';

 const telephone=phoneNumber(info.phone);
 const recipient=whatsappNumber(info);
 const whatsapp=recipient?'https://wa.me/'+recipient+'?text='+encodeURIComponent(
  'Olá! Encontrei '+name+' pelo site. '+(profile.ask||'Gostaria de informações sobre o atendimento.')
 ):'';
 const email=contactEmail(info.email);
 const networks=window.ProspectSocial.profiles([window.ProspectLinks.instagram(info.instagram),...fieldLines(info.socialLinks,12),info.website]);
 const instagram=networks.find(item=>item.network==='instagram')?.url;
 const website=whatsappLinkNumber(info.website)||window.ProspectSocial.profile(info.website)?'':photo(info.website);
 const hours=fieldLines(info.hours,10);
 const placeId=showLocation&&/^[A-Za-z0-9_-]{5,250}$/.test(text(info.googlePlaceId))?text(info.googlePlaceId):'';
 const query=[name,address,city].filter(Boolean).join(' ');
 const map=showLocation&&!demo&&(suppliedMap(info.mapsUrl)||suppliedMap(info.googleMapsUrl)
  ||(address||city||placeId?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query)
    +(placeId?'&query_place_id='+encodeURIComponent(placeId):''):''));
 const hasContact=!!(whatsapp||telephone||email||networks.length||website||map||hours.length||address||city);
 if(!faq.length){
  if(hasServices)faq.push([isMenu?'O que encontro no cardápio?':'Quais serviços posso consultar?',
   (isSuggested?'As opções ilustrativas incluem ':'Nesta apresentação você encontra ')+rawServices.slice(0,4).join(', ')+'.']);
  if(hours.length)faq.push(['Qual é o horário de atendimento?',hours.join(' · ')+'.']);
  if(address||city)faq.push(['Onde fica a empresa?',[address,city].filter(Boolean).join(' · ')+'.']);
  if(whatsapp)faq.push(['Como iniciar uma conversa?','Na aba Contato, toque em Abrir WhatsApp para revisar sua mensagem e conversar com '+name+'.']);
 }
 const external=' target="_blank" rel="noopener noreferrer"';
 const customAction=text(info.cta);
 const requestedAction=!whatsapp&&!telephone&&/consultar disponibilidade|agendar|reservar/i.test(customAction)?'':customAction;
 const heroAction=requestedAction||(whatsapp?profile.action:telephone?'Ligar para a empresa'
  :hasServices?profile.services:map?'Ver localização':hasContact?'Ver contatos':'Conheça a empresa');
 const defaultHeroHref=whatsapp||(telephone?'tel:'+telephone:hasServices?'#servicos':hasContact?'#contato':!sourcesOnly||text(info.about)?'#sobre':'');
 const locationFirst=sourcesOnly&&direction==='pratico'&&map;
 const servicesFirst=sourcesOnly&&direction==='assinatura'&&hasServices;
 const heroHref=locationFirst?map:servicesFirst?'#servicos':defaultHeroHref;
 const actionLabel=requestedAction||(
  locationFirst?'Abrir no Google Maps':servicesFirst?'Conhecer '+serviceNav.toLocaleLowerCase('pt-BR'):
  sourcesOnly&&heroHref===whatsapp&&whatsapp?'Falar no WhatsApp':heroAction
 );

 const library=window.ProspectImageLibrary;
 const selectedImage=photo(info.photo),logo=photo(info.logo);
 const ownPhotos=[...new Set(fieldLines(info.brandGallery,12).map(photo).filter(Boolean))];
 const exclusive=t.exclusivePhotos===true;
 const sameSegment=sourcesOnly&&!premiumVisuals?[]:exclusive?(Array.isArray(t.stockPhotos)?t.stockPhotos:[]):library?.select(base?.id||t.id,name+' '+city,new Set([selectedImage]),12)||[];
 const stock=[...new Set(sameSegment.map(photo).filter(Boolean))];
 const owners=library?.owners(selectedImage)||[];
 const wrongStock=info.photoOrigin!=='business'&&info.photoOrigin!=='generated'&&owners.length&&(!base||!owners.includes(base.id));
 const image=(!wrongStock&&selectedImage)||ownPhotos[0]||stock[0]||'';
 const supportDetail=photo(t.detailPhoto);
 const allowedDetail=ownPhotos.includes(supportDetail)||stock.some(url=>url.split('?')[0]===supportDetail.split('?')[0])?supportDetail:'';
 const imageKey=url=>String(url||'').split('?')[0];
 const supporting=[...new Map([...ownPhotos,allowedDetail,...stock].map(photo).filter(Boolean).map(url=>[imageKey(url),url])).values()].filter(url=>imageKey(url)!==imageKey(image));
 const [secondary,tertiary]=supporting;
 const origin=ownPhotos.includes(image)?'business':image===selectedImage&&['generated','business','reference'].includes(info.photoOrigin)?info.photoOrigin:'reference';
 const imageCaption=origin==='generated'?'Imagem gerada por IA':origin==='reference'?'Imagem ilustrativa':'';
 const figureCaption=caption=>caption?'<figcaption>'+esc(caption)+'</figcaption>':'';
 const mainPhoto=image?'<img src="'+esc(image)+'" width="1200" height="900" decoding="async" fetchpriority="high" alt="'+esc(origin==='business'?'Foto de '+name:'Imagem ilustrativa de '+kind)+'">':'';
 const intro=[normal(kind)!==normal(headline)&&normal(kind)!==normal(name)?kind:'',city].filter(Boolean).join(' · ');
 const heroBody='<div class="hero-text">'+(intro?'<p class="eyebrow">'+esc(intro)+'</p>':'')+
  '<h1>'+esc(headline)+'</h1>'+(summary&&normal(summary)!==normal(headline)?'<p class="hero-summary">'+esc(summary)+'</p>':'')+
  (heroHref?'<div class="hero-actions"><a class="hero-button" href="'+esc(heroHref)+'"'+(heroHref.startsWith('https://')?external:'')+'>'+esc(actionLabel)+'</a></div>':'')+'</div>';
 const layout=['editorial','technical','immersive','serene','artisan','kinetic','corporate','catalog','directory'].includes(t.layout)?t.layout:'corporate';
 const supportingPhoto=src=>src?'<img src="'+esc(src)+'" width="600" height="600" decoding="async" loading="lazy" alt="">':'';
 const supportIsIllustrative=[secondary,tertiary].filter(Boolean).some(src=>!ownPhotos.includes(src));
 const galleryCaption=supportIsIllustrative?(origin==='business'?'Fotos da empresa e imagens ilustrativas.':origin==='generated'?'Imagem principal gerada por IA e imagens ilustrativas.':'Imagens ilustrativas.'):imageCaption;
 const heroImage=layout==='catalog'
  ?'<figure class="catalog-gallery">'+mainPhoto+supportingPhoto(secondary)+supportingPhoto(tertiary)+figureCaption(galleryCaption)+'</figure>'
  :'<figure class="hero-image">'+mainPhoto+figureCaption(imageCaption)+'</figure>';
 const solarGraphic=base?.id==='solar'&&!image&&Boolean(window.ProspectPremiumArt);
 const graphicHero=((sourcesOnly&&!premiumVisuals)||solarGraphic)&&!image&&(direction||(solarGraphic?'assinatura':''));
 const hero=graphicHero?'<section class="hero composition-hero">'+heroBody+window.ProspectComposition.graphic(graphicHero,base?.id)+'</section>':
  '<section class="hero '+(layout==='catalog'?'catalog-hero':layout)+(image?'':' no-stock-photo')+'">'+heroBody+(image?heroImage:'')+'</section>';

 const serviceSection=hasServices?servicesMarkup(rawServices,profile,info,isSuggested):
  premiumVisuals&&!finalSite&&hasContact?'<section id="servicos" class="services section premium-inquiries"><div class="container"><div class="section-lead"><h2>O que você procura?</h2><p>Consulte a empresa para confirmar as opções disponíveis.</p></div><ul class="service-list">'+(base?.services?.length?base.services.slice(0,3):['Produtos e serviços','Atendimento','Informações']).map(label=>'<li class="service-card"><a href="#contato" class="service-name">'+esc('Consultar '+label.toLocaleLowerCase('pt-BR'))+' <span aria-hidden="true">→</span></a></li>').join('')+'</ul></div></section>':'';
 const about=text(info.about);
 const profileStory=text(profile.story);
 const storyCopy=about||[summary,profileStory!==summary&&!finalSite?profileStory:'',address&&finalSite?'Endereço: '+address:'',hours.length&&finalSite?'Atendimento: '+hours.join(' · '):''].filter(Boolean).join('\n');
 const storyPhoto=exclusive?(layout==='catalog'?supporting[2]:supporting[0])||'':ownPhotos.find(src=>src!==image)||ownPhotos[0]||secondary||(origin==='business'?image:'');
 const story=sourcesOnly&&!about&&!premiumVisuals?'':storyMarkup(isMenu?'Nossa cozinha':'Sobre a empresa',
  (sourcesOnly&&premiumVisuals&&!about?[kind,city].filter(Boolean).join(' · ')+'. '+(hasContact?'Consulte os canais de contato para informações sobre produtos e atendimento.':'Informações comerciais a confirmar.'):storyCopy)||'Entre em contato para conhecer o atendimento de '+name+'.',
  storyPhoto,ownPhotos.includes(storyPhoto)||(origin==='business'&&storyPhoto===image));
 const galleryCandidates=[...new Map([...ownPhotos,...supporting,image].filter(Boolean).map(url=>[imageKey(url),url])).values()];
 const galleryPhotos=(exclusive?galleryCandidates.filter(url=>![image,storyPhoto,...(layout==='catalog'?[secondary,tertiary]:[])].some(used=>imageKey(used)===imageKey(url))):galleryCandidates).slice(0,9);
 const realGallery=new Set([...ownPhotos,...(origin==='business'?[image]:[])]);
 const photoNames=Array.isArray(info.galleryCaptions)?info.galleryCaptions:[];
 const portfolio=galleryPhotos.length?'<section id="galeria" class="brand-portfolio section" aria-labelledby="galeria-title"><div class="container">'+
  '<h2 id="galeria-title">Galeria de fotos</h2><p>'+esc(galleryPhotos.every(src=>realGallery.has(src))?'Fotografias da empresa.':realGallery.size?'Fotos da empresa e imagens ilustrativas do segmento.':origin==='generated'?'Imagem gerada por IA e referências do segmento.':'Imagens ilustrativas de '+kind.toLocaleLowerCase('pt-BR')+'.')+'</p>'+
  '<div class="portfolio-strip">'+galleryPhotos.map((src,i)=>{
   const caption=text(info.photoCaptions?.[src]||photoNames[i]);
   const real=realGallery.has(src);
   const label=caption||(real?'Foto de '+name:'Referência de '+kind)+' · '+(i+1);
   const photoNote=caption||(real?'':src===image&&origin==='generated'?'Imagem gerada por IA':'Imagem ilustrativa');
   return '<figure><a href="'+esc(src)+'"'+external+' aria-label="'+esc('Ampliar '+label)+'"><img src="'+esc(src)+'" alt="'+esc(label)+'" width="720" height="540" loading="lazy"></a>'+
    (photoNote?'<figcaption>'+esc(photoNote)+'</figcaption>':'')+'</figure>';
  }).join('')+'</div>'+(instagram?'<a class="gallery-social" href="'+esc(instagram)+'"'+external+'>Ver mais no Instagram</a>':'')+'</div></section>':'';
 const sections=direction==='experiencia'||(!direction&&['catalog','artisan'].includes(layout))
  ?story+serviceSection
  :serviceSection+story;

 const mapLink=map?'<a class="map-link" href="'+esc(map)+'"'+external+'>Abrir no Google Maps</a>':'';
 const locationHtml=address||city||map
  ?'<div class="contact-detail"><h3>Localização</h3>'+
   (address?'<address>'+fieldLines(address,5).map(esc).join('<br>')+'</address>':'')+
   (city&&(!address||!address.toLocaleLowerCase('pt-BR').includes(city.toLocaleLowerCase('pt-BR')))
    ?'<p>'+esc(city)+'</p>':'')+mapLink+'</div>'
  :'';
 const scheduleHtml=hours.length
  ?'<div class="contact-detail"><h3>Horários</h3><ul class="business-hours">'+
   hours.map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul></div>'
  :'';
 const channelLinks=[
  telephone?'<a data-contact="phone" href="tel:'+esc(telephone)+'">'+esc(info.phone)+'</a>':'',
  email?'<a data-contact="email" href="mailto:'+esc(email.replaceAll('+','%2B'))+'">'+esc(email)+'</a>':'',
  ...networks.map(item=>'<a data-contact="'+item.network+'" href="'+esc(item.url)+'"'+external+'>'+item.label+'</a>'),
  website?'<a data-contact="website" href="'+esc(website)+'"'+external+'>Site da empresa</a>':''
 ].filter(Boolean);
 const channelsHtml=channelLinks.length
  ?'<div class="contact-detail"><h3>Canais de contato</h3><ul class="contact-channels">'+
   channelLinks.map(link=>'<li>'+link+'</li>').join('')+'</ul></div>'
  :'';
 const contactHtml=hasContact
  ?'<section class="contact'+(sourcesOnly&&direction==='pratico'?' composition-contact-compact':'')+'" id="contato" aria-labelledby="contact-title"><div class="container">'+
   '<div class="contact-heading"><h2 id="contact-title">'+esc(
    whatsapp||channelLinks.length?profile.contact||'Fale com '+name:'Informações para sua visita'
   )+'</h2>'+
   (whatsapp?'<a class="cta-button" href="'+esc(whatsapp)+'"'+external+'>Abrir WhatsApp</a>':
    demo?'<a class="cta-button" href="https://wa.me/?text='+esc(encodeURIComponent('Olá! Vi o cardápio de demonstração da '+name+' e gostaria de consultar um pedido para retirada.'))+'"'+external+'>Testar mensagem no WhatsApp</a>':'')+'</div>'+
   (demo?'<p class="demo-contact">Esta hamburgueria é fictícia. Para experimentar a mensagem, escolha uma conversa sua no WhatsApp.</p>':'')+
   (locationHtml||scheduleHtml||channelsHtml?'<div class="contact-details">'+locationHtml+scheduleHtml+channelsHtml+'</div>':'')+
   '</div></section>'
  :'';

 const accent=palette(info.color||t.accent),bg=palette(t.bg),ink=palette(t.ink);
 const dark=readableInk(bg)==='#ffffff'?bg:'#202a32',buttonInk=readableInk(accent);
 const muted=readableInk(bg)==='#ffffff'?'#f0f3f6':'#4a5561';
 const line=readableInk(bg)==='#ffffff'?'#ffffff52':'#17253342';
 const art=Object.hasOwn(siteArt,profile.art)?profile.art:'practice';
 const artStyle=siteArt[art];
 const fontKey=direction==='pratico'?artStyle.practical:direction==='experiencia'?artStyle.experience:artStyle.signature;
 const font=siteFonts[fontKey];
 const families={editorial:'Georgia,serif',modern:'Arial,Helvetica,sans-serif',
  luxury:'Times New Roman,Georgia,serif',impact:'Impact,Arial Black,sans-serif'};
 const customFont=Object.hasOwn(families,info.headingFont)?families[info.headingFont]:'';
 const factor=Math.min(1.3,Math.max(.85,Number(info.headingSize)||1));
 const designOverrides=(customFont?'.hero h1,.section h2,.contact h2{font-family:'+customFont+'!important}':'')+
  (factor!==1?'.hero h1{font-size:clamp('+Math.round(38*factor)+'px,'+(7.5*factor).toFixed(2)+'vw,'+Math.round(110*factor)+'px)!important}'+
   '@media(max-width:520px){.hero h1{font-size:clamp('+Math.round(35*factor)+'px,'+(10*factor).toFixed(2)+'vw,'+Math.round(54*factor)+'px)!important}}':'')+
  (info.buttonStyle==='pill'?'.hero-button,.cta-button,.nav-cta{border-radius:100px!important}':'')+
  (info.buttonStyle==='square'?'.hero-button,.cta-button,.nav-cta{border-radius:0!important}':'')+
  (info.motionStyle==='none'?'html{scroll-behavior:auto}*,*::before,*::after{animation:none!important;transition:none!important}':'');
 const areas=[['inicio','Início'],...(serviceSection?[['servicos',hasServices?serviceNav:'Consultar']]:[]),...(story?[['sobre','Sobre']]:[]),
  ...(portfolio?[['galeria','Galeria']]:[]),...(faq.length?[['perguntas','Dúvidas']]:[]),...(hasContact?[['contato','Contato']]:[])];
 const siteNav=areas.map(([id,label])=>'<a href="#'+id+'"'+(id==='contato'?' class="nav-cta"':'')+'>'+label+'</a>').join('');
 const navigationCss=[
  '.site-header.container{width:100%;max-width:none;padding:8px max(4vw,calc((100vw - 1160px)/2));background:var(--surface);color:var(--ink);height:auto;min-height:72px;position:sticky;top:0;z-index:5}.site-header .brand{overflow-wrap:anywhere}.site-header nav{flex-wrap:wrap;justify-content:flex-end}.site-header nav a,.site-header nav a:not(:last-child){display:inline-flex;align-items:center;min-height:42px;font-size:14px;white-space:nowrap}.site-header nav a:focus-visible{outline:2px solid currentColor;outline-offset:3px}',
  'main,main>section[id]{scroll-margin-top:84px}main>section:target{min-height:0}@supports selector(main:has(>section:target)){main:has(>section:target)>section:not(:target){display:none}}',
  areas.map(([id])=>'body:has(#'+id+':target) .site-header nav a[href="#'+id+'"]').join(',')+'{text-decoration:underline;text-underline-offset:5px}',
  '.service-label{display:flex;flex-wrap:wrap;align-items:baseline;gap:7px 14px}.service-price{font-weight:750;white-space:nowrap}.brand-portfolio .portfolio-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,215px),1fr));gap:18px}.portfolio-strip figure{margin:0}.portfolio-strip img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover}.portfolio-strip figcaption{margin-top:8px;font-size:15px}.demo-contact{max-width:55ch;line-height:1.5}',
  '@media(max-width:760px){.site-header.container{display:block;padding:8px 16px 4px}.site-header .brand{min-height:32px;display:flex;align-items:center}.site-header nav{justify-content:flex-start;gap:0 14px}.site-header nav a,.site-header nav a:not(:last-child){display:inline-flex;min-height:40px;font-size:14px}.site-header .nav-cta{background:transparent;color:inherit;padding:0;min-height:40px}.brand-logo{max-height:34px;width:auto}main,main>section[id]{scroll-margin-top:152px}}',
  '@media print{main:has(>section:target)>section:not(:target){display:block}.site-header.container{position:static}.site-header nav{display:none}}'
 ].join('');
 const pageStyle=(graphicHero?'':font.rule)+css+
  ':root{--accent:'+accent+';--surface:'+bg+';--ink:'+ink+';--dark:'+dark+
  ';--buttonInk:'+buttonInk+';--muted:'+muted+';--line:'+line+';--display:'+(graphicHero?'system-ui,sans-serif':font.family)+
  ';--material:'+(t.brandColor?accent:artStyle.material)+';--material-ink:'+(t.brandColor?buttonInk:artStyle.ink)+'}'+compositionCss+premiumCss+navigationCss+motionCss +qualityCss+motionEnhancements+distinctCss+motionCraftCss+'.hero.no-stock-photo{display:block!important;height:auto!important;min-height:0!important;background:var(--surface);color:var(--ink);padding:0}.hero.no-stock-photo::after{display:none}.hero.no-stock-photo .hero-text{position:relative!important;inset:auto!important;padding:clamp(28px,7vw,90px);max-width:100%;text-align:left}'+
  ((sourcesOnly&&!premiumVisuals)||solarGraphic?window.ProspectComposition.styles:'')+
  (solarGraphic?window.ProspectPremiumArt.css:'')+(premiumVisuals?premiumVisualCss:'')+designOverrides;

 const title=name;
 const brandLogo=brandImage(logo);
 const iconHref=brandLogo||'data:image/svg+xml,'+encodeURIComponent(brandIconSvg(name,kind));
 const favicon='<link rel="icon"'+(brandLogo?'':' type="image/svg+xml"')+' href="'+esc(iconHref)+'">'+(brandLogo?'<link rel="apple-touch-icon" href="'+esc(brandLogo)+'">':'');
 const socialImage=(origin==='business'?brandImage(image):'')||brandLogo||brandImage(image);
 const meta=(summary||[kind,city].filter(Boolean).join(' em ')||name).slice(0,155);
 const social = finalSite ? '<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR">'+
  '<meta property="og:site_name" content="'+esc(name)+'"><meta property="og:title" content="'+esc(title)+'">'+
  '<meta property="og:description" content="'+esc(meta)+'">'+
  (socialImage?'<meta property="og:image" content="'+esc(socialImage)+'"><meta property="og:image:alt" content="'+esc(socialImage===brandLogo?'Logo de '+name:origin==='business'?'Foto de '+name:'Imagem ilustrativa do segmento')+'"><meta name="twitter:card" content="summary_large_image">':'') : '';
 const schema={'@context':'https://schema.org','@type':'LocalBusiness',name,description:meta,
  ...(address||city?{address:{'@type':'PostalAddress',...(address?{streetAddress:address}:{}),...(city?{addressLocality:city}:{}),addressCountry:'BR'}}:{}),
  ...(telephone?{telephone}:{}),...(email?{email}:{}),...(map?{hasMap:map}:{}),...(networks.length?{sameAs:networks.map(item=>item.url)}:{})};
 // User input in structured data must remain inert inside the script element.
 const schemaSafe=JSON.stringify(schema).replace(/</g,'\\u003c');
 const variant=['0','1','2'].includes(info.variant)?info.variant:'0';
 const spacing=['compact','spacious'].includes(info.spacing)?' spacing-'+info.spacing:'';

 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta name="theme-color" content="'+bg+'"><meta name="description" content="'+esc(meta)+'">'+
  (sourcesOnly&&!finalSite?'<meta name="robots" content="noindex,nofollow,noarchive">':'')+
  '<title>'+esc(title)+'</title>'+favicon+social+
  '<script type="application/ld+json">'+schemaSafe+'</script><style>'+pageStyle+'</style></head>'+
  '<body class="variant-'+variant+((direction||graphicHero)?' direction-'+(direction||graphicHero):'')+spacing+' art-'+art+((sourcesOnly&&!premiumVisuals)||solarGraphic?' composition composition-'+art:'')+(premiumVisuals?' premium-visual':'')+' motion-'+(['strong','none'].includes(info.motionStyle)?info.motionStyle:'soft')+'" data-direction="'+direction+'">'+
  '<a class="skip-link" href="#inicio">Ir para o conteúdo</a>'+
  '<header class="site-header container"><a class="brand" href="#inicio">'+
  (logo?'<img class="brand-logo" src="'+esc(logo)+'" width="140" height="52" alt="'+esc(name)+'">':esc(name))+'</a><nav aria-label="Navegação principal">'+siteNav+'</nav></header>'+
  '<main id="inicio">'+hero+(sourcesOnly&&direction==='pratico'?contactHtml+sections:sections)+portfolio+(faq.length?faqMarkup(faq):'')+(sourcesOnly&&direction==='pratico'?'':contactHtml)+'</main>'+
  '<footer class="footer container"><span>'+(sourcesOnly?esc(name):'© '+new Date().getFullYear()+' '+esc(name)+' — Todos os direitos reservados.')+'</span>'+
  (sourcesOnly&&!finalSite?'<span class="site-footer-label">Prévia de design</span>':'')+
  (Array.isArray(info.brandSources)&&info.brandSources.includes('https://docs.overturemaps.org/guides/places/')?'<a href="https://docs.overturemaps.org/attribution/"'+external+'>Dados de locais · Overture Maps</a>':'')+
  '</footer></body></html>';
}
window.PortalSiteStudio={
 start,buildSite,getDefault,pendingLead,templates,renderProjects,showInFrame,fullPreview,save:saveSelected,
 otherCovers:(name,city)=>new Set(projects.filter(p=>slug(p.name)!==slug(name)||slug(p.city)!==slug(city)).map(p=>p.photo)),
 getCurrent:()=>{if(!selected||!template)return null;readFields();return {data:{...selected},template:{...template}};},
 updatePublished:(id, original, share)=>{
  if (!selected) return;
  selected.publishedId=id;
  selected.publicSlug=original;
  selected.publicShareSlug=share;
 }
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
