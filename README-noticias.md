# Módulo Últimas Notícias — Portal Central IA

Este módulo usa uma Netlify Function para buscar manchetes na NewsAPI.org sem expor sua chave no JavaScript do navegador.

## Arquivos adicionados

- `noticias.html` — página pública das últimas notícias.
- `netlify/functions/noticias.js` — função serverless que consulta a NewsAPI no servidor.
- `README-noticias.md` — este guia de configuração.

## Por que usar Netlify Function?

A chave da NewsAPI não deve ficar no front-end. Se ela fosse colocada em `fetch()` direto no navegador, qualquer visitante poderia ver a chave no código-fonte ou no painel de rede do navegador. A função serverless mantém a chave protegida em uma variável de ambiente do Netlify chamada `NEWS_API_KEY`.

## Como configurar no painel do Netlify

1. Acesse sua conta no Netlify.
2. Entre no site do **Portal Central IA**.
3. Vá em **Site configuration**.
4. Abra **Environment variables**.
5. Clique em **Add a variable**.
6. Em **Key**, coloque exatamente:

```text
NEWS_API_KEY
```

7. Em **Value**, cole sua chave da NewsAPI.org.
8. Salve a variável.

## Como garantir que as functions fiquem ativas no deploy

1. Verifique se o projeto enviado ao Netlify contém esta pasta:

```text
netlify/functions/noticias.js
```

2. Faça um novo deploy do ZIP completo no Netlify.
3. Após o deploy, acesse:

```text
https://portalcentralia.com.br/.netlify/functions/noticias
```

4. Se estiver configurado corretamente, a resposta será um JSON com `ok: true` e uma lista de manchetes.
5. Depois acesse:

```text
https://portalcentralia.com.br/noticias.html
```

## Teste local opcional

Para testar localmente, instale a CLI do Netlify e rode:

```bash
netlify dev
```

Depois acesse:

```text
http://localhost:8888/noticias.html
```

## Regras editoriais do módulo

- A página exibe apenas manchete, fonte, data, imagem quando disponível e link para a fonte original.
- A página não exibe o corpo das notícias.
- A página não faz resumo automático do conteúdo.
- Os links abrem em nova aba com `target="_blank" rel="noopener noreferrer nofollow"`.

## Erros comuns

### “NEWS_API_KEY não está configurada”
A variável de ambiente ainda não foi criada no Netlify ou o nome foi digitado diferente.

### “A NewsAPI retornou um erro”
Pode ser limite do plano, chave inválida, endpoint indisponível ou restrição da própria NewsAPI.

### A página carrega, mas não aparecem notícias
Abra a URL da função diretamente para ver a mensagem de erro retornada em JSON.
