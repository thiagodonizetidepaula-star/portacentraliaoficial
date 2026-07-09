# Módulo Últimas Notícias — Portal Central IA

Este módulo usa uma Cloudflare Pages Function para buscar manchetes na NewsAPI.org sem expor sua chave no JavaScript do navegador.

## Arquivos envolvidos

- `noticias.html` — página pública das últimas notícias.
- `index.html` — também mostra uma vitrine de notícias na entrada do site.
- `functions/api/noticias.js` — função serverless (Cloudflare Pages Function) que consulta a NewsAPI no servidor.
- `README-noticias.md` — este guia de configuração.

## Por que usar uma Pages Function?

A chave da NewsAPI não deve ficar no front-end. Se ela fosse colocada em `fetch()` direto no navegador, qualquer visitante poderia ver a chave no código-fonte ou no painel de rede do navegador. A função mantém a chave protegida em uma variável de ambiente do Cloudflare chamada `NEWS_API_KEY`, acessada no servidor via `env.NEWS_API_KEY`.

## Como configurar no painel do Cloudflare Pages

1. Acesse o painel do Cloudflare (dash.cloudflare.com).
2. Vá em **Workers & Pages** e abra o projeto do **Portal Central IA**.
3. Clique em **Settings** (Configurações).
4. Abra **Environment variables** (Variáveis de ambiente).
5. Clique em **Add variable**.
6. Em **Variable name**, coloque exatamente:

```text
NEWS_API_KEY
```

7. Em **Value**, cole sua chave da NewsAPI.org.
8. Marque para aplicar em **Production** (e também em Preview, se quiser testar em deploys de preview).
9. Salve e faça um novo deploy (qualquer novo commit já dispara isso automaticamente).

## Como a função é detectada

O Cloudflare Pages detecta automaticamente qualquer arquivo dentro da pasta `functions/` na raiz do projeto e transforma em uma rota. Como o arquivo está em:

```text
functions/api/noticias.js
```

ele fica disponível em:

```text
https://portalcentralia.com.br/api/noticias
```

Não é necessário nenhum arquivo de configuração adicional — basta a pasta `functions/` estar na raiz do repositório que o Cloudflare já reconhece.

## Como testar depois do deploy

1. Acesse diretamente:

```text
https://portalcentralia.com.br/api/noticias
```

Se estiver configurado corretamente, a resposta será um JSON com `ok: true` e uma lista de manchetes.

2. Depois acesse a página normal:

```text
https://portalcentralia.com.br/noticias.html
```

E também confira a vitrine de notícias na home:

```text
https://portalcentralia.com.br/
```

## Regras editoriais do módulo

- A página exibe apenas manchete, fonte, data, imagem quando disponível e link para a fonte original.
- A página não exibe o corpo das notícias.
- A página não faz resumo automático do conteúdo.
- Os links abrem em nova aba com `target="_blank" rel="noopener noreferrer nofollow"`.

## Erros comuns

### "NEWS_API_KEY não está configurada"
A variável de ambiente ainda não foi criada no Cloudflare Pages, foi digitada com nome diferente, ou foi salva só em Preview (e não em Production).

### "A NewsAPI retornou um erro"
Pode ser limite do plano gratuito, chave inválida, endpoint indisponível ou restrição da própria NewsAPI.

### A página carrega, mas não aparecem notícias
Abra `https://portalcentralia.com.br/api/noticias` diretamente no navegador para ver a mensagem de erro retornada em JSON — ela indica exatamente o que está errado.

### Erro 404 em `/api/noticias`
Confirme que a pasta `functions/api/noticias.js` realmente foi enviada ao repositório (às vezes pastas ficam de fora do commit por engano) e que o deploy mais recente já rodou.
