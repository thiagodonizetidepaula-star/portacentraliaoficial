const fetchHttp = globalThis.fetch.bind(globalThis);
const fixtureOrigin = new URL(process.env.PROSPECT_PROVIDER_FIXTURE_ORIGIN).origin;
const publicOrigin = process.env.PROSPECT_PROVIDER_PUBLIC_ORIGIN;

globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.origin === fixtureOrigin) return fetchHttp(input, init);
  if (url.hostname === '127.0.0.1' && url.origin === process.env.PROSPECT_PUBLICATION_ORIGIN) return fetchHttp(input, init);
  if (url.origin === publicOrigin) {
    return fetchHttp(new URL(url.pathname + url.search, fixtureOrigin), init);
  }
  if (url.href === 'https://places.googleapis.com/v1/places:searchText') {
    return fetchHttp(new URL('/fixtures/google', fixtureOrigin), init);
  }
  if (url.origin === 'https://places.googleapis.com' && url.pathname.startsWith('/v1/places/')) {
    return fetchHttp(new URL('/fixtures/place/' + url.pathname.split('/').pop(), fixtureOrigin), init);
  }
  if (url.origin === 'https://graph.facebook.com') {
    return fetchHttp(new URL('/fixtures/instagram' + url.search, fixtureOrigin), init);
  }
  if (url.origin === 'https://scontent.cdninstagram.com') {
    return fetchHttp(new URL('/fixtures/insta-image', fixtureOrigin), init);
  }
  throw new Error('A rede do teste não permite chamadas para ' + url.origin);
};
