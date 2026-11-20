(function () {
  'use strict';

  const localKey = 'prospect_library_projects';
  const sessionKey = 'prospect_publisher_session_v1';
  const versions = '/rest/v1/prospect_studio_project_versions';
  const currentProjects = '/rest/v1/rpc/prospect_studio_current_projects';
  const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
  let connection = null;
  let queue = Promise.resolve();

  function stored(storage, key, fallback) {
    try { return JSON.parse(storage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  }

  const session = () => stored(sessionStorage, sessionKey, null);
  const token = () => session()?.access_token || '';

  function localProjects() {
    const projects = stored(localStorage, localKey, []);
    return Array.isArray(projects) ? projects.filter(project => validId(project?.id)) : [];
  }

  function releaseLocalCopy(project) {
    const projects = localProjects();
    const matching = projects.find(draft => draft.id === project.id && JSON.stringify(draft) === JSON.stringify(project));
    if (matching) {
      try { localStorage.setItem(localKey, JSON.stringify(projects.filter(draft => draft !== matching))); }
      catch { /* Keep the existing draft if the browser cannot update this key. */ }
    }
  }

  function pendingKey(ownerId) {
    return `prospect_studio_pending_${ownerId}`;
  }

  function pendingProjects(ownerId) {
    const entries = stored(localStorage, pendingKey(ownerId), []);
    return new Map(Array.isArray(entries) ? entries.filter(entry => validId(entry?.id)).map(entry => [entry.id, entry]) : []);
  }

  function persistPending(state) {
    try {
      if (state.pending.size) localStorage.setItem(pendingKey(state.ownerId), JSON.stringify([...state.pending.values()]));
      else localStorage.removeItem(pendingKey(state.ownerId));
      return true;
    } catch { return false; }
  }

  function status(message) {
    const indicator = document.getElementById('projectCloudStatus');
    if (indicator) indicator.textContent = message;
  }

  function addCloudContext(state, snapshot, version) {
    return { ...snapshot, cloudVersion: version, cloudOwned: true, cloudOwnerId: state.ownerId };
  }

  function emit(state, ownerId = state?.ownerId ?? null) {
    const projects = new Map(localProjects().map(project => [project.id, project]));
    if (state) {
      for (const [id, row] of state.heads) {
        if (row.snapshot) projects.set(id, addCloudContext(state, row.snapshot, row.version_id));
        else projects.delete(id);
      }
      for (const [id, entry] of state.pending) {
        if (entry.snapshot) projects.set(id, addCloudContext(state, entry.snapshot, entry.previousVersion));
        else if (!entry.conflict) projects.delete(id);
      }
    }
    const sorted = [...projects.values()].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    window.dispatchEvent(new CustomEvent('portal-projects-loaded', { detail: { projects: sorted, ownerId } }));
  }

  async function request(config, accessToken, path, options = {}) {
    const { headers, ...init } = options;
    const response = await fetch(`${config.supabaseUrl}${path}`, {
      ...init,
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}`, ...headers },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw Object.assign(new Error('A sincronização de projetos está indisponível.'), { status: response.status });
    return response.json();
  }

  async function loadHeads(state) {
    const rows = await request(state.config, state.accessToken, currentProjects);
    state.heads = new Map(rows.map(row => [row.project_id, row]));
  }

  async function connect() {
    const accessToken = token();
    if (!accessToken) return null;
    if (connection?.accessToken === accessToken) return connection;
    const response = await fetch('/api/public-config', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Configuração de projetos indisponível.');
    const config = await response.json();
    if (!config.configured) throw new Error('Armazenamento de projetos indisponível.');
    const user = await request(config, accessToken, '/auth/v1/user');
    if (!user.id || user.app_metadata?.prospect_operator !== true) throw new Error('O acesso da sua conta a projetos na nuvem ainda não foi ativado.');
    const state = {
      accessToken, ownerId: user.id, config,
      heads: new Map(), pending: pendingProjects(user.id), saved: new Map(), queued: new Set()
    };
    await loadHeads(state);
    if (token() !== accessToken) return null;
    connection = state;
    return state;
  }

  async function submit(state, entry) {
    if (token() !== state.accessToken || entry.conflict) return;
    status('Sincronizando projetos…');
    const data = {
      project_id: entry.id,
      version_id: entry.version,
      previous_version_id: entry.previousVersion,
      snapshot: entry.snapshot
    };
    try {
      const rows = await request(state.config, state.accessToken, versions, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(data)
      });
      if (rows[0]) state.heads.set(entry.id, rows[0]);
      else await loadHeads(state);
      if (state.pending.get(entry.id)?.version === entry.version) state.pending.delete(entry.id);
      const head = state.heads.get(entry.id);
      if (entry.snapshot && head?.version_id === entry.version && token() === state.accessToken) {
        releaseLocalCopy(entry.snapshot);
        const earlier = state.saved.get(entry.id);
        const base = earlier?.version === entry.previousVersion ? earlier.base : entry.previousVersion;
        state.saved.set(entry.id, { base, version: entry.version });
        window.dispatchEvent(new CustomEvent('portal-project-version', { detail: { id: entry.id, version: entry.version, previousVersion: entry.previousVersion, ownerId: state.ownerId } }));
      }
    } catch (error) {
      if (error.status !== 409) throw error;
      await loadHeads(state);
      entry.conflict = true;
    } finally {
      persistPending(state);
    }
    if (token() === state.accessToken) emit(state);
  }

  function report(state) {
    if ([...state.pending.values()].some(entry => entry.conflict)) {
      status('Há uma versão mais recente na nuvem. Sua edição ficou neste aparelho. Abra o histórico para conferir e restaurar uma versão.');
    } else if (state.pending.size) {
      status('Há alterações neste aparelho aguardando sincronização.');
    } else {
      status('Projetos sincronizados com sua conta.');
    }
  }

  function enqueue(action) {
    const run = queue.then(action);
    queue = run.catch(() => {});
    return run;
  }

  function refresh() {
    const accessToken = token();
    if (connection?.accessToken !== accessToken) {
      const knownOwnerId = connection?.ownerId;
      connection = null;
      const retainedOwner = accessToken && knownOwnerId === session()?.user?.id ? knownOwnerId : null;
      emit(null, retainedOwner);
    }
    return enqueue(async () => {
      if (token() !== accessToken) return;
      if (!accessToken) {
        status('Projetos guardados neste navegador. Entre com sua conta para sincronizar.');
        return;
      }
      status('Recuperando projetos da sua conta…');
      try {
        const existing = connection;
        const state = await connect();
        if (!state) return;
        if (state === existing) await loadHeads(state);
        if (token() !== state.accessToken) return;
        emit(state);
        for (const entry of state.pending.values()) {
          if (!state.queued.has(entry.version)) await submit(state, entry);
        }
        if (token() === state.accessToken) report(state);
      } catch {
        if (token() === accessToken) status('Projetos na nuvem indisponíveis. Os rascunhos deste navegador continuam disponíveis.');
      }
    });
  }

  function write(project, remove = false) {
    const id = project?.id;
    if (!validId(id)) return;
    const accessToken = token();
    if (!accessToken) return;
    const openedVersion = project.cloudVersion ?? null;
    const snapshot = remove ? null : { ...project };
    if (snapshot) {
      delete snapshot.cloudVersion;
      delete snapshot.cloudOwned;
      delete snapshot.cloudOwnerId;
    }
    const entry = { id, version: crypto.randomUUID(), previousVersion: openedVersion, snapshot };
    const cached = connection?.accessToken === accessToken ? connection : null;
    const staged = cached && (!project.cloudOwnerId || project.cloudOwnerId === cached.ownerId)
      && (!remove || cached.heads.has(id) || cached.pending.has(id));
    let savedLocally = false;
    if (staged) {
      cached.pending.set(id, entry);
      cached.queued.add(entry.version);
      savedLocally = persistPending(cached);
    }

    return enqueue(async () => {
      try {
        if (token() !== accessToken) return;
        const state = await connect();
        if (!state || token() !== accessToken) return;
        if (project.cloudOwnerId && project.cloudOwnerId !== state.ownerId) return;
        if (state === cached && staged && state.pending.get(id)?.version !== entry.version) return;
        const previous = state.pending.get(id);
        const head = state.heads.get(id);
        // A fresh draft may be saved locally before it has a cloud version. An
        // opened cloud draft carries the version the editor actually loaded.
        const lastSave = state.saved.get(id);
        const savedHere = lastSave?.base === openedVersion && lastSave.version === head?.version_id;
        entry.previousVersion = savedHere ? lastSave.version : openedVersion;
        if (remove && !head && !previous) return;
        state.pending.set(id, entry);
        savedLocally = persistPending(state);
        await submit(state, entry);
        if (token() === accessToken) report(state);
      } catch {
        if (token() !== accessToken) return;
        if (remove && !savedLocally) {
          status('A exclusão não foi sincronizada. Tente novamente quando a nuvem estiver disponível.');
          return;
        }
        status(savedLocally || !project.cloudOwned
          ? 'Sincronização indisponível. As alterações ficaram neste navegador.'
          : 'A edição continua aberta. A nuvem e o armazenamento local estão indisponíveis.');
      } finally {
        if (staged) cached.queued.delete(entry.version);
      }
    });
  }

  async function history(id) {
    if (!validId(id)) return [];
    return enqueue(async () => {
      const state = await connect();
      if (!state) return [];
      await loadHeads(state);
      const query = new URLSearchParams({
        project_id: `eq.${id}`,
        snapshot: 'not.is.null',
        select: 'snapshot,created_at',
        order: 'revision.desc',
        limit: '12'
      });
      const rows = await request(state.config, state.accessToken, `${versions}?${query}`);
      if (token() !== state.accessToken) return [];
      const currentVersion = state.heads.get(id)?.version_id;
      return rows.map(row => ({ recordedAt: row.created_at, project: addCloudContext(state, row.snapshot, currentVersion) }));
    });
  }

  window.PortalProjectStore = {
    refresh,
    save: project => write(project),
    remove: project => write(project, true),
    localize: project => !project?.cloudOwned && !project?.cloudVersion,
    history
  };
  window.addEventListener('online', refresh);
  window.addEventListener('storage', event => {
    if (event.key === sessionKey) refresh();
    if (event.key === localKey) emit(connection);
  });
  refresh();
})();
