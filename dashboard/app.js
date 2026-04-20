const API_URL = 'https://icesoft-api.onrender.com/api';
let chartInstancia = null; // Guarda a memória do gráfico

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

        const [anoI, mesI, diaI] = inicioInput.split('-');
        const dataInicio = new Date(anoI, mesI - 1, diaI, 0, 0, 0);
        
        const [anoF, mesF, diaF] = fimInput.split('-');
        const dataFim = new Date(anoF, mesF - 1, diaF, 23, 59, 59);

        const vendasFiltradas = vendasBrutas.filter(v => {
            if (!v.data_hora) return true; 
            const dataTexto = String(v.data_hora).substring(0, 10);
            const [anoV, mesV, diaV] = dataTexto.split('-');
            const dataDaVenda = new Date(anoV, mesV - 1, diaV, 12, 0, 0); 
            return dataDaVenda >= dataInicio && dataDaVenda <= dataFim;
        });
        
        let faturamento = 0;
        let contagemProdutos = {};
        let contagemAdicionais = {};
        let pedidosValidos = 0;
        
        // As 7 gavetas dos dias da semana (Domingo a Sábado)
        let faturamentoPorDia = [0, 0, 0, 0, 0, 0, 0]; 

        vendasFiltradas.forEach(v => {
            if (!v.itens || String(v.itens).includes("[object")) return;
            
            let valorNum = parseFloat(v.valor_total || v.total);
            let listaTextosDeVenda = [];
            let itensLidos = v.itens;

            if (typeof itensLidos === 'string' && itensLidos.trim().startsWith('[')) {
                try { itensLidos = JSON.parse(itensLidos); } catch(e) {}
            }

            if (Array.isArray(itensLidos)) {
                listaTextosDeVenda = itensLidos.map(item => item.nome || item.produto_nome || "");
                if (isNaN(valorNum)) {
                    valorNum = itensLidos.reduce((soma, item) => soma + (parseFloat(item.preco) || 0), 0);
                }
            } else if (typeof itensLidos === 'string') {
                let textoLimpo = itensLidos.replace(/(Balcão:|Delivery:)\s*/g, '');
                listaTextosDeVenda = textoLimpo.split('+').map(t => t.trim());
            }

            if (isNaN(valorNum)) valorNum = 0;

            if (listaTextosDeVenda.length > 0 && listaTextosDeVenda.some(t => t !== "")) {
                faturamento += valorNum; 
                pedidosValidos++; 

                // 📊 INTELIGÊNCIA DO GRÁFICO: Descobre o dia da semana da venda
                let diaSemanaIndex = new Date().getDay(); // Assume hoje como segurança
                if (v.data_hora) {
                    const dataTexto = String(v.data_hora).substring(0, 10);
                    const [anoV, mesV, diaV] = dataTexto.split('-');
                    const dataCorrigida = new Date(anoV, mesV - 1, diaV, 12, 0, 0);
                    diaSemanaIndex = dataCorrigida.getDay(); // Retorna de 0 (Dom) a 6 (Sáb)
                }
                faturamentoPorDia[diaSemanaIndex] += valorNum; // Coloca o dinheiro na gaveta do dia
                
                listaTextosDeVenda.forEach(textoVenda => {
                    if (!textoVenda) return;
                    
                    let textoLimpo = textoVenda.replace(/(Balcão:|Delivery:)\s*/g, '').trim();
                    let nomeBase = textoLimpo.split('(')[0].trim();
                    
                    if (nomeBase) contagemProdutos[nomeBase] = (contagemProdutos[nomeBase] || 0) + 1;

                    let match = textoLimpo.match(/\(([^)]+)\)/);
                    if(match) {
                        let adicionais = match[1].split(','); 
                        adicionais.forEach(item => {
                            let adcLimpo = item.trim();
                            if (adcLimpo) contagemAdicionais[adcLimpo] = (contagemAdicionais[adcLimpo] || 0) + 1;
                        });
                    }
                });
            }
        });

        const ticketMedio = pedidosValidos > 0 ? (faturamento / pedidosValidos) : 0;

        document.getElementById('dash-faturamento').innerText = `R$ ${faturamento.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-ticket').innerText = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-pedidos').innerText = pedidosValidos;

        renderizarLista(contagemProdutos, 'lista-produtos-top', "Nenhum produto vendido.");
        renderizarLista(contagemAdicionais, 'lista-adicionais-top', "Nenhum adicional vendido.");
        
        // 🚀 DISPARA O GRÁFICO!
        renderizarGrafico(faturamentoPorDia);

    } catch (e) {
        console.error("Erro:", e);
        alert("Erro ao calcular vendas. Atualize a página e tente novamente.");
    }
}

// ==========================================
// FUNÇÕES DE DESENHO DA TELA (LISTAS E GRÁFICO)
// ==========================================
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

    if (chartInstancia) {
        chartInstancia.destroy();
    }

    chartInstancia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
            datasets: [{
                label: 'Faturamento (R$)',
                data: dadosDaSemana,
                // A MÁGICA ESTÁ AQUI: Trocamos para o Rosa Vibrante da Icesoft!
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
                        label: function(context) {
                            return 'R$ ' + context.raw.toFixed(2).replace('.', ',');
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}
