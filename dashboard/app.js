const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
let chartInstancia = null;

window.onload = () => { carregarVendas(); };

function formatarDataBR(dataString) {
    if (!dataString) return '';
    const partes = dataString.split('-');
    if (partes.length !== 3) return dataString;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

async function carregarVendas() {
    let inicioInput = document.getElementById('filtro-inicio').value;
    let fimInput = document.getElementById('filtro-fim').value;
    const textoPeriodo = document.getElementById('periodo-exibicao');

    if (!inicioInput || !fimInput) {
        const dataHoje = new Date();
        const dataTrintaDiasAtras = new Date();
        dataTrintaDiasAtras.setDate(dataHoje.getDate() - 30);
        inicioInput = dataTrintaDiasAtras.toISOString().split('T')[0];
        fimInput = dataHoje.toISOString().split('T')[0];
        document.getElementById('filtro-inicio').value = inicioInput;
        document.getElementById('filtro-fim').value = fimInput;
    }

    textoPeriodo.innerText = `${formatarDataBR(inicioInput)} ATÉ ${formatarDataBR(fimInput)}`;

    try {
        const resposta = await fetch(`${API_URL}/vendas`);
        let vendasBrutas = await resposta.json();
        if (!Array.isArray(vendasBrutas)) vendasBrutas = [];

        // Filtro Blindado contra Fuso Horário
        const vendasFiltradas = vendasBrutas.filter(v => {
            if (!v.data_hora) return false;
            let dataVendaTexto = String(v.data_hora).split('T')[0].substring(0, 10);
            return dataVendaTexto >= inicioInput && dataVendaTexto <= fimInput;
        });
        
        let faturamento = 0;
        let contagemProdutos = {};
        let contagemAdicionais = {};
        let pedidosValidos = 0;
        let faturamentoPorDia = [0, 0, 0, 0, 0, 0, 0]; 

        vendasFiltradas.forEach(v => {
            if (!v.itens) return;
            
            let valorNum = parseFloat(v.valor_total || v.total || 0);
            let itensLidos = v.itens;

            // A MÁGICA DA CORREÇÃO AQUI 👇
            // Se for string e estiver corrompida, ignora. Mas se for um Array perfeito do banco JSONB, deixa passar!
            if (typeof itensLidos === 'string') {
                if (itensLidos.includes("[object")) return; 
                if (itensLidos.trim().startsWith('[')) {
                    try { itensLidos = JSON.parse(itensLidos); } catch(e) {}
                }
            }

            let listaTextosDeVenda = [];
            
            // Lê perfeitamente a lista que veio do PDV e das Mesas
            if (Array.isArray(itensLidos)) {
                listaTextosDeVenda = itensLidos.map(item => {
                    if (typeof item === 'string') return item;
                    return item.nome || item.produto_nome || item.nomeBase || "";
                });
                
                if (valorNum === 0) {
                    valorNum = itensLidos.reduce((soma, item) => soma + (parseFloat(item.preco) || 0), 0);
                }
            } else if (typeof itensLidos === 'string') {
                let textoLimpo = itensLidos.replace(/(Balcão:|Delivery:|Mesa\s\d+\s?-)\s*/gi, '');
                listaTextosDeVenda = textoLimpo.split('+').map(t => t.trim());
            }

            if (listaTextosDeVenda.length > 0) {
                faturamento += valorNum; 
                pedidosValidos++; 

                let diaSemanaIndex = new Date().getDay();
                if (v.data_hora) {
                    let dataVendaTexto = String(v.data_hora).split('T')[0].substring(0, 10);
                    if (dataVendaTexto.includes('-')) {
                        const [anoV, mesV, diaV] = dataVendaTexto.split('-');
                        diaSemanaIndex = new Date(anoV, mesV - 1, diaV, 12, 0, 0).getDay();
                    }
                }
                faturamentoPorDia[diaSemanaIndex] += valorNum; 
                
                listaTextosDeVenda.forEach(textoVenda => {
                    if (typeof textoVenda !== 'string' || !textoVenda.trim()) return;
                    
                    // LIMPAMOS TUDO: Tira "Balcão", "Delivery" e "Mesa XX"
                    let textoLimpo = textoVenda.replace(/(Balcão:|Delivery:|Mesa\s\d+\s?-)\s*/gi, '').trim();
                    let nomeBase = textoLimpo.split('(')[0].trim();
                    
                    if (nomeBase) contagemProdutos[nomeBase] = (contagemProdutos[nomeBase] || 0) + 1;

                    let match = textoLimpo.match(/\(([^)]+)\)/);
                    if(match) {
                        match[1].split(',').forEach(item => {
                            let adcLimpo = item.trim();
                            if (adcLimpo) contagemAdicionais[adcLimpo] = (contagemAdicionais[adcLimpo] || 0) + 1;
                        });
                    }
                });
            }
        });

        document.getElementById('dash-faturamento').innerText = `R$ ${faturamento.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-ticket').innerText = `R$ ${pedidosValidos > 0 ? (faturamento / pedidosValidos).toFixed(2).replace('.', ',') : '0,00'}`;
        document.getElementById('dash-pedidos').innerText = pedidosValidos;

        renderizarLista(contagemProdutos, 'lista-produtos-top', "Nenhum produto vendido.");
        renderizarLista(contagemAdicionais, 'lista-adicionais-top', "Nenhum adicional vendido.");
        renderizarGrafico(faturamentoPorDia);

    } catch (e) {
        console.error("Erro Dashboard:", e);
        alert("Erro ao carregar dados. Verifique o console.");
    }
}

function renderizarLista(objetoContagem, idElemento, msgVazio) {
    const container = document.getElementById(idElemento);
    const ordenado = Object.entries(objetoContagem).sort((a, b) => b[1] - a[1]);
    if (ordenado.length === 0) {
        container.innerHTML = `<p style="text-align:center; opacity:0.8;">${msgVazio}</p>`;
        return;
    }
    container.innerHTML = '';
    ordenado.forEach(([nome, quantidade]) => {
        container.innerHTML += `<div class="item-lista"><span>${nome}</span><span class="qtd">${quantidade}x</span></div>`;
    });
}

function renderizarGrafico(dadosDaSemana) {
    const ctx = document.getElementById('graficoVendas');
    if (!ctx) return;
    if (chartInstancia) chartInstancia.destroy();
    chartInstancia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
            datasets: [{
                label: 'Faturamento (R$)',
                data: dadosDaSemana,
                backgroundColor: '#ffffff', 
                borderRadius: 6 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => 'R$ ' + context.raw.toFixed(2).replace('.', ',')
                    }
                }
            },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// --- FUNCIONALIDADES DO HISTÓRICO DE CAIXAS ---

function abrirHistoricoCaixas() {
  document.getElementById('modal-historico-caixas').style.display = 'block';
  // Define o mês atual como padrão no filtro
  const dataAtual = new Date();
  const mesFormatado = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('filtro-mes-caixa').value = mesFormatado;
  
  carregarDadosCaixa();
}

function fecharHistoricoCaixas() {
  document.getElementById('modal-historico-caixas').style.display = 'none';
}

async function carregarDadosCaixa() {
  const mesSelecionado = document.getElementById('filtro-mes-caixa').value;
  const corpoTabela = document.getElementById('corpo-tabela-caixas');
  
  corpoTabela.innerHTML = '<tr><td colspan="6">Buscando dados do banco...</td></tr>';

  try {
    // ATENÇÃO: Aqui conectamos com seu Banco de Dados (ex: Firebase ou sua API)
    // Estamos simulando a busca na coleção de caixas filtrando pelo mês
    const dadosDosCaixas = await buscarCaixasDoBancoDeDados(mesSelecionado); 

    corpoTabela.innerHTML = ''; // Limpa o "buscando dados..."

    if (dadosDosCaixas.length === 0) {
      corpoTabela.innerHTML = '<tr><td colspan="6">Nenhum caixa encontrado neste mês.</td></tr>';
      return;
    }

    // Preenche a tabela com os dados
    dadosDosCaixas.forEach(caixa => {
      // Garantimos que totalPix não venha quebrado caso alguma caixa antiga não tenha a propriedade
      const valorPix = caixa.totalPix || 0; 
      
      corpoTabela.innerHTML += `
        <tr>
          <td>${caixa.dataAbertura}</td>
          <td>${caixa.dataFechamento}</td>
          <td>R$ ${caixa.totalCartao.toFixed(2)}</td>
          <td style="color: #25D366; font-weight: bold;">R$ ${valorPix.toFixed(2)}</td> <td>R$ ${caixa.totalDinheiro.toFixed(2)}</td>
          <td style="color: red;">R$ ${caixa.totalDespesas.toFixed(2)}</td>
          <td><button onclick="verDetalhesCaixa('${caixa.id}')">Ver Detalhes</button></td>
        </tr>
      `;
    });

  } catch (erro) {
    console.error("Erro ao buscar caixas:", erro);
    corpoTabela.innerHTML = '<tr><td colspan="6">Erro ao carregar dados. Verifique sua conexão.</td></tr>';
  }
}

// Função real apontando para a sua API Icesoft
async function buscarCaixasDoBancoDeDados(mes) {
  // Conforme o seu arquivo Icesoft_Dev_Atual, esta é a URL oficial da sua API
  const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
  
  try {
    // Faz o pedido para a rota nova que acabamos de criar no backend
    const resposta = await fetch(`${API_URL}/caixa/historico?mes=${mes}`);
    
    if (!resposta.ok) {
      throw new Error("Falha na comunicação com o servidor Icesoft");
    }
    
    // Recebe a lista já mastigada e formatada pelo servidor
    const dados = await resposta.json();
    return dados;
    
  } catch (erro) {
    console.error("Erro de conexão com a API Icesoft:", erro);
    return []; // Retorna vazio em caso de erro de internet para não quebrar a tabela
  }
}

// Função para abrir o Raio-X do Caixa selecionado
async function verDetalhesCaixa(idCaixa) {
  // Mostra o modal e coloca o ID no título
  document.getElementById('detalhes-caixa-id').innerText = idCaixa;
  document.getElementById('modal-detalhes-caixa').style.display = 'block';
  
  const corpoVendas = document.getElementById('corpo-tabela-detalhes-vendas');
  const corpoMovs = document.getElementById('corpo-tabela-detalhes-movs');
  
  // Mensagem de carregamento enquanto busca os dados
  corpoVendas.innerHTML = '<tr><td colspan="3">Carregando vendas...</td></tr>';
  corpoMovs.innerHTML = '<tr><td colspan="3">Carregando despesas...</td></tr>';

  try {
    const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
    const resposta = await fetch(`${API_URL}/caixa/${idCaixa}/detalhes`);
    
    if (!resposta.ok) throw new Error("Falha na API");
    const dados = await resposta.json();

    // ==========================================
    // 1. RENDERIZAR AS VENDAS
    // ==========================================
    corpoVendas.innerHTML = '';
    if (dados.vendas.length === 0) {
        corpoVendas.innerHTML = '<tr><td colspan="3">Nenhuma venda registrada neste caixa.</td></tr>';
    } else {
        dados.vendas.forEach(v => {
            // Formata a hora para ficar limpo (Ex: 14:30)
            const hora = new Date(v.data_hora).toLocaleTimeString('pt-BR', {timeStyle: 'short'});
            corpoVendas.innerHTML += `
              <tr>
                <td>${hora}</td>
                <td>${v.forma_pagamento}</td>
                <td style="font-weight: bold;">R$ ${Number(v.valor_total).toFixed(2)}</td>
              </tr>
            `;
        });
    }

    // ==========================================
    // 2. RENDERIZAR AS DESPESAS E MOVIMENTAÇÕES
    // ==========================================
    corpoMovs.innerHTML = '';
    if (dados.movimentacoes.length === 0) {
        corpoMovs.innerHTML = '<tr><td colspan="3">Nenhuma movimentação registrada.</td></tr>';
    } else {
        dados.movimentacoes.forEach(m => {
            // Se for Sangria fica vermelho, se for Suprimento (Entrada de troco) fica verde
            const corTexto = m.tipo.toLowerCase() === 'sangria' ? '#f44336' : '#25D366';
            corpoMovs.innerHTML += `
              <tr>
                <td style="color: ${corTexto}; font-weight: bold;">${m.tipo}</td>
                <td>${m.motivo || '-'}</td>
                <td style="color: ${corTexto}; font-weight: bold;">R$ ${Number(m.valor).toFixed(2)}</td>
              </tr>
            `;
        });
    }

  } catch (erro) {
    console.error("Erro ao buscar detalhes:", erro);
    corpoVendas.innerHTML = '<tr><td colspan="3" style="color:red;">Erro ao buscar dados do servidor.</td></tr>';
    corpoMovs.innerHTML = '<tr><td colspan="3" style="color:red;">Erro ao buscar dados do servidor.</td></tr>';
  }
}

// Função para fechar a nova janela
function fecharDetalhesCaixa() {
  document.getElementById('modal-detalhes-caixa').style.display = 'none';
}