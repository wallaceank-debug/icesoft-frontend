const API_URL = 'https://icesoft-api.onrender.com/api';

window.onload = () => {
    carregarVendas();
};

function formatarDataBR(dataString) {
    if (!dataString) return '';
    const partes = dataString.split('-');
    if (partes.length !== 3) return dataString; // Segurança extra
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

async function carregarVendas() {
    let inicioInput = document.getElementById('filtro-inicio').value;
    let fimInput = document.getElementById('filtro-fim').value;
    const textoPeriodo = document.getElementById('periodo-exibicao');

    // 1. INTELIGÊNCIA DOS 30 DIAS
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
        
        // ESCUDO 1: Se a API falhar e não mandar uma lista, cria uma vazia para não travar
        if (!Array.isArray(vendasBrutas)) {
            vendasBrutas = [];
        }

        const dataInicio = new Date(inicioInput + "T00:00:00");
        const dataFim = new Date(fimInput + "T23:59:59");

        const vendasFiltradas = vendasBrutas.filter(v => {
            // Se a coluna de data não existir no banco, a gente aprova a venda para não sumir com o dinheiro
            if (!v.data_venda && !v.created_at) return true; 
            
            // Tenta usar data_venda ou created_at (o que existir no seu banco)
            const dataDaVenda = new Date(v.data_venda || v.created_at);
            return dataDaVenda >= dataInicio && dataDaVenda <= dataFim;
        });
        
        let faturamento = 0;
        let contagemProdutos = {};
        let contagemAdicionais = {};

        vendasFiltradas.forEach(v => {
            // ESCUDO 2: Ignora completamente vendas que não têm nome ou total (dados sujos de testes antigos)
            if (!v.produto_nome || v.total === undefined) return;

            faturamento += parseFloat(v.total) || 0;

            // Transforma em texto de forma forçada para evitar travamentos
            let textoVenda = String(v.produto_nome).replace('Balcão: ', '').trim();
            let nomeBase = textoVenda.split('(')[0].trim();
            
            if (nomeBase) {
                contagemProdutos[nomeBase] = (contagemProdutos[nomeBase] || 0) + 1;
            }

            let match = textoVenda.match(/\(([^)]+)\)/);
            if(match) {
                let itensAdicionais = match[1].split(','); 
                itensAdicionais.forEach(item => {
                    let adcLimpo = item.trim();
                    if (adcLimpo) {
                        contagemAdicionais[adcLimpo] = (contagemAdicionais[adcLimpo] || 0) + 1;
                    }
                });
            }
        });

        // Só conta como pedido as vendas que não foram barradas no Escudo 2
        const totalPedidos = faturamento > 0 ? Object.keys(contagemProdutos).reduce((a, b) => a + contagemProdutos[b], 0) : 0;
        const ticketMedio = totalPedidos > 0 ? (faturamento / totalPedidos) : 0;

        document.getElementById('dash-faturamento').innerText = `R$ ${faturamento.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-ticket').innerText = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
        // Como o Dashboard estava contando vendas vazias, agora ele conta pelos produtos reais:
        document.getElementById('dash-pedidos').innerText = vendasFiltradas.filter(v => v.produto_nome).length;

        renderizarLista(contagemProdutos, 'lista-produtos-top', "Nenhum produto vendido neste período.");
        renderizarLista(contagemAdicionais, 'lista-adicionais-top', "Nenhum adicional vendido neste período.");

    } catch (e) {
        console.error("Erro detalhado (para o TI):", e);
        alert("Ops! O servidor acordou mas algo falhou. Atualize a tela.");
    }
}

function renderizarLista(objetoContagem, idElemento, msgVazio) {
    const container = document.getElementById(idElemento);
    const ordenado = Object.entries(objetoContagem).sort((a, b) => b[1] - a[1]);

    if (ordenado.length === 0) {
        container.innerHTML = `<p style="text-align:center; font-weight:normal; margin-top:20px; opacity:0.8;">${msgVazio}</p>`;
        return;
    }

    container.innerHTML = '';
    ordenado.forEach(([nome, quantidade]) => {
        container.innerHTML += `
            <div class="item-lista">
                <span>${nome}</span>
                <span class="qtd">${quantidade}x</span>
            </div>
        `;
    });
}
