const API_URL = 'https://icesoft-api.onrender.com/api';

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
                // AQUI FOI ATUALIZADO (Limpa Balcão e Delivery)
                let textoLimpo = itensLidos.replace(/(Balcão:|Delivery:)\s*/g, '');
                listaTextosDeVenda = textoLimpo.split('+').map(t => t.trim());
            }

            if (isNaN(valorNum)) valorNum = 0;

            if (listaTextosDeVenda.length > 0 && listaTextosDeVenda.some(t => t !== "")) {
                faturamento += valorNum; 
                pedidosValidos++; 
                
                listaTextosDeVenda.forEach(textoVenda => {
                    if (!textoVenda) return;
                    
                    // AQUI TAMBÉM FOI ATUALIZADO
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
        container.innerHTML += `<div class="item-lista"><span>${nome}</span><span class="qtd">${quantidade}x</span></div>`;
    });
}