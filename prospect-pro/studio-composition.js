(function(){
'use strict';

// The Studio keeps these editorial treatments internal. The original catalog remains available.
const editorial = {
 salao: ['editorial','immersive','directory'],
 barbearia: ['technical','artisan','directory'],
 restaurante: ['artisan','immersive','directory'],
 hamburgueria: ['immersive','kinetic','directory'],
 solar: ['technical','immersive','directory'],
 pizzaria: ['artisan','catalog','directory'],
 petshop: ['kinetic','catalog','directory'],
 clinica: ['serene','corporate','directory'],
 oficina: ['technical','corporate','directory'],
 moda: ['editorial','catalog','directory'],
 academia: ['kinetic','technical','directory']
};
const salonDirections = [
 {title:'Editorial',description:'Uma abertura tipográfica com gravura abstrata e navegação discreta.'},
 {title:'Espelho',description:'Uma composição escura com luz em movimento e leitura centralizada.'},
 {title:'Localização',description:'Uma página que coloca o acesso ao mapa e as informações de visita em destaque.'}
];

function blend(color, other, weight) {
 const channels = [1,3,5].map(index => {
  const from = Number.parseInt(color.slice(index,index+2),16);
  const to = Number.parseInt(other.slice(index,index+2),16);
  return Math.round(from+(to-from)*weight).toString(16).padStart(2,'0');
 });
 return '#'+channels.join('');
}

function colors(base,index,brandColor) {
 const accent=brandColor||base.accent;
 if(base.id==='salao'){
  return [
   {bg:'#f8efe5',ink:'#3e202c',accent:brandColor||'#642940'},
   {bg:'#21121e',ink:'#fff2e8',accent:brandColor||'#ed9d89'},
   {bg:'#f3ebee',ink:'#392334',accent:brandColor||'#69233f'}
  ][index];
 }
 if(index===1)return {bg:blend(accent,'#14151e',.83),ink:'#fff8ef',accent:brandColor||blend(accent,'#fef1e7',.51)};
 if(index===2)return {bg:blend(accent,'#ffffff',.92),ink:'#1b202a',accent:brandColor||blend(accent,'#222436',.55)};
 return {bg:base.bg,ink:base.ink,accent};
}

function authorizedGroups(photos) {
 const clean=[...new Set(photos)];
 return [0,1,2].map(index=>{
  const own=clean.filter((_,photoIndex)=>photoIndex%3===index);
  return {cover:own[0]||'',photos:own,stock:[],real:own};
 });
}

function graphic(direction, segment) {
 if(segment==='solar'&&window.ProspectPremiumArt)return '<div class="composition-graphic composition-graphic-'+direction+' composition-solar" aria-hidden="true">'+window.ProspectPremiumArt.model+'</div>';
 if(segment==='hamburgueria'&&direction==='experiencia')return '<div class="composition-graphic composition-burger" aria-hidden="true"><span><i></i><i></i><i></i><i></i><i></i></span></div>';
 // Decorative geometry is original CSS. Use the business name as a text wordmark.
 const shapes = '<i></i><i></i><i></i>';
 return '<div class="composition-graphic composition-graphic-'+direction+'" aria-hidden="true">'+shapes+'</div>';
}

const styles=`
.composition main, .composition main>section[id]{scroll-margin-top:90px}
.composition main:has(>section:target)>section:not(:target){display:block}
.composition .site-header.container{position:relative;min-height:74px;padding-inline:max(4.5vw,calc((100vw - 1230px)/2))}
.composition .site-header nav a{font-weight:600}
.composition .site-header .nav-cta{border-radius:0!important;background:transparent;color:inherit;text-decoration:underline;text-underline-offset:.28em;padding-inline:6px}
.composition .hero-button,.composition .map-link{min-height:48px}
.composition a:focus-visible{outline:2px solid currentColor;outline-offset:5px}
.composition .footer{justify-content:space-between}
.composition .site-footer-label{font-size:14px}
.composition .contact .map-link{display:inline-flex;align-items:center}
.composition .contact-detail p,.composition .contact-detail address{opacity:1}
.composition .section:target,.composition .contact:target{animation:none}
.composition-hero{--art-color:var(--accent);width:min(1310px,100% - 9vw);margin:0 auto;min-height:clamp(470px,61vw,720px);display:grid;align-items:center;isolation:isolate;position:relative;overflow:hidden}
.composition-hero .hero-text{position:relative;inset:auto;z-index:2;min-width:0}
.composition .composition-hero h1{font-style:normal;text-transform:none;font-family:var(--composition-display);font-size:clamp(64px,10.2vw,154px);line-height:.89;letter-spacing:-.07em;margin:.2em 0 .26em;max-width:10ch;text-wrap:balance;color:inherit}
.composition-hero .eyebrow{font-size:14px;letter-spacing:.045em;font-weight:630;max-width:34ch}
.composition-hero .hero-summary{color:inherit;opacity:1;font-size:17px}
.composition-graphic{position:relative;isolation:isolate;min-height:0;overflow:hidden}
.composition-graphic i{position:absolute;display:block;pointer-events:none}
.composition .composition-hero .hero-button{transition:background-color .22s ease,color .22s ease,transform .22s ease}
.composition .composition-hero .hero-button:hover{transform:translateY(-2px)}
.composition-hero .hero-button::after{display:none}

.direction-assinatura .composition-hero{--composition-display:Georgia,'Times New Roman',serif;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:clamp(24px,5.7vw,95px);padding:clamp(28px,4vw,64px) 0}
.direction-assinatura .composition-hero h1{font-weight:400}
.direction-assinatura .composition-hero .hero-button{border-radius:0}
.composition-graphic-assinatura{height:100%;min-height:350px;background:color-mix(in srgb,var(--art-color) 31%,#eac8b9);border-radius:44% 44% 0 0}
.composition-graphic-assinatura i:first-child{inset:-36% -44% -25%;transform:rotate(-18deg);background:repeating-radial-gradient(ellipse at 20% 42%,transparent 0 9px,color-mix(in srgb,var(--art-color) 73%,#40212b) 10px,transparent 12px 19px)}
.composition-graphic-assinatura i:nth-child(2){top:15%;left:33%;width:35%;aspect-ratio:1;border-radius:50%;background:color-mix(in srgb,var(--art-color) 13%,#fde4cb);box-shadow:0 0 55px #ffe3bb8a;mix-blend-mode:screen}
.composition-graphic-assinatura i:last-child{inset:12px;border:1px solid color-mix(in srgb,var(--art-color) 45%,transparent);border-radius:inherit}

.direction-experiencia .composition-hero{--composition-display:'Trebuchet MS',system-ui,sans-serif;width:100%;min-height:clamp(530px,79svh,760px);place-items:center;text-align:center;color:var(--ink);padding:60px 5vw}
.direction-experiencia .composition-hero .hero-text{grid-area:1/1;max-width:min(850px,100%)}
.direction-experiencia .composition-hero .hero-text>*{margin-inline:auto}
.direction-experiencia .composition-hero h1{font-weight:580;letter-spacing:-.075em;line-height:.94;text-shadow:0 6px 40px #180b18}
.direction-experiencia .composition-hero .hero-actions{justify-content:center}
.direction-experiencia .composition-hero .hero-button{background:var(--ink);color:var(--surface);border-radius:99px}
.composition-graphic-experiencia{position:absolute;inset:0;z-index:0;background:radial-gradient(ellipse at 50% 90%,color-mix(in srgb,var(--accent) 31%,#21121e) 0%,var(--surface) 69%)}
.composition-graphic-experiencia i{width:min(77vw,720px);height:111%;border:1px solid color-mix(in srgb,var(--accent) 56%,transparent);border-radius:48% 48% 0 0;left:50%;top:14%;transform:translateX(-50%);background:linear-gradient(165deg,color-mix(in srgb,var(--accent) 15%,transparent),transparent 32%);box-shadow:inset 0 0 40px color-mix(in srgb,var(--accent) 15%,transparent)}
.composition-graphic-experiencia i:nth-child(2){width:min(66vw,590px);top:22%}
.composition-graphic-experiencia i:nth-child(3){width:min(53vw,460px);top:30%}

.direction-pratico .composition-hero{--composition-display:system-ui,sans-serif;align-items:stretch;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);grid-template-rows:auto auto;gap:24px;padding:clamp(30px,5.8vw,90px) 0;min-height:0}
.direction-pratico .composition-hero h1{font-size:clamp(56px,8vw,122px);font-weight:790;line-height:.91;letter-spacing:-.08em}
.direction-pratico .composition-hero .hero-summary{max-width:46ch}
.direction-pratico .composition-hero .hero-actions{margin-top:32px}
.direction-pratico .composition-hero .hero-button{border-radius:4px}
.composition-graphic-pratico{min-height:380px;background:color-mix(in srgb,var(--art-color) 15%,#fbf3ec);grid-column:2;grid-row:1 / 3;border:1px solid color-mix(in srgb,var(--art-color) 30%,transparent)}
.composition-graphic-pratico i:first-child{inset:-15%;transform:rotate(-22deg);background:repeating-linear-gradient(90deg,transparent 0 52px,#ffffff8a 52px 54px),repeating-linear-gradient(0deg,transparent 0 50px,#ffffff9a 51px 54px);background-color:color-mix(in srgb,var(--art-color) 9%,#fff3e9)}
.composition-graphic-pratico i:nth-child(2){inset:-20%;transform:rotate(21deg);background:linear-gradient(0deg,transparent 0 48%,color-mix(in srgb,var(--art-color) 30%,transparent) 48% 50%,#fff5ec 50% 52%,color-mix(in srgb,var(--art-color) 25%,transparent) 52% 55%,transparent 55%);border-radius:50%}
.composition-graphic-pratico i:last-child{width:32%;aspect-ratio:1;top:50%;left:50%;transform:translate(-50%,-50%);border:1px solid color-mix(in srgb,var(--art-color) 82%,#27121e);border-radius:50%;background:radial-gradient(circle,var(--art-color) 0 9%,transparent 10% 24%,color-mix(in srgb,var(--art-color) 25%,transparent) 25% 27%,transparent 28%),color-mix(in srgb,var(--art-color) 10%,#fff3e9);box-shadow:0 0 0 14px color-mix(in srgb,var(--art-color) 13%,transparent)}
.composition .composition-contact-compact{background:var(--surface);color:var(--ink);border-top:1px solid var(--line)}
.composition .composition-contact-compact .contact-details{border-color:var(--line)}
.composition .composition-contact-compact .contact-detail :is(p,address){color:inherit}
.composition .composition-contact-compact .contact-heading h2{max-width:none;font-size:clamp(29px,4vw,50px)}
.composition .composition-contact-compact .contact-details{margin-top:22px;padding-top:20px}

@keyframes composition-engraving{from{transform:rotate(-23deg) scale(1.08)}to{transform:rotate(-18deg) scale(1)}}
@keyframes composition-mirror{from{opacity:.24;transform:translate(-50%,28px) scale(.93)}to{opacity:1;transform:translate(-50%,0) scale(1)}}
@keyframes composition-focus{from{opacity:.15;transform:translate(-50%,-50%) scale(.7)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@media(prefers-reduced-motion:no-preference){
 body.composition:not(.motion-none) .composition-graphic-assinatura i:first-child{animation:composition-engraving var(--entry-time) var(--curve) both}
 body.composition:not(.motion-none) .composition-graphic-experiencia i{animation:composition-mirror calc(var(--entry-time) + 230ms) var(--curve) both}
 body.composition:not(.motion-none) .composition-graphic-experiencia i:nth-child(2){animation-delay:.07s}
 body.composition:not(.motion-none) .composition-graphic-experiencia i:last-child{animation-delay:.14s}
 body.composition:not(.motion-none) .composition-graphic-pratico i:last-child{animation:composition-focus var(--entry-time) var(--curve) both}
 @supports(animation-timeline:view()){
  body.composition:not(.motion-none) .composition-graphic-assinatura i:nth-child(2){animation:composition-glide linear both;animation-timeline:view();animation-range:exit 0% exit 90%}
 }
}
@keyframes composition-glide{from{transform:translateY(0)}to{transform:translateY(65%)}}

.composition-graphic.composition-solar{display:grid;place-items:center;min-height:clamp(210px,34vw,480px);border:1px solid #698e8b35;border-radius:4px;background:radial-gradient(ellipse at 50% 36%,#f5fff6,#bbd9d4)}
.composition-solar svg{display:block;width:100%;height:auto;max-height:470px}
.direction-experiencia .composition-hero:has(.composition-solar){width:min(1310px,100% - 9vw);grid-template-columns:minmax(0,1fr) minmax(0,1fr);text-align:left;gap:clamp(22px,4vw,55px);min-height:0;padding:clamp(30px,6vw,80px) 0}
.direction-experiencia .composition-hero:has(.composition-solar) .hero-text{grid-area:auto;max-width:100%}
.direction-experiencia .composition-hero:has(.composition-solar) .hero-text>*{margin-inline:0}
.direction-experiencia .composition-hero:has(.composition-solar) h1{text-shadow:none}
.direction-experiencia .composition-solar{position:relative;inset:auto;width:100%}
.direction-experiencia .composition-hero:has(.composition-burger){grid-template-columns:minmax(0,1fr) minmax(0,1fr);text-align:left;gap:25px;min-height:0;padding:clamp(28px,6vw,88px) 5vw;background:#241711}
.direction-experiencia .composition-hero:has(.composition-burger) .hero-text{grid-area:auto;width:min(100%,620px)}
.direction-experiencia .composition-hero:has(.composition-burger) .hero-text>*{margin-inline:0}
.direction-experiencia .composition-hero:has(.composition-burger) .hero-actions{justify-content:flex-start}
.direction-experiencia .composition-hero:has(.composition-burger) h1{font-weight:870;text-transform:uppercase;font-size:clamp(58px,8vw,142px);text-shadow:none}
.composition-burger{display:grid;place-items:center;width:100%;min-height:clamp(230px,38vw,490px);background:radial-gradient(closest-side,#d16a2a 69%,#a5481c 70% 72%,transparent 73%);isolation:isolate}
.composition-burger span{display:grid;gap:clamp(3px,1.2vw,13px);width:65%;transform:rotate(-12deg);filter:drop-shadow(14px 22px 14px #39180565)}
.composition-burger i{position:static;width:100%;margin:auto;border-radius:50px;background:#4b2117;height:clamp(13px,3vw,38px)}
.composition-burger i:first-child{border-radius:65% 65% 18% 18% / 100% 100% 22% 22%;height:clamp(39px,9vw,118px);background:radial-gradient(ellipse at 33% 42%,#fff0b9 0 2%,transparent 2.5%),radial-gradient(ellipse at 58% 24%,#fff0b9 0 2%,transparent 2.5%),radial-gradient(ellipse at 73% 51%,#fff0b9 0 2%,transparent 2.5%),linear-gradient(#ffcd71,#dc7d2a)}
.composition-burger i:nth-child(2){background:#5f7a38;height:clamp(8px,1.3vw,21px);width:104%;border-radius:40%}
.composition-burger i:nth-child(3){background:#f5ba43;clip-path:polygon(0 0,100% 0,100% 36%,62% 36%,42% 100%,34% 36%,0 36%);margin-bottom:-4%}
.composition-burger i:last-child{border-radius:20% 20% 60% 60%;background:linear-gradient(#eda63d,#aa4f1f);height:clamp(19px,4vw,48px)}
.composition .faq-items summary:focus-visible{outline:2px solid currentColor;outline-offset:5px}
.composition .faq-items details[open] summary{text-decoration:underline;text-underline-offset:.25em}

@media(prefers-reduced-motion:no-preference){
 body:not(.motion-none) .composition-solar svg{animation:prospect-solar-rise var(--entry-time) 90ms linear both}
 body:not(.motion-none) .composition-burger span{animation:composition-burger-arrival var(--entry-time) 120ms var(--curve) both}
 @supports(animation-timeline:view()){
  body.composition:not(.motion-none) main:not(:has(>section:target)) .services .service-card{animation:composition-service-arrival linear both;animation-timeline:view();animation-range:entry 0% entry 70%}
 }
}
@keyframes composition-service-arrival{from{transform:translateY(12px)}to{transform:translateY(0)}}
@keyframes composition-burger-arrival{from{opacity:.65;transform:translateY(24px) rotate(-16deg) scale(.96)}to{opacity:1;transform:rotate(-12deg) scale(1)}}

@media(max-width:760px){
 .composition .site-header.container{display:flex;align-items:center;gap:10px;padding:8px 5vw;min-height:60px}
 .composition .site-header .brand{font-size:16px}
 .composition .site-header nav{flex:0 1 auto;justify-content:flex-end;column-gap:12px}
 .composition .site-header nav a,.composition .site-header nav a:not(:last-child){font-size:14px;white-space:normal}
 .composition .site-header nav a[href="#inicio"]{display:none}
 .composition .composition-hero{scroll-margin-top:15px}
 .composition .composition-hero .hero-text{padding:0}
 .composition .composition-hero h1{font-size:clamp(50px,13vw,92px)!important;line-height:.92;letter-spacing:-.066em}
 .direction-assinatura .composition-hero{grid-template-columns:minmax(0,1fr);min-height:0;gap:24px;padding:38px 0 24px}
 .composition-graphic-assinatura{min-height:clamp(190px,56vw,360px);border-radius:44% 44% 0 0}
 .direction-experiencia .composition-hero{min-height:clamp(420px,71svh,620px);padding:36px 5vw}
 .composition-graphic-experiencia i{width:102vw}
 .composition-graphic-experiencia i:nth-child(2){width:86vw}
 .composition-graphic-experiencia i:nth-child(3){width:70vw}
 .direction-pratico .composition-hero{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto;padding:36px 0 20px}
 .composition-graphic-pratico{grid-column:1;grid-row:2;min-height:clamp(150px,43vw,310px)}
 .composition-graphic-pratico i:last-child{width:24%}
 .composition .contact,.composition .contact.composition-contact-compact{padding:38px 0}
 .composition .footer{width:90%}
 .direction-experiencia .composition-hero:has(.composition-solar){grid-template-columns:minmax(0,1fr)}
 .direction-experiencia .composition-hero:has(.composition-burger){grid-template-columns:minmax(0,1fr);gap:12px}
}
`;

window.ProspectComposition = {
 authorizedGroups, blend, colors, graphic, styles,
 layout:(segment,index,fallback)=>editorial[segment]?.[index]||fallback,
 direction:(direction,segment,index)=>segment==='salao'?{...direction,...salonDirections[index]}:direction
};
})();
