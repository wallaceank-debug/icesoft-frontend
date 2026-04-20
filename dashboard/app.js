const API_URL = 'https://icesoft-api.onrender.com/api';

window.onload = () => {
    carregarVendas();
};

// Função para transformar "2026-04-20" em "20/04/2026"
function formatarDataBR(dataString) {
    if (!dataString) return '';
    const partes = dataString.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

async function carregarVendas() {
    let inicioInput = document.getElementById('filtro-inicio').value;
    let fimInput = document.getElementById('filtro-fim').value;
    const textoPeriodo = document.getElementById('periodo-exibicao');

    // ========================================================
    // 1. INTELIGÊNCIA DOS 30 DIAS (SE NÃO HOUVER FILTRO)
    // ========================================================
    if (!inicioInput || !fimInput) {
        const dataHoje = new Date();
        const dataTrintaDiasAtras = new Date();
        dataTrintaDiasAtras.setDate(dataHoje.getDate() - 30);

        // Converte para o formato que as caixinhas de data entendem (YYYY-MM-DD)
        inicioInput = dataTrintaDiasAtras.toISOString().split('T')[0];
        fimInput = dataHoje.toISOString().split('T')[0];

        // Preenche as caixinhas visualmente para o operador saber o que está vendo
        document.getElementById('filtro-inicio').value = inicioInput;
        document.getElementById('filtro-fim').value = fimInput;
    }

    // 2. Atualiza o texto do Cabeçalho
    textoPeriodo.innerText = `${formatarDataBR(inicioInput)} ATÉ ${formatarDataBR(fimInput)}`;

    try {
        // Busca TODAS as vendas brutas do servidor
        const resposta = await fetch(`${API_URL}/vendas`);
        let vendasBrutas = await resposta.json();
        
        // ========================================================
        // 3. FILTRO DE DATA ROBUSTO (Ignora fuso horário do banco)
        // ========================================================
        // Adiciona T00:00:00 (Início do dia inicial) e T23:59:59 (Fim do dia final)
        const dataInicio = new Date(inicioInput + "T00:00:00");
        const dataFim = new Date(fimInput + "T23:59:59");

        const vendasFiltradas = vendasBrutas.filter(v => {
            // Dica: Se a sua coluna de data no banco Neon se chamar diferente de 'data_venda'
            // (ex: 'criado_em'), troque a palavra abaixo.
            if (!v.data_venda) return true; // Se a venda for antiga e não tiver data, mostra por segurança
            
            const dataDaVenda = new Date(v.data_venda);
            return dataDaVenda >= dataInicio && dataDaVenda <= dataFim;
        });
        
        let faturamento = 0;
        let contagemProdutos = {};
        let contagemAdicionais = {};

        vendasFiltradas.forEach(v => {
            faturamento += parseFloat(v.total);

            let textoVenda = v.produto_nome.replace('Balcão: ', '').trim();
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

        const totalPedidos = vendasFiltradas.length;
        const ticketMedio = totalPedidos > 0 ? (faturamento / totalPedidos) : 0;

        document.getElementById('dash-faturamento').innerText = `R$ ${faturamento.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-ticket').innerText = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-pedidos').innerText = totalPedidos;

        renderizarLista(contagemProdutos, 'lista-produtos-top', "Nenhum produto vendido neste período.");
        renderizarLista(contagemAdicionais, 'lista-adicionais-top', "Nenhum adicional vendido neste período.");

    } catch (e) {
        console.error("Erro ao carregar dashboard:", e);
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
