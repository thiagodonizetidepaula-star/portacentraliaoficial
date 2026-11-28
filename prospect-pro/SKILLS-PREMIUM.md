# Skills do Prospect PRO

Abra uma sessão do Codex na raiz do repositório ou em `prospect-pro/`. A pasta `.agents/skills/` contém as skills do projeto. A skill `prospect-premium` orienta a geração das propostas e aponta para as referências de movimento e de 3D.

| Origem oficial | Versão revisada | Licença |
| --- | --- | --- |
| [GSAP Skills](https://github.com/greensock/gsap-skills/tree/aed9cfd3277740755f6bfc1155c7aa645403b760) | 8 skills, commit `aed9cfd` | MIT |
| [Emil Kowalski Skills](https://github.com/emilkowalski/skills/tree/64eb3deb9a5fbfa041faf783e0bc3fd635872e9c) | 20 skills, commit `64eb3de` | MIT |
| [img2threejs](https://github.com/img2threejs/img2threejs/tree/0c0c49bc168e648dbaf9c8c080474de0b3a941b6) | v2.0.1, commit `0c0c49b` | Apache-2.0 |

As cópias do GSAP e do Emil já acompanham o repositório. As revisões completas e os hashes foram registrados em `skills-lock.json` pelo instalador `skills@1.9.1` da Vercel. Os avisos MIT estão junto às cópias. A instalação foi feita com Node.js 24 e Git. O instalador da Vercel requer Node.js 22.20 ou superior.

Em outro checkout, execute `bash prospect-pro/scripts/install-img2threejs.sh` na raiz do repositório e abra outra sessão do Codex. O comando restaura a cópia oficial fixada que o link do projeto aponta, seguindo a instalação manual com uma cópia e um link simbólico. O CLI oficial `img2threejs@0.2.0` usa a pasta pessoal quando instala globalmente. As ferramentas de reconstrução usam a biblioteca padrão do Python 3.10 ou superior. [Documentação oficial do img2threejs](https://github.com/img2threejs/img2threejs/blob/main/docs/INSTALL.md#5-manual-install-no-cli)

## Geração visual

Em `prospect-pro/`, `npm ci` instala as dependências fixadas. `npm run build:premium-art` regenera `studio-premium-art.js`. O Three.js 0.187.0 (MIT) projeta a geometria dos painéis em SVG e o GSAP 3.15.1 (Standard License) gera os quadros CSS da abertura. As bibliotecas são dependências de desenvolvimento. O HTML da proposta recebe os dados visuais gerados, CSS responsivo e animações nativas de rolagem. O efeito 3D é uma projeção ilustrativa e é usado no segmento solar quando a abertura está sem fotografia. [Licença do GSAP](https://gsap.com/standard-license/)

As prévias continuam sujeitas à sandbox e à política de segurança existentes. O HTML é legível com movimento reduzido, com a opção Sem animação e em navegadores sem suporte às animações vinculadas à rolagem. O uso de img2threejs para reconstruir uma fotografia é uma etapa de autoria. O fluxo automático usa um modelo procedural previamente preparado.

## Demonstrações locais

Suba `npm start` em `prospect-pro/` sem chaves de serviços. Com Playwright e Chromium disponíveis, execute `node scripts/generate-premium-demos.mjs http://127.0.0.1:3000 /tmp/prospect-demos` no mesmo diretório. O roteiro usa os formulários do Estúdio para gerar Casa Íris, Brasa Alta e Limiar Solar, baixa os pacotes de revisão e testa as páginas em 390 e 1440 px. Todas as marcas e informações nas demonstrações são fictícias.
