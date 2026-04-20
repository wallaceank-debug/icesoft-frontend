const API_URL = 'https://icesoft-api.onrender.com/api';

window.onload = () => {
    carregarVendas();
};

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

    // INTELIGÊNCIA DE 30 DIAS
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

        const dataInicio = new Date(inicioInput + "T00:00:00");
        const dataFim = new Date(fimInput + "T23:59:59");

        const vendasFiltradas = vendasBrutas.filter(v => {
            // LENDO A GAVETA CORRETA: data_hora
            if (!v.data_hora) return true; 
            const dataDaVenda = new Date(v.data_hora);
            return dataDaVenda >= dataInicio && dataDaVenda <= dataFim;
        });
        
        let faturamento = 0;
        let contagemProdutos = {};
        let contagemAdicionais = {};

        vendasFiltradas.forEach(v => {
            // LENDO AS GAVETAS CORRETAS E BARRANDO AS VAZIAS DE ANTES (null)
            if (!v.itens || v.valor_total === null) return;

            faturamento += parseFloat(v.valor_total) || 0;

            let textoVenda = String(v.itens).replace('Balcão: ', '').trim();
            let nomeBase = textoVenda.split('(')[0].trim();
            
            if (nomeBase) contagemProdutos[nomeBase] = (contagemProdutos[nomeBase] || 0) + 1;

            let match = textoVenda.match(/\(([^)]+)\)/);
            if(match) {
                let itensAdicionais = match[1].split(','); 
                itensAdicionais.forEach(item => {
                    let adcLimpo = item.trim();
                    if (adcLimpo) contagemAdicionais[adcLimpo] = (contagemAdicionais[adcLimpo] || 0) + 1;
                });
            }
        });

        // Contagem corrigida
        const totalPedidos = vendasFiltradas.filter(v => v.itens && v.valor_total !== null).length;
        const ticketMedio = totalPedidos > 0 ? (faturamento / totalPedidos) : 0;

        document.getElementById('dash-faturamento').innerText = `R$ ${faturamento.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-ticket').innerText = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-pedidos').innerText = totalPedidos;

        renderizarLista(contagemProdutos, 'lista-produtos-top', "Nenhum produto vendido neste período.");
        renderizarLista(contagemAdicionais, 'lista-adicionais-top', "Nenhum adicional vendido neste período.");

    } catch (e) {
        console.error("Erro:", e);
        alert("Erro ao calcular vendas. Atualize a página e tente novamente.");
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