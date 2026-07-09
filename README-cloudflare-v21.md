# Central IA v21 - Cloudflare Worker

Correção desta versão:
- adiciona `.assetsignore` para impedir que `_worker.js` seja publicado como asset estático;
- mantém `_worker.js` como Worker principal pelo `wrangler.toml`;
- preserva `/api/noticias` usando `NEWS_API_KEY` e fallback RSS.

No Cloudflare, mantenha a variável `NEWS_API_KEY` cadastrada em Settings > Variables and Secrets.
