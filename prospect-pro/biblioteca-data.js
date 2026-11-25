// Modelos e referências visuais por segmento.
// Fotografias externas são demonstrativas e precisam ser substituídas por material licenciado antes da entrega.
const source = [
["salao","Salão de beleza","Beleza e bem-estar","editorial","Studio Aurora","Beleza que revela o seu melhor.","Cuidado, expressão e detalhes feitos para cada pessoa.","Corte e finalização|Coloração|Tratamentos capilares","photo-1560066984-138dadb4c035","#b77969","#f6ede7","#241d22"],
["barbearia","Barbearia","Beleza e bem-estar","technical","Barao Barber","Estilo com personalidade.","O seu momento, do primeiro detalhe ao acabamento.","Cortes masculinos|Barba e acabamento|Cuidados pessoais","photo-1503951914875-452162b0f3f1","#d7aa64","#16191d","#ffffff"],
["spa","Spa e massagem","Beleza e bem-estar","serene","Casa Serena","Seu tempo de desacelerar.","Experiências de cuidado em um ambiente de tranquilidade.","Massagens relaxantes|Rituais de bem-estar|Cuidados corporais","photo-1540555700478-4be289fbecef","#8c9273","#f2f1e9","#28352f"],
["estetica","Clínica de estética","Beleza e bem-estar","catalog","Essenza Estética","Sua beleza, sua essência.","Tratamentos e experiências pensados para valorizar sua individualidade.","Avaliação estética|Tratamentos faciais|Cuidados corporais","photo-1570172619644-dfd03ed5d881","#bc8f95","#fff4f1","#372935"],
["odontologia","Clínica odontológica","Saúde","serene","Clínica Sorriso","Cuidado que começa com um sorriso.","Atendimento odontológico com clareza, atenção e conforto.","Consultas odontológicas|Limpeza e prevenção|Avaliação de tratamentos","photo-1606811971618-4486d14f3f99","#2e8d95","#f1f9f8","#17383d"],
["clinica","Clínica médica","Saúde","corporate","Clínica Horizonte","Sua saúde merece atenção.","Uma experiência de atendimento centrada nas pessoas.","Consultas|Acompanhamento de saúde|Orientação preventiva","photo-1559839734-2b71ea197ec2","#2879a2","#eff7fc","#172f44"],
["fisioterapia","Fisioterapia","Saúde","serene","Movimento Vivo","Mais movimento em cada etapa.","Acompanhamento com atenção à sua rotina e aos seus objetivos.","Avaliação funcional|Fisioterapia|Orientação de movimentos","photo-1571019614242-c5c5dee9f50b","#66917a","#f4f7ee","#203b31"],
["psicologia","Psicologia","Saúde","editorial","Espaço Escuta","Um espaço para você.","Acolhimento e escuta em uma jornada de cuidado.","Psicoterapia individual|Acompanhamento|Atendimento agendado","photo-1499209974431-9dddcece7f88","#947d90","#f9f2f7","#302536"],
["nutricao","Nutrição","Saúde","artisan","Nutri Essência","Comer bem faz parte de viver.","Orientação nutricional que respeita sua rotina.","Consulta nutricional|Planejamento alimentar|Acompanhamento","photo-1490645935967-10de6ba17061","#78935d","#f8f6ed","#36412b"],
["veterinaria","Clínica veterinária","Pets","serene","Vida Animal","Carinho e cuidado com seu melhor amigo.","Atenção veterinária com respeito a cada animal.","Consultas veterinárias|Cuidados preventivos|Orientações para tutores","photo-1517849845537-4d257902454a","#4d907d","#f2f8f5","#263d37"],
["petshop","Pet shop","Pets","kinetic","Pata & Cia","Tudo para quem faz parte da família.","Produtos, serviços e carinho para o dia a dia do seu pet.","Banho e tosa|Produtos para pets|Acessórios","photo-1583337130417-3346a1be7dee","#ee8750","#fff5ec","#403126"],
["hamburgueria","Hamburgueria","Gastronomia","immersive","Brasa Burger","O sabor que faz você voltar.","Hambúrgueres artesanais, combinações marcantes e uma experiência feita para reunir.","Hambúrgueres especiais|Combos e acompanhamentos|Pedidos e retirada","photo-1568901346375-23c9450c58cd","#e3ac63","#231810","#fff8ee"],
["restaurante","Restaurante","Gastronomia","immersive","Mesa & Brasa","Sabores que viram encontros.","Uma experiência feita para reunir e surpreender à mesa.","Pratos da casa|Almoço e jantar|Reservas e eventos","photo-1517248135467-4c7edcad34c4","#e8bd82","#261911","#fff9f1"],
["pizzaria","Pizzaria","Gastronomia","immersive","Forno 72","A pizza que reúne todo mundo.","Massa, forno e bons momentos em cada fatia.","Pizzas tradicionais|Pizzas especiais|Pedidos e retirada","photo-1579751626657-72bc17010498","#e7a14d","#301b16","#fff3e6"],
["cafeteria","Cafeteria","Gastronomia","artisan","Café da Esquina","Um café muda o ritmo do dia.","Aroma, conversa e pequenas pausas que fazem bem.","Cafés especiais|Doces e sobremesas|Salgados artesanais","photo-1442512595331-e89e73853f31","#ad7750","#f4e9d9","#3b2b23"],
["padaria","Padaria artesanal","Gastronomia","artisan","Pão de Casa","Feito com tempo. Feito com carinho.","O prazer dos sabores de sempre, preparados com dedicação.","Pães especiais|Confeitaria|Café da manhã","photo-1509440159596-0249088772ff","#ad744b","#fcf5e7","#483124"],
["hotelaria","Hotel e pousada","Hospitalidade e turismo","immersive","Pousada Maré","Seu lugar para ficar.","Conforto, tranquilidade e um convite para aproveitar cada instante.","Hospedagem|Acomodações|Informações de reserva","photo-1566073771259-6a8506099945","#d7c3a1","#283b47","#ffffff"],
["turismo","Agência de viagens","Hospitalidade e turismo","catalog","Rota Viva","Sua próxima história começa aqui.","Experiências e destinos feitos para ampliar horizontes.","Roteiros personalizados|Pacotes de viagem|Orientações para viajar","photo-1488646953014-85cb44e25828","#d69d59","#edf6f8","#193d53"],
["imobiliaria","Imobiliária","Casa e imóveis","catalog","Nexo Imóveis","Encontre o seu próximo lugar.","Uma seleção de imóveis e atendimento para cada etapa da sua escolha.","Compra de imóveis|Locação|Avaliação imobiliária","photo-1600607687920-4e2a09cf159d","#b7956a","#f3f1ed","#282a2c"],
["arquitetura","Arquitetura","Casa e imóveis","editorial","Linha Arquitetura","Espaços que contam histórias.","Arquitetura autoral para viver, criar e pertencer.","Projetos arquitetônicos|Reformas|Projetos comerciais","photo-1600566753190-17f0baa2a6c3","#a58467","#f0eee9","#292623"],
["interiores","Design de interiores","Casa e imóveis","serene","Ateliê Forma","O extraordinário está nos detalhes.","Ambientes pensados para refletir sua maneira de viver.","Projetos de interiores|Consultoria de ambientes|Curadoria de decoração","photo-1600210492486-724fe5c67fb0","#9a8068","#f8f5ef","#383029"],
["construcao","Construção e reformas","Casa e imóveis","technical","Estrutura Obras","Projetos firmes. Resultados reais.","Obras e reformas com planejamento e acompanhamento.","Reformas residenciais|Construção|Manutenção predial","photo-1504307651254-35680f356dfd","#e5aa54","#202c34","#ffffff"],
["moveis","Móveis e decoração","Casa e imóveis","catalog","Casa Autoral","Design para morar melhor.","Peças e composições que traduzem identidade.","Móveis para ambientes|Decoração|Composições personalizadas","photo-1555041469-a586c61ea9bc","#9e845e","#f2f1e8","#303329"],
["oficina","Oficina mecânica","Automotivo","technical","Torque Garage","Seu carro em boas mãos.","Serviços automotivos com diagnóstico e atenção aos detalhes.","Revisões|Manutenção mecânica|Diagnóstico automotivo","photo-1489824904134-891ab64532f1","#f0a23b","#18212b","#ffffff"],
["esteticaauto","Estética automotiva","Automotivo","kinetic","Black Detail","Cada detalhe faz diferença.","Limpeza e acabamento para valorizar seu veículo.","Higienização|Polimento|Detalhamento automotivo","photo-1503376780353-7e6692767b70","#c4d1d9","#14202d","#f7fafc"],
["contabilidade","Escritório contábil","Serviços profissionais","corporate","Veritas Contábil","Clareza para suas decisões.","Organização contábil e suporte para a rotina de negócios.","Contabilidade empresarial|Obrigações fiscais|Apoio à gestão","photo-1460925895917-afdab827c52f","#436fa7","#f1f6fb","#1b2d45"],
["advocacia","Advocacia","Serviços profissionais","corporate","Almeida Advocacia","Estratégia. Técnica. Confiança.","Atendimento jurídico pautado em responsabilidade e atenção.","Consultoria jurídica|Análise de contratos|Atendimento consultivo","photo-1589829545856-d10d557cf95f","#a98763","#1d2837","#ffffff"],
["consultoria","Consultoria empresarial","Serviços profissionais","corporate","Norte Consultoria","Decisões com direção.","Estratégia e organização para empresas em evolução.","Diagnóstico empresarial|Planejamento|Processos e gestão","photo-1454165804606-c3d57bc86b40","#6d8cab","#f2f5fa","#1b3045"],
["logistica","Transportes e logística","Serviços profissionais","technical","Rota Log","Movendo negócios para frente.","Soluções operacionais para conectar origem e destino.","Transporte|Gestão de entregas|Soluções logísticas","photo-1586528116311-ad8dd3c8310d","#ed8a47","#162a35","#ffffff"],
["tecnologia","Tecnologia e software","Tecnologia e comércio","kinetic","Orbit Tech","Tecnologia que faz acontecer.","Produtos digitais sob medida para desafios reais.","Desenvolvimento web|Sistemas personalizados|Integrações","photo-1498050108023-c5249f4df085","#7c87ff","#101b35","#ffffff"],
["ecommerce","Loja virtual","Tecnologia e comércio","catalog","Coletivo Shop","Descubra o seu próximo favorito.","Produtos selecionados para uma compra simples e inspiradora.","Catálogo digital|Novidades|Atendimento","photo-1472851294608-062f824d29cc","#bb778f","#fcf5f7","#322a36"],
["moda","Loja de moda","Moda e criatividade","editorial","Maison 24","Viva a sua assinatura.","Estilo para momentos, ideias e novas versões de você.","Coleção atual|Peças selecionadas|Atendimento","photo-1483985988355-763728e1935b","#a37d69","#f5f0ed","#242123"],
["fotografia","Fotografia","Moda e criatividade","catalog","Luz Fotografia","Histórias em cada imagem.","Ensaios e registros que valorizam o que importa.","Ensaios individuais|Eventos|Fotografia comercial","photo-1542038784456-1ea8e935640e","#e2c7a8","#161717","#ffffff"],
["eventos","Eventos e cerimonial","Moda e criatividade","editorial","Essência Eventos","Momentos com significado.","Planejamento e cuidado para celebrar o que é único.","Planejamento de eventos|Cerimonial|Coordenação de celebrações","photo-1511795409834-ef04bbd61622","#b98d9c","#f7f0f2","#40313a"],
["floricultura","Floricultura","Moda e criatividade","artisan","Flora Atelier","Flores para dizer mais.","Arranjos que transformam gestos em lembranças.","Buquês|Arranjos personalizados|Presentes florais","photo-1490750967868-88aa4486c946","#898e65","#f8f5ed","#38402e"],
["educacao","Escola e cursos","Educação e esportes","kinetic","Prisma Escola","Aprender abre caminhos.","Uma experiência educacional para descobrir novas possibilidades.","Cursos|Atividades|Informações de matrícula","photo-1503676260728-1c00da094a0b","#586ecb","#f1f5fc","#1d315b"],
["academia","Academia e fitness","Educação e esportes","kinetic","Forma Ativa","O próximo passo é seu.","Treino, energia e movimento em um só lugar.","Musculação|Treinamento funcional|Aulas em grupo","photo-1534438327276-14e5300c3a48","#d0f95b","#17211b","#ffffff"],
["farmacia","Farmácia","Saúde","corporate","VidaFarma","Cuidado no dia a dia.","Produtos e atendimento para sua rotina de bem-estar.","Medicamentos e cuidados|Higiene pessoal|Orientações de atendimento","photo-1576091160399-112ba8d25d1d","#3a9ca8","#f1f9fa","#243748"]
];
const segmentAliases = {
 salao:['salão','cabeleireir','hair salon','manicure','esmalteria','nail studio'],
 barbearia:['barbear','barber','corte masculino'],
 spa:['spa','massagem','massoterap'],
 estetica:['estética','sobrancelha','depilação','esteticista'],
 odontologia:['odonto','dentista','ortodont'],
 clinica:['clínica','médic','hospital','pediatria'],
 fisioterapia:['fisioterap','pilates'],
 psicologia:['psicolog','psicoterap','terapia'],
 nutricao:['nutrição','nutricion'],
 veterinaria:['veterinár'],
 petshop:['pet shop','petshop','banho e tosa'],
 hamburgueria:['hambúrg','burger'],
 restaurante:['restaurante','churrasc','lanchonete','sushi','bistrô'],
 pizzaria:['pizza'],
 cafeteria:['café','cafeteria','coffee shop'],
 padaria:['padaria','panifica','confeitaria','bakery'],
 hotelaria:['hotel','pousada','hospedagem'],
 turismo:['turismo','viagem','viagens'],
 imobiliaria:['imobiliár','imóveis','corretor de imóveis'],
 arquitetura:['arquitet'],
 interiores:['design de interiores','designer de interiores','projeto de interiores'],
 construcao:['construção','reforma','empreiteir'],
 moveis:['móveis','marcenaria','decoração'],
 oficina:['oficina','mecânica','auto center'],
 esteticaauto:['estética auto','lava rápido','detalhamento auto','higienização automotiva'],
 contabilidade:['contábil','contabilidade','contador'],
 advocacia:['advocac','advog','jurídic'],
 consultoria:['consultoria','consultor empresarial'],
 logistica:['logístic','transportad','frete','transporte'],
 tecnologia:['tecnologi','software','desenvolvimento web','informática'],
 ecommerce:['ecommerce','e commerce','loja virtual'],
 moda:['loja de roupa','moda','boutique','vestuário'],
 fotografia:['fotógraf','fotografia','estúdio fotográfico'],
 eventos:['eventos','cerimonial','buffet'],
 floricultura:['floricultur','flores','florista'],
 educacao:['escola','curso','colégio','ensino','educação'],
 academia:['academia','fitness','crossfit','musculação'],
 farmacia:['farmáci','drogaria']
};

const referencePhotos = {
 salao:['photo-1522335789203-aabd1fc54bc9','photo-1512290923902-8a9f81dc236c'],
 barbearia:['photo-1599351431202-1e0f0137899a','photo-1621605815971-fbc98d665033'],
 spa:['photo-1512290923902-8a9f81dc236c','photo-1570172619644-dfd03ed5d881'],
 estetica:['photo-1512290923902-8a9f81dc236c','photo-1522335789203-aabd1fc54bc9'],
 clinica:['photo-1576091160399-112ba8d25d1d','photo-1551076805-e1869033e561'],
 odontologia:['photo-1551076805-e1869033e561','photo-1576091160399-112ba8d25d1d'],
 hamburgueria:['photo-1550547660-d9450f859349','photo-1571091718767-18b5b1457add'],
 restaurante:['photo-1552566626-52f8b828add9','photo-1555396273-367ea4eb4db5'],
 pizzaria:['photo-1513104890138-7c749659a591','photo-1574071318508-1cdbab80d002'],
 cafeteria:['photo-1501339847302-ac426a4a7cbb','photo-1509042239860-f550ce710b93'],
 imobiliaria:['photo-1600566753086-00f18fb6b3ea','photo-1600585154340-be6161a56a0c'],
 arquitetura:['photo-1600607687920-4e2a09cf159d','photo-1600566753086-00f18fb6b3ea'],
 oficina:['photo-1485291571150-772bcfc10da5','photo-1517524206127-48bbd363f3d7'],
 esteticaauto:['photo-1517524206127-48bbd363f3d7','photo-1486496572940-2bb2341fdbdf'],
 advocacia:['photo-1505664194779-8beaceb93744','photo-1497366811353-6870744d04b2'],
 contabilidade:['photo-1497366754035-f200968a6e72','photo-1497366811353-6870744d04b2'],
 consultoria:['photo-1497366811353-6870744d04b2','photo-1497366754035-f200968a6e72'],
 academia:['photo-1517836357463-d25dfeac3438','photo-1571019614242-c5c5dee9f50b'],
 educacao:['photo-1427504494785-3a9ca7044f45','photo-1523240795612-9a054b0db644'],
 veterinaria:['photo-1583337130417-3346a1be7dee','photo-1548199973-03cce0bbc87b'],
 petshop:['photo-1548199973-03cce0bbc87b','photo-1517849845537-4d257902454a'],
 hotelaria:['photo-1571896349842-33c89424de2d','photo-1564501049412-61c2a3083791'],
 turismo:['photo-1469474968028-56623f02e42e','photo-1476514525535-07fb3b4ae5f1'],
 farmacia:['photo-1587854692152-cbe660dbde88','photo-1471864190281-a93a3070b6de'],
 tecnologia:['photo-1555066931-4365d14bab8c','photo-1518770660439-4636190af475'],
 ecommerce:['photo-1556742049-0cfed4f6a45d','photo-1607082348824-0a96f2a4b9da'],
 fotografia:['photo-1516035069371-29a1b244cc32','photo-1452780212940-6f5c0d14d848']
};

const sectorCopy = {
 'Beleza e bem-estar': {
  experience:'Reserve um momento para se cuidar.', practical:'Encontre o atendimento que procura.',
  services:'Cuidados e serviços', action:'Consultar horários', story:'Tire dúvidas sobre o atendimento e encontre um horário que combine com a sua rotina.'
 },
 Saúde: {
  experience:'Cuidado em cada etapa do atendimento.', practical:'Dê o próximo passo no seu cuidado.',
  services:'Áreas de atendimento', action:'Informações de atendimento', story:'Peça informações sobre modalidades de atendimento, horários e orientações para a primeira visita.'
 },
 Pets: {
  experience:'Cuidado para quem faz parte da família.', practical:'Encontre o que seu pet precisa.',
  services:'Serviços para pets', action:'Consultar disponibilidade', story:'Conte o que seu pet precisa para saber quais serviços estão disponíveis e como funciona o atendimento.'
 },
 Gastronomia: {
  experience:'O próximo encontro tem sabor.', practical:'Escolha o que provar hoje.',
  services:'Opções da casa', action:'Consultar opções', story:'Fale com a casa para conhecer as opções disponíveis e planejar o próximo pedido ou visita.'
 },
 'Hospitalidade e turismo': {
  experience:'Viaje com tempo para aproveitar.', practical:'Planeje sua próxima viagem.',
  services:'Opções para sua viagem', action:'Consultar disponibilidade', story:'Compartilhe as datas e o que você procura para descobrir as opções e condições disponíveis.'
 },
 'Casa e imóveis': {
  experience:'Um novo olhar para o seu espaço.', practical:'Tire sua ideia do papel.',
  services:'Como podemos ajudar', action:'Conversar sobre o projeto', story:'Conte o que você busca para conversar sobre possibilidades, etapas e próximos passos.'
 },
 Automotivo: {
  experience:'Atenção ao seu carro em cada detalhe.', practical:'Saiba o que fazer pelo seu veículo.',
  services:'Serviços para seu veículo', action:'Consultar atendimento', story:'Informe o modelo do veículo e o que ele está precisando antes de combinar um atendimento.'
 },
 'Serviços profissionais': {
  experience:'Entenda suas opções com clareza.', practical:'Converse sobre o que você precisa.',
  services:'Áreas de atuação', action:'Conversar sobre atendimento', story:'Explique sua situação para conhecer as opções de atendimento e combinar os próximos passos.'
 },
 'Tecnologia e comércio': {
  experience:'Explore o que funciona para você.', practical:'Encontre o próximo passo para sua ideia.',
  services:'Soluções e serviços', action:'Solicitar informações', story:'Entre em contato para entender as opções disponíveis e esclarecer seus requisitos.'
 },
 'Moda e criatividade': {
  experience:'Ideias para momentos que importam.', practical:'Encontre a opção que combina com você.',
  services:'O que você encontra aqui', action:'Consultar opções', story:'Conte a ocasião ou o que você está procurando para receber informações sobre as opções disponíveis.'
 },
 'Educação e esportes': {
  experience:'Toda jornada começa com um passo.', practical:'Encontre uma atividade para você.',
  services:'Atividades e modalidades', action:'Consultar turmas e horários', story:'Pergunte sobre atividades, horários e condições para começar.'
 }
};

const segmentCopy = {
 salao:{experience:'Seu próximo visual começa com uma conversa.', practical:'Escolha como cuidar do seu cabelo.'},
 barbearia:{experience:'Do corte à barba, encontre o seu estilo.', practical:'Combine seu próximo corte.'},
 odontologia:{experience:'Converse sobre os cuidados com seu sorriso.', practical:'Informações para sua próxima consulta odontológica.'},
 restaurante:{experience:'Sua próxima boa conversa começa à mesa.', practical:'Conheça as opções para sua próxima refeição.'},
 hamburgueria:{experience:'Abra o apetite para o próximo burger.', practical:'Encontre seu próximo hambúrguer.'},
 pizzaria:{experience:'O próximo encontro pede pizza.', practical:'Escolha o sabor da vez.'},
 cafeteria:{experience:'Uma pausa com aroma de café.', practical:'Descubra o que acompanha seu café.'},
 padaria:{experience:'O dia começa com cheiro de pão.', practical:'Descubra as opções da padaria.'},
 hotelaria:{experience:'Sinta-se em casa em outro lugar.', practical:'Consulte acomodações para a sua estadia.'},
 imobiliaria:{experience:'Imagine seu próximo endereço.', practical:'Encontre imóveis para comprar ou alugar.'},
 fotografia:{experience:'Fotografias para guardar o que importa.', practical:'Planeje seu próximo ensaio.', action:'Consultar disponibilidade'},
 advocacia:{experience:'Entenda as possibilidades para sua situação.', practical:'Conheça as áreas de atendimento jurídico.'},
 contabilidade:{experience:'Organização para o dia a dia da empresa.', practical:'Encontre apoio para sua rotina contábil.'},
 academia:{experience:'Movimento no seu próprio ritmo.', practical:'Conheça as modalidades e programe seu treino.'},
 farmacia:{experience:'Apoio para seus cuidados do dia a dia.', practical:'Consulte produtos e atendimento.', action:'Consultar disponibilidade'}
};

const sectorEditorial = {
 'Beleza e bem-estar': {
  art:'salon',contact:'Combine seu atendimento',
  planning:'Antes de agendar',ask:'Quero saber quais opções de atendimento e horários estão disponíveis.'
 },
 Saúde: {
  art:'care',contact:'Informações de atendimento',
  planning:'Antes da primeira visita',ask:'Gostaria de saber como funciona o atendimento e quais são os horários disponíveis.'
 },
 Pets: {
  art:'pet',contact:'Fale sobre o seu pet',
  planning:'Prepare o atendimento do seu pet',ask:'Gostaria de informações sobre os serviços e a disponibilidade para o meu pet.'
 },
 Gastronomia: {
  art:'food',contact:'Consulte a casa',
  planning:'Planeje seu pedido ou visita',ask:'Gostaria de consultar o cardápio e saber como fazer um pedido ou planejar uma visita.'
 },
 'Hospitalidade e turismo': {
  art:'editorial',contact:'Consulte as opções para sua viagem',
  planning:'Planeje sua viagem',ask:'Gostaria de saber quais opções estão disponíveis para as minhas datas.'
 },
 'Casa e imóveis': {
  art:'architect',contact:'Conte o que você procura',
  planning:'Prepare a conversa sobre seu espaço',ask:'Gostaria de explicar o que estou buscando e saber como funciona o atendimento.'
 },
 Automotivo: {
  art:'workshop',contact:'Fale sobre seu veículo',
  planning:'Antes de levar o veículo',ask:'Gostaria de conversar sobre o serviço que meu veículo precisa e consultar horários.'
 },
 'Serviços profissionais': {
  art:'practice',contact:'Converse sobre o atendimento',
  planning:'Prepare o primeiro contato',ask:'Gostaria de explicar o que preciso e entender como funciona o atendimento.'
 },
 'Tecnologia e comércio': {
  art:'modern',contact:'Peça informações',
  planning:'Esclareça suas dúvidas',ask:'Gostaria de saber mais sobre as opções disponíveis e como funciona o atendimento.'
 },
 'Moda e criatividade': {
  art:'creative',contact:'Conte o que você tem em mente',
  planning:'Planeje o que está procurando',ask:'Gostaria de falar sobre o que estou procurando e saber quais opções estão disponíveis.'
 },
 'Educação e esportes': {
  art:'academy',contact:'Consulte atividades e horários',
  planning:'Prepare seu primeiro encontro',ask:'Gostaria de informações sobre atividades, horários e como começar.'
 }
};

const segmentEditorial = {
 barbearia:{art:'barber',contact:'Combine seu próximo corte',planning:'Antes de sentar na cadeira',ask:'Quero saber quais opções de corte ou barba estão disponíveis e consultar horários.'},
 salao:{contact:'Planeje seu próximo atendimento',planning:'Antes de ir ao salão'},
 odontologia:{contact:'Informações para sua consulta',planning:'Prepare sua consulta odontológica'},
 veterinaria:{contact:'Informações para seu pet',planning:'Antes da consulta veterinária'},
 hamburgueria:{art:'counter',contact:'Confira os burgers disponíveis',planning:'Antes de pedir',ask:'Gostaria de consultar os burgers disponíveis e as condições para pedir.'},
 pizzaria:{art:'oven',contact:'Consulte sabores e pedidos',planning:'Antes de escolher a pizza',ask:'Gostaria de consultar os sabores disponíveis e saber como fazer meu pedido.'},
 cafeteria:{art:'coffee',contact:'Planeje sua próxima visita',planning:'Antes de passar para um café',ask:'Gostaria de saber sobre as opções da cafeteria e os horários para visitar.'},
 padaria:{art:'coffee',contact:'Consulte as opções da padaria',planning:'Antes de passar na padaria'},
 hotelaria:{contact:'Consulte vagas para sua estadia',planning:'Antes de reservar',ask:'Gostaria de consultar acomodações e valores para as datas da minha estadia.'},
 imobiliaria:{contact:'Fale sobre o imóvel que procura',planning:'Prepare sua busca por imóveis',ask:'Gostaria de conversar sobre o imóvel que procuro e saber quais opções estão disponíveis.'},
 academia:{art:'training',contact:'Consulte modalidades e horários',planning:'Antes do primeiro treino'},
 fotografia:{art:'editorial',contact:'Planeje seu próximo ensaio',planning:'Antes de marcar a sessão',ask:'Gostaria de conversar sobre uma sessão de fotos e consultar possibilidades.'},
 farmacia:{contact:'Consulte produtos e atendimento',planning:'Antes de visitar a farmácia'}
};

const serviceGuidance = {
 salao:['Pergunte pelas opções para seu tipo de cabelo e a duração prevista do atendimento.','Consulte a técnica indicada, o tempo de atendimento e os cuidados depois da coloração.','Conte o que você busca para avaliar as opções de tratamento e manutenção.'],
 barbearia:['Leve uma referência do estilo ou peça orientação sobre o comprimento e a finalização.','Pergunte sobre alinhamento, contorno e tempo de atendimento para a barba.','Consulte quais cuidados complementares estão disponíveis na barbearia.'],
 spa:['Consulte tipos de massagem, duração e orientações antes de agendar.','Pergunte sobre as etapas de cada opção e o tempo reservado para a sessão.','Confirme os cuidados indicados para o que você está procurando.'],
 estetica:['Converse sobre seu objetivo e confirme como funciona a avaliação inicial.','Peça informações sobre indicações, preparo prévio e cuidados posteriores.','Pergunte quais procedimentos são avaliados para o seu caso.'],
 odontologia:['Confirme as informações para agendar e o que levar à consulta.','Pergunte como funciona a avaliação preventiva e os cuidados de rotina.','Converse sobre dúvidas, etapas e opções a avaliar com o profissional.'],
 clinica:['Confirme especialidades, horários e informações para agendar.','Pergunte sobre orientações de retorno e documentos úteis para a consulta.','Converse com o atendimento sobre orientações e encaminhamentos disponíveis.'],
 fisioterapia:['Informe sua necessidade para saber como funciona a avaliação.','Converse sobre o objetivo do atendimento e a disponibilidade para sessões.','Pergunte como são orientados movimentos e cuidados entre sessões.'],
 psicologia:['Confirme disponibilidade e modalidade para a primeira conversa.','Pergunte sobre horários e como combinar a continuidade do atendimento.','Consulte as informações práticas para marcar uma sessão.'],
 nutricao:['Pergunte o que levar e como se preparar para a primeira consulta.','Conte sobre seus hábitos e objetivos para conversar sobre o planejamento.','Converse sobre disponibilidade para retorno e acompanhamento.'],
 veterinaria:['Informe a espécie, idade e motivo do atendimento ao consultar horários.','Pergunte quais cuidados de rotina podem ser discutidos na avaliação.','Consulte o que levar e como preparar seu pet para a visita.'],
 petshop:['Informe o porte e o tipo de pelagem ao consultar opções de banho e tosa.','Pergunte pela disponibilidade dos produtos de rotina do seu pet.','Confirme medidas e opções de acessórios para o porte do animal.'],
 hamburgueria:['Consulte os hambúrgueres disponíveis, ingredientes e opções adicionais.','Confira como montar o pedido com bebidas e acompanhamentos.','Pergunte sobre horários, áreas de entrega e condições de retirada.'],
 restaurante:['Consulte os pratos, ingredientes e eventuais opções do dia.','Confirme os horários e a disponibilidade para o período desejado.','Pergunte com antecedência sobre datas, número de pessoas e condições.'],
 pizzaria:['Confira sabores, tamanhos e ingredientes das opções tradicionais.','Pergunte quais combinações e sabores especiais estão disponíveis.','Consulte o horário e as condições de entrega ou retirada antes de pedir.'],
 cafeteria:['Pergunte pelos cafés e preparos disponíveis no dia.','Consulte as opções de vitrine e informe possíveis restrições alimentares.','Confira o que está disponível para acompanhar o seu café.'],
 padaria:['Consulte os tipos de pão e horários em que costumam ficar prontos.','Pergunte pelos itens da vitrine e pelas condições para encomendar.','Confira o horário e as opções para o café da manhã.'],
 hotelaria:['Consulte datas, quantidade de hóspedes e condições da hospedagem.','Pergunte pelas categorias, configurações de quarto e itens incluídos.','Confirme horários de entrada e saída e as condições de reserva.'],
 turismo:['Compartilhe destino, datas e perfil da viagem para conversar sobre o roteiro.','Consulte o que está incluído e a disponibilidade para as datas desejadas.','Confirme documentos, prazos e informações práticas para embarcar.'],
 imobiliaria:['Informe região, faixa de preço e os critérios mais importantes para sua procura.','Converse sobre prazo para mudança, tipo de imóvel e condições de locação.','Pergunte quais dados são necessários para conversar sobre a avaliação.'],
 arquitetura:['Converse sobre o terreno ou espaço, uso do projeto e próximos passos.','Compartilhe a situação atual e o que quer transformar no imóvel.','Apresente a atividade do negócio, o local e as necessidades do espaço.'],
 interiores:['Compartilhe medidas, referências e o uso da área que deseja transformar.','Conte quais decisões de ambiente precisam de orientação.','Informe o estilo desejado e os itens que pretende manter.'],
 construcao:['Descreva o imóvel e as mudanças desejadas para conversar sobre escopo.','Informe onde será a obra, em que etapa está e qual o objetivo.','Descreva os pontos que precisam de manutenção e confirme a disponibilidade.'],
 moveis:['Informe medidas e o uso do ambiente ao consultar opções de móveis.','Compartilhe referências de estilo e o que precisa para o espaço.','Converse sobre medidas, materiais e prazo antes de decidir.'],
 oficina:['Informe modelo, ano e quilometragem do veículo antes de consultar a revisão.','Descreva o problema percebido e desde quando ele acontece.','Informe sintomas, avisos do painel e situações em que o problema aparece.'],
 esteticaauto:['Consulte o processo indicado conforme o estado dos tecidos e superfícies.','Informe o estado da pintura e o acabamento que você procura.','Converse sobre as áreas do veículo que precisam de cuidado.'],
 contabilidade:['Informe tipo de atividade, porte da empresa e necessidades da rotina contábil.','Converse sobre regime e prazos que precisam de atenção.','Descreva os controles e relatórios que precisa organizar.'],
 advocacia:['Explique o assunto e confirme a área e a forma de atendimento.','Informe o tipo de documento e se há prazo relacionado.','Pergunte quais informações são necessárias para a primeira conversa.'],
 consultoria:['Conte sobre o desafio atual e os processos que deseja entender melhor.','Indique objetivos, prioridades e prazos para conversar sobre o planejamento.','Compartilhe as áreas da operação que precisam de revisão.'],
 logistica:['Informe origem, destino, volume e prazo antes de solicitar condições.','Conte a frequência e os locais das entregas que precisam de organização.','Apresente as etapas da operação que precisam de suporte.'],
 tecnologia:['Descreva a finalidade do site, o público e as funcionalidades necessárias.','Explique o processo atual e o que pretende resolver com o sistema.','Liste as ferramentas e as informações que precisam trocar dados.'],
 ecommerce:['Consulte categorias, disponibilidade e condições de compra.','Pergunte pelos produtos ou coleções com novidades.','Confirme dúvidas sobre compra, formas de entrega e troca.'],
 moda:['Pergunte pelas peças e pelos tamanhos disponíveis.','Informe a ocasião ou o estilo da peça que procura.','Consulte disponibilidade, condições de troca e horários para visitar.'],
 fotografia:['Informe a finalidade do ensaio, local e possíveis datas.','Conte o tipo de evento, data, duração e local.','Compartilhe o produto, a campanha e os formatos de imagem que precisa.'],
 eventos:['Informe data, local e número estimado de convidados.','Converse sobre as etapas e o tipo de acompanhamento desejado.','Compartilhe fornecedores e pontos do cronograma que precisam de coordenação.'],
 floricultura:['Informe a ocasião, as cores escolhidas e a data de entrega desejada.','Pergunte pelas flores disponíveis e pelas possibilidades de composição.','Consulte valores, mensagem para o cartão e condições de retirada ou entrega.'],
 educacao:['Consulte nível, conteúdo e disponibilidade de turmas.','Pergunte sobre faixa etária, duração e materiais necessários.','Confirme documentação, datas e condições para matrícula.'],
 academia:['Consulte horários, estrutura e orientações para iniciar a musculação.','Pergunte por horários de treino e como funciona a orientação inicial.','Consulte grade, duração e disponibilidade das aulas.'],
 farmacia:['Consulte disponibilidade, apresentação e condições para compra.','Pergunte pelas categorias e pelos produtos de higiene disponíveis.','Confirme horários, canais de atendimento e informações para sua visita.']
};

// Catálogo interno de referências Pexels, sem interface pública de acervo.
 // IDs de páginas de fotografias consultadas; uso em sites, não revenda de fotos.
 const extraSegmentAliases={"salao":["salões de beleza","salões","cabeleireiros","cabeleireiras","beauty salon","beauty salons","hairdresser","hair studio","beauty studio","beauty"],"barbearia":["barbearias","barbershop","barber shop"],"petshop":["pet shops","petshops","pet store","pet center","lojas de animais"],"veterinaria":["veterinários","clínicas veterinárias","vet clinic"],"oficina":["oficinas mecânicas","oficinas","mecânicos","auto repair"],"esteticaauto":["estéticas automotivas","estética automotiva","car detailing"],"estetica":["clínicas de estética","centro de estética"],"odontologia":["clínicas odontológicas","dentistas"],"clinica":["clínicas médicas"],"farmacia":["farmácias","drogarias"],"restaurante":["restaurantes","restaurants"],"hamburgueria":["hamburguerias"],"pizzaria":["pizzarias"],"cafeteria":["cafeterias","coffee shops"],"padaria":["padarias"],"imobiliaria":["imobiliárias"],"construcao":["construtoras","construções"],"contabilidade":["escritórios de contabilidade","serviços contábeis"],"advocacia":["escritórios de advocacia","advogados"],"logistica":["transportadoras","transportes"],"academia":["academias"],"educacao":["escolas","colégios"],"moda":["lojas de roupas","lojas de vestuário"],"floricultura":["floriculturas"],"hotelaria":["hotéis","pousadas"],"fotografia":["fotógrafos","estúdios fotográficos"],"eventos":["buffets"],"moveis":["lojas de móveis"],"tecnologia":["empresas de tecnologia"],"consultoria":["consultorias"]};
 const stockPexels={"petshop":[16395150,35711491,28852102,14770947,6816850,19145883,6131162,4432261,12928244,6130995,6131568],"veterinaria":[7469216,7469234,6604130,6235648,6235226,6235120],"salao":[7440054,4783340,29498301,8834077,3993462,7447128,2799609,36587244,8834095],"barbearia":[7518731,13138585,6599044,6599032],"oficina":[33814735,8985917,33814734,24407415,8985455],"hamburgueria":[6896009,11812583,20652782,9268664,15388329,7497246,1137473],"pizzaria":[35759998,30512710,9685272,5056621,29021745,3343627],"cafeteria":[40025142,34337602,30218902,5864216,8936947,11145283,36729734],"contabilidade":[8297220,33175669,8296948,7651738,6694492,4476375],"logistica":[13532504,14688876,5498230,5156696,6170405,34585120],"restaurante":[15098824,11689797,14646769,20184726,7243889,33991139]};
 const pexelsUrl=id=>'https://images.pexels.com/photos/'+id+'/pexels-photo-'+id+'.jpeg?auto=compress&cs=tinysrgb&w=1400';
 const stockUrl=id=>'https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=1400&q=78';
 const photoKey=url=>String(url||'').split('?')[0];
 const uniquePhotos=urls=>[...new Map(urls.filter(Boolean).map(url=>[photoKey(url),url])).values()];
 const stockPools=Object.fromEntries(source.map(row=>[row[0],uniquePhotos([
 stockUrl(row[8]),...(stockPexels[row[0]]||[]).map(pexelsUrl),...(referencePhotos[row[0]]||[]).map(stockUrl)
 ])]));
 window.ProspectImageLibrary=Object.freeze({
  select(id,identity='',used=new Set(),count=12){
   const pool=stockPools[id]||[];
   const hash=Array.from(String(identity).normalize('NFD').toLowerCase()).reduce((h,c)=>(Math.imul(h,31)+c.charCodeAt(0))>>>0,0);
   const rotate=pool.length?pool.map((_,i)=>pool[(i+hash%pool.length)%pool.length]):[];
   const previous=new Set([...used].map(photoKey));
   return [...rotate.filter(url=>!previous.has(photoKey(url))),...rotate.filter(url=>previous.has(photoKey(url)))].slice(0,count);
  },
  // Partition once for all three proposals. No automatic reuse, even if stock is scarce.
  allocate(id,identity='',real=[],used=new Set()){
   const actual=uniquePhotos(real);
   const actualKeys=new Set(actual.map(photoKey));
   const available=(stockPools[id]||[]).filter(url=>!actualKeys.has(photoKey(url)));
   const hash=Array.from(String(identity).normalize('NFD').toLowerCase()).reduce((h,c)=>(Math.imul(h,31)+c.charCodeAt(0))>>>0,0);
   const rotated=available.length?available.map((_,i)=>available[(i+hash%available.length)%available.length]):[];
   const previous=new Set([...used].map(photoKey));
   const stock=[...rotated.filter(url=>!previous.has(photoKey(url))),...rotated.filter(url=>previous.has(photoKey(url)))];
   const groups=Array.from({length:3},()=>({real:[],stock:[]}));
   actual.forEach((url,i)=>groups[i%3].real.push(url));
   stock.forEach(url=>{
    const index=groups.reduce((best,g,i)=>g.real.length+g.stock.length<groups[best].real.length+groups[best].stock.length?i:best,0);
    groups[index].stock.push(url);
   });
   return groups.map(g=>({...g,photos:[...g.real,...g.stock],cover:g.real[0]||g.stock[0]||''}));
  },
  count:id=>(stockPools[id]||[]).length,
  owners(url){const key=photoKey(url);return Object.keys(stockPools).filter(id=>stockPools[id].some(photo=>photoKey(photo)===key));}
 });
 window.SITE_TEMPLATES = source.map(([id,label,category,layout,example,headline,summary,serviceList,mainPhoto,accent,bg,ink])=>{
 const services=serviceList.split('|');
 const photos=stockPools[id].slice();
 return {
  id,label,category,layout,example,headline,summary,services,
  photo:photos[0],photos,accent,bg,ink,aliases:[...(segmentAliases[id]||[]),...(extraSegmentAliases[id]||[])],
  profile:{
   ...sectorCopy[category],...sectorEditorial[category],...segmentCopy[id],...segmentEditorial[id],
   serviceDescriptions:Object.fromEntries(services.map((service,index)=>[service,serviceGuidance[id]?.[index]||'']))
  }
 };
});

 window.ProspectMatchSegment=function(value){
  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const query=normalize(value);if(!query)return null;
  let best=null,score=0;
  for(const t of window.SITE_TEMPLATES)for(const term of [t.label,...t.aliases]){
    const a=normalize(term);if(!a)continue;
    const exact=query===a,whole=(' '+query+' ').includes(' '+a+' '),prefix=a.length>=5&&!a.includes(' ')&&query.split(' ').some(word=>word.startsWith(a));
    if(!exact&&!whole&&!prefix)continue;
    const rank=(exact?1000:whole?100:10)+a.length;
    if(rank>score){score=rank;best=t;}
  }
  return best;
 };
