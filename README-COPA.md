# Módulo Jogos da Copa — Central IA

Esta versão adiciona um bloco automático de jogos da Copa na Home.

## Como funciona

- O front-end chama `/api/copa`.
- O Netlify redireciona para `/.netlify/functions/copa`.
- A função consulta uma API pública de placares/esportes e devolve apenas dados objetivos: times, data, horário, competição e status.

## Direitos autorais

O módulo não copia textos de matérias, não reproduz conteúdo jornalístico e não faz resumo de sites. Ele exibe apenas informações factuais de agenda esportiva.

## Variáveis

Este módulo não precisa de chave própria. A NewsAPI continua usando `NEWS_API_KEY` apenas para as notícias.
