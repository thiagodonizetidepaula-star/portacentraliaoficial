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
const notify=message=>{const e=$('toast');e.textContent=message;e.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>e.hidden=true,3200)};
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
function switchView(view){
 ['gallery','projects'].forEach(k=>{$(k+'View').hidden=k!==view;$('tab'+(k==='gallery'?'Gallery':'Projects')).classList.toggle('selected',k===view);$('tab'+(k==='gallery'?'Gallery':'Projects')).setAttribute('aria-selected',String(k===view))});
 if(view==='projects')renderProjects();
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('filter').addEventListener('input',renderCatalog);
$('category').addEventListener('change',renderCatalog);
function getDefault(t){
 return {id:null,templateId:t.id,name:pendingLead?.name||t.example,industry:t.label,city:(pendingLead?.address||'Mauá, SP').slice(0,90),phone:pendingLead?.phone||'',headline:t.headline,summary:t.summary,services:t.services.join('\n'),photo:t.photo,color:t.accent,variant:'0'};
}
function start(id,project){
 template=templates.find(t=>t.id===id)||templates[0];if(!template)return notify('Nenhum modelo disponível');
 selected=project?{...project}:getDefault(template);
 $('modelName').textContent=template.label+' / '+template.layout;
 const pairs={companyName:'name',industryName:'industry',cityName:'city',phoneNumber:'phone',headline:'headline',summary:'summary',services:'services',photoUrl:'photo',brandColor:'color',layoutVariant:'variant'};
 Object.entries(pairs).forEach(([field,key])=>{$(field).value=selected[key]??''});
 $('editorOverlay').hidden=false;document.body.style.overflow='hidden';setDevice(device);paint();
}
function close(){ $('editorOverlay').hidden=true;document.body.style.overflow='';selected=null;}
$('closeEditor').onclick=close;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('editorOverlay').hidden)close()});
function setDevice(d){device=d;document.querySelectorAll('[data-device]').forEach(b=>b.classList.toggle('active',b.dataset.device===d));$('websitePreview').parentElement.classList.toggle('mobile',d==='mobile');$('previewLabel').textContent=d==='mobile'?'375 px · celular':'Desktop · site completo'}
document.querySelectorAll('[data-device]').forEach(b=>b.onclick=()=>setDevice(b.dataset.device));
function readFields(){
 const pairs={companyName:'name',industryName:'industry',cityName:'city',phoneNumber:'phone',headline:'headline',summary:'summary',services:'services',photoUrl:'photo',brandColor:'color',layoutVariant:'variant'};
 Object.entries(pairs).forEach(([field,key])=>selected[key]=$(field).value);
}
let renderTimer;
document.querySelectorAll('.form-grid input,.form-grid textarea,.form-grid select').forEach(el=>el.addEventListener('input',()=>{if(!selected)return;readFields();clearTimeout(renderTimer);renderTimer=setTimeout(paint,260)}));
function paint(){if(!selected)return;$('websitePreview').srcdoc=buildSite(selected,template)}
$('resetModel').onclick=()=>{if(!template)return;const n=getDefault(template);selected={...n,id:selected?.id||null};const pairs={companyName:'name',industryName:'industry',cityName:'city',phoneNumber:'phone',headline:'headline',summary:'summary',services:'services',photoUrl:'photo',brandColor:'color',layoutVariant:'variant'};Object.entries(pairs).forEach(([id,key])=>$(id).value=selected[key]);paint();notify('Modelo original restaurado')};
function persist(){localStorage.setItem('prospect_library_projects',JSON.stringify(projects));$('savedCount').textContent=projects.length}
$('saveProject').onclick=()=>{if(!selected)return;readFields();selected.id=selected.id||('p'+Date.now()+Math.random().toString(36).slice(2,6));selected.updatedAt=new Date().toISOString();const i=projects.findIndex(p=>p.id===selected.id);if(i===-1)projects.unshift({...selected});else projects[i]={...selected};persist();notify('Projeto salvo neste navegador')};
function renderProjects(){
 $('projectsList').innerHTML=projects.length?projects.map(p=>'<div class="project-row"><strong>'+esc(p.name)+'</strong><span>'+esc(p.industry)+' · '+esc(p.city)+'<br>Atualizado: '+esc(new Date(p.updatedAt||Date.now()).toLocaleDateString('pt-BR'))+'</span><div class="project-actions"><button data-load="'+esc(p.id)+'">Continuar editando</button><button data-remove="'+esc(p.id)+'">Excluir</button></div></div>').join(''):'<p>Você ainda não salvou nenhum site. Abra um modelo e clique em “Salvar projeto”.</p>';
 document.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{const p=projects.find(x=>x.id===b.dataset.load);if(p)start(p.templateId,p)});
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(!confirm('Excluir este rascunho local?'))return;projects=projects.filter(p=>p.id!==b.dataset.remove);persist();renderProjects()});
}
$('downloadSite').onclick=()=>{if(!selected)return;readFields();const html=buildSite(selected,template);const blob=new Blob([html],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=slug(selected.name)+'-site.html';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);notify('Site HTML gerado. Revise fotos, dados e contato antes de publicar.')};
$('copyHtml').onclick=async()=>{if(!selected)return;readFields();try{await navigator.clipboard.writeText(buildSite(selected,template));notify('Código HTML copiado')}catch{notify('Não foi possível copiar. Use Baixar site HTML.')}};
$('customStart').onclick=()=>{start('consultoria');$('industryName').value='Meu segmento';$('headline').value='Uma experiência feita para você.';readFields();paint()};
$('help').onclick=()=>alert('1. Abra um segmento. 2. Personalize nome, serviços, foto, cidade e contato. 3. Alterne entre computador e celular. 4. Salve o projeto ou baixe o HTML completo.\n\nGeração sem créditos de IA. As fotos são demonstrativas, os projetos ficam neste navegador e a publicação na internet será integrada na próxima etapa.');
function servicesMarkup(list){
 return '<section class="services section" id="servicos"><div class="container"><div class="section-overline">O QUE FAZEMOS</div><div class="section-heading"><h2>Serviços feitos para o que você precisa.</h2><p>Conheça algumas formas de atendimento e encontre o próximo passo para seu projeto.</p></div><div class="service-list">'+list.map((s,i)=>'<article class="service-card"><span class="service-number">0'+(i+1)+'</span><h3>'+esc(s)+'</h3><p>Conheça as possibilidades e solicite informações para o seu caso.</p><span aria-hidden="true">↗</span></article>').join('')+'</div></div></section>';
}
function storyMarkup(t,info,sec){
 return '<section class="story section" id="sobre"><div class="container story-grid"><div class="story-image"><img loading="lazy" decoding="async" width="850" height="650" src="'+esc(sec)+'" alt="Imagem demonstrativa de '+esc(info.industry)+'"></div><div class="story-copy"><span class="section-overline">SOBRE NOSSO TRABALHO</span><h2>Uma experiência que combina com a sua história.</h2><p>'+esc(info.summary)+'</p><p>Entre em contato para conhecer os serviços, conversar sobre suas necessidades e saber como podemos atender você.</p><a href="#contato" class="textlink">Vamos conversar <span aria-hidden="true">↗</span></a></div></div></section>';
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
'@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}'
].join('');
function buildSite(info,t){
 const n=esc(text(info.name)||t.example),kind=esc(text(info.industry)||t.label),city=esc(text(info.city)||'Sua região'),head=esc(text(info.headline)||t.headline),summary=esc(text(info.summary)||t.summary);
 const services=String(info.services||'').split(/\n/).map(text).filter(Boolean).slice(0,8);
 const list=services.length?services:t.services,contact=phone(info.phone);
 const href=contact?'https://wa.me/'+contact+'?text='+encodeURIComponent('Olá! Conheci o site da '+(text(info.name)||t.example)+' e gostaria de saber mais sobre os serviços.'):'#contato';
 const button=contact?'Falar pelo WhatsApp':'Conheça nossos serviços';
 const bHref=contact?href:'#servicos';
 const image=photo(info.photo)||photo(t.photo);
 const related=templates.filter(x=>x.category===t.category&&x.id!==t.id);
 const second=photo(related[0]?.photo)||image,third=photo(related[1]?.photo)||second;
 const photoEl=src=>'<div class="hero-image"><img src="'+esc(src)+'" width="1200" height="900" decoding="async" fetchpriority="high" alt="Imagem ilustrativa de '+kind+'"></div>';
 const heroBody='<div class="hero-text"><div class="eyebrow">'+kind+' · '+city+'</div><h1>'+head+'</h1><p>'+summary+'</p><a class="hero-button" href="'+esc(bHref)+'" '+(contact?'target="_blank" rel="noopener noreferrer"':'')+'>'+button+' <span aria-hidden="true">↗</span></a></div>';
 const layout=t.layout;
 let hero='';
 if(layout==='catalog'){
   hero='<section class="hero catalog-hero">'+heroBody+'<div class="catalog-gallery"><img src="'+esc(image)+'" alt="" width="600" height="800"><img src="'+esc(second)+'" alt="" width="500" height="500"><img src="'+esc(third)+'" alt="" width="500" height="500"></div></section>';
 }else{
   const type=layout==='editorial'?'editorial':layout==='technical'?'technical':layout==='immersive'?'immersive':layout==='serene'?'serene':layout==='artisan'?'artisan':layout==='kinetic'?'kinetic':'corporate';
   hero='<section class="hero '+type+'">'+heroBody+photoEl(image)+'</section>';
 }
 const ctitle='Vamos conversar sobre o que você precisa?';
 const action=contact?'<a class="cta-button" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">Enviar mensagem <span aria-hidden="true">↗</span></a>':'<p class="smallnote">Contato em configuração. Adicione o WhatsApp no editor para habilitar este botão.</p>';
 const contactHtml='<section class="contact" id="contato"><div class="container contact-grid"><div><span class="section-overline">FALE COM A GENTE</span><h2>'+ctitle+'</h2><p>Conheça melhor nossos serviços e tire suas dúvidas. Atendimento em '+city+'.</p></div><div class="contact-actions">'+action+'</div></div></section>';
 const servicesHtml=servicesMarkup(list),storyHtml=storyMarkup(t,info,second);
 const sections=(layout==='catalog'||layout==='artisan')?storyHtml+servicesHtml:servicesHtml+storyHtml;
 const accent=palette(info.color),bg=palette(t.bg),ink=palette(t.ink);
 const dark=ink.toLowerCase()==='#ffffff'?bg:'#202a32',buttonInk=('#'+accent.slice(1).toLowerCase())==='#d0f95b'?'#14201a':ink.toLowerCase()==='#ffffff'?'#101721':'#fff';
 const muted=ink.toLowerCase()==='#ffffff'?'#c2cbd8':'#667583';const pageStyle=':root{--accent:'+accent+';--surface:'+bg+';--ink:'+ink+';--dark:'+dark+';--buttonInk:'+buttonInk+';--muted:'+muted+';}'+css;
 const title=(text(info.name)||t.example)+' | '+(text(info.industry)||t.label)+' em '+(text(info.city)||'sua região');
 const meta=String(info.summary||t.summary).slice(0,155);
 const schema={'@context':'https://schema.org','@type':'LocalBusiness',name:text(info.name)||t.example,description:meta,areaServed:text(info.city)||'Brasil',...(contact?{telephone:'+'+contact}:{})};
 // Embed the structured data as inert JSON, escaping characters that could close a script block.
 const schemaSafe=JSON.stringify(schema).replace(/</g,'\\u003c');
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="'+bg+'"><meta name="description" content="'+esc(meta)+'"><meta name="robots" content="noindex,nofollow"><title>'+esc(title)+'</title><script type="application/ld+json">'+schemaSafe+'</script><style>'+pageStyle+'</style></head>'+
 '<body class="variant-'+(info.variant==='1'?'1':info.variant==='2'?'2':'0')+'">'+
 '<header class="site-header container"><a class="brand" href="#inicio">'+n+'<span class="brand-dot"></span></a><nav aria-label="Navegação principal"><a href="#servicos">Serviços</a><a href="#sobre">Sobre</a><a class="nav-cta" href="#contato">Contato ↗</a></nav></header>'+
 '<main id="inicio">'+hero+sections+contactHtml+'</main><footer class="footer container"><span>© '+new Date().getFullYear()+' '+n+'</span><span>'+kind+' · '+city+'</span></footer></body></html>';
}
persist();renderCatalog();switchView('gallery');
if(pendingLead){notify('Empresa selecionada: '+pendingLead.name+'. Escolha um modelo para criar o site.')}
})();
