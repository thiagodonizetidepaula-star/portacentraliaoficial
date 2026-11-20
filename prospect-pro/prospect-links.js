(() => {
'use strict';
function profile(raw) {
 if (!raw) return '';
 let u;
 try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://'+raw); } catch { return ''; }
 if (!['http:','https:'].includes(u.protocol) || u.username || u.password) return '';
 const handle = /^\/([a-z0-9._]{1,30})\/?$/i.exec(u.pathname)?.[1];
 if (!['instagram.com','www.instagram.com'].includes(u.hostname) || u.port || !handle ||
     /^(p|reel|reels|stories|explore|share|direct|accounts|legal|about|tv|api|web)$/i.test(handle)) return '';
 return 'https://www.instagram.com/' + handle.toLowerCase() + '/';
}
window.ProspectLinks = { instagram:profile, hasWebsite:company=>Boolean(company.website && !profile(company.website)) };
})();
