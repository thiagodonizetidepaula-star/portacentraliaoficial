# Portal Prospect PRO — orientações para evolução no Codex

Este documento registra o escopo e a situação real do aplicativo de prospecção comercial do Portal Central IA. NÃO recrie ou apague a infraestrutura existente sem necessidade.

## Infraestrutura e arquivos principais
- GitHub: `thiagodonizetidepaula-star/portacentraliaoficial`, branch `portal-prospect-pro-preview-20261118`.
- Web service já existente no Render, app servido em `/prospect-pro`; URL pública atual `https://portal-prospect-pro.onrender.com`.
- Supabase já configurado pelo próprio serviço Render usando variáveis `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`. Não armazenar service-role no front nem criar projeto pago.
- `server.js`: rotas API, bloqueio de 50 consultas Google mensais, site público em `/mvp/:slug`.
- `index.html`: dashboard, prospecção, oportunidades, propostas enviadas e funil (legado com JS inline).
- `prospect-radar.js/.css`: radar ilustrativo, busca real por API, resultados sem site informado, filtros e ações.
- `prospect-auth.js`: login do operador via Supabase Auth; token é necessário para API.
- `prospect-crm.js`: CRM com sincronização privada Supabase, histórico de buscas por Place IDs, acompanhamento de propostas, confirmação manual de envio.
- `biblioteca-data.js`, `biblioteca.js`, `studio-flow.js`, `studio-publish.js`: biblioteca interna (oculta ao operador), motor de propostas, editor, publicação e mensagem WhatsApp.

## Requisitos inegociáveis
1. O operador pesquisa cidade + segmento; radar exibe etapas reais e feedback. Se Google estiver bloqueado, exibir erro e não simular empresas.
2. API Google Place Search (New), chave exclusivamente no backend; cota mensal de **50** invocações de pesquisa, atômica no Supabase, com fuso de São Paulo. Não autorizar cobrança nem alterar plano sem permissão.
3. Para não perder resultados, manter histórico privado das consultas com Place IDs (armazenamento permitido pelos termos Google) e leads confirmados pelo operador. O conteúdo do Google Maps não pode ser copiado em massa para armazenamento permanente; atualizar detalhes ao reutilizar dados. Deixar o limite de consultas explícito ao usuário.
4. Aba **Oportunidades**: guardar leads confirmados, evitar duplicatas por Place ID, status pendente/arquivado, fichas de clientes, botões criar site, editar, preparar WhatsApp. Ao retornar/recarregar, recarregar estado autenticado do Supabase.
5. Aba **Propostas enviadas**: somente registros confirmados pelo usuário após ele efetivamente apertar Enviar no WhatsApp. Abrir `wa.me` é apenas `message_opened_at`, jamais `proposal_sent_at`. Mensagem duplicada deve gerar aviso. Permitir arquivar sem perder histórico. Respeitar `opted_out` e política anti-spam.
6. Botão **Criar 3 sites** deve gerar 3 direções criativas **realmente diferentes** por empresa: layout, proporção de imagens, tipografia, fotografias licenciadas distintas, paletas, ritmo de animação, composição de seções e texto. Nunca afirmar que fotos genéricas são fotos reais da empresa; substituir após aprovação.
7. Editor precisa ajustar textos, logo, imagens, cores, fontes, tamanhos, espaçamentos, componentes e animações, com prévia Desktop/Mobile e desfazer/refazer. Guardar versões em nuvem para não perder edição.
8. Publicar site de demonstração em `/mvp/slug` com título/descritivo e imagem `og:image` válidos; após contratar, permitir apontamento de domínio externo. Não criar um Render por site.
9. Preparar mensagem personalizada no WhatsApp com o link público e revisão manual; não enviar em massa, não marcar como enviado sem confirmação.
10. Permissões RLS por `owner_id = auth.uid()` e operador autorizado; não expor credenciais, dados dos leads ou projetos editáveis ao visitante da prévia.
11. Layout profissional, sofisticado e administrativo, responsivo a 375px, com desempenho e acessibilidade.

## Banco existente (não mexer em tabelas de outros aplicativos)
- `public.prospect_site_previews` — demonstrativos publicados.
- `public.prospect_crm_leads` — leads confirmados, status, `preview_slug`, `proposal_sent_at`, `message_opened_at`.
- `public.prospect_search_bookmarks` — histórico com pesquisa e Place IDs permitidos.
- `public.prospect_search_usage` — contador mensal e cota atômica.

## Implementação e testes
- Preferir refatoração incremental para componentes React + TypeScript ou outra arquitetura coerente com a atual; não mudar rotas nem quebrar deploy.
- Criar testes automatizados de integração e fluxo: API sem chave, 50/50, 51ª bloqueada, empresa sem site, duplicata por Place ID, salvar/fechar/abrir, CRM em dispositivo distinto, prévia publicada com imagem social, abertura do WhatsApp sem marcar envio, confirmação de envio, aviso duplicado, arquivamento e recuperação.
- Testar visualmente em 375px/desktop e animações com `prefers-reduced-motion`. Não exibir indicadores de carregamento falsos.
- Auditar CSP, XSS, URL sanitization e rich text; conferir políticas de uso do Google Maps e WhatsApp.
- Toda alteração deve ter teste e commit. Não liberar envio para clientes nem realizar pesquisa paga apenas para testar sem autorização. Não contratar planos.
- Informar claramente funcionalidades prontas vs. pendentes; não afirmar funcionamento de produção sem validação.
