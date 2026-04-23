const API_URL = 'https://icesoft-api.onrender.com/api';
let chartInstancia = null;

window.onload = () => { carregarVendas(); };

function formatarDataBR(dataString) {
    if (!dataString) return '';
    const partes = dataString.split('-');
    if (partes.length !== 3) return dataString;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// NOVA FUNÇÃO: Extrai YYYY-MM-DD de qualquer formato de data
function extrairDataYYYYMMDD(data) {
    if (!data) return null;
    // Se já for um objeto de data (comum no PostgreSQL/Node)
    if (data instanceof Date) {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }
    // Se for uma string (ISO ou formatada)
    const texto = String(data);
    if (texto.includes('T')) return texto.split('T')[0];
    return texto.substring(0, 10);
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

        // Prepara os limites do filtro
        const [anoI, mesI, diaI] = inicioInput.split('-');
        const dataInicio = new Date(anoI, mesI - 1, diaI, 0, 0, 0);
        const [anoF, mesF, diaF] = fimInput.split('-');
        const dataFim = new Date(anoF, mesF - 1, diaF, 23, 59, 59);

        // FILTRAGEM BLINDADA
        const vendasFiltradas = vendasBrutas.filter(v => {
            const dataFormatada = extrairDataYYYYMMDD(v.data_hora);
            if (!dataFormatada || !dataFormatada.includes('-')) return false;

            const [anoV, mesV, diaV] = dataFormatada.split('-');
            const dataDaVenda = new Date(anoV, mesV - 1, diaV, 12, 0, 0); 
            return dataDaVenda >= dataInicio && dataDaVenda <= dataFim;
        });
        
        let faturamento = 0;
        let contagemProdutos = {};
        let contagemAdicionais = {};
        let pedidosValidos = 0;
        let faturamentoPorDia = [0, 0, 0, 0, 0, 0, 0]; 

        vendasFiltradas.forEach(v => {
            if (!v.itens || String(v.itens).includes("[object")) return;
            
            let valorNum = parseFloat(v.valor_total || v.total || 0);
            let itensLidos = v.itens;

            if (typeof itensLidos === 'string' && itensLidos.trim().startsWith('[')) {
                try { itensLidos = JSON.parse(itensLidos); } catch(e) {}
            }

            let listaTextosDeVenda = [];
            if (Array.isArray(itensLidos)) {
                listaTextosDeVenda = itensLidos.map(item => item.nome || item.produto_nome || "");
                if (valorNum === 0) {
                    valorNum = itensLidos.reduce((soma, item) => soma + (parseFloat(item.preco) || 0), 0);
                }
            }

            if (listaTextosDeVenda.length > 0) {
                faturamento += valorNum; 
                pedidosValidos++; 

                // Descobre o dia da semana para o gráfico
                let diaSemanaIndex = new Date().getDay();
                const dataFormatada = extrairDataYYYYMMDD(v.data_hora);
                if (dataFormatada) {
                    const [anoV, mesV, diaV] = dataFormatada.split('-');
                    diaSemanaIndex = new Date(anoV, mesV - 1, diaV, 12, 0, 0).getDay();
                }
                faturamentoPorDia[diaSemanaIndex] += valorNum; 
                
                listaTextosDeVenda.forEach(textoVenda => {
                    if (!textoVenda) return;
                    // Limpa prefixos de Balcão, Delivery e Mesas
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

        // Atualiza os painéis numéricos
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
