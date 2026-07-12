(function(){
'use strict';
const $=id=>document.getElementById(id);
const typeInput=$('qr_tipo');
const canvas=$('qrcode');
const ctx=canvas.getContext('2d');
let current='', currentSvg='';
const fields=['url','whatsapp','wifi','pix','email','telefone','sms','texto'];
const levelMap={L:QRErrorCorrectLevel.L,M:QRErrorCorrectLevel.M,Q:QRErrorCorrectLevel.Q,H:QRErrorCorrectLevel.H};
function notify(msg){ if(typeof toast==='function') toast(msg); else alert(msg); }
function esc(v){return String(v||'').replace(/([\\;,:\"])/g,'\\$1')}
function cleanPhone(v){let p=String(v||'').replace(/\D/g,'');if(p.length===10||p.length===11)p='55'+p;return p}
function setType(t){typeInput.value=t;document.querySelectorAll('.qr-type').forEach(b=>b.classList.toggle('active',b.dataset.type===t));fields.forEach(k=>{const el=$('qr_'+k+'_fields');if(el)el.hidden=k!==t});clearPreview();}
function content(){const t=typeInput.value;
 if(t==='url'){let u=$('qr_url').value.trim();if(!u)return '';if(!/^https?:\/\//i.test(u))u='https://'+u;return u}
 if(t==='whatsapp'){const p=cleanPhone($('qr_telefone').value);if(p.length<12)return '';const m=$('qr_mensagem').value.trim();return 'https://wa.me/'+p+(m?'?text='+encodeURIComponent(m):'')}
 if(t==='wifi'){const s=$('qr_wifi_nome').value.trim();if(!s)return '';const sec=$('qr_wifi_seguranca').value;const pass=sec==='nopass'?'':$('qr_wifi_senha').value;return `WIFI:T:${sec};S:${esc(s)};P:${esc(pass)};H:${$('qr_wifi_hidden').checked?'true':'false'};;`}
 if(t==='pix')return $('qr_pix_code').value.trim();
 if(t==='email'){const to=$('qr_email_to').value.trim();if(!to)return '';return 'mailto:'+to+'?subject='+encodeURIComponent($('qr_email_subject').value.trim())+'&body='+encodeURIComponent($('qr_email_body').value.trim())}
 if(t==='telefone'){const p=$('qr_phone').value.trim();return p?'tel:'+p.replace(/\s/g,''):''}
 if(t==='sms'){const p=cleanPhone($('qr_sms_phone').value);if(p.length<12)return '';return 'SMSTO:'+p+':'+$('qr_sms_text').value.trim()}
 return $('qr_texto').value.trim();
}
function validHex(v){return /^#[0-9a-f]{6}$/i.test(v)}
function syncColors(){[['qr_foreground','qr_foreground_hex'],['qr_background','qr_background_hex']].forEach(([c,h])=>{const color=$(c),hex=$(h);color.addEventListener('input',()=>hex.value=color.value);hex.addEventListener('input',()=>{if(validHex(hex.value))color.value=hex.value})})}
function contrastOk(fg,bg){const lum=h=>{const a=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*a[0]+.7152*a[1]+.0722*a[2]};const a=lum(fg),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=3}
function clearPreview(){ctx.clearRect(0,0,canvas.width,canvas.height);$('qr_empty_state').hidden=false;$('qr_hint').textContent='Ainda não foi gerado.';['qr_download','qr_download_svg','qr_copy','qr_share','qr_print'].forEach(id=>$(id).disabled=true);current='';currentSvg='';}
function makeQr(data){const qr=new QRCore(0,levelMap[$('qr_level').value]||QRErrorCorrectLevel.M);qr.addData(data);qr.make();return qr}
function renderSvg(qr,size,margin,fg,bg){const n=qr.getModuleCount(),cell=size/(n+margin*2);let paths='';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))paths+=`M${((c+margin)*cell).toFixed(3)} ${((r+margin)*cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`;
return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="${bg}"/><path d="${paths}" fill="${fg}"/></svg>`}
function generate(){current=content();if(!current){notify(typeInput.value==='whatsapp'||typeInput.value==='sms'?'Informe um telefone válido com DDD':'Preencha as informações necessárias');return}const fg=$('qr_foreground').value,bg=$('qr_background').value;if(!contrastOk(fg,bg))notify('As cores têm pouco contraste. O QR Code pode ficar difícil de ler.');try{const qr=makeQr(current),n=qr.getModuleCount(),size=Number($('qr_tamanho').value)||384,margin=Number($('qr_margin').value)||4,cell=Math.max(1,Math.floor(size/(n+margin*2))),real=cell*(n+margin*2);canvas.width=real;canvas.height=real;ctx.fillStyle=bg;ctx.fillRect(0,0,real,real);ctx.fillStyle=fg;for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))ctx.fillRect((c+margin)*cell,(r+margin)*cell,cell,cell);currentSvg=renderSvg(qr,size,margin,fg,bg);$('qr_empty_state').hidden=true;$('qr_hint').textContent='QR Code criado. Teste antes de compartilhar ou imprimir.';['qr_download','qr_download_svg','qr_copy','qr_share','qr_print'].forEach(id=>$(id).disabled=false);saveHistory();canvas.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){console.error(e);notify('O conteúdo ficou grande demais. Reduza o texto ou aumente a correção de erro com cautela.')}}
function downloadPng(){if(!current)return;const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='qr-code-central-ia.png';a.click();notify('PNG baixado')}
function downloadSvg(){if(!currentSvg)return;const blob=new Blob([currentSvg],{type:'image/svg+xml'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='qr-code-central-ia.svg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notify('SVG baixado')}
async function copy(){if(!current)return;try{await navigator.clipboard.writeText(current);notify('Conteúdo copiado')}catch(e){notify('Não foi possível copiar automaticamente')}}
async function share(){if(!current)return;try{const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));const file=new File([blob],'qr-code.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({title:'QR Code - Central IA',text:'QR Code criado na Central IA',files:[file]});else if(navigator.share)await navigator.share({title:'QR Code - Central IA',text:current});else{await copy();notify('Conteúdo copiado para compartilhar')}}catch(e){if(e.name!=='AbortError')notify('Não foi possível compartilhar')}}
function printQr(){if(!current)return;const w=window.open('','_blank','width=700,height=800');w.document.write(`<html><head><title>QR Code</title><style>body{font-family:Arial;text-align:center;padding:40px}img{max-width:500px;width:90%}p{word-break:break-all;color:#555}</style></head><body><h1>QR Code</h1><img src="${canvas.toDataURL('image/png')}"><p>${current.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}</p><script>onload=()=>print()<\/script></body></html>`);w.document.close()}
function historyData(){try{return JSON.parse(localStorage.getItem('centralia_qr_history')||'[]')}catch(e){return []}}
function saveHistory(){const list=historyData();const item={type:typeInput.value,content:current,date:new Date().toISOString(),png:canvas.toDataURL('image/png')};const clean=list.filter(x=>x.content!==current);clean.unshift(item);localStorage.setItem('centralia_qr_history',JSON.stringify(clean.slice(0,6)));renderHistory()}
function renderHistory(){const box=$('qr_history'),list=historyData();if(!list.length){box.innerHTML='<p class="muted">Nenhum QR Code salvo neste navegador.</p>';return}box.innerHTML=list.map((x,i)=>`<article class="qr-history-item"><img src="${x.png}" alt="QR Code salvo"><div><b>${({url:'Link',whatsapp:'WhatsApp',wifi:'Wi-Fi',pix:'PIX',email:'E-mail',telefone:'Telefone',sms:'SMS',texto:'Texto'})[x.type]||'QR Code'}</b><p>${new Date(x.date).toLocaleString('pt-BR')}</p><small>${x.content.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])).slice(0,65)}</small><div><button class="link-button history-use" data-index="${i}" type="button">Usar novamente</button></div></div></article>`).join('');box.querySelectorAll('.history-use').forEach(b=>b.addEventListener('click',()=>restoreHistory(Number(b.dataset.index))))}
function restoreHistory(i){const x=historyData()[i];if(!x)return;setType(x.type);if(x.type==='url')$('qr_url').value=x.content;else if(x.type==='texto')$('qr_texto').value=x.content;else if(x.type==='pix')$('qr_pix_code').value=x.content;else{try{navigator.clipboard.writeText(x.content);notify('Conteúdo antigo copiado. Cole no campo correspondente.')}catch(e){}}window.scrollTo({top:document.querySelector('.qr-pro-shell').offsetTop-80,behavior:'smooth'})}
document.querySelectorAll('.qr-type').forEach(b=>b.addEventListener('click',()=>setType(b.dataset.type)));
$('qr_generate').addEventListener('click',generate);$('qr_download').addEventListener('click',downloadPng);$('qr_download_svg').addEventListener('click',downloadSvg);$('qr_copy').addEventListener('click',copy);$('qr_share').addEventListener('click',share);$('qr_print').addEventListener('click',printQr);
$('qr_reset_style').addEventListener('click',()=>{$('qr_foreground').value=$('qr_foreground_hex').value='#111827';$('qr_background').value=$('qr_background_hex').value='#ffffff';$('qr_tamanho').value='384';$('qr_margin').value='4';$('qr_level').value='M';notify('Estilo restaurado')});
$('toggle_wifi_password').addEventListener('click',e=>{const input=$('qr_wifi_senha');input.type=input.type==='password'?'text':'password';e.currentTarget.textContent=input.type==='password'?'Mostrar':'Ocultar'});
$('qr_clear_history').addEventListener('click',()=>{localStorage.removeItem('centralia_qr_history');renderHistory();notify('Histórico apagado')});
$('qr_mensagem').addEventListener('input',()=>{$('wa_count').textContent=$('qr_mensagem').value.length});$('qr_texto').addEventListener('input',()=>{$('text_count').textContent=$('qr_texto').value.length});
syncColors();setType('url');renderHistory();
})();
