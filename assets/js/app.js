const $=(s)=>document.querySelector(s);
const $$=(s)=>document.querySelectorAll(s);
const BRL=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const NUM=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
function moneyToNumber(v){return Number(String(v||'').replace(/\D/g,''))/100||0}
function maskMoney(el){let n=moneyToNumber(el.value);el.value=n?BRL.format(n):''}
function toast(t){const x=$('#toast');if(!x)return; x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2800)}
function getVal(id){return document.getElementById(id)?.value||''}
function setHtml(id,html){const el=document.getElementById(id);if(el)el.innerHTML=html}
function blockText(id){const el=document.getElementById(id);return el?el.innerText.trim():''}
function mailBlock(id,subject){
  const txt=blockText(id);
  if(!txt){toast('Gere o documento ou relatório primeiro');return}
  const body=encodeURIComponent(txt+'\n\nGerado pela Central IA');
  const sub=encodeURIComponent(subject||'Documento Central IA');
  window.location.href=`mailto:?subject=${sub}&body=${body}`;
}
function downloadText(name,txt){
  if(!txt||!String(txt).trim()){toast('Gere o conteúdo antes de baixar');return}
  const blob=new Blob([txt],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
  toast('Arquivo baixado');
}
function downloadBlock(id,name){downloadText(name,blockText(id))}
function printBlock(id){
  const el=document.getElementById(id);if(!el||!el.innerHTML.trim()){toast('Gere o conteúdo antes de imprimir');return}
  const w=window.open('','_blank','width=900,height=700');
  if(!w){toast('O navegador bloqueou a impressão. Permita pop-ups.');return}
  w.document.open();
  w.document.write(`<html><head><title>Central IA</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;padding:28px;color:#111}h1,h2,h3{margin-top:0}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #ddd;padding:8px;text-align:left}.box{border:1px solid #ddd;border-radius:12px;padding:20px}.brand{font-weight:bold;color:#2563eb;margin-bottom:20px}@media print{button{display:none}}</style></head><body><div class="brand">Central IA</div>${el.innerHTML}</body></html>`);
  w.document.close();w.focus();setTimeout(()=>w.print(),350);
}

function setupMasks(){ $$('.money').forEach(i=>{i.addEventListener('input',()=>maskMoney(i));i.addEventListener('blur',()=>maskMoney(i));}); }
function setupFilters(){
  $$('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{const f=btn.dataset.filter;$$('[data-filter]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');$$('.tool-card').forEach(c=>{c.style.display=(f==='todos'||c.dataset.cat===f)?'flex':'none'});document.getElementById('ferramentas')?.scrollIntoView({behavior:'smooth'});}));
  $('#search')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();$$('.tool-card').forEach(c=>{c.style.display=c.innerText.toLowerCase().includes(q)?'flex':'none'})});
}

function calcFin(){const pv=moneyToNumber(getVal('fin_valor')),juros=Number(getVal('fin_juros').replace(',','.'))/100,n=Number(getVal('fin_prazo'));if(!pv||!n){toast('Preencha valor e prazo');return}let p=juros?pv*(juros*Math.pow(1+juros,n))/(Math.pow(1+juros,n)-1):pv/n;let total=p*n;setHtml('fin_result',`<h3>Resultado do financiamento</h3><p>Parcela estimada: <b>${BRL.format(p)}</b></p><p>Total pago: <b>${BRL.format(total)}</b></p><p>Juros totais: <b>${BRL.format(total-pv)}</b></p><small>Cálculo estimado pela Tabela Price. Consulte sempre a instituição financeira.</small>`)}
function calcLucro(){const custo=moneyToNumber(getVal('lucro_custo')),venda=moneyToNumber(getVal('lucro_venda')),q=Number(getVal('lucro_qtd'))||1;if(!custo||!venda){toast('Preencha custo e venda');return}const lucro=(venda-custo)*q;const margem=(venda-custo)/venda*100;setHtml('lucro_result',`<h3>Resultado</h3><p>Lucro total: <b>${BRL.format(lucro)}</b></p><p>Margem: <b>${NUM.format(margem)}%</b></p><p>Faturamento: <b>${BRL.format(venda*q)}</b></p>`)}
function calcCDI(){const valor=moneyToNumber(getVal('cdi_valor')),pct=Number(getVal('cdi_pct'))||100,dias=Number(getVal('cdi_dias'))||30,cdi=Number(getVal('cdi_taxa').replace(',','.'))/100||.1065;if(!valor){toast('Informe o valor aplicado');return}const bruto=valor*(Math.pow(1+cdi*pct/100,dias/365)-1);let aliquota=dias<=180?.225:dias<=360?.20:dias<=720?.175:.15;let ir=bruto*aliquota;let liquido=bruto-ir;setHtml('cdi_result',`<h3>Rendimento estimado</h3><p>Bruto: <b>${BRL.format(bruto)}</b></p><p>IR estimado: <b>${BRL.format(ir)}</b></p><p>Líquido: <b>${BRL.format(liquido)}</b></p><p>Total final: <b>${BRL.format(valor+liquido)}</b></p><small>Estimativa educativa. Taxas reais variam.</small>`)}

function addCar(){const data=getVal('car_data'),desc=getVal('car_desc'),km=getVal('car_km'),valor=moneyToNumber(getVal('car_valor'));if(!desc||!valor){toast('Informe descrição e valor');return}const arr=JSON.parse(localStorage.getItem('centralia_car')||'[]');arr.push({data,desc,km,valor});localStorage.setItem('centralia_car',JSON.stringify(arr));renderCar();['car_desc','car_km','car_valor'].forEach(id=>document.getElementById(id).value='')}
function renderCar(){const arr=JSON.parse(localStorage.getItem('centralia_car')||'[]');const total=arr.reduce((s,i)=>s+i.valor,0);let rows=arr.map(i=>`<tr><td>${i.data||'-'}</td><td>${i.desc}</td><td>${i.km||'-'}</td><td>${BRL.format(i.valor)}</td></tr>`).join('');setHtml('car_report',`<div class="box"><h2>Relatório de Manutenção do Veículo</h2><p>Total registrado: <b>${BRL.format(total)}</b></p><table><thead><tr><th>Data</th><th>Serviço</th><th>Km</th><th>Valor</th></tr></thead><tbody>${rows||'<tr><td colspan="4">Nenhum gasto registrado.</td></tr>'}</tbody></table></div>`)}
function clearCar(){localStorage.removeItem('centralia_car');renderCar();toast('Histórico limpo')}
function recibo(){const nome=getVal('rec_nome'),valor=moneyToNumber(getVal('rec_valor')),ref=getVal('rec_ref');setHtml('rec_doc',`<div class="box"><h2>RECIBO</h2><p>Recebi de <b>${nome||'________________'}</b> a importância de <b>${BRL.format(valor)}</b>.</p><p>Referente a: ${ref||'________________'}.</p><p>Data: ${new Date().toLocaleDateString('pt-BR')}</p><br><p>__________________________________<br>Assinatura</p></div>`)}
function orcamento(){const cli=getVal('orc_cli'),serv=getVal('orc_serv'),valor=moneyToNumber(getVal('orc_valor'));setHtml('orc_doc',`<div class="box"><h2>ORÇAMENTO</h2><p><b>Cliente:</b> ${cli||'-'}</p><p><b>Serviço/Produto:</b> ${serv||'-'}</p><p><b>Valor total:</b> ${BRL.format(valor)}</p><p><b>Validade:</b> 7 dias</p></div>`)}
function moeda(){const amount=Number(getVal('moeda_valor').replace(',','.'))||1;const from=getVal('moeda_de'),to=getVal('moeda_para');const fallback={BRL:1,USD:5.55,EUR:6.04,GBP:7.05,BTC:360000};const rates=(LIVE_RATES&&LIVE_RATES.USD&&LIVE_RATES.BTC)?LIVE_RATES:fallback;const usandoAoVivo=(LIVE_RATES&&LIVE_RATES.USD&&LIVE_RATES.BTC);const res=amount*rates[from]/rates[to];const aviso=usandoAoVivo?'Cotação obtida em tempo real (AwesomeAPI/CoinGecko). Pode haver pequena variação em relação à cotação de fechamento.':'Não foi possível obter a cotação em tempo real agora; exibindo valor aproximado de referência. Para uso financeiro real, confirme a cotação atual em uma corretora ou banco.';setHtml('moeda_result',`<h3>Conversão</h3><p><b>${amount} ${from}</b> ≈ <b>${NUM.format(res)} ${to}</b></p><small>${aviso}</small>`)}
function signo(){const s=getVal('signo_nome');const nomes={aries:'Áries',touro:'Touro',gemeos:'Gêmeos',cancer:'Câncer',leao:'Leão',virgem:'Virgem',libra:'Libra',escorpiao:'Escorpião',sagitario:'Sagitário',capricornio:'Capricórnio',aquario:'Aquário',peixes:'Peixes'};const textos={aries:'Dia de iniciativa. Evite pressa e escolha uma prioridade.',touro:'Organize finanças e cuide do que traz estabilidade.',gemeos:'Boa fase para conversas, ideias e contatos.',cancer:'Atenção à família e ao equilíbrio emocional.',leao:'Mostre seu valor, mas evite orgulho nas decisões.',virgem:'Planejamento e detalhes farão diferença hoje.',libra:'Busque equilíbrio em acordos e relações.',escorpiao:'Dia de foco e transformação. Não aja por impulso.',sagitario:'Aprendizado e movimento favorecidos.',capricornio:'Disciplina traz resultado. Faça o essencial primeiro.',aquario:'Ideias novas podem abrir portas.',peixes:'Intuição forte, mas confira os fatos.'};setHtml('signo_result',`<h3>${nomes[s]}</h3><p>${textos[s]}</p><small>Conteúdo de entretenimento.</small>`)}
function imc(){const p=Number(getVal('imc_peso').replace(',','.')),a=Number(getVal('imc_altura').replace(',','.'));if(!p||!a){toast('Informe peso e altura');return}const v=p/(a*a);let c=v<18.5?'Abaixo do peso':v<25?'Peso normal':v<30?'Sobrepeso':'Obesidade';setHtml('imc_result',`<h3>IMC</h3><p>Seu IMC é <b>${NUM.format(v)}</b></p><p>Classificação: <b>${c}</b></p><small>Informação educativa, não substitui avaliação médica.</small>`)}
function agua(){const p=Number(getVal('agua_peso').replace(',','.'));if(!p){toast('Informe seu peso');return}setHtml('agua_result',`<h3>Água diária</h3><p>Estimativa: <b>${NUM.format(p*35/1000)} litros/dia</b></p><small>Necessidades variam por saúde, clima e atividade física.</small>`)}
function lembrete(){const titulo=encodeURIComponent(getVal('lem_titulo')||'Lembrete'),desc=encodeURIComponent(getVal('lem_desc')||''),email=getVal('lem_email'),data=getVal('lem_data');const body=encodeURIComponent(`Lembrete: ${decodeURIComponent(titulo)}\n\n${decodeURIComponent(desc)}\n\nData: ${data||'-'}\n\nGerado pela Central IA`);setHtml('lem_result',`<h3>Lembrete criado</h3><p>Use os botões abaixo para enviar por e-mail ou adicionar na agenda.</p><div class="mini-actions"><a class="btn" href="mailto:${email}?subject=${titulo}&body=${body}">Abrir e-mail</a><a class="btn secondary" target="_blank" href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&details=${desc}">Abrir Google Agenda</a></div>`)}
function bula(){const nome=getVal('bula_nome').trim();if(!nome){toast('Digite o nome do remédio');return}const anvisa='https://www.gov.br/anvisa/pt-br/sistemas/bulario-eletronico';const guia='https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/bulas-e-rotulos/como-acessar-o-bulario-eletronico';const busca='https://www.google.com/search?q='+encodeURIComponent(nome+' bula Anvisa gov.br');setHtml('bula_result',`<h3>💊 Bula Online</h3><p><b>Medicamento pesquisado:</b> ${nome}</p><p>O sistema oficial da Anvisa pode ficar fora do ar. Por isso, esta ferramenta usa caminhos seguros: página oficial, instrução oficial e busca direcionada.</p><div class="mini-actions"><a class="btn" target="_blank" href="${anvisa}">Abrir Bulário Anvisa</a><a class="btn secondary" target="_blank" href="${busca}">Buscar bula oficial</a><a class="ghost" target="_blank" href="${guia}">Como consultar</a><button class="ghost" onclick="printBlock('bula_result')">Imprimir</button><button class="ghost" onclick="mailBlock('bula_result','Pesquisa de bula - Central IA')">Enviar por e-mail</button></div><small>Informação de saúde deve ser confirmada na bula oficial e com médico ou farmacêutico. A Central IA não substitui orientação profissional.</small>`)}

async function buscarClima(){
  const cidade=(getVal('weather_city')||'São Paulo').trim();
  setHtml('weather_result','<h3>Clima</h3><p>Consultando...</p>');
  try{
    const geo=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`).then(r=>r.json());
    if(!geo.results||!geo.results.length) throw new Error('Cidade não encontrada');
    const g=geo.results[0];
    const w=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`).then(r=>r.json());
    const c=w.current||{}; const desc=weatherCode(c.weather_code);
    const tempNum = Number(c.temperature_2m);
    const temp = Number.isFinite(tempNum) ? `${NUM.format(tempNum)}°C` : '--°C';
    const humidity = c.relative_humidity_2m ?? '-';
    const wind = c.wind_speed_10m ?? '-';
    const text=`${g.name}${g.admin1?' - '+g.admin1:''}: ${temp}, ${desc}, umidade ${humidity}%, vento ${wind} km/h.`;
    setHtml('weather_result',`<h3>${g.name}</h3><p><b>${temp}</b> — ${desc}</p><p>Umidade: <b>${humidity}%</b></p><p>Vento: <b>${wind} km/h</b></p><small>Fonte: Open-Meteo. Pode variar conforme localização.</small>`);
    updateWeatherHeader(temp,desc,text,g.name);
  }catch(e){setHtml('weather_result',`<h3>Não foi possível consultar</h3><p>Tente outra cidade ou verifique a conexão.</p>`);toast('Clima não carregou agora')}
}
function weatherCode(code){const map={0:'céu limpo',1:'principalmente claro',2:'parcialmente nublado',3:'nublado',45:'neblina',48:'neblina com geada',51:'garoa fraca',53:'garoa',55:'garoa forte',61:'chuva fraca',63:'chuva',65:'chuva forte',80:'pancadas fracas',81:'pancadas',82:'pancadas fortes',95:'trovoadas'};return map[code]||'condição variável'}
function updateWeatherHeader(temp,desc,text,city){$$('[data-weather]').forEach(e=>e.textContent=`${city} ${temp}`);const wt=$('#weather_text'),wtemp=$('#weather_temp'),wd=$('#weather_desc'),title=$('#weather_city_title');if(wt)wt.textContent=text;if(wtemp)wtemp.textContent=temp;if(wd)wd.textContent=desc;if(title)title.textContent=`Tempo em ${city}`}
function gerarPrompt(){gerarPromptAvancado()}
function gerarPromptAvancado(){
  const tipo=getVal('prompt_tipo');
  const tema=(getVal('prompt_tema')||'meu negócio').trim();
  const detalhes=(getVal('prompt_detalhes')||'').trim();
  const tom=getVal('prompt_tom')||'profissional';
  const tomLabel={profissional:'profissional, claro e confiável',simples:'simples, direto e fácil de entender',premium:'premium, sofisticado e persuasivo',criativo:'criativo, original e chamativo',emocional:'emocional, humano e envolvente'}[tom]||'profissional';
  const ctx=detalhes?`
Detalhes importantes: ${detalhes}.`:'';
  const prompts={
    'imagem-realista':`Crie uma imagem hiper-realista sobre: ${tema}.${ctx}
Estilo: fotografia profissional, iluminação cinematográfica, alta resolução, profundidade de campo, textura realista, composição premium, cores naturais, aparência confiável e visual pronto para uso comercial. Evite distorções, textos ilegíveis e elementos sem sentido.`,
    desenho:`Crie uma ilustração/desenho sobre: ${tema}.${ctx}
Estilo: visual moderno, traços limpos, cores harmônicas, personagens expressivos quando necessário, boa leitura no celular, composição organizada e aparência profissional para conteúdo digital.`,
    robotica:`Crie uma cena de robótica/futuro sobre: ${tema}.${ctx}
Estilo: tecnologia avançada, conectores luminosos, luz azul e roxa, detalhes metálicos, sensação de inteligência artificial, ambiente premium, composição limpa e moderna.`,
    vendas:`Crie uma copy de vendas para: ${tema}.${ctx}
Use tom ${tomLabel}. Inclua: título forte, promessa principal, dores do público, benefícios, diferenciais, prova/confiança, oferta, urgência ética e chamada para ação clara.`,
    instagram:`Crie um post para Instagram sobre: ${tema}.${ctx}
Use tom ${tomLabel}. Entregue: gancho forte, legenda curta, 5 ideias de conteúdo, CTA, hashtags e sugestão visual para a arte.`,
    negocio:`Analise a ideia de negócio: ${tema}.${ctx}
Use tom ${tomLabel}. Entregue: público-alvo, problema resolvido, oferta inicial, preço sugerido, canais de venda, primeiros passos, riscos e melhorias.`,
    atendimento:`Crie mensagens de atendimento para: ${tema}.${ctx}
Use tom ${tomLabel}. Entregue respostas para: saudação, orçamento, confirmação, objeção de preço, pós-venda, cliente sumido e pedido de avaliação.`
  };
  const exemplos={
    'imagem-realista':`Resultado sugerido:
Imagem vertical de ${tema}, com aparência realista, luz suave, fundo limpo, foco no objeto principal, cores modernas e sensação profissional. Ideal para capa, anúncio, apresentação ou postagem.

Dica: substitua detalhes como cor, ambiente, ângulo da câmera e estilo visual para gerar variações melhores.`,
    desenho:`Resultado sugerido:
Ilustração clara sobre ${tema}, com visual amigável, elementos bem distribuídos e composição fácil de entender no celular. Pode ser usada em post educativo, material digital, card ou apresentação.`,
    robotica:`Resultado sugerido:
Cena tecnológica com ${tema}, conectores brilhantes, tons azul e roxo, aparência futurista e visual premium. Boa para representar IA, inovação, automação, sistemas e ferramentas digitais.`,
    vendas:`Resultado sugerido:
Título: Transforme ${tema} em uma solução simples e profissional.

Texto: Chega de perder tempo tentando organizar tudo sozinho. Com uma solução bem estruturada, você ganha clareza, economia de tempo e mais confiança para vender ou atender melhor.

CTA: Comece agora e veja como é simples dar o próximo passo.`,
    instagram:`Resultado sugerido:
Gancho: Você está complicando ${tema} sem perceber?

Legenda: Muitas pessoas perdem tempo porque não usam um processo simples. Organize o básico, acompanhe os resultados e melhore um passo por vez.

CTA: Salve este post para consultar depois.
Hashtags: #empreendedorismo #produtividade #negocios #centralia`,
    negocio:`Resultado sugerido:
Público-alvo: pessoas interessadas em ${tema}.
Oferta inicial: uma solução simples, barata e fácil de usar.
Primeiro passo: validar com 10 potenciais clientes antes de investir pesado.
Canal de venda: WhatsApp, Instagram, Google e indicações.
Risco principal: criar algo grande antes de confirmar demanda.`,
    atendimento:`Resultado sugerido:
Olá! Tudo bem? Obrigado pelo contato. 😊

Para te passar a melhor opção sobre ${tema}, me envie por favor mais detalhes do que você precisa. Assim consigo te orientar com clareza e passar um orçamento correto.

Fico à disposição!`
  };
  setHtml('prompt_result',`<h3>Prompt pronto</h3><pre>${escapeHtml(prompts[tipo]||prompts.vendas)}</pre>`);
  setHtml('prompt_answer',`<h3>Resultado gerado</h3><pre>${escapeHtml(exemplos[tipo]||exemplos.vendas)}</pre>`);
  toast('Prompt e resultado gerados');
}
function escapeHtml(str){return String(str).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}
function organizarProdutividade(){const linhas=getVal('prod_tarefas').split('\n').map(x=>x.trim()).filter(Boolean);if(!linhas.length){toast('Digite pelo menos uma tarefa');return}const html=linhas.map((t,i)=>`<li><b>${i+1}.</b> ${t}</li>`).join('');setHtml('prod_result',`<h3>Plano organizado</h3><p>Comece pela primeira tarefa e evite fazer tudo ao mesmo tempo.</p><ol>${html}</ol><p><b>Dica:</b> separe 25 minutos de foco para cada tarefa importante.</p><div class="mini-actions"><button class="ghost" onclick="downloadBlock('prod_result','plano-produtividade.txt')">Baixar TXT</button><button class="ghost" onclick="mailBlock('prod_result','Plano de produtividade')">Enviar por e-mail</button></div>`)}
let LIVE_RATES=null;
async function initMarket(){
  try{
    const r=await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,GBP-BRL').then(r=>r.json());
    const usdN=Number(r.USDBRL.bid),eurN=Number(r.EURBRL.bid),gbpN=Number(r.GBPBRL.bid);
    LIVE_RATES={BRL:1,USD:usdN,EUR:eurN,GBP:gbpN,BTC:LIVE_RATES?LIVE_RATES.BTC:null};
    $$('[data-usd]').forEach(e=>e.textContent='R$ '+usdN.toFixed(2).replace('.',','));
    $$('[data-eur]').forEach(e=>e.textContent='R$ '+eurN.toFixed(2).replace('.',','));
  }catch(e){
    $$('[data-usd]').forEach(e=>e.textContent='indisponível');
    $$('[data-eur]').forEach(e=>e.textContent='indisponível');
  }
  try{
    const b=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl').then(r=>r.json());
    const btcN=Number(b.bitcoin.brl);
    if(LIVE_RATES)LIVE_RATES.BTC=btcN;
    $$('[data-btc]').forEach(e=>e.textContent='R$ '+NUM.format(Math.round(btcN/1000))+' mil');
  }catch(e){
    $$('[data-btc]').forEach(e=>e.textContent='indisponível');
  }
}
function init(){setupMasks();setupFilters();setupMentor();renderCar();initMarket();setInterval(initMarket,45000);buscarClima();}
init();
function filtrar(cat){
  const btn=document.querySelector(`[data-filter="${cat}"]`);
  if(btn){btn.click();}
  document.getElementById('ferramentas')?.scrollIntoView({behavior:'smooth'});
}
function surpreenda(){
  const links=['#carro','#prompts-ia','#bula','#moedas','#tempo','#recibo','#financiamento','#cdi','#lucro'];
  const link=links[Math.floor(Math.random()*links.length)];
  document.querySelector(link)?.scrollIntoView({behavior:'smooth'});
  toast('Abrimos uma ferramenta para você explorar');
}
function copyFrom(id){
  const txt=document.getElementById(id)?.innerText||'';
  if(!txt.trim()){toast('Nada para copiar');return}
  if(navigator.clipboard){navigator.clipboard.writeText(txt).then(()=>toast('Prompt copiado'))}
  else{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Prompt copiado')}
}


let mentorTopic='dinheiro';
function setupMentor(){
  $$('.mentor-topic').forEach(btn=>{
    btn.addEventListener('click',()=>{
      $$('.mentor-topic').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      mentorTopic=btn.dataset.topic||'dinheiro';
      const visuals={
        dinheiro:['💰','Organize o financeiro','Comece pelo diagnóstico, depois corte vazamentos e defina uma ação simples para hoje.'],
        trabalho:['💼','Clareza profissional','Transforme pressão em prioridades e defina o próximo passo da sua carreira.'],
        negocios:['🚀','Decisão empreendedora','Valide antes de investir pesado e mantenha o foco em venda e execução.'],
        familia:['👨‍👩‍👧','Conversa e equilíbrio','Procure diálogo, limites claros e pequenas ações consistentes.'],
        relacionamento:['❤️','Respeito e diálogo','Organize seus sentimentos antes de tomar decisões importantes.'],
        estudos:['📚','Plano de estudo','Menos ansiedade, mais rotina e metas pequenas todos os dias.'],
        saude:['🩺','Saúde com responsabilidade','Organize cuidados básicos e procure ajuda profissional quando houver sintomas ou dúvidas.'],
        habitos:['💪','Hábitos possíveis','Comece leve, repita o básico e mantenha constância sem depender de motivação.'],
        emocional:['🧘','Calma e clareza','Respire, diminua o ruído e foque no que está sob seu controle.'],
        objetivos:['🎯','Direção e foco','Transforme desejo em meta, meta em plano e plano em rotina.']
      };
      const v=visuals[mentorTopic]||visuals.dinheiro;
      setHtml('mentor_visual',`<div class="orb">${v[0]}</div><h3>${v[1]}</h3><p>${v[2]}</p>`);
    });
  });
}
function gerarMentor(){
  const problema=getVal('mentor_problem').trim();
  const sentimento=getVal('mentor_feeling')||'perdido';
  const estilo=getVal('mentor_style')||'pratico';
  if(!problema){toast('Conte rapidamente o que está acontecendo');return}
  const alerta=/suic|se matar|tirar minha vida|não aguento mais viver|automutila|me cortar|acabar com (a )?minha vida|não quero mais viver|quero morrer/i;
  if(alerta.test(problema)){
    setHtml('mentor_visual',`<div class="orb">💙</div><h3>Você não está sozinho(a)</h3><p>O que você está sentindo é sério e merece cuidado imediato de uma pessoa preparada para isso.</p>`);
    setHtml('mentor_result',`<h3>💙 Apoio imediato</h3>
    <div class="advice-grid">
      <div class="advice-box"><h4>Você não está sozinho(a)</h4><p>Pelo que você escreveu, o momento parece muito difícil. Isso que você sente importa e merece atenção de quem pode ajudar de verdade agora.</p></div>
      <div class="advice-box"><h4>Ajuda disponível agora, no Brasil</h4><p><b>CVV — Centro de Valorização da Vida:</b> ligue <b>188</b> (gratuito, 24h) ou acesse <b>cvv.org.br</b> para conversar por chat.</p><p>Em caso de risco imediato, ligue <b>192</b> (SAMU) ou vá ao pronto-socorro mais próximo.</p></div>
      <div class="advice-box"><h4>Próximo passo</h4><p>Se possível, entre em contato agora com alguém de confiança — um familiar, amigo ou profissional de saúde — e conte o que está sentindo.</p></div>
    </div>`);
    toast('Mostrando apoio e canais de ajuda');
    return;
  }
  const topicMap={
    dinheiro:{titulo:'Conselho financeiro',icone:'💰',diagnostico:'Você precisa transformar preocupação financeira em clareza. O primeiro passo é enxergar números reais: quanto entra, quanto sai, quanto deve e qual dívida aperta mais.',acoes:['Anote todas as dívidas com valor, parcela, juros e atraso.','Separe gastos essenciais de gastos cortáveis por 7 dias.','Negocie primeiro o que tem juros mais altos ou risco imediato.','Use uma meta diária pequena para recuperar controle, não uma promessa impossível.'],ferramentas:['Fluxo de Caixa','Calculadora CDI','Calculadora de Financiamento','Controle de Gastos']},
    trabalho:{titulo:'Conselho de carreira',icone:'💼',diagnostico:'Sua situação pede organização e posicionamento. Em vez de tentar resolver tudo de uma vez, escolha uma direção profissional clara e alinhe currículo, rotina e contatos.',acoes:['Defina uma função-alvo para os próximos 30 dias.','Atualize currículo com resultados e atividades concretas.','Envie candidaturas de forma consistente, não por impulso.','Separe 1 hora por dia para estudar uma habilidade valorizada.'],ferramentas:['Planejador de Produtividade','Gerador de Currículo','Prompt IA para LinkedIn','Organizador de Estudos']},
    negocios:{titulo:'Conselho empreendedor',icone:'🚀',diagnostico:'A ideia pode ser boa, mas precisa ser validada antes de virar investimento. Um negócio forte começa resolvendo uma dor clara para um público específico.',acoes:['Descreva o cliente ideal em uma frase.','Crie uma oferta simples e barata para testar.','Fale com 10 possíveis clientes antes de criar algo grande.','Meça interesse real: mensagem, pedido, orçamento ou compra.'],ferramentas:['Gerador de Orçamento','Calculadora de Lucro','Prompt IA de Marketing','Fluxo de Caixa']},
    familia:{titulo:'Conselho familiar',icone:'👨‍👩‍👧',diagnostico:'Problemas familiares geralmente pioram quando todos tentam vencer a conversa. O objetivo deve ser reduzir tensão e construir acordos pequenos, não resolver tudo no mesmo dia.',acoes:['Escolha um momento calmo para conversar.','Fale do problema sem atacar a pessoa.','Combine uma regra prática para a semana.','Observe se a ação melhorou a convivência antes de cobrar perfeição.'],ferramentas:['Mentor IA','Planejador de Rotina','Agenda de Lembretes','Prompt IA para Conversas Difíceis']},
    relacionamento:{titulo:'Conselho de relacionamento',icone:'❤️',diagnostico:'Antes de decidir no calor da emoção, organize o que você sente, o que você precisa e o que está disposto a conversar com respeito.',acoes:['Escreva o problema em uma frase objetiva.','Separe fatos de interpretações.','Converse pedindo clareza, não buscando vencer.','Se houver desrespeito, ameaça ou violência, procure apoio de pessoas e serviços de confiança.'],ferramentas:['Mentor IA','Planejador de Conversa','Agenda de Lembretes','Prompt IA para Comunicação']},
    estudos:{titulo:'Conselho de estudos',icone:'📚',diagnostico:'Falta de foco normalmente não se resolve com motivação, mas com ambiente, horário e tarefas pequenas o suficiente para começar.',acoes:['Escolha uma matéria ou tema por vez.','Estude 25 minutos e descanse 5.','Faça resumo ativo: perguntas e respostas.','Revise no dia seguinte antes de avançar.'],ferramentas:['Organizador de Estudos','Planejador de Produtividade','Prompt IA para Resumos','Cronograma Semanal']},
    saude:{titulo:'Conselho de saúde',icone:'🩺',diagnostico:'Cuidados com saúde exigem responsabilidade. A orientação aqui ajuda a organizar rotina e prevenção, mas sintomas, dores, medicamentos e diagnósticos devem ser avaliados por profissional.',acoes:['Anote sintomas, horários e frequência se houver algum incômodo.','Organize água, sono e alimentação em horários previsíveis.','Evite iniciar remédios, dietas ou treinos intensos sem orientação.','Procure atendimento se houver dor forte, piora, falta de ar, pressão alterada ou sinais persistentes.'],ferramentas:['Calculadora de Água','IMC','Lembrete por E-mail','Previsão do Tempo']},
    habitos:{titulo:'Conselho de hábitos',icone:'💪',diagnostico:'Mudança de hábito precisa ser simples, repetível e mensurável. O erro comum é começar grande demais e abandonar rápido.',acoes:['Escolha um hábito pequeno para repetir por 7 dias.','Defina horário e gatilho: depois de acordar, depois do almoço ou antes de dormir.','Marque um X no calendário a cada dia cumprido.','Reduza o plano pela metade se estiver difícil manter.'],ferramentas:['Lembrete por E-mail','Checklist Semanal','Calculadora de Água','Planejador de Rotina']},
    emocional:{titulo:'Conselho emocional',icone:'🧘',diagnostico:'Quando a mente está acelerada, decisões grandes ficam distorcidas. O primeiro objetivo é recuperar um pouco de calma e clareza.',acoes:['Respire devagar por 2 minutos antes de decidir.','Escreva o que está sob seu controle e o que não está.','Resolva uma tarefa pequena hoje.','Se o sofrimento estiver intenso ou persistente, procure ajuda profissional.'],ferramentas:['Mentor IA','Planejador de Rotina','Lista de Tarefas','Agenda de Lembretes']},
    objetivos:{titulo:'Conselho de objetivos',icone:'🎯',diagnostico:'Um objetivo sem rotina vira ansiedade. A solução é transformar a meta em ações pequenas, mensuráveis e repetíveis.',acoes:['Escreva uma meta específica para 30 dias.','Defina 3 ações semanais ligadas a essa meta.','Acompanhe progresso em uma tabela simples.','Corte distrações que não combinam com o objetivo.'],ferramentas:['Planejador de Produtividade','Checklist Semanal','Prompt IA de Metas','Organizador Financeiro']}
  };
  const base=topicMap[mentorTopic]||topicMap.dinheiro;
  const tom={
    pratico:'Vou ser direto: o melhor agora é simplificar e agir em uma coisa concreta.',
    professor:'Pense nisso como uma aula: primeiro entendemos o problema, depois criamos um método simples.',
    empreendedor:'Olhe para isso como gestão: prioridade, ação, medição e correção rápida.',
    produtividade:'O foco é reduzir ruído, escolher prioridade e criar uma rotina executável.',
    biblico:'Com sabedoria, prudência e constância, você pode dar um passo por vez sem agir por desespero.',
    calmo:'Respire. Você não precisa resolver tudo hoje; precisa apenas escolher o próximo passo correto.'
  }[estilo]||'Vamos organizar isso com clareza.';
  const feelingMsg={
    perdido:'Como você se sente perdido(a), o foco é criar ordem antes de tomar decisões grandes.',
    ansioso:'Como existe ansiedade, evite decisões impulsivas e comece por uma ação pequena e controlável.',
    cansado:'Como você está cansado(a), o plano precisa ser leve o bastante para ser cumprido.',
    motivado:'Como você está motivado(a), aproveite essa energia criando um plano simples e mensurável.',
    triste:'Como há tristeza, trate-se com respeito e busque apoio se isso estiver pesado demais.',
    pressionado:'Como há pressão, separe o que é urgente do que apenas parece urgente.'
  }[sentimento]||'O foco é clareza e ação simples.';
  const dias=['Hoje: escreva o problema em uma frase e escolha uma ação pequena.','Amanhã: organize informações e elimine uma distração ou gasto desnecessário.','Em 3 dias: revise o que funcionou e ajuste o plano sem desistir.','Em 7 dias: compare sua situação com o começo e defina o próximo ciclo.'];
  const html=`<h3>${base.icone} ${base.titulo}</h3>
  <div class="advice-grid">
    <div class="advice-box"><h4>Diagnóstico</h4><p>${escapeHtml(base.diagnostico)}</p><p><b>Sobre o que você contou:</b> ${escapeHtml(problema)}</p></div>
    <div class="advice-box"><h4>Conselho do mentor</h4><p>${escapeHtml(tom)} ${escapeHtml(feelingMsg)}</p></div>
    <div class="advice-box"><h4>Plano de ação</h4><ul>${base.acoes.map(a=>`<li>${escapeHtml(a)}</li>`).join('')}</ul></div>
    <div class="advice-box"><h4>Plano para 7 dias</h4><ol>${dias.map(d=>`<li>${escapeHtml(d)}</li>`).join('')}</ol></div>
    <div class="advice-box"><h4>Ferramentas recomendadas</h4><p>${base.ferramentas.map(f=>`<span class="tag">${escapeHtml(f)}</span>`).join(' ')}</p></div>
    <div class="advice-box"><h4>Próximo passo recomendado</h4><p>Escolha uma ação que você consiga fazer em até 20 minutos hoje. O objetivo não é perfeição, é retomada de controle.</p></div>
  </div>`;
  setHtml('mentor_result',html);
  toast('Conselho gerado');
}
