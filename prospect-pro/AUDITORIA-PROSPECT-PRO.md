# Auditoria do Prospect PRO

A inspeção de 26 de novembro de 2026 abrangeu a aplicação `prospect-pro`, as migrações, os endpoints públicos de diagnóstico e os catálogos do Render e do Supabase. As consultas à produção foram somente de leitura. Nenhuma consulta de Places com cobrança nem mensagem de WhatsApp foi executada.

## Versão e arquitetura

- O Render executa o repositório `thiagodonizetidepaula-star/portacentraliaoficial`, branch `portal-prospect-pro-preview-20261118`, com o commit `81ac2071c7c7` ativo. O plano é gratuito, o deploy automático acompanha commits dessa branch e as prévias de pull request estão desativadas. A instalação roda dentro de `prospect-pro`. O endpoint `/health` respondeu HTTP 200. [Studio em produção](https://portal-prospect-pro.onrender.com/studio)
- O dashboard e o Studio usam HTML, CSS e JavaScript no navegador. O servidor Node HTTP entrega páginas e arquivos, guarda credenciais de Google, Meta e IA, e encaminha buscas e operações autorizadas. O CRM e o Studio combinam armazenamento local, Supabase Auth e sincronização via Data API. O editor já gera três variantes, guarda histórico de versões e exporta HTML. [Código da versão examinada](https://github.com/thiagodonizetidepaula-star/portacentraliaoficial/tree/81ac2071c7c7b54dad426f22e4479b12f9c6dfd8/prospect-pro)
- A configuração aponta a publicação legada para `portalcentralia.com.br`. Nesse domínio, `/p/<slug>` redireciona para a função Netlify. O Render também atende `/mvp/<slug>`. A manutenção do site principal e dessas rotas pertence ao fluxo antigo de publicação. [Configuração de publicação](https://portal-prospect-pro.onrender.com/publication-config.js)

## Banco de dados

| Objeto | Função e controle verificados |
| --- | --- |
| `prospect_crm_leads` | Oportunidades, estágio, WhatsApp, confirmação de envio e bloqueio. RLS por proprietário com lista de operadores. |
| `prospect_search_bookmarks` | Histórico de pesquisas com Place IDs. RLS por proprietário com lista de operadores. |
| `prospect_search_usage` | Uso mensal. A RPC `prospect_search_quota` reserva a cota e é executável por usuários autenticados com controle de operador no procedimento. |
| `prospect_studio_project_versions` | Revisões dos projetos. RLS exige propriedade, conta não anônima e a marca de operador em `app_metadata`. |
| `prospect_site_previews` | Páginas legadas. RLS por proprietário para editar. Leitura anônima liberada para todas as colunas de linhas publicadas. |
| `prospect-site-images` | Bucket público com limite de 2,5 MB por arquivo WebP ou JPEG. A política de upload exige operador e prefixo próprio. |

As cinco tabelas do Prospect têm RLS habilitada. O banco atende outros projetos do titular. A inspeção leu apenas metadados de objetos do Prospect PRO e o histórico de migrações.

Três migrações existentes estão registradas em produção com carimbos diferentes dos arquivos correspondentes na branch.

| Migração | Arquivo local | Histórico remoto |
| --- | --- | --- |
| Versões de projeto | `20261120001304` | `20261120002418` |
| Bucket de imagens | `20261120011113` | `20261120012417` |
| Slug para compartilhamento | `20261120150000` | `20261120150145` |
| Campos de WhatsApp | `20261121103906` | `20261121103906` |

Na implantação, aplique somente a nova migração revisada e testada. O envio indiscriminado do diretório de migrações pode tentar reaplicar alterações de tabelas e políticas que já existem.

## Integrações e lacunas

- **Google Places.** Produção indica configuração ativa e exige login. A cota de 50 buscas por mês é controlada por RPC no fuso de São Paulo. O radar e os detalhes de identidade usam a mesma cota. Os favoritos guardam Place IDs e o operador confirma dados que serão mantidos no CRM. [Status da cota](https://portal-prospect-pro.onrender.com/api/quota)
- **Meta.** O código já possui rotas de leitura autorizada do Instagram e do Facebook, com seleção de mídia por tickets temporários e recursos de importação manual. Produção reporta ambas desativadas. A ativação depende de credenciais e permissões concedidas em uma conta Meta adequada. [Status das fontes](https://portal-prospect-pro.onrender.com/api/studio/brand/status)
- **IA.** Produção reporta a geração de texto e imagem desativada. O caminho local permanece disponível. [Status da IA](https://portal-prospect-pro.onrender.com/api/studio/ai/status)
- **WhatsApp.** O fluxo legado abre uma conversa com mensagem preparada. O operador confirma o envio depois. O registro de abertura representa o ato do operador de abrir o WhatsApp e não comprova que a empresa visualizou a proposta.
- **Privacidade.** O legado é servido por slug. A função Netlify marca as páginas com `noindex` e permite cache de sucesso de cinco segundos no CDN. O Render mantém cache de até um minuto no legado. O banco permite leitura anônima dos registros publicados, inclusive de campos de design e HTML. O fluxo privado precisa aplicar autorização e expiração no servidor e atender seus arquivos separadamente.
- **Recusa.** A sincronização legada envia a linha inteira do CRM. Uma recusa registrada em outra sessão precisa prevalecer sobre atualizações vindas de um navegador desatualizado.
- **Qualidade.** A suíte de integração usa um navegador Chromium e escopa as requisições a serviços simulados. O fluxo antigo validava edição, publicação e confirmação manual de envio. A liberação de propostas privadas exige validação específica do conteúdo das três páginas, dos links e do fluxo de expiração e revogação.

## Linha de base dos testes

A suíte legada foi executada em Chromium sobre uma cópia isolada do commit em produção. Oito dos doze testes passaram. Um teste de exportação esperava que uma opção ilustrativa fosse publicada como serviço. Outro alcançou o link de serviços da miniatura, mas o Chromium não conseguiu clicar nele enquanto estava fora da área visível. Os dois restantes esperavam reutilização de uma foto corporativa em mais de uma proposta e repetição da foto de capa na galeria, respectivamente. A execução confirmou a importação da única foto selecionada do pacote do Instagram.

## Ordem de implantação

1. Validar a branch de desenvolvimento com navegadores e serviços simulados. A referência para restaurar o código do serviço é o commit `81ac2071c7c7`.
2. Aplicar somente `20261126234436_prospect_private_proposals.sql` no ambiente aprovado. Verificar a funcionalidade com a mesma separação de papéis e permissões do Supabase. A migração usa o CRM existente e cria uma tabela separada para os documentos privados.
3. No Render, vincular `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` como segredo do servidor para as propostas privadas. A importação oficial já aceita `INSTAGRAM_BUSINESS_ACCOUNT_ID`, `INSTAGRAM_GRAPH_ACCESS_TOKEN` e `FACEBOOK_GRAPH_ACCESS_TOKEN`. O titular concede as permissões no painel Meta. Confirmar o estado em `/api/studio/brand/status`. [Documentação oficial da Meta](https://developers.facebook.com/docs/instagram-platform/)
4. Validar uma proposta privada sem contato externo, incluindo validade, dois tamanhos de tela, acesso sem token e exclusão. Confirmar que o dashboard recebe os eventos administrativos e que as prévias antigas mantêm suas URLs.
5. Incorporar as mudanças à branch acompanhada pelo Render após a aprovação visual e operacional. Confirmar o commit ativo e repetir os testes de saúde e de privacidade.

## Direção visual e dependências

- Solène orientou a hierarquia tipográfica e o ritmo das seções. Smashhouse serviu de referência para navegação centrada em produtos. Fine Dine ajudou a definir como tratar a abertura e separar os destinos de menu e reserva. As composições usam CSS próprio, adaptam-se por segmento e respeitam a preferência de movimento reduzido. [Solène](https://solene.framer.photos/) · [Smashhouse](https://smashhouse1.framer.website/) · [Fine Dine](https://finedine-template.framer.website/) · [Figma Sites](https://help.figma.com/hc/en-us/articles/33257143505175-Tips-for-creating-a-responsive-webpage-in-Figma-Sites)
- Motion, Three.js e Lenis têm licença MIT. GSAP tem licença própria gratuita para aplicações comerciais, com condições específicas para ferramentas de autoria visual de animação. O gerador usa CSS nativo para preservar o movimento em prévias isoladas e limitar o volume de código entregue ao visitante. [Motion](https://github.com/motiondivision/motion/blob/main/LICENSE.md) · [Three.js](https://github.com/mrdoob/three.js/blob/dev/LICENSE) · [Lenis](https://github.com/darkroomengineering/lenis/blob/main/LICENSE) · [GSAP](https://gsap.com/community/standard-license/)
- A composição foi revisada com os critérios de hierarquia, identidade e acessibilidade das referências de design pesquisadas, ambas com licença Apache 2.0. [Frontend Design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) · [Impeccable](https://github.com/pbakaus/impeccable)
