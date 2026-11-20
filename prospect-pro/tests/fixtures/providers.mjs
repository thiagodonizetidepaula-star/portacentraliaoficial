import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {createServer} from 'node:http';

export const token = 'only_local_fixture_bearer_not_usable_as_a_real_token';
export const publishableKey = 'only_local_fixture_publishable_key';
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

async function jsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
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
    failures: [],
  };
  let googleHandler = () => [200, {places: [business, withWebsite]}];

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
      assert.equal(request.headers['x-goog-fieldmask'], 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.googleMapsUri');
      const payload = await jsonBody(request);
      state.googleQueries.push(payload);
      const [status, body] = await googleHandler(payload);
      respond(response, status, body);
      return;
    }
    if (pathname === '/auth/v1/user' && method === 'GET') {
      const authorized = hasAuth(request);
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
    if (pathname === '/rest/v1/prospect_site_previews') {
      const slug = findValue(url, 'slug');
      const id = findValue(url, 'id');
      if (method === 'GET' && slug && !request.headers.authorization) {
        assert.equal(request.headers.apikey, publishableKey);
        assert.equal(findValue(url, 'status'), 'published');
        const row = [...state.previews.values()].find(preview => preview.slug === slug);
        respond(response, 200, row ? [row] : []);
        return;
      }
      assert.ok(hasAuth(request));
      if (method === 'GET') {
        respond(response, 200, [...state.previews.values()].filter(preview => !id || preview.id === id));
        return;
      }
      assert.ok(method === 'POST' || method === 'PATCH');
      const payload = await jsonBody(request);
      assert.equal(payload.owner_id, operator.id);
      const row = {...state.previews.get(id), ...payload, id: id || randomUUID()};
      state.previews.set(row.id, row);
      respond(response, method === 'POST' ? 201 : 200, [{id: row.id, slug: row.slug}]);
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
    throw new Error('Rota inesperada na simulação: ' + method + ' ' + url.pathname);
  }

  const server = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'apikey,authorization,content-type,prefer');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    handle(request, response).catch(error => {
      state.failures.push(error);
      respond(response, 500, {message: 'Erro na simulação local: ' + error.message});
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    origin: 'http://127.0.0.1:' + server.address().port,
    state,
    controlGoogle(handler) {
      googleHandler = handler;
    },
    close: () => new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    }),
  };
}
