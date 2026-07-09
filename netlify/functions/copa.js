const LEAGUES = [
  { slug: 'fifa.world', nome: 'Copa do Mundo' },
  { slug: 'fifa.cwc', nome: 'Copa do Mundo de Clubes' },
  { slug: 'fifa.worldq', nome: 'Eliminatórias da Copa' },
  { slug: 'fifa.worldq.uefa', nome: 'Eliminatórias da Copa - UEFA' },
  { slug: 'fifa.worldq.conmebol', nome: 'Eliminatórias da Copa - CONMEBOL' },
  { slug: 'fifa.worldq.concacaf', nome: 'Eliminatórias da Copa - CONCACAF' },
  { slug: 'fifa.worldq.afc', nome: 'Eliminatórias da Copa - AFC' },
  { slug: 'fifa.worldq.caf', nome: 'Eliminatórias da Copa - CAF' },
  { slug: 'conmebol.america', nome: 'Copa América' },
  { slug: 'conmebol.libertadores', nome: 'Libertadores' },
  { slug: 'conmebol.sudamericana', nome: 'Sul-Americana' },
  { slug: 'bra.1', nome: 'Brasileirão Série A' },
  { slug: 'bra.2', nome: 'Brasileirão Série B' },
  { slug: 'uefa.champions', nome: 'Champions League' },
  { slug: 'uefa.europa', nome: 'Europa League' },
  { slug: 'club.friendly', nome: 'Amistosos de Clubes' },
  { slug: 'fifa.friendly', nome: 'Amistosos Internacionais' }
];

function dateKey(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function brNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function pickLogo(team) {
  if (!team) return null;
  if (team.logo) return team.logo;
  if (Array.isArray(team.logos) && team.logos[0] && team.logos[0].href) return team.logos[0].href;
  return null;
}

function mapEvent(event, leagueName) {
  const competition = event.competitions && event.competitions[0];
  const competitors = competition && competition.competitors ? competition.competitors : [];
  const home = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
  const away = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
  const homeTeam = home.team || {};
  const awayTeam = away.team || {};
  const status = event.status || {};
  const type = status.type || {};

  return {
    liga: leagueName || (event.league && event.league.name) || 'Futebol',
    nome: event.name || `${awayTeam.displayName || awayTeam.shortDisplayName || 'Time'} x ${homeTeam.displayName || homeTeam.shortDisplayName || 'Time'}`,
    data: event.date || null,
    status: type.shortDetail || type.detail || 'A confirmar',
    estado: type.state || 'pre',
    local: competition && competition.venue && competition.venue.fullName ? competition.venue.fullName : null,
    timeA: {
      nome: awayTeam.displayName || awayTeam.shortDisplayName || awayTeam.name || 'Visitante',
      sigla: awayTeam.abbreviation || awayTeam.shortDisplayName || '---',
      logo: pickLogo(awayTeam),
      placar: away.score || null
    },
    timeB: {
      nome: homeTeam.displayName || homeTeam.shortDisplayName || homeTeam.name || 'Mandante',
      sigla: homeTeam.abbreviation || homeTeam.shortDisplayName || '---',
      logo: pickLogo(homeTeam),
      placar: home.score || null
    }
  };
}

function fallbackGames() {
  const todayBR = brNow();
  const base = `${todayBR}T17:00:00-03:00`;
  const tomorrow = new Date(`${todayBR}T17:00:00-03:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return [
    {
      liga: 'Copa - agenda básica',
      nome: 'França x Marrocos',
      data: base,
      status: '17h00',
      estado: 'pre',
      local: null,
      timeA: { nome: 'França', sigla: 'FRA', logo: null, placar: null },
      timeB: { nome: 'Marrocos', sigla: 'MAR', logo: null, placar: null }
    },
    {
      liga: 'Futebol - próximos jogos',
      nome: 'Próximas partidas serão atualizadas automaticamente',
      data: tomorrow.toISOString(),
      status: 'A confirmar',
      estado: 'pre',
      local: null,
      timeA: { nome: 'Time A', sigla: 'A', logo: null, placar: null },
      timeB: { nome: 'Time B', sigla: 'B', logo: null, placar: null }
    }
  ];
}

async function fetchScoreboard(league, day) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.slug}/scoreboard?dates=${day}&limit=50`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'PortalCentralIA/1.0 (+https://portalcentralia.com.br)'
    }
  });
  if (!response.ok) return [];
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data.events) ? data.events.map(ev => mapEvent(ev, league.nome)) : [];
}

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=600',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const now = new Date();
  const days = Array.from({ length: 14 }, (_, index) => dateKey(addDays(now, index)));
  const games = [];

  for (const league of LEAGUES) {
    for (const day of days) {
      try {
        const found = await fetchScoreboard(league, day);
        found.forEach(game => games.push(game));
      } catch (_) {}
      if (games.length >= 12) break;
    }
    if (games.length >= 12) break;
  }

  const unique = new Map();
  games
    .filter(game => game && game.data && game.timeA && game.timeB)
    .forEach(game => {
      const key = `${game.liga}-${game.data}-${game.timeA.sigla}-${game.timeB.sigla}`;
      unique.set(key, game);
    });

  let sorted = [...unique.values()]
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .slice(0, 8);

  let fonte = 'ESPN API pública';
  if (!sorted.length) {
    sorted = fallbackGames();
    fonte = 'agenda básica de contingência';
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ ok: true, games: sorted, fonte })
  };
};
