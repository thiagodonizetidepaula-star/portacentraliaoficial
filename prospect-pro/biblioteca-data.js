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

window.SITE_TEMPLATES = source.map(([id,label,category,layout,example,headline,summary,serviceList,mainPhoto,accent,bg,ink])=>{
 const related=source.filter(row=>row[2]===category&&row[0]!==id).map(row=>row[8]);
 const photos=[...new Set([mainPhoto,...(referencePhotos[id]||[]),...related])]
  .slice(0,3).map(photo=>`https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1600&q=82`);
 return {
  id,label,category,layout,example,headline,summary,services:serviceList.split('|'),
  photo:photos[0],photos,accent,bg,ink,aliases:segmentAliases[id]||[],
  profile:{...sectorCopy[category],...segmentCopy[id]}
 };
});
