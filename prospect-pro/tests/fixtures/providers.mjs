import {publicationHtml} from '../../public-page.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {createServer} from 'node:http';

export const token = 'only_local_fixture_bearer_not_usable_as_a_real_token';
export const viewOnlyToken = 'only_local_fixture_viewer_not_usable_as_a_real_token';
export const publishableKey = 'only_local_fixture_publishable_key';
export const openaiKey = 'only_local_fixture_openai_key';
const imageBytes = Buffer.from('UklGRjQAAABXRUJQVlA4ICgAAABwAQCdASoFAAUAAUAmJaACdAFAAAD+9SddWWohyP/8bx/ru/yi3oAA', 'base64');
export const operator = {
  id: '8b2f438c-6a5f-4f91-952d-0f1163be9787',
  email: 'operador@example.test',
  app_metadata: {prospect_operator: true},
};
export const business = {
  id: 'local-establishment-aurora',
  displayName: {text: 'Salão Aurora'},
  formattedAddress: 'Rua das Flores, 12, Mauá, SP',
  internationalPhoneNumber: '+55 11 90000-0001',
  googleMapsUri: 'https://maps.google.com/?cid=123',
};
const withWebsite = {
  id: 'local-establishment-with-site',
  displayName: {text: 'Salão Horizonte'},
  websiteUri: 'https://horizonte.example.test',
};

async function requestBytes(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function jsonBody(request) {
  const body = await requestBytes(request);
  return body.length ? JSON.parse(body.toString()) : undefined;
}

function respond(response, status, body) {
  response.writeHead(status, {'Content-Type': 'application/json'});
  response.end(body === undefined ? undefined : JSON.stringify(body));
}

function findValue(url, column) {
  const value = url.searchParams.get(column);
  return value?.startsWith('eq.') ? value.slice(3) : null;
}

export async function startProviders() {
  const state = {
    used: 0,
    googleQueries: [],
    leads: new Map(),
    previews: new Map(),
    projectVersions: new Map(),
    bookmarks: [],
    messages: [],
    aiTexts: [],
    aiImages: [],
    uploadedImages: new Map(),
    failures: [],
  };
  let googleHandler = () => [200, {places: [business, withWebsite]}];
  let textHandler = () => [500, {error: {message: 'Resposta de texto não configurada no teste'}}];

  function hasAuth(request) {
    assert.equal(request.headers.apikey, publishableKey);
    return request.headers.authorization === 'Bearer ' + token;
  }

  async function handle(request, response) {
    const url = new URL(request.url, 'http://127.0.0.1');
    const {method} = request;
    const {pathname} = url;
    if (method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    if (pathname === '/fixtures/google' && method === 'POST') {
      assert.equal(request.headers['x-goog-api-key'], 'only_local_fixture_google_key');
      const fields='places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.googleMapsUri';
      assert.ok([fields,fields+',places.googleMapsLinks.photosUri,places.attributions,places.regularOpeningHours.weekdayDescriptions'].includes(request.headers['x-goog-fieldmask']));
      const payload = await jsonBody(request);
      state.googleQueries.push(payload);
      const [status, body] = await googleHandler(payload);
      respond(response, status, body);
      return;
    }
    if (pathname === '/fixtures/place/' + business.id) {
      assert.equal(request.headers['x-goog-api-key'], 'only_local_fixture_google_key');
      assert.ok(request.headers['x-goog-fieldmask'].includes('googleMapsLinks.photosUri'));
      respond(response,200,{...business,googleMapsLinks:{photosUri:'https://maps.google.com/maps/photos'}});
      return;
    }
    if (pathname === '/fixtures/instagram') {
      assert.equal(request.headers.authorization,'Bearer only_local_fixture_meta');
      if(!url.searchParams.get('fields').startsWith('business_discovery.username(salaoaurora)')){respond(response,400,{error:{message:'Perfil indisponível'}});return;}
      assert.match(url.searchParams.get('fields'),/^business_discovery\.username\(salaoaurora\)/);
      respond(response,200,{business_discovery:{username:'salaoaurora',name:'Salão Aurora',
        biography:'Cortes com hora marcada.',profile_picture_url:'https://scontent.cdninstagram.com/mark.webp',
        media:{data:[1,2].map(i=>({media_type:'IMAGE',media_url:'https://scontent.cdninstagram.com/'+i+'.webp',permalink:'https://www.instagram.com/p/example'+i+'/'}))}}});
      return;
    }
    if (pathname === '/fixtures/insta-image') {
      assert.equal(request.headers.authorization,undefined);
      response.writeHead(200,{'Content-Type':'image/webp'}); response.end(imageBytes); return;
    }
    if (pathname === '/auth/v1/user' && method === 'GET') {
      const authorized = hasAuth(request);
      if (request.headers.authorization === 'Bearer ' + viewOnlyToken) {
        respond(response, 200, {id: '1c92dd2b-5513-4925-8b13-f98677bebe21', app_metadata: {}, user_metadata: {prospect_operator: true}});
        return;
      }
      respond(response, authorized ? 200 : 401, authorized ? operator : {message: 'Sessão inválida'});
      return;
    }
    if (pathname === '/auth/v1/token' && method === 'POST') {
      assert.equal(request.headers.apikey, publishableKey);
      const credentials = await jsonBody(request);
      assert.equal(credentials.email, operator.email);
      assert.equal(credentials.password, 'senha-do-teste-local');
      respond(response, 200, {access_token: token, user: operator});
      return;
    }
    if (pathname === '/rest/v1/rpc/prospect_search_quota' && method === 'POST') {
      assert.ok(hasAuth(request));
      const body = await jsonBody(request);
      const blocked = Boolean(body.p_reserve && state.used >= 50);
      if (body.p_reserve && !blocked) state.used++;
      respond(response, 200, {month: '2026-11', limit: 50, used: state.used, blocked});
      return;
    }
    if (pathname === '/rest/v1/prospect_search_bookmarks') {
      assert.ok(hasAuth(request));
      if (method === 'GET') {
        respond(response, 200, state.bookmarks);
        return;
      }
      assert.equal(method, 'POST');
      const bookmark = await jsonBody(request);
      assert.equal(bookmark.owner_id, operator.id);
      assert.deepEqual(Object.keys(bookmark).sort(), ['owner_id', 'place_ids', 'search_city', 'search_term']);
      state.bookmarks.unshift({...bookmark, id: randomUUID(), created_at: new Date().toISOString()});
      respond(response, 201);
      return;
    }
    if (pathname === '/rest/v1/prospect_crm_leads') {
      assert.ok(hasAuth(request));
      const id = findValue(url, 'id');
      if (method === 'GET') {
        respond(response, 200, [...state.leads.values()].filter(lead => !id || lead.id === id));
        return;
      }
      if (method === 'POST') {
        const rows = await jsonBody(request);
        for (const row of rows) {
          assert.equal(row.owner_id, operator.id);
          state.leads.set(row.id, {...state.leads.get(row.id), ...row});
        }
        respond(response, 201, rows);
        return;
      }
      assert.equal(method, 'PATCH');
      assert.equal(findValue(url, 'owner_id'), operator.id);
      const lead = state.leads.get(id);
      const fields = await jsonBody(request);
      if (fields.message_opened_at) state.messages.push(fields);
      if (lead) Object.assign(lead, fields);
      respond(response, 200, lead ? [lead] : []);
      return;
    }
    if (pathname.startsWith('/p/') && (method === 'GET' || method === 'HEAD')) {
      const share = pathname.slice(3);
      const row = [...state.previews.values()].find(preview => preview.share_slug === share && preview.status === 'published');
      if (!row) return respond(response, 404);
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Prospect-Updated': String(Date.parse(row.updated_at)),
        'Access-Control-Expose-Headers':'X-Prospect-Updated'
      });
      response.end(method === 'HEAD' ? undefined : publicationHtml(row, 'http://' + request.headers.host + pathname));
      return;
    }
    if (pathname === '/rest/v1/prospect_site_previews') {
      const slug = findValue(url, 'slug');
      const id = findValue(url, 'id');
      if (method === 'GET' && !request.headers.authorization) {
        assert.equal(request.headers.apikey, publishableKey);
        assert.equal(findValue(url, 'status'), 'published');
        const lookup = /^\(slug\.eq\.([a-z0-9-]+),share_slug\.eq\.\1\)$/.exec(url.searchParams.get('or'));
        assert.ok(lookup);
        const rows = [...state.previews.values()].filter(preview =>
          preview.status === 'published' && [preview.slug, preview.share_slug].includes(lookup[1]));
        respond(response, 200, rows);
        return;
      }
      assert.ok(hasAuth(request));
      if (method === 'GET') {
        respond(response, 200, [...state.previews.values()].filter(preview => (!id || preview.id === id) && (!slug || preview.slug === slug)));
        return;
      }
      assert.ok(method === 'POST' || method === 'PATCH');
      const payload = await jsonBody(request);
      assert.equal(payload.owner_id, operator.id);
      const existing = state.previews.get(id);
      const share = existing?.share_slug || payload.business_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const row = {...existing, ...payload, id: id || randomUUID(), share_slug: share};
      state.previews.set(row.id, row);
      respond(response, method === 'POST' ? 201 : 200, [{id: row.id, slug: row.slug, share_slug: share, updated_at: row.updated_at}]);
      return;
    }
    if (pathname === '/rest/v1/rpc/prospect_studio_current_projects') {
      assert.ok(hasAuth(request));
      assert.equal(method, 'GET');
      respond(response, 200, [...state.projectVersions.values()].map(versions => versions[0]));
      return;
    }
    if (pathname === '/rest/v1/prospect_studio_project_versions') {
      assert.ok(hasAuth(request));
      if (method === 'GET') {
        const versions = state.projectVersions.get(findValue(url, 'project_id')) || [];
        respond(response, 200, versions.filter(row => row.snapshot).slice(0, 12));
        return;
      }
      assert.equal(method, 'POST');
      const change = await jsonBody(request);
      const versions = state.projectVersions.get(change.project_id) || [];
      if (change.previous_version_id !== (versions[0]?.version_id || null)) {
        respond(response, 409, {message: 'Versão concorrente no teste'});
        return;
      }
      if (change.snapshot) assert.equal(change.snapshot.id, change.project_id);
      const row = {...change, revision: versions.length + 1, created_at: new Date().toISOString()};
      versions.unshift(row);
      state.projectVersions.set(row.project_id, versions);
      respond(response, 201, [row]);
      return;
    }
    if (pathname === '/v1/responses' && method === 'POST') {
      assert.equal(request.headers.authorization, 'Bearer ' + openaiKey);
      const payload = await jsonBody(request);
      state.aiTexts.push(payload);
      const [status, output] = await textHandler(payload);
      respond(response, status, output);
      return;
    }
    if (pathname === '/v1/images/generations' && method === 'POST') {
      assert.equal(request.headers.authorization, 'Bearer ' + openaiKey);
      state.aiImages.push(await jsonBody(request));
      respond(response, 200, {data: [{b64_json: imageBytes.toString('base64')}]});
      return;
    }
    const bucket = 'prospect-site-images';
    const storagePath = '/storage/v1/object/';
    if (method === 'POST' && pathname.startsWith(storagePath + bucket + '/')) {
      assert.ok(hasAuth(request));
      assert.match(pathname.slice((storagePath + bucket + '/').length), new RegExp('^' + operator.id + '/[0-9a-f-]{36}\\.webp$'));
      assert.equal(request.headers['content-type'], 'image/webp');
      const bytes = await requestBytes(request);
      assert.equal(bytes.toString('ascii',0,4),'RIFF');
      assert.equal(bytes.toString('ascii',8,12),'WEBP');
      if (state.aiImages.length) assert.deepEqual(bytes, imageBytes);
      const key = pathname.slice(storagePath.length);
      state.uploadedImages.set(key, bytes);
      respond(response, 200, {Key: key});
      return;
    }
    if (method === 'GET' && pathname.startsWith(storagePath + 'public/' + bucket + '/')) {
      const image = state.uploadedImages.get(pathname.slice((storagePath + 'public/').length));
      if (!image) {
        respond(response, 404, {message: 'Imagem não encontrada na simulação'});
        return;
      }
      response.writeHead(200, {'Content-Type': 'image/webp'});
      response.end(image);
      return;
    }
    throw new Error('Rota inesperada na simulação: ' + method + ' ' + url.pathname);
  }

  const server = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'apikey,authorization,content-type,prefer,x-upsert,cache-control,pragma');
    response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PATCH,OPTIONS');
    handle(request, response).catch(error => {
      state.failures.push(error);
      respond(response, 500, {message: 'Erro na simulação local: ' + error.message});
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    origin: 'http://127.0.0.1:' + server.address().port,
    publicOrigin: 'https://prospect-storage.example.test',
    state,
    controlGoogle(handler) {
      googleHandler = handler;
    },
    controlAiText(handler) {
      textHandler = handler;
    },
    close: () => new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    }),
  };
}
