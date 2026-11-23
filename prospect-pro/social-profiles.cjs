(function () {
'use strict';
const names = {instagram:'Instagram', facebook:'Facebook', tiktok:'TikTok', youtube:'YouTube', linkedin:'LinkedIn', threads:'Threads'};
const reserved = new Set('about account accounts ads api business channel channels company developer developers direct directory emails events explore groups help intent legal login marketplace media messages p pages people permalink.php plugins policies post press privacy profile.php reel reels search share share.php sharer sharer.php shorts stories terms tv videos watch web'.split(' '));
function profile(raw) {
 if (typeof raw !== 'string' || raw.length > 900) return null;
 try {
  const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
  const host = url.hostname.replace(/^(?:www|m)\./, '');
  const path = url.pathname.replace(/\/$/, '');
  const single = /^\/([a-z\d._-]{1,100})$/i.exec(path)?.[1];
  let network, canonical;
  if (host === 'instagram.com' && single && !reserved.has(single.toLowerCase()) && /^[a-z\d._]{1,30}$/i.test(single)) {
   network='instagram'; canonical='https://www.instagram.com/'+single.toLowerCase()+'/';
  } else if (host === 'facebook.com' || host === 'fb.com') {
   if (path === '/profile.php' && /^\d{5,25}$/.test(url.searchParams.get('id')||'')) canonical='https://www.facebook.com/profile.php?id='+url.searchParams.get('id');
   else if (single && !reserved.has(single.toLowerCase())) canonical='https://www.facebook.com/'+single.toLowerCase()+'/';
   if (canonical) network='facebook';
  } else if ((host === 'tiktok.com' || host === 'threads.net' || host === 'threads.com') && /^\/@[a-z\d._]{1,32}$/i.test(path)) {
   network=host==='tiktok.com'?'tiktok':'threads'; canonical='https://www.'+(network==='threads'?'threads.com':'tiktok.com')+path.toLowerCase();
  } else if (host === 'youtube.com' && /^\/(?:@[\p{L}\d._-]{2,80}|channel\/UC[a-zA-Z0-9_-]{22}|(?:c|user)\/[a-z\d._-]{2,80})$/iu.test(decodeURIComponent(path))) {
   network='youtube'; canonical='https://www.youtube.com'+path;
  } else if (host === 'linkedin.com' && /^\/(?:company|school)\/[a-z\d_-]{2,120}$/i.test(path)) {
   network='linkedin'; canonical='https://www.linkedin.com'+path.toLowerCase()+'/';
  }
  return network ? {network,url:canonical,label:names[network]} : null;
 } catch { return null; }
}
function profiles(values) {
 const unique=new Map();
 for (const input of values) { const item=profile(input); if(item) unique.set(item.url,item); }
 return [...unique.values()];
}
function instagramPost(raw) {
 try {
  const url=new URL(raw);
  const path=/^\/(p|reel)\/([\w-]{3,64})\/?$/.exec(url.pathname);
  return url.protocol==='https:' && !url.username && !url.password && !url.port && ['instagram.com','www.instagram.com'].includes(url.hostname) && path ? 'https://www.instagram.com/'+path[1]+'/'+path[2]+'/' : '';
 } catch { return ''; }
}
const api={profile,profiles,instagramPost};
if (typeof module !== 'undefined' && module.exports) module.exports=api;
else globalThis.ProspectSocial=api;
})();
