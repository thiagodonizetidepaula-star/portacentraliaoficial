export const validSlug = value => typeof value === 'string' && value.length >= 3 && value.length <= 90 &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export const previewPolicy = "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'";

const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

export async function readPublication(endpoint, key, slug, prefer = 'slug', fetcher = fetch) {
  const url = new URL('/rest/v1/prospect_site_previews', endpoint);
  url.search = new URLSearchParams({
    or: '(slug.eq.' + slug + ',share_slug.eq.' + slug + ')', status: 'eq.published', limit: '2',
    select: 'slug,share_slug,business_name,description,cover_image,html,updated_at'
  });
  const response = await fetcher(url, {headers: {apikey: key}, signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error('Leitura da publicação indisponível');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Resposta de publicação inválida');
  return rows.find(row => row[prefer] === slug) || rows[0] || null;
}

export function publicationHtml(row, canonical) {
  const raw = row.html;
  if (typeof raw !== 'string' || raw.length > 280000 || !/<\/head>/i.test(raw)) throw new Error('HTML indisponível');
  const title = String(row.business_name || 'Site demonstrativo').slice(0,90) + ' | Demonstração Portal Central IA';
  const fields = {
    'og:type': 'website', 'og:locale': 'pt_BR', 'og:site_name': 'Portal Central IA · Demonstração',
    'og:title': title, 'og:description': String(row.description || 'Uma proposta de site criada para esta empresa.').slice(0,160),
    'og:url': canonical
  };
  if (typeof row.cover_image === 'string' && /^https:\/\/[^<>"'\s]+$/.test(row.cover_image)) fields['og:image'] = row.cover_image;
  const tags = Object.entries(fields).map(([name, value]) => '<meta property="' + name + '" content="' + escape(value) + '">');
  if (fields['og:image']) tags.push('<meta name="twitter:card" content="summary_large_image">');
  tags.push('<meta name="robots" content="noindex,nofollow">');
  return raw.replace(/<\/head>/i, () => tags.join('') + '</head>');
}
