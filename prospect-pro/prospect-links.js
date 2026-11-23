(() => {
'use strict';
function profile(raw) {
 const handle=typeof raw==='string' && /^@([a-z\d._]{1,30})$/i.exec(raw.trim());
 const result=window.ProspectSocial.profile(handle?'https://www.instagram.com/'+handle[1]+'/':raw);
 return result?.network==='instagram'?result.url:'';
}
function phoneNumber(raw) {
 const input = String(raw || '').trim().replace(/^tel:/i, '');
 if (!/^[+()\d .-]+$/.test(input)) return '';
 const digits = input.replace(/\D/g, '');
 if (input.startsWith('+') && !digits.startsWith('55')) return /^[1-9]\d{7,14}$/.test(digits) ? '+' + digits : '';
 if (/^0(?:300|500|800|900)\d{7}$/.test(digits)) return digits;
 if (!input.startsWith('+') && /^[1-9]\d[2-9]\d{7,8}$/.test(digits)) return '+55' + digits;
 return /^55[1-9]\d[2-9]\d{7,8}$/.test(digits) ? '+' + digits : '';
}
function whatsappLinkNumber(raw) {
 if (!raw) return '';
 try {
  const u = new URL(String(raw).includes('://') ? raw : 'https://' + raw);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.port) return '';
  let digits;
  if (u.hostname === 'wa.me') digits = /^\/(\d+)\/?$/.exec(u.pathname)?.[1];
  if (['api.whatsapp.com', 'web.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com'].includes(u.hostname) && /^\/send\/?$/.test(u.pathname)) digits = u.searchParams.get('phone');
  return digits && /^[+]?\d{8,15}$/.test(digits.trim()) ? phoneNumber('+' + digits.trim().replace(/^\+/, '')) : '';
 } catch { return ''; }
}
function whatsappNumber(company) {
 if (!company) return '';
 const preferred = String(company.whatsapp || '').trim();
 const candidate = preferred || (company.whatsappUsePhone === false ? '' : whatsappLinkNumber(company.website) || company.phone);
 const number = whatsappLinkNumber(candidate) || phoneNumber(candidate);
 return number.startsWith('+') ? number.slice(1) : '';
}
const publicationOrigin = window.ProspectPreviewOrigin || '';
function previewUrl(original, share) {
 const slug = publicationOrigin ? (share || original) : original;
 if (typeof slug !== 'string' || slug.length < 3 || slug.length > 90 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return '';
 return publicationOrigin ? publicationOrigin + '/p/' + slug : location.origin + '/mvp/' + slug;
}
window.ProspectLinks = {
 instagram:profile, phoneNumber, whatsappLinkNumber, whatsappNumber,
 hasWebsite:company=>Boolean(company.website && !window.ProspectSocial.profile(company.website) && !whatsappLinkNumber(company.website)),
 previewUrl, externalPreviews:Boolean(publicationOrigin)
};
})();
