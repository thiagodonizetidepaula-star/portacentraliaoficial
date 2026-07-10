# Notícias da Central IA — versão 35

O portal utiliza Google News RSS por meio da função Netlify `netlify/functions/noticias.js`.

## Características
- Não usa `NEWS_API_KEY`.
- Não depende da NewsAPI.
- Feed gratuito em português do Brasil.
- Cache de 10 minutos para reduzir chamadas e acelerar o site.
- Filtros por assunto continuam funcionando nas páginas Inicial e Notícias.

## Publicação
Suba todos os arquivos no GitHub. O Netlify detectará a pasta `netlify/functions` e publicará a função automaticamente.
Não é necessário configurar chave de API para notícias.
