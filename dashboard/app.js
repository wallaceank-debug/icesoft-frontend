const API_URL = 'https://icesoft-api.onrender.com/api';
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
