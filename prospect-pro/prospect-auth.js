(()=>{
'use strict';
const $a=id=>document.getElementById(id),key='prospect_publisher_session_v1';
let cfg=null;
const show=(s)=>{$a('radarAuthStatus').textContent=s||''};
function getSession(){try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}}
async function config(){
 if(cfg)return cfg;
 const r=await fetch('/api/public-config',{cache:'no-store'});
 if(!r.ok)throw Error('Integração Supabase indisponível');
 cfg=await r.json();
 if(!cfg.configured)throw Error('O acesso seguro ainda não foi configurado no servidor.');
 return cfg;
}
async function callAuth(path,body){
 const c=await config();
 const r=await fetch(c.supabaseUrl+'/auth/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json',apikey:c.publishableKey},body:JSON.stringify(body)});
 let j;try{j=await r.json()}catch{j={}};
 if(!r.ok)throw Error(j.msg||j.error_description||j.message||j.error||'Falha ao entrar');
 return j;
}
async function authenticated(){
 const session=getSession();
 if(!session?.access_token)return false;
 try{
  const c=await config();
  const r=await fetch(c.supabaseUrl+'/auth/v1/user',{headers:{apikey:c.publishableKey,Authorization:'Bearer '+session.access_token}});
  if(r.ok)return true;
  if(!session.refresh_token)return false;
  const updated=await callAuth('token?grant_type=refresh_token',{refresh_token:session.refresh_token});
  sessionStorage.setItem(key,JSON.stringify(updated));return !!updated.access_token;
 }catch{return false}
}
async function updateAuth(){
 if(await authenticated()){
  $a('prospectAuthPanel').hidden=true;
  return;
 }
 const q=await fetch('/api/quota',{cache:'no-store'}).then(r=>r.json()).catch(()=>null);
 $a('prospectAuthPanel').hidden=!(q&&q.enabled);
 if(q?.enabled)show('Entre para realizar buscas reais e proteger o limite de consultas.');
}
async function doLogin(){
 const email=$a('radarEmail').value.trim(),password=$a('radarPassword').value;
 if(!email||!password)return show('Informe e-mail e senha.');
 $a('radarLogin').disabled=true;show('Verificando acesso…');
 try{
  const s=await callAuth('token?grant_type=password',{email,password});
  if(!s.access_token)throw Error('A conta não retornou sessão.');
  sessionStorage.setItem(key,JSON.stringify(s));
  if(!await authenticated())throw Error('Não foi possível confirmar sua sessão.');
  $a('radarPassword').value='';$a('prospectAuthPanel').hidden=true;
  show('Acesso confirmado.');
  if(typeof refreshQuota==='function')refreshQuota();
 }catch(e){show('Não foi possível entrar: '+e.message)}
 finally{$a('radarLogin').disabled=false}
}
async function magic(){
 const email=$a('radarEmail').value.trim();
 if(!email)return show('Informe seu e-mail cadastrado.');
 $a('radarMagic').disabled=true;show('Solicitando código de acesso…');
 try{
  await callAuth('otp?redirect_to='+encodeURIComponent(location.origin+'/'),{email,create_user:false});
  $a('radarOtpRow').hidden=false;
  show('Confira seu e-mail. Se receber um código, preencha abaixo. Se receber um link, abra no mesmo navegador. O endereço precisa ser autorizado no Supabase.');
 }catch(e){show('Não foi possível solicitar o acesso: '+e.message)}
 finally{$a('radarMagic').disabled=false}
}
async function verifyOtp(){
 const email=$a('radarEmail').value.trim(),token=$a('radarOtp').value.trim();
 if(!email||token.length<6)return show('Informe e-mail e código recebido.');
 try{
  const s=await callAuth('verify',{email,token,type:'email'});
  if(!s.access_token)throw Error('Código não gerou sessão.');
  sessionStorage.setItem(key,JSON.stringify(s));$a('prospectAuthPanel').hidden=true;
  show('Autenticado. Você pode realizar sua pesquisa.');
  if(typeof refreshQuota==='function')refreshQuota();
 }catch(e){show('Código não verificado: '+e.message)}
}
$a('radarLogin').onclick=doLogin;
$a('radarMagic').onclick=magic;
$a('radarVerifyOtp').onclick=verifyOtp;
(function acceptEmailLink(){
 const params=new URLSearchParams(location.hash.slice(1));
 const access=params.get('access_token');
 if(access){
  sessionStorage.setItem(key,JSON.stringify({access_token:access,refresh_token:params.get('refresh_token')||''}));
  history.replaceState(null,'',location.pathname+location.search);
 }
})();
updateAuth();
})();