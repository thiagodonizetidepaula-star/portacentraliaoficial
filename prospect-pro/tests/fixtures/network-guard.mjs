const fetchHttp = globalThis.fetch.bind(globalThis);
const fixtureOrigin = new URL(process.env.PROSPECT_PROVIDER_FIXTURE_ORIGIN).origin;

globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.origin === fixtureOrigin) return fetchHttp(input, init);
  if (url.href === 'https://places.googleapis.com/v1/places:searchText') {
    return fetchHttp(new URL('/fixtures/google', fixtureOrigin), init);
  }
  throw new Error('A rede do teste não permite chamadas para ' + url.origin);
};
