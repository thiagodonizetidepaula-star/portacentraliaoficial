# Central IA — Deploy no Netlify

## Passos

1. Envie este projeto para o Netlify por ZIP ou pelo GitHub.
2. No Netlify, abra o site e vá em **Site configuration > Environment variables**.
3. Crie a variável:

```text
NEWS_API_KEY
```

4. No valor, cole sua chave da NewsAPI.
5. Salve e faça um novo deploy.
6. Teste a URL:

```text
https://SEU-SITE.netlify.app/api/noticias
```

Se retornar JSON com `ok: true`, as notícias estão funcionando.

## Observação

O JavaScript da Home chama `/api/noticias`. O arquivo `netlify.toml` redireciona automaticamente para a Netlify Function `/.netlify/functions/noticias`.
