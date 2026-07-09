# Central IA v20 — Cloudflare

Esta versão inclui suporte nativo a Cloudflare Workers para o endpoint:

/api/noticias

Arquivos importantes:
- `_worker.js` — Worker principal que serve o site e a API de notícias.
- `wrangler.toml` — configuração para Cloudflare Workers com Static Assets.
- `functions/api/noticias.js` — compatibilidade extra caso o projeto seja publicado como Cloudflare Pages.

Variável necessária:
- `NEWS_API_KEY`

Se a NewsAPI falhar ou bloquear a consulta, o Worker tenta carregar notícias via RSS público como alternativa para não deixar a home vazia.
