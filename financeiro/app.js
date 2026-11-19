const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
let categoriasFinanceiras = []; // Memória global para as categorias
let contasBancariasGlobais = []; // 👇 NOVO: Guarda os bancos na memória
let filtroLancamentosAtual = 'todos'; // 👇 NOVO: Guarda o filtro ativo

window.onload = async () => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
    
    if (document.getElementById('filtro-data-inicio')) document.getElementById('filtro-data-inicio').value = primeiroDia;
    if (document.getElementById('filtro-data-fim')) document.getElementById('filtro-data-fim').value = ultimoDia;

    await carregarCategorias(); 
    await carregarBancos(); 
    popularFiltroBancos();
    popularFiltroCategorias();
    await carregarResumoFinanceiro();
    await carregarLancamentos();
};

function popularFiltroBancos() {
    const selectFiltro = document.getElementById('filtro-banco');
    if (selectFiltro) {
        selectFiltro.innerHTML = '<option value="">Todos os Bancos</option>';
        contasBancariasGlobais.forEach(b => {
            selectFiltro.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
        });
    }
}

function popularFiltroCategorias() {
    const selectFiltroCat = document.getElementById('filtro-categoria');
    if (!selectFiltroCat) return;
    
    selectFiltroCat.innerHTML = '<option value="">Todas as Categorias</option>';
    const catFiltradas = categoriasFinanceiras.filter(c => c.ativa !== false);
    
    const GRUPOS_PAI = [
        { dre: 'receita_bruta', nome: '1 - Receitas Operacionais Brutas' },
        { dre: 'deducoes', nome: '2 - Deduções da Receita Bruta' },
        { dre: 'cmv', nome: '3 - Custos Variáveis (CMV)' },
        { dre: 'despesas_operacionais', nome: '4 - Despesas Operacionais Fixas' },
        { dre: 'despesas_vendas', nome: '5 - Despesas Comerciais e Logística' },
        { dre: 'despesas_financeiras', nome: '6 - Despesas Financeiras' },
        { dre: 'investimentos', nome: '7 - Investimentos em Ativos (CAPEX)' },
        { dre: 'outras_receitas', nome: '8 - Entradas Não Operacionais' },
        { dre: 'nao_operacional', nome: '9 - Saídas Não Operacionais' },
        { dre: 'aporte_capital', nome: '10 - Financiamentos e Sócios (Entradas)' },
        { dre: 'distribuicao_lucros', nome: '11 - Financiamentos e Sócios (Saídas)' },
        { dre: 'movimentacao_interna', nome: '12 - Movimentações Internas' }
    ];

    let indexPaiContador = 1;
    GRUPOS_PAI.forEach((grupo) => {
        const subcategorias = catFiltradas.filter(c => c.dre_ref === grupo.dre).sort((a,b) => a.ordem - b.ordem);
        if (subcategorias.length > 0) {
            let optgroup = `<optgroup label="${grupo.nome}">`;
            subcategorias.forEach((cat, indexFilho) => {
                optgroup += `<option value="${cat.id}">[${indexPaiContador}.${indexFilho + 1}] ${cat.nome}</option>`;
            });
            optgroup += `</optgroup>`;
            selectFiltroCat.innerHTML += optgroup;
        }
        indexPaiContador++;
    });
}

async function carregarCategorias() {
    try {
        const res = await fetch(`${API_URL}/financeiro/categorias`);
        categoriasFinanceiras = await res.json();
    } catch (e) { console.error("Erro ao carregar categorias"); }
}

// 🏦 Filtra o extrato clicando direto no card do banco para conciliação
function selecionarBancoConciliacao(bancoId) {
    const selectBanco = document.getElementById('filtro-banco');
    const checkOcultar = document.getElementById('filtro-ocultar-internos');
    const btnTodos = document.getElementById('btn-ver-todos-bancos');

    if (selectBanco) selectBanco.value = bancoId ? String(bancoId) : '';
    
    // Quando seleciona um banco específico para conciliar, mostra também as transferências e fechamentos dele
    if (checkOcultar) {
        checkOcultar.checked = !bancoId;
    }
    if (btnTodos) {
        btnTodos.style.display = bancoId ? 'inline-block' : 'none';
    }

    renderizarCardsBancos();
    carregarLancamentos();
}

function renderizarCardsBancos() {
    const containerBancos = document.getElementById('container-saldos-bancos');
    if (!containerBancos) return;

    const bancoSelecionado = document.getElementById('filtro-banco')?.value || '';
    containerBancos.innerHTML = '';

    contasBancariasGlobais.forEach(b => {
        const corSaldo = b.saldo_atual >= 0 ? '#2e7d32' : '#c62828';
        const isSelecionado = String(b.id) === String(bancoSelecionado);
        const isTransicao = b.nome.toLowerCase().includes('transição');
        const bordaCard = isSelecionado ? '2px solid #1565c0' : '1px solid #e0e0e0';
        const fundoCard = isSelecionado ? '#f0f7ff' : '#fafafa';

        let btnConciliarHtml = '';
        if (isTransicao && b.saldo_atual > 0) {
            btnConciliarHtml = `
                <button onclick="event.stopPropagation(); abrirModalTransferencia();" style="margin-top: 8px; width: 100%; background: #ff9800; color: white; border: none; padding: 5px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
                    🔄 Conciliar Lote
                </button>
            `;
        }

        containerBancos.innerHTML += `
            <div onclick="selecionarBancoConciliacao(${b.id})" style="background: ${fundoCard}; padding: 12px 16px; border-radius: 10px; min-width: 185px; flex-shrink: 0; border: ${bordaCard}; border-left: 4px solid ${isTransicao ? '#ff9800' : '#2196F3'}; cursor: pointer; transition: 0.2s;">
                <div style="font-size: 0.82rem; color: #555; font-weight: 600; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${b.nome}">${b.nome}</div>
                <div style="font-size: 1.15rem; font-weight: 700; color: ${corSaldo};">
                    R$ ${parseFloat(b.saldo_atual).toFixed(2).replace('.', ',')}
                </div>
                ${btnConciliarHtml}
            </div>
        `;
    });
}

async function carregarResumoFinanceiro() {
    try {
        await carregarBancos();
        const cracha = localStorage.getItem('icesoft_token');
        
        const res = await fetch(`${API_URL}/financeiro/resumo`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${cracha}` }
        });
        
        if (res.status === 401 || res.status === 403) {
            window.location.href = '../login/index.html';
            return;
        }

        const dados = await res.json();
        
        const contaTransicao = contasBancariasGlobais.find(b => b.nome.toLowerCase().includes('transição'));
        const saldoTransicao = contaTransicao ? parseFloat(contaTransicao.saldo_atual) : 0;

        const totalAReceber = parseFloat(dados.receber || 0) + saldoTransicao;
        const totalAPagar = parseFloat(dados.pagar || 0);

        document.getElementById('fin-receber').innerText = `R$ ${totalAReceber.toFixed(2).replace('.', ',')}`;
        document.getElementById('fin-pagar').innerText = `R$ ${totalAPagar.toFixed(2).replace('.', ',')}`;

        const elDetalheTransicao = document.getElementById('fin-detalhe-transicao');
        if (elDetalheTransicao) {
            elDetalheTransicao.innerText = saldoTransicao > 0 
                ? `Sendo R$ ${saldoTransicao.toFixed(2).replace('.', ',')} na Conta de Transição`
                : `Nenhum lote retido na Transição`;
        }
        
        const saldoApenasBancos = contasBancariasGlobais
            .filter(b => !b.nome.toLowerCase().includes('caixa físico') && !b.nome.toLowerCase().includes('gaveta') && !b.nome.toLowerCase().includes('transição'))
            .reduce((soma, b) => soma + parseFloat(b.saldo_atual), 0);

        const elSaldoBancos = document.getElementById('fin-saldo-bancos');
        elSaldoBancos.innerText = `R$ ${saldoApenasBancos.toFixed(2).replace('.', ',')}`;
        elSaldoBancos.style.color = saldoApenasBancos < 0 ? '#f44336' : '#333';

        // Termômetro prático: Saldo nos Bancos vs Boletos a Pagar do Mês
        const elFolego = document.getElementById('fin-folego-mes');
        if (elFolego) {
            const diferencaMes = saldoApenasBancos - totalAPagar;
            if (diferencaMes >= 0) {
                elFolego.style.color = '#2e7d32';
                elFolego.innerText = `✅ Cobre as contas (Sobra R$ ${diferencaMes.toFixed(2).replace('.', ',')})`;
            } else {
                elFolego.style.color = '#d32f2f';
                elFolego.innerText = `⚠️ Faltam R$ ${Math.abs(diferencaMes).toFixed(2).replace('.', ',')} p/ cobrir o mês`;
            }
        }

        renderizarCardsBancos();
    } catch (e) {
        console.error("Erro ao carregar resumo:", e);
    }
}

function filtrarLancamentos(tipo) {
    filtroLancamentosAtual = tipo;
    carregarLancamentos();
}

function limparFiltrosTabela() {
    document.getElementById('filtro-busca').value = '';
    document.getElementById('filtro-banco').value = '';
    document.getElementById('filtro-categoria').value = '';
    if (document.getElementById('filtro-ocultar-internos')) {
        document.getElementById('filtro-ocultar-internos').checked = true;
    }
    if (document.getElementById('btn-ver-todos-bancos')) {
        document.getElementById('btn-ver-todos-bancos').style.display = 'none';
    }
    
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
    
    document.getElementById('filtro-data-inicio').value = primeiroDia;
    document.getElementById('filtro-data-fim').value = ultimoDia;
    
    filtroLancamentosAtual = 'todos';
    renderizarCardsBancos();
    carregarLancamentos();
}

async function carregarLancamentos() {
    const container = document.getElementById('fin-lista-lancamentos');
    const tituloTabela = document.getElementById('fin-titulo-tabela');
    
    const busca = document.getElementById('filtro-busca')?.value || '';
    const bancoId = document.getElementById('filtro-banco')?.value || '';
    const categoriaId = document.getElementById('filtro-categoria')?.value || '';
    const dataInicio = document.getElementById('filtro-data-inicio')?.value || '';
    const dataFim = document.getElementById('filtro-data-fim')?.value || '';
    const ocultarInternos = document.getElementById('filtro-ocultar-internos')?.checked || false;
    
    try {
        const params = new URLSearchParams({ 
            busca, 
            banco_id: bancoId,
            categoria_id: categoriaId,
            data_inicio: dataInicio, 
            data_fim: dataFim,
            filtro_card: (filtroLancamentosAtual === 'pagar' || filtroLancamentosAtual === 'receber') ? filtroLancamentosAtual : 'todos'
        });
        
        const res = await fetch(`${API_URL}/financeiro/lancamentos?${params}`);
        let listaBruta = await res.json();

        // Identifica a categoria de movimentação interna para calcular o resumo limpo do mês
        const idsCatInterna = categoriasFinanceiras
            .filter(c => c.dre_ref === 'movimentacao_interna')
            .map(c => Number(c.id));

        const ehMovimentacaoInterna = (item) => {
            const desc = (item.descricao || '').toLowerCase();
            return idsCatInterna.includes(Number(item.categoria_id)) ||
                   desc.includes('fechamento de caixa #') ||
                   desc.includes('[saída transferência]') ||
                   desc.includes('[entrada transferência]');
        };

        atualizarLabelMesNavegacao();

        // Calcula o Resumo das Transações no Período e o que vence nos próximos 7 dias
        let entradasPagasMes = 0;
        let saidasPagasMes = 0;
        let qtdContasPendentes = 0;
        let totalPagar7Dias = 0;

        const limite7Dias = new Date();
        limite7Dias.setDate(limite7Dias.getDate() + 7);
        const limite7DiasStr = limite7Dias.toLocaleDateString('en-CA');

        listaBruta.forEach(item => {
            if (ehMovimentacaoInterna(item)) return;
            const val = parseFloat(item.valor) || 0;
            if (item.status === 'Pago') {
                if (item.tipo === 'Receita') entradasPagasMes += val;
                else if (item.tipo === 'Despesa') saidasPagasMes += val;
            } else if (item.status === 'Pendente' && item.tipo === 'Despesa') {
                qtdContasPendentes++;
                if (item.data_vencimento) {
                    const dItem = new Date(item.data_vencimento);
                    dItem.setMinutes(dItem.getMinutes() + dItem.getTimezoneOffset());
                    if (dItem.toLocaleDateString('en-CA') <= limite7DiasStr) {
                        totalPagar7Dias += val;
                    }
                }
            }
        });

        const saldoMovimentadoMes = entradasPagasMes - saidasPagasMes;
        if (document.getElementById('fin-mes-entradas')) {
            document.getElementById('fin-mes-entradas').innerText = `R$ ${entradasPagasMes.toFixed(2).replace('.', ',')}`;
            document.getElementById('fin-mes-saidas').innerText = `R$ ${saidasPagasMes.toFixed(2).replace('.', ',')}`;
            const elResumoSaldo = document.getElementById('fin-resumo-mes-saldo');
            elResumoSaldo.innerText = `${saldoMovimentadoMes >= 0 ? '' : '- '}R$ ${Math.abs(saldoMovimentadoMes).toFixed(2).replace('.', ',')}`;
            elResumoSaldo.style.color = saldoMovimentadoMes >= 0 ? '#2e7d32' : '#c62828';
        }
        if (document.getElementById('fin-qtd-pendentes')) {
            document.getElementById('fin-qtd-pendentes').innerHTML = totalPagar7Dias > 0
                ? `<span style="color:#d32f2f; font-weight:700;">🔥 Próx. 7 dias: R$ ${totalPagar7Dias.toFixed(2).replace('.', ',')}</span> (${qtdContasPendentes} no mês)`
                : (qtdContasPendentes > 0 ? `✅ Nada p/ os próx. 7 dias (${qtdContasPendentes} no mês)` : `Nenhuma conta pendente no período`);
        }

        // Aplica filtros visuais na lista
        let lista = listaBruta.filter(item => {
            if (ocultarInternos && ehMovimentacaoInterna(item)) return false;
            if (filtroLancamentosAtual === 'pagos' && item.status !== 'Pago') return false;
            return true;
        });

        if (filtroLancamentosAtual === 'receber') {
            tituloTabela.innerHTML = '🔍 Filtrando: Contas a Receber (Pendentes)';
            tituloTabela.style.color = '#4CAF50';
        } else if (filtroLancamentosAtual === 'pagar') {
            tituloTabela.innerHTML = '🔍 Filtrando: Contas a Pagar (Pendentes)';
            tituloTabela.style.color = '#f44336';
        } else if (filtroLancamentosAtual === 'pagos') {
            tituloTabela.innerHTML = '✅ Filtrando: Lançamentos Já Pagos / Recebidos';
            tituloTabela.style.color = '#00838f';
        } else {
            const bancoObj = contasBancariasGlobais.find(b => String(b.id) === String(bancoId));
            tituloTabela.innerHTML = bancoObj ? `🏦 Extrato: ${bancoObj.nome}` : 'Resumo de Transações do Mês';
            tituloTabela.style.color = '#333';
        }

        if (lista.length === 0) {
            container.innerHTML = '<p style="color: #999; font-style: italic; padding: 15px 0;">Nenhum lançamento encontrado para este filtro.</p>';
            return;
        }

        lista.sort((a, b) => {
            if (!a.data_vencimento) return 1;
            if (!b.data_vencimento) return -1;
            return new Date(b.data_vencimento) - new Date(a.data_vencimento);
        });

        const hojeStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

        let html = `<table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <tr style="border-bottom: 2px solid #eee; color: #666;">
                            <th style="padding: 10px;">Vencimento</th>
                            <th style="padding: 10px;">Descrição</th>
                            <th style="padding: 10px;">Banco / Conta</th>
                            <th style="padding: 10px;">Status</th>
                            <th style="padding: 10px; text-align: right;">Valor</th>
                            <th style="padding: 10px; text-align: center;">Ações</th>
                        </tr>`;
        
        let dataAtualGrupo = '';

        lista.forEach(item => {
            const corValor = item.tipo === 'Receita' ? '#4CAF50' : '#f44336';
            let dataFormatada = 'Sem data';
            let dataAgrupamento = 'Sem data';
            let dataIsoItem = '';
            
            if (item.data_vencimento) {
                const d = new Date(item.data_vencimento);
                d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
                dataFormatada = d.toLocaleDateString('pt-BR');
                dataIsoItem = d.toLocaleDateString('en-CA');
                
                const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
                dataAgrupamento = `${d.getDate()} de ${meses[d.getMonth()]}`;
            }
            
            if (dataAgrupamento !== dataAtualGrupo) {
                html += `<tr style="background-color: #f8f9fa; border-top: 2px solid #eee; border-bottom: 1px solid #ddd;">
                            <td colspan="6" style="padding: 10px; font-weight: bold; color: #333; font-size: 0.92rem;">
                                📅 ${dataAgrupamento}
                            </td>
                         </tr>`;
                dataAtualGrupo = dataAgrupamento;
            }

            // Etiqueta inteligente de vencimento
            let badgeStatusHtml = '';
            if (item.status === 'Pago') {
                badgeStatusHtml = `<span style="background: #4CAF50; color: white; padding: 4px 10px; border-radius: 10px; font-size: 0.78rem; font-weight: 600;">Pago</span>`;
            } else if (dataIsoItem && dataIsoItem < hojeStr) {
                badgeStatusHtml = `<span style="background: #d32f2f; color: white; padding: 4px 10px; border-radius: 10px; font-size: 0.78rem; font-weight: 700;">⚠️ Atrasado</span>`;
            } else if (dataIsoItem && dataIsoItem === hojeStr) {
                badgeStatusHtml = `<span style="background: #f57c00; color: white; padding: 4px 10px; border-radius: 10px; font-size: 0.78rem; font-weight: 700;">🔥 Vence Hoje</span>`;
            } else {
                badgeStatusHtml = `<span style="background: #FF9800; color: white; padding: 4px 10px; border-radius: 10px; font-size: 0.78rem; font-weight: 600;">Pendente</span>`;
            }

            const bancoItem = contasBancariasGlobais.find(b => Number(b.id) === Number(item.conta_id));
            const nomeBanco = bancoItem ? bancoItem.nome : '-';

            let iconeRepeticao = item.recorrente ? `<span class="material-symbols-outlined" style="font-size: 1rem; color: #9c27b0; vertical-align: middle; margin-left: 5px;" title="Conta Fixa / Parcelada">repeat</span>` : '';
            const itemString = encodeURIComponent(JSON.stringify(item));

            // Botão de Baixa Rápida para Pendentes OU Botão de Auditar Lote se for entrada na Conta de Transição
            const ehEntradaTransicao = bancoItem && bancoItem.nome.toLowerCase().includes('transição') && item.tipo === 'Receita';
            let btnBaixaRapida = '';
            if (item.status === 'Pendente') {
                btnBaixaRapida = `<button onclick="darBaixaRapida('${itemString}')" style="background:#e8f5e9; border:1px solid #a5d6a7; color:#2e7d32; cursor:pointer; font-size:0.8rem; font-weight:700; padding:4px 8px; border-radius:6px; margin-right:6px;" title="Marcar como Pago em 1 clique">✅ Baixar</button>`;
            } else if (ehEntradaTransicao) {
                btnBaixaRapida = `<button onclick="auditarLancamentoTransicao('${itemString}')" style="background:#fff3e0; border:1px solid #ffb74d; color:#e65100; cursor:pointer; font-size:0.8rem; font-weight:700; padding:4px 8px; border-radius:6px; margin-right:6px;" title="Transferir este lote para o banco real">🔄 Auditar</button>`;
            }

            html += `<tr style="border-bottom: 1px solid #eee; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f1f8ff'" onmouseout="this.style.backgroundColor='transparent'">
                        <td style="padding: 10px; color: #666; font-size: 0.9rem;">${dataFormatada}</td>
                        <td style="padding: 10px; font-weight: 600; color: #333;">${item.descricao} ${iconeRepeticao}</td>
                        <td style="padding: 10px; color: #666; font-size: 0.85rem;">${nomeBanco}</td>
                        <td style="padding: 10px;">${badgeStatusHtml}</td>
                        <td style="padding: 10px; text-align: right; font-weight: bold; color: ${corValor};">
                            ${item.tipo === 'Despesa' ? '- ' : ''}R$ ${parseFloat(item.valor).toFixed(2).replace('.', ',')}
                        </td>
                        <td style="padding: 10px; text-align: center; white-space: nowrap;">
                            ${btnBaixaRapida}
                            <button onclick="prepararEdicaoLancamento('${itemString}')" style="background:none; border:none; color:#FF9800; cursor:pointer; font-size:1.15rem; vertical-align:middle;" title="Editar Lançamento">✏️</button>
                            <button onclick="deletarLancamento(${item.id}, ${item.recorrente})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.15rem; vertical-align:middle;" title="Excluir Lançamento">🗑️</button>
                        </td>
                     </tr>`;
        });
        
        html += `</table>`;
        container.innerHTML = html;

    } catch (e) {
        container.innerHTML = '<p style="color: red;">Erro ao buscar os lançamentos no banco de dados.</p>';
    }
}

// ⚡ NOVA FUNÇÃO: Dá baixa em uma conta pendente com 1 clique
async function darBaixaRapida(itemStringCodificado) {
    const item = JSON.parse(decodeURIComponent(itemStringCodificado));
    if (!confirm(`Confirmar baixa de "${item.descricao}" no valor de R$ ${parseFloat(item.valor).toFixed(2).replace('.', ',')}?`)) return;

    let dataVenc = '';
    if (item.data_vencimento) {
        const d = new Date(item.data_vencimento);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        dataVenc = d.toISOString().split('T')[0];
    }

    try {
        const payload = {
            descricao: item.descricao,
            valor: parseFloat(item.valor),
            data_vencimento: dataVenc,
            status: 'Pago',
            tipo: item.tipo,
            categoria_id: item.categoria_id,
            conta_id: item.conta_id,
            aplicar_futuros: false
        };

        const res = await fetch(`${API_URL}/financeiro/lancamentos/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            await carregarResumoFinanceiro();
            await carregarLancamentos();
        } else {
            alert("❌ Erro ao dar baixa no lançamento.");
        }
    } catch (e) {
        alert("❌ Falha de conexão com o servidor.");
    }
}

async function deletarLancamento(id, isRecorrente) {
    if (!confirm("⚠️ Tem certeza que deseja excluir este lançamento?")) return;
    
    // 👇 A PERGUNTA INTELIGENTE DO SISTEMA (Para exclusão)
    let deletarFuturos = false;
    if (isRecorrente) {
        deletarFuturos = confirm("🔄 ATENÇÃO: Esta é uma conta fixa/parcelada.\n\nDeseja excluir também TODOS os lançamentos FUTUROS dessa mesma conta?");
    }

    try {
        const res = await fetch(`${API_URL}/financeiro/lancamentos/${id}?futuros=${deletarFuturos}`, { method: 'DELETE' });
        if (res.ok) {
            await carregarResumoFinanceiro();
            await carregarLancamentos();
            await carregarAlertasInteligentes();
        } else alert("❌ Erro ao tentar excluir no banco de dados.");
    } catch (e) { alert("❌ Falha de conexão com o servidor."); }
}

// ==========================================
// LÓGICA DO MODAL (NOVO LANÇAMENTO / EDITAR)
// ==========================================
let tipoLancamentoAtual = '';

function abrirModalLancamento(tipo) {
    tipoLancamentoAtual = tipo; 
    document.getElementById('modal-titulo').innerText = `Nova ${tipo}`;
    document.getElementById('edit-lan-id').value = ''; // Limpa a memória
    
    document.getElementById('lan-descricao').value = '';
    document.getElementById('lan-valor').value = '';
    document.getElementById('lan-data').value = new Date().toLocaleDateString('en-CA');
    document.getElementById('lan-status').value = 'Pendente';
    
    // 👇 Garante que a área de repetição VAI APARECER ao criar um novo
    document.getElementById('area-recorrencia').style.display = 'flex';
    document.getElementById('lan-recorrencia').value = 'unico';
    document.getElementById('lan-qtd-meses').value = '2';
    toggleParcelas();
    
    // 🧠 MÁGICA YAMPA: Popula Categorias Separadas por Pai e Filho
    const selectCat = document.getElementById('lan-categoria');
    selectCat.innerHTML = '<option value="">Selecione a Subconta</option>';
    
    const nomesDRE = {
        'receita_bruta': '1 - Receitas Operacionais Brutas', 
        'deducoes': '2 - Deduções da Receita Bruta',
        'cmv': '3 - Custos Variáveis (CMV)', 
        'despesas_operacionais': '4 - Despesas Operacionais Fixas',
        'despesas_vendas': '5 - Despesas Comerciais e Logística', 
        'despesas_financeiras': '6 - Despesas Financeiras',
        'investimentos': '7 - Investimentos em Ativos (CAPEX)', 
        'outras_receitas': '8.A - Entradas Não Operacionais',
        'nao_operacional': '8.B - Saídas Não Operacionais', 
        'aporte_capital': '9.A - Sócios e Financiamentos (Entradas)',
        'distribuicao_lucros': '9.B - Sócios e Financiamentos (Saídas)', 
        'movimentacao_interna': '10 - Movimentações Internas'
    };

    const tipoFiltro = (typeof item !== 'undefined') ? item.tipo : tipo;
    const catFiltradas = categoriasFinanceiras.filter(c => c.tipo === tipoFiltro && c.ativa !== false);
    
    const GRUPOS_PAI = [
        { dre: 'receita_bruta', nome: '1 - Receitas Operacionais Brutas' },
        { dre: 'deducoes', nome: '2 - Deduções da Receita Bruta' },
        { dre: 'cmv', nome: '3 - Custos Variáveis (CMV)' },
        { dre: 'despesas_operacionais', nome: '4 - Despesas Operacionais Fixas' },
        { dre: 'despesas_vendas', nome: '5 - Despesas Comerciais e Logística' },
        { dre: 'despesas_financeiras', nome: '6 - Despesas Financeiras' },
        { dre: 'investimentos', nome: '7 - Investimentos em Ativos (CAPEX)' },
        { dre: 'outras_receitas', nome: '8 - Entradas Não Operacionais' },
        { dre: 'nao_operacional', nome: '9 - Saídas Não Operacionais' },
        { dre: 'aporte_capital', nome: '10 - Financiamentos e Sócios (Entradas)' },
        { dre: 'distribuicao_lucros', nome: '11 - Financiamentos e Sócios (Saídas)' },
        { dre: 'movimentacao_interna', nome: '12 - Movimentações Internas' }
    ];

    let indexPaiContador = 1;
    GRUPOS_PAI.forEach((grupo) => {
        const subcategorias = catFiltradas.filter(c => c.dre_ref === grupo.dre).sort((a,b) => a.ordem - b.ordem);
        if (subcategorias.length > 0) {
            let optgroup = `<optgroup label="${grupo.nome}">`;
            subcategorias.forEach((cat, indexFilho) => {
                optgroup += `<option value="${cat.id}">[${indexPaiContador}.${indexFilho + 1}] ${cat.nome}</option>`;
            });
            optgroup += `</optgroup>`;
            selectCat.innerHTML += optgroup;
        }
        indexPaiContador++;
    });

    const selectConta = document.getElementById('lan-conta');
    selectConta.innerHTML = '<option value="">Selecione o Banco</option>';
    contasBancariasGlobais.forEach(b => {
        selectConta.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
    });

    const btnSalvar = document.getElementById('btn-salvar-lan');
    btnSalvar.innerText = "Salvar";
    btnSalvar.style.backgroundColor = (tipo === 'Receita') ? '#4CAF50' : '#f44336';
    
    document.getElementById('modal-lancamento').style.display = 'flex';
}

let lancamentoSendoEditado = null; // 🧠 Memória global para edição

function prepararEdicaoLancamento(itemStringCodificado) {
    const item = JSON.parse(decodeURIComponent(itemStringCodificado));
    
    lancamentoSendoEditado = item; // Guarda na memória se ele é de repetição
    tipoLancamentoAtual = item.tipo;
    document.getElementById('modal-titulo').innerText = `Editar ${item.tipo}`;
    document.getElementById('edit-lan-id').value = item.id;
    
    document.getElementById('lan-descricao').value = item.descricao;
    document.getElementById('lan-valor').value = parseFloat(item.valor).toFixed(2);
    
    if (item.data_vencimento) {
        const d = new Date(item.data_vencimento);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        document.getElementById('lan-data').value = d.toISOString().split('T')[0];
    }
    
    document.getElementById('lan-status').value = item.status;

    const selectCat = document.getElementById('lan-categoria');
    selectCat.innerHTML = '<option value="">Selecione a Subconta</option>';
    
    const nomesDRE = {
        'receita_bruta': '1 - Receitas Operacionais Brutas', 
        'deducoes': '2 - Deduções da Receita Bruta',
        'cmv': '3 - Custos Variáveis (CMV)', 
        'despesas_operacionais': '4 - Despesas Operacionais Fixas',
        'despesas_vendas': '5 - Despesas Comerciais e Logística', 
        'despesas_financeiras': '6 - Despesas Financeiras',
        'investimentos': '7 - Investimentos em Ativos (CAPEX)', 
        'outras_receitas': '8.A - Entradas Não Operacionais',
        'nao_operacional': '8.B - Saídas Não Operacionais', 
        'aporte_capital': '9.A - Sócios e Financiamentos (Entradas)',
        'distribuicao_lucros': '9.B - Sócios e Financiamentos (Saídas)', 
        'movimentacao_interna': '10 - Movimentações Internas'
    };

    const tipoFiltro = (typeof item !== 'undefined') ? item.tipo : tipo;
    const catFiltradas = categoriasFinanceiras.filter(c => c.tipo === tipoFiltro && (c.ativa !== false || c.id === item.categoria_id));
    
    const GRUPOS_PAI = [
        { dre: 'receita_bruta', nome: '1 - Receitas Operacionais Brutas' },
        { dre: 'deducoes', nome: '2 - Deduções da Receita Bruta' },
        { dre: 'cmv', nome: '3 - Custos Variáveis (CMV)' },
        { dre: 'despesas_operacionais', nome: '4 - Despesas Operacionais Fixas' },
        { dre: 'despesas_vendas', nome: '5 - Despesas Comerciais e Logística' },
        { dre: 'despesas_financeiras', nome: '6 - Despesas Financeiras' },
        { dre: 'investimentos', nome: '7 - Investimentos em Ativos (CAPEX)' },
        { dre: 'outras_receitas', nome: '8 - Entradas Não Operacionais' },
        { dre: 'nao_operacional', nome: '9 - Saídas Não Operacionais' },
        { dre: 'aporte_capital', nome: '10 - Financiamentos e Sócios (Entradas)' },
        { dre: 'distribuicao_lucros', nome: '11 - Financiamentos e Sócios (Saídas)' },
        { dre: 'movimentacao_interna', nome: '12 - Movimentações Internas' }
    ];

    let indexPaiContador = 1;
    GRUPOS_PAI.forEach((grupo) => {
        const subcategorias = catFiltradas.filter(c => c.dre_ref === grupo.dre).sort((a,b) => a.ordem - b.ordem);
        if (subcategorias.length > 0) {
            let optgroup = `<optgroup label="${grupo.nome}">`;
            subcategorias.forEach((cat, indexFilho) => {
                const isSelected = (cat.id === item.categoria_id) ? 'selected' : '';
                optgroup += `<option value="${cat.id}" ${isSelected}>[${indexPaiContador}.${indexFilho + 1}] ${cat.nome}</option>`;
            });
            optgroup += `</optgroup>`;
            selectCat.innerHTML += optgroup;
        }
        indexPaiContador++;
    });

    const selectConta = document.getElementById('lan-conta');
    selectConta.innerHTML = '<option value="">Selecione o Banco</option>';
    contasBancariasGlobais.forEach(b => {
        selectConta.innerHTML += `<option value="${b.id}" ${b.id === item.conta_id ? 'selected' : ''}>${b.nome}</option>`;
    });

    const btnSalvar = document.getElementById('btn-salvar-lan');
    btnSalvar.innerText = "Atualizar";
    btnSalvar.style.backgroundColor = '#FF9800'; 
    
    const areaRec = document.getElementById('area-recorrencia');
    if (areaRec) areaRec.style.display = 'none';
    
    document.getElementById('modal-lancamento').style.display = 'flex';
}

function fecharModalLancamento() {
    document.getElementById('modal-lancamento').style.display = 'none';
}

function toggleParcelas() {
    const tipo = document.getElementById('lan-recorrencia').value;
    document.getElementById('div-lan-parcelas').style.display = (tipo !== 'unico') ? 'block' : 'none';
}

async function salvarLancamento() {
    const idEdit = document.getElementById('edit-lan-id').value;
    const descricao = document.getElementById('lan-descricao').value.trim();
    const valor = parseFloat(document.getElementById('lan-valor').value);
    const data_vencimento = document.getElementById('lan-data').value;
    const status = document.getElementById('lan-status').value;
    const categoria_id = document.getElementById('lan-categoria').value;
    const conta_id = document.getElementById('lan-conta').value;
    const recorrencia_tipo = document.getElementById('lan-recorrencia').value;
    const qtd_meses = document.getElementById('lan-qtd-meses').value;

    if (!descricao || isNaN(valor) || valor <= 0 || !data_vencimento) return alert("⚠️ Por favor, preencha a descrição, valor e vencimento.");
    if (!categoria_id || !conta_id) return alert("⚠️ Selecione a Categoria (DRE) e a Conta Bancária.");

    // 👇 A PERGUNTA INTELIGENTE DO SISTEMA (Para edição)
    let aplicar_futuros = false;
    if (idEdit && lancamentoSendoEditado && lancamentoSendoEditado.recorrente) {
        aplicar_futuros = confirm("🔄 ATENÇÃO: Esta é uma conta fixa/parcelada.\n\nDeseja aplicar o novo Valor e Categoria também para as parcelas FUTURAS?");
    }

    const btnSalvar = document.getElementById('btn-salvar-lan');
    btnSalvar.innerText = "Salvando...";
    btnSalvar.disabled = true;

    try {
        const payload = { descricao, valor, data_vencimento, status, tipo: tipoLancamentoAtual, categoria_id, conta_id, recorrencia_tipo, qtd_meses, aplicar_futuros };
        let res;

        if (idEdit) {
            res = await fetch(`${API_URL}/financeiro/lancamentos/${idEdit}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
        } else {
            res = await fetch(`${API_URL}/financeiro/lancamentos`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
        }

        if (res.ok) {
            fecharModalLancamento();
            await carregarResumoFinanceiro();
            await carregarLancamentos();
            await carregarAlertasInteligentes();
        } else {
            alert("❌ Erro ao salvar lançamento.");
        }
    } catch (e) {
        alert("❌ Falha de conexão com o servidor.");
    } finally {
        btnSalvar.disabled = false;
    }
}

// ==========================================
// 🏦 LÓGICA DE CONTAS BANCÁRIAS (CORRIGIDO)
// ==========================================
async function carregarBancos() {
    try {
        const res = await fetch(`${API_URL}/financeiro/bancos`);
        contasBancariasGlobais = await res.json();
    } catch (e) { console.error("Erro ao carregar bancos"); }
}

async function abrirModalBancos() {
    await carregarBancos(); 
    const container = document.getElementById('lista-bancos-cadastrados');
    container.innerHTML = '';
    
    contasBancariasGlobais.forEach(banco => {
        container.innerHTML += `
            <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: #333; font-size: 0.95rem;">${banco.nome}</strong>
                    <div style="font-weight: bold; color: ${banco.saldo_atual >= 0 ? '#4CAF50' : '#f44336'}; font-size: 0.95rem;">
                        R$ ${parseFloat(banco.saldo_atual).toFixed(2).replace('.', ',')}
                    </div>
                </div>
                <div style="display: flex; gap: 15px;">
                    <button onclick="prepararEdicaoBanco(${banco.id}, '${banco.nome}', ${banco.saldo_inicial})" style="background:none; border:none; color:#FF9800; cursor:pointer; font-size:1.2rem;" title="Editar Banco">✏️</button>
                    <button onclick="deletarBanco(${banco.id})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.2rem;" title="Excluir Banco">🗑️</button>
                </div>
            </div>
        `;
    });

    // Reseta o formulário para modo inclusão padrão ao abrir
    document.getElementById('edit-banco-id').value = '';
    document.getElementById('novo-banco-nome').value = '';
    document.getElementById('novo-banco-saldo').value = '0.00';
    document.getElementById('titulo-acao-banco').innerText = 'Adicionar Novo Banco';
    
    const btnSalvar = document.getElementById('btn-salvar-banco');
    if(btnSalvar) {
        btnSalvar.innerText = '+ Salvar Banco';
        btnSalvar.style.background = '#2196F3';
    }

    document.getElementById('modal-bancos').style.display = 'flex';
}

function fecharModalBancos() {
    document.getElementById('modal-bancos').style.display = 'none';
}

// Ativa o modo de edição jogando os dados para as caixas de texto
function prepararEdicaoBanco(id, nome, saldo_inicial) {
    document.getElementById('edit-banco-id').value = id;
    document.getElementById('novo-banco-nome').value = nome;
    document.getElementById('novo-banco-saldo').value = parseFloat(saldo_inicial).toFixed(2);
    
    document.getElementById('titulo-acao-banco').innerText = 'Editar Conta Bancária';
    const btnSalvar = document.getElementById('btn-salvar-banco');
    if (btnSalvar) {
        btnSalvar.innerText = 'Atualizar Banco';
        btnSalvar.style.background = '#FF9800'; // Cor laranja para alertar edição
    }
}

async function salvarBanco() {
    const idEdit = document.getElementById('edit-banco-id').value;
    const nome = document.getElementById('novo-banco-nome').value.trim();
    const saldoInicial = parseFloat(document.getElementById('novo-banco-saldo').value) || 0;
    
    if (!nome) return alert("⚠️ Digite o nome do banco!");

    try {
        let res;
        if (idEdit) {
            // Se tem ID na memória, atualiza usando PUT
            res = await fetch(`${API_URL}/financeiro/bancos/${idEdit}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nome, saldo_inicial: saldoInicial })
            });
        } else {
            // Se não tem ID, cria um novo registro usando POST
            res = await fetch(`${API_URL}/financeiro/bancos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nome, saldo_inicial: saldoInicial })
            });
        }
        
        if (res.ok) {
            await abrirModalBancos();
            await carregarResumoFinanceiro();
        } else {
            alert("❌ Erro ao salvar banco.");
        }
    } catch (e) { alert("❌ Falha de conexão."); }
}

async function deletarBanco(id) {
    if (!confirm("⚠️ Tem certeza que deseja excluir este banco?")) return;
    try {
        const res = await fetch(`${API_URL}/financeiro/bancos/${id}`, { method: 'DELETE' });
        if (res.ok) {
            await carregarResumoFinanceiro(); 
            await abrirModalBancos(); 
        } else alert("❌ Erro ao deletar o banco.");
    } catch (e) { alert("❌ Falha de conexão."); }
}

// ==========================================
// 🗓️ NAVEGAÇÃO RÁPIDA DE MÊS (1 CLIQUE)
// ==========================================
function atualizarLabelMesNavegacao() {
    const elLabel = document.getElementById('label-mes-navegacao');
    const dataInicio = document.getElementById('filtro-data-inicio')?.value;
    if (!elLabel || !dataInicio) return;

    const [ano, mes] = dataInicio.split('-');
    const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    elLabel.innerText = `${nomesMeses[parseInt(mes, 10) - 1]} ${ano}`;
}

function navegarMesFinanceiro(direcao) {
    const inputInicio = document.getElementById('filtro-data-inicio');
    const inputFim = document.getElementById('filtro-data-fim');
    if (!inputInicio || !inputFim) return;

    const base = inputInicio.value ? new Date(inputInicio.value + 'T12:00:00') : new Date();
    const novoAno = base.getFullYear();
    const novoMes = base.getMonth() + direcao;

    const primeiroDia = new Date(novoAno, novoMes, 1).toISOString().split('T')[0];
    const ultimoDia = new Date(novoAno, novoMes + 1, 0).toISOString().split('T')[0];

    inputInicio.value = primeiroDia;
    inputFim.value = ultimoDia;

    atualizarLabelMesNavegacao();
    carregarLancamentos();
}

// ==========================================
// 🔄 LÓGICA DE TRANSFERÊNCIA E AUDITORIA TURBO
// ==========================================
function abrirModalTransferencia() {
    const selectOrigem = document.getElementById('trans-origem');
    const selectDestino = document.getElementById('trans-destino');
    
    selectOrigem.innerHTML = '<option value="">Selecione a Origem</option>';
    selectDestino.innerHTML = '<option value="">Selecione o Destino</option>';
    
    contasBancariasGlobais.forEach(b => {
        selectOrigem.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
        if (!b.nome.toLowerCase().includes('transição')) {
            selectDestino.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
        }
    });

    const contaTransicao = contasBancariasGlobais.find(b => b.nome.toLowerCase().includes('transição'));
    if (contaTransicao) selectOrigem.value = contaTransicao.id;

    if (document.getElementById('trans-descricao-custom')) {
        document.getElementById('trans-descricao-custom').value = 'Conciliação de Cartões/Pix';
    }
    document.getElementById('trans-valor-bruto').value = '';
    if (document.getElementById('trans-valor-liquido')) {
        document.getElementById('trans-valor-liquido').value = '';
    }
    document.getElementById('trans-taxa').value = '0.00';
    document.getElementById('trans-data').value = new Date().toLocaleDateString('en-CA');
    document.getElementById('modal-transferencia').style.display = 'flex';
}

// Abre o modal já preenchido ao clicar em "🔄 Auditar" na linha da Conta de Transição
function auditarLancamentoTransicao(itemStringCodificado) {
    const item = JSON.parse(decodeURIComponent(itemStringCodificado));
    abrirModalTransferencia();

    const valorBruto = parseFloat(item.valor) || 0;
    document.getElementById('trans-valor-bruto').value = valorBruto.toFixed(2);
    if (document.getElementById('trans-valor-liquido')) {
        document.getElementById('trans-valor-liquido').value = valorBruto.toFixed(2);
    }
    document.getElementById('trans-taxa').value = '0.00';

    if (document.getElementById('trans-descricao-custom')) {
        document.getElementById('trans-descricao-custom').value = `Auditoria: ${item.descricao}`;
    }

    if (item.data_vencimento) {
        const d = new Date(item.data_vencimento);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        document.getElementById('trans-data').value = d.toISOString().split('T')[0];
    }
}

// Calcula automaticamente a taxa ao digitar o Valor Líquido que caiu no banco
function calcularTaxaPorLiquido(origemCampo) {
    const elBruto = document.getElementById('trans-valor-bruto');
    const elLiquido = document.getElementById('trans-valor-liquido');
    const elTaxa = document.getElementById('trans-taxa');
    if (!elBruto || !elLiquido || !elTaxa) return;

    const bruto = parseFloat(elBruto.value) || 0;

    if (origemCampo === 'bruto') {
        const taxaAtual = parseFloat(elTaxa.value) || 0;
        elLiquido.value = Math.max(0, bruto - taxaAtual).toFixed(2);
    } else if (origemCampo === 'liquido') {
        const liquido = parseFloat(elLiquido.value) || 0;
        const taxaCalculada = Math.max(0, bruto - liquido);
        elTaxa.value = taxaCalculada.toFixed(2);
    } else if (origemCampo === 'taxa') {
        const taxa = parseFloat(elTaxa.value) || 0;
        elLiquido.value = Math.max(0, bruto - taxa).toFixed(2);
    }
}

function fecharModalTransferencia() {
    document.getElementById('modal-transferencia').style.display = 'none';
}

async function executarTransferencia() {
    const origem = document.getElementById('trans-origem').value;
    const destino = document.getElementById('trans-destino').value;
    const valorBruto = parseFloat(document.getElementById('trans-valor-bruto').value);
    const taxa = parseFloat(document.getElementById('trans-taxa').value) || 0;
    const dataTrans = document.getElementById('trans-data').value;
    const descCustom = document.getElementById('trans-descricao-custom')?.value.trim() || 'Conciliação de Cartões/Pix';

    if (!origem || !destino || isNaN(valorBruto) || valorBruto <= 0 || !dataTrans) {
        return alert("⚠️ Por favor, preencha as contas, o valor bruto e a data corretamente.");
    }
    if (origem === destino) {
        return alert("⚠️ A conta de origem e a de destino não podem ser iguais.");
    }
    if (taxa >= valorBruto) {
        return alert("⚠️ O valor das taxas não pode ser maior ou igual ao valor bruto.");
    }

    try {
        const res = await fetch(`${API_URL}/financeiro/transferencias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conta_origem_id: origem,
                conta_destino_id: destino,
                valor_bruto: valorBruto,
                taxa: taxa,
                data_transferencia: dataTrans,
                descricao: descCustom
            })
        });

        if (res.ok) {
            alert("✅ Auditoria realizada! Dinheiro transferido e taxas computadas no DRE.");
            document.getElementById('trans-valor-bruto').value = '';
            if (document.getElementById('trans-valor-liquido')) {
                document.getElementById('trans-valor-liquido').value = '';
            }
            document.getElementById('trans-taxa').value = '0.00';
            document.getElementById('trans-valor-bruto').focus();
            
            await carregarResumoFinanceiro();
            await carregarLancamentos();
        } else {
            alert("❌ Erro ao processar a transferência no servidor.");
        }
    } catch (e) {
        alert("❌ Falha de conexão com o servidor.");
    }
}

// ==========================================
// 💡 CENTRAL DE ALERTAS INTELIGENTES
// ==========================================
async function carregarAlertasInteligentes() {
    const container = document.getElementById('central-alertas');
    if (!container) return;
    
    try {
        const res = await fetch(`${API_URL}/financeiro/alertas`);
        const alertas = await res.json();
        
        container.innerHTML = '';
        
        const paleta = {
            'perigo': { bg: '#ffebee', border: '#f44336', text: '#c62828' }, // Vermelho
            'alerta': { bg: '#fff8e1', border: '#ffc107', text: '#f57f17' }, // Amarelo
            'sucesso': { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' },// Verde
            'dica': { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0' }    // Azul
        };

        alertas.forEach(alerta => {
            const cor = paleta[alerta.tipo];
            container.innerHTML += `
                <div style="background: ${cor.bg}; border-left: 5px solid ${cor.border}; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; gap: 15px; align-items: flex-start; transition: transform 0.2s;">
                    <span class="material-symbols-outlined" style="color: ${cor.text}; font-size: 2rem;">${alerta.icone}</span>
                    <div>
                        <h4 style="margin: 0 0 5px 0; color: ${cor.text}; font-size: 0.95rem; font-weight: 700;">${alerta.titulo}</h4>
                        <p style="margin: 0; color: #555; font-size: 0.82rem; line-height: 1.4; font-weight: 500;">${alerta.texto}</p>
                    </div>
                </div>
            `;
        });
    } catch(e) {
        console.error("Erro ao carregar alertas:", e);
    }
}

// ==========================================
// 📥 CONCILIAÇÃO BANCÁRIA INTELIGENTE (LEITOR OFX E CSV)
// ==========================================
let transacoesExtratoLidas = [];
let regrasConciliacaoMemoria = [];
let hashesJaImportados = [];

async function abrirModalImportarExtrato() {
    await carregarBancos();
    await carregarCategorias();

    const selectConta = document.getElementById('imp-conta-id');
    selectConta.innerHTML = '<option value="">Selecione o Banco...</option>';
    contasBancariasGlobais.forEach(b => {
        if (!b.nome.toLowerCase().includes('transição')) {
            selectConta.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
        }
    });

    // Se já estava filtrando um banco na tela principal, pré-seleciona ele
    const bancoFiltroAtual = document.getElementById('filtro-banco')?.value;
    if (bancoFiltroAtual) selectConta.value = bancoFiltroAtual;

    try {
        const res = await fetch(`${API_URL}/financeiro/conciliacao/regras`);
        const dados = await res.json();
        regrasConciliacaoMemoria = dados.regras || [];
        hashesJaImportados = dados.hashes_existentes || [];
    } catch (e) {
        regrasConciliacaoMemoria = [];
        hashesJaImportados = [];
    }

    transacoesExtratoLidas = [];
    document.getElementById('imp-arquivo').value = '';
    document.getElementById('imp-resumo-barra').style.display = 'none';
    document.getElementById('imp-lista-previa').innerHTML = '<p style="text-align: center; color: #888; font-style: italic; margin: 25px 0;">Escolha o banco acima e selecione um arquivo .OFX ou .CSV do seu computador.</p>';
    document.getElementById('modal-importar-extrato').style.display = 'flex';
}

function fecharModalImportarExtrato() {
    document.getElementById('modal-importar-extrato').style.display = 'none';
}

function limparDescricaoExtrato(desc) {
    return (desc || '')
        .replace(/PIX\s*(ENVIADO|RECEBIDO|TRANSF|QR\s*CODE)\s*[-:]?\s*/gi, '')
        .replace(/PAGAMENTO\s*(DE\s*BOLETO|EFETUADO|TITULO)\s*[-:]?\s*/gi, '')
        .replace(/COMPRA\s*(CARTAO|DEBITO)\s*[-:]?\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function sugerirCategoriaAutomatica(descricao, tipo) {
    const descUpper = (descricao || '').toUpperCase();

    // 1. Primeiro olha na memória que você mesmo ensinou ao sistema
    for (let r of regrasConciliacaoMemoria) {
        if (r.termo_busca && descUpper.includes(r.termo_busca.toUpperCase())) {
            return r.categoria_id;
        }
    }

    // 2. Palavras-chave nativas da Icesoft (Sorveteria & Açaí + Bancos)
    const mapaNativo = [
        { termos: ['ENEL', 'LIGHT', 'ENERGIA', 'ELETRICA', 'CEMIG', 'CPFL'], buscaCat: 'Energia' },
        { termos: ['CEDAE', 'AGUAS', 'SANEAMENTO', 'SABESP'], buscaCat: 'Água' },
        { termos: ['VIVO', 'CLARO', 'TIM', 'OI ', 'INTERNET', 'FIBRA', 'HOST', 'EASYPANEL'], buscaCat: 'Internet' },
        { termos: ['MOTOBOY', 'ENTREGADOR', 'ENTREGA'], buscaCat: 'Motoboy' },
        { termos: ['POSTO', 'COMBUSTIVEL', 'GASOLINA', 'IPIRANGA', 'SHELL', 'BR MANIA'], buscaCat: 'Combustível' },
        { termos: ['FACEBOOK', 'META ADS', 'INSTAGRAM', 'GOOGLE ADS', 'TRAFEGO'], buscaCat: 'Anúncios' },
        { termos: ['ACAI', 'AÇAÍ', 'SORVETE', 'POLPA', 'PICOLE'], buscaCat: 'Açaí' },
        { termos: ['NUTELLA', 'AVELA', 'LEITINHO', 'CALDA'], buscaCat: 'Cremes' },
        { termos: ['ITAMBE', 'PIRACANJUBA', 'NESTLE', 'LEITE', 'LATICINIO'], buscaCat: 'Lácteos' },
        { termos: ['HORTIFRUTI', 'SACOLAO', 'MORANGO', 'BANANA', 'FRUTA'], buscaCat: 'Frutas' },
        { termos: ['EMBALAGEM', 'COPO', 'DESCARTAVEL', 'ISOPOR', 'PLAST'], buscaCat: 'Embalagens' },
        { termos: ['COCA COLA', 'AMBEV', 'REFRIGERANTE', 'BEBIDA', 'DISTRIBUIDORA BEB'], buscaCat: 'Bebidas' },
        { termos: ['DAS ', 'SIMPLES NACIONAL', 'RECEITA FEDERAL', 'MEI ', 'DARF'], buscaCat: 'Impostos' },
        { termos: ['TARIFA', 'CESTA DE RELACIONAMENTO', 'ANUIDADE', 'MANUTENCAO CONTA'], buscaCat: 'Tarifas' },
        { termos: ['SUMUP', 'REPASSE', 'LIQUIDACAO', 'IFOOD', 'PIX RECEBIDO'], buscaCat: 'Transferência' },
        { termos: ['WALLACE', 'JACQUELINE', 'PRO-LABORE', 'PRO LABORE'], buscaCat: 'Pró-Labore' }
    ];

    for (let item of mapaNativo) {
        if (item.termos.some(t => descUpper.includes(t))) {
            const catAchada = categoriasFinanceiras.find(c =>
                c.ativa !== false &&
                (c.tipo === tipo || c.dre_ref === 'movimentacao_interna') &&
                c.nome.toLowerCase().includes(item.buscaCat.toLowerCase())
            );
            if (catAchada) return catAchada.id;
        }
    }

    return '';
}

async function processarArquivoExtrato(event) {
    const file = event.target.files[0];
    if (!file) return;

    const nomeArq = file.name.toLowerCase();

    // 📄 LEITURA DE EXTRATO EM PDF (Mercado Pago e outros bancos)
    if (nomeArq.endsWith('.pdf')) {
        const container = document.getElementById('imp-lista-previa');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #00695c; font-weight: 600; margin: 25px 0;">⏳ Lendo páginas do PDF e extraindo transações...</p>';
        }
        try {
            transacoesExtratoLidas = await parseExtratoPDF(file);
            renderizarPreviaExtrato();
        } catch (err) {
            console.error("Erro ao ler PDF:", err);
            alert("❌ Não foi possível ler este arquivo PDF. Verifique se ele não está protegido por senha.");
            if (container) {
                container.innerHTML = '<p style="text-align: center; color: #c62828; margin: 25px 0;">Erro ao ler o PDF selecionado.</p>';
            }
        }
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const conteudo = e.target.result;

        if (nomeArq.endsWith('.ofx') || conteudo.includes('<OFX>') || conteudo.includes('<STMTTRN>')) {
            transacoesExtratoLidas = parseExtratoOFX(conteudo);
        } else {
            transacoesExtratoLidas = parseExtratoCSV(conteudo);
        }

        renderizarPreviaExtrato();
    };
    reader.readAsText(file, 'UTF-8');
}

async function parseExtratoPDF(file) {
    if (typeof pdfjsLib === 'undefined') {
        throw new Error("Biblioteca PDF.js não carregada.");
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const linhasTexto = [];

    // Percorre todas as páginas do extrato reconstruindo cada linha visual da tabela
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();

        const linhasMap = [];
        textContent.items.forEach(item => {
            const str = (item.str || '').trim();
            if (!str) return;
            const y = Math.round(item.transform[5]);
            const x = item.transform[4];

            let linhaExistente = linhasMap.find(l => Math.abs(l.y - y) <= 3);
            if (!linhaExistente) {
                linhaExistente = { y, itens: [] };
                linhasMap.push(linhaExistente);
            }
            linhaExistente.itens.push({ x, str });
        });

        // Ordena de cima para baixo na página e da esquerda para a direita na linha
        linhasMap.sort((a, b) => b.y - a.y);
        linhasMap.forEach(l => {
            l.itens.sort((a, b) => a.x - b.x);
            const textoLinha = l.itens.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
            if (textoLinha) linhasTexto.push(textoLinha);
        });
    }

    const lista = [];
    const ignorarTermos = ['SALDO INICIAL', 'SALDO FINAL', 'SALDO DISPON', 'ENTRADAS:', 'SAÍDAS:', 'SAIDAS:', 'DATA DESCRI'];

    linhasTexto.forEach((linha, idx) => {
        const linhaUpper = linha.toUpperCase();
        if (ignorarTermos.some(t => linhaUpper.includes(t))) return;

        // Procura data no formato DD-MM-YYYY ou DD/MM/YYYY (padrão Mercado Pago e bancos BR)
        const matchData = linha.match(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/);
        if (!matchData) return;

        const dataIso = `${matchData[3]}-${matchData[2]}-${matchData[1]}`;

        // Captura todos os valores em reais na linha (ex: R$ -150,00 | -R$ 150,00 | -150,00 | 50,00)
        const regexValores = /(?:[-+]\s*)?R\$\s*(?:[-+]\s*)?[\d\.]+,\d{2}|(?:[-+]\s*)?\b[\d\.]+,\d{2}\b/g;
        const valoresEncontrados = linha.match(regexValores);
        if (!valoresEncontrados || valoresEncontrados.length === 0) return;

        // No extrato do Mercado Pago, o 1º valor da linha é o da transação e o 2º é o Saldo acumulado
        const rawValor = valoresEncontrados[0];
        const ehNegativo = rawValor.includes('-');
        const numLimpo = rawValor.replace(/R\$|\s|\+|-/gi, '').replace(/\./g, '').replace(',', '.');
        const valorAbs = parseFloat(numLimpo);

        if (isNaN(valorAbs) || valorAbs === 0) return;

        // Extrai um possível ID de operação do Mercado Pago (sequência longa de 8+ dígitos) para trava anti-duplicidade
        const matchIdOp = linha.match(/\b(\d{8,15})\b/);
        const idOp = matchIdOp ? matchIdOp[1] : '';

        // Limpa a descrição removendo data, valores monetários e o ID numérico
        let desc = linha
            .replace(matchData[0], '')
            .replace(regexValores, '')
            .replace(idOp, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!desc) desc = 'Movimentação Mercado Pago (PDF)';

        const tipo = ehNegativo ? 'Despesa' : 'Receita';
        const hash = idOp ? `PDF-${idOp}` : `PDF-${dataIso}-${valorAbs.toFixed(2)}-${desc.substring(0, 25)}`;
        const jaExiste = hashesJaImportados.includes(hash);
        const descLimpa = limparDescricaoExtrato(desc);

        lista.push({
            id_temp: idx,
            selecionado: !jaExiste,
            ja_importado: jaExiste,
            data: dataIso,
            descricao: desc,
            termo_regra: descLimpa.toUpperCase().substring(0, 40),
            valor: valorAbs,
            tipo: tipo,
            categoria_id: sugerirCategoriaAutomatica(desc, tipo),
            salvar_regra: true,
            hash_extrato: hash
        });
    });

    return lista;
}

function parseExtratoOFX(texto) {
    const lista = [];
    const blocos = texto.split(/<STMTTRN>/i).slice(1);

    blocos.forEach((bloco, idx) => {
        const getTag = (tag) => {
            const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
            const m = bloco.match(regex);
            return m ? m[1].trim() : '';
        };

        const dtRaw = getTag('DTPOSTED');
        const valorRaw = getTag('TRNAMT').replace(',', '.');
        const fitid = getTag('FITID');
        const memo = getTag('MEMO') || getTag('NAME') || 'Lançamento Bancário';

        if (!dtRaw || !valorRaw) return;

        const ano = dtRaw.substring(0, 4);
        const mes = dtRaw.substring(4, 6);
        const dia = dtRaw.substring(6, 8);
        const dataIso = `${ano}-${mes}-${dia}`;

        const valorNum = parseFloat(valorRaw);
        if (isNaN(valorNum) || valorNum === 0) return;

        const tipo = valorNum < 0 ? 'Despesa' : 'Receita';
        const valorAbs = Math.abs(valorNum);
        const hash = fitid ? `OFX-${fitid}` : `OFX-${dataIso}-${valorAbs.toFixed(2)}-${memo.substring(0, 20)}`;
        const jaExiste = hashesJaImportados.includes(hash);
        const descLimpa = limparDescricaoExtrato(memo);

        lista.push({
            id_temp: idx,
            selecionado: !jaExiste,
            ja_importado: jaExiste,
            data: dataIso,
            descricao: memo,
            termo_regra: descLimpa.toUpperCase().substring(0, 40),
            valor: valorAbs,
            tipo: tipo,
            categoria_id: sugerirCategoriaAutomatica(memo, tipo),
            salvar_regra: true,
            hash_extrato: hash
        });
    });

    return lista;
}

function parseExtratoCSV(texto) {
    const lista = [];
    const linhas = texto.split(/\r?\n/).filter(l => l.trim() !== '');
    if (linhas.length < 2) return lista;

    const separador = linhas[0].includes(';') ? ';' : ',';
    const cabecalho = linhas[0].split(separador).map(c => c.replace(/^"|"$/g, '').trim().toLowerCase());

    // Detecta colunas automaticamente (Mercado Pago, Sicredi, SumUp, iFood Pago)
    let idxData = cabecalho.findIndex(c => c.includes('data') || c.includes('date') || c.includes('release_date'));
    let idxDesc = cabecalho.findIndex(c => c.includes('descri') || c.includes('hist') || c.includes('detalhe') || c.includes('transaction_type') || c.includes('origem') || c.includes('title'));
    let idxValor = cabecalho.findIndex(c => c.includes('valor') || c.includes('amount') || c.includes('net_amount') || c.includes('líquido') || c.includes('liquido'));
    let idxId = cabecalho.findIndex(c => c === 'id' || c.includes('reference_id') || c.includes('documento') || c.includes('codigo'));

    if (idxData === -1) idxData = 0;
    if (idxDesc === -1) idxDesc = 1;
    if (idxValor === -1) idxValor = cabecalho.length > 2 ? 2 : 1;

    for (let i = 1; i < linhas.length; i++) {
        const cols = linhas[i].split(separador).map(c => c.replace(/^"|"$/g, '').trim());
        if (cols.length < 2) continue;

        const rawData = cols[idxData] || '';
        let dataIso = '';

        // Aceita DD/MM/YYYY ou YYYY-MM-DD
        const mBR = rawData.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        const mISO = rawData.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (mBR) dataIso = `${mBR[3]}-${mBR[2]}-${mBR[1]}`;
        else if (mISO) dataIso = `${mISO[1]}-${mISO[2]}-${mISO[3]}`;
        else continue;

        let rawValor = (cols[idxValor] || '').replace(/R\$\s?/gi, '').trim();
        if (rawValor.includes(',') && rawValor.includes('.')) {
            rawValor = rawValor.replace(/\./g, '').replace(',', '.');
        } else if (rawValor.includes(',')) {
            rawValor = rawValor.replace(',', '.');
        }

        const valorNum = parseFloat(rawValor);
        if (isNaN(valorNum) || valorNum === 0) continue;

        const desc = cols[idxDesc] || 'Lançamento Extrato CSV';
        const idRef = idxId !== -1 ? cols[idxId] : '';
        const tipo = valorNum < 0 ? 'Despesa' : 'Receita';
        const valorAbs = Math.abs(valorNum);
        const hash = idRef ? `CSV-${idRef}` : `CSV-${dataIso}-${valorAbs.toFixed(2)}-${desc.substring(0, 25)}`;
        const jaExiste = hashesJaImportados.includes(hash);
        const descLimpa = limparDescricaoExtrato(desc);

        lista.push({
            id_temp: i,
            selecionado: !jaExiste,
            ja_importado: jaExiste,
            data: dataIso,
            descricao: desc,
            termo_regra: descLimpa.toUpperCase().substring(0, 40),
            valor: valorAbs,
            tipo: tipo,
            categoria_id: sugerirCategoriaAutomatica(desc, tipo),
            salvar_regra: true,
            hash_extrato: hash
        });
    }

    return lista;
}

function montarOptionsCategoriasExtrato(tipo, catSelecionadaId) {
    let html = '<option value="">-- Escolha a Categoria --</option>';
    const catValidas = categoriasFinanceiras.filter(c =>
        c.ativa !== false && (c.tipo === tipo || c.dre_ref === 'movimentacao_interna')
    );

    catValidas.forEach(c => {
        const sel = String(c.id) === String(catSelecionadaId) ? 'selected' : '';
        const prefixo = c.dre_ref === 'movimentacao_interna' ? '🔄 [Interno/Sem DRE] ' : '';
        html += `<option value="${c.id}" ${sel}>${prefixo}${c.nome}</option>`;
    });
    return html;
}

function renderizarPreviaExtrato() {
    const container = document.getElementById('imp-lista-previa');
    const barra = document.getElementById('imp-resumo-barra');
    const apenasSaidas = document.getElementById('imp-apenas-saidas')?.checked || false;

    const listaExibida = transacoesExtratoLidas.filter(t => !apenasSaidas || t.tipo === 'Despesa');

    if (listaExibida.length === 0) {
        barra.style.display = 'none';
        container.innerHTML = '<p style="text-align: center; color: #c62828; font-weight: 600; margin: 20px 0;">Nenhuma transação encontrada para este filtro ou formato de arquivo.</p>';
        return;
    }

    barra.style.display = 'flex';
    const qtdSelecionados = listaExibida.filter(t => t.selecionado).length;
    document.getElementById('imp-contador-texto').innerText = `${listaExibida.length} transações lidas (${qtdSelecionados} marcadas para importar)`;

    let html = `<table style="width:100%; border-collapse: collapse; font-size: 0.84rem;">
        <thead>
            <tr style="border-bottom: 2px solid #ddd; color: #555; text-align: left;">
                <th style="padding: 8px; width: 32px;">✔</th>
                <th style="padding: 8px; width: 90px;">Data</th>
                <th style="padding: 8px;">Descrição no Banco</th>
                <th style="padding: 8px; width: 110px; text-align: right;">Valor</th>
                <th style="padding: 8px; width: 250px;">Categoria (DRE)</th>
                <th style="padding: 8px; width: 95px; text-align: center;">🧠 Lembrar</th>
            </tr>
        </thead>
        <tbody>`;

    listaExibida.forEach(item => {
        const corValor = item.tipo === 'Despesa' ? '#c62828' : '#2e7d32';
        const sinal = item.tipo === 'Despesa' ? '- ' : '+ ';
        const [ano, mes, dia] = item.data.split('-');
        const dataBR = `${dia}/${mes}/${ano}`;
        const badgeDup = item.ja_importado ? `<span style="background:#ffebee; color:#c62828; font-size:0.7rem; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:700;">Já Importado</span>` : '';

        html += `
            <tr style="border-bottom: 1px solid #eee; background: ${item.ja_importado ? '#f5f5f5' : 'white'}; opacity: ${item.ja_importado ? '0.6' : '1'};">
                <td style="padding: 8px;">
                    <input type="checkbox" ${item.selecionado ? 'checked' : ''} onchange="atualizarItemExtrato(${item.id_temp}, 'selecionado', this.checked)">
                </td>
                <td style="padding: 8px; color: #666;">${dataBR}</td>
                <td style="padding: 8px;">
                    <input type="text" value="${item.descricao.replace(/"/g, '&quot;')}" onchange="atualizarItemExtrato(${item.id_temp}, 'descricao', this.value)" style="width: 96%; padding: 5px 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.82rem;">
                    ${badgeDup}
                </td>
                <td style="padding: 8px; text-align: right; font-weight: 700; color: ${corValor};">
                    ${sinal}R$ ${item.valor.toFixed(2).replace('.', ',')}
                </td>
                <td style="padding: 8px;">
                    <select onchange="atualizarItemExtrato(${item.id_temp}, 'categoria_id', this.value)" style="width: 100%; padding: 6px; border: 1px solid ${item.categoria_id ? '#81c784' : '#ffb74d'}; border-radius: 6px; font-size: 0.82rem; background: ${item.categoria_id ? '#f1f8e9' : '#fff8e1'};">
                        ${montarOptionsCategoriasExtrato(item.tipo, item.categoria_id)}
                    </select>
                </td>
                <td style="padding: 8px; text-align: center;">
                    <input type="checkbox" ${item.salvar_regra ? 'checked' : ''} onchange="atualizarItemExtrato(${item.id_temp}, 'salvar_regra', this.checked)" title="Lembrar categoria para: ${item.termo_regra}">
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function atualizarItemExtrato(idTemp, campo, valor) {
    const item = transacoesExtratoLidas.find(t => t.id_temp === idTemp);
    if (!item) return;
    item[campo] = valor;

    // Se você escolheu a categoria de um fornecedor, preenche os outros iguais da mesma lista na mesma hora!
    if (campo === 'categoria_id' && valor && item.termo_regra) {
        transacoesExtratoLidas.forEach(outro => {
            if (!outro.categoria_id && outro.tipo === item.tipo && outro.termo_regra === item.termo_regra) {
                outro.categoria_id = valor;
            }
        });
        renderizarPreviaExtrato();
    }
}

function marcarTodosExtrato(marcar) {
    transacoesExtratoLidas.forEach(t => {
        t.selecionado = marcar ? !t.ja_importado : false;
    });
    renderizarPreviaExtrato();
}

async function confirmarImportacaoExtrato() {
    const contaId = document.getElementById('imp-conta-id').value;
    if (!contaId) return alert("⚠️ Escolha no Passo 1 de qual banco é este extrato!");

    const apenasSaidas = document.getElementById('imp-apenas-saidas')?.checked || false;
    const selecionados = transacoesExtratoLidas.filter(t => t.selecionado && (!apenasSaidas || t.tipo === 'Despesa'));

    if (selecionados.length === 0) return alert("⚠️ Nenhum lançamento marcado para importar.");

    const semCategoria = selecionados.filter(t => !t.categoria_id);
    if (semCategoria.length > 0) {
        return alert(`⚠️ Ainda faltam selecionar a categoria de ${semCategoria.length} lançamento(s) marcados (destacados em amarelo).`);
    }

    const btn = document.getElementById('btn-confirmar-importacao');
    btn.disabled = true;
    btn.innerText = "Importando...";

    try {
        const res = await fetch(`${API_URL}/financeiro/conciliacao/importar-lote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conta_id: contaId, itens: selecionados })
        });
        const resp = await res.json();
        if (res.ok) {
            alert(`✅ Conciliação concluída!\n\n• ${resp.importados} lançamentos importados com sucesso.\n• ${resp.ignorados} duplicados ignorados.`);
            fecharModalImportarExtrato();
            await carregarResumoFinanceiro();
            await carregarLancamentos();
        } else {
            alert("❌ Erro ao importar: " + (resp.erro || "Verifique o servidor."));
        }
    } catch (e) {
        alert("❌ Falha de conexão com o servidor.");
    } finally {
        btn.disabled = false;
        btn.innerText = "✅ Confirmar e Lançar Selecionados";
    }
}

// ==========================================
// 🚀 VIRADA DE ANO & RESET FINANCEIRO ICESOFT
// ==========================================
const BANCOS_OFICIAIS_ICESOFT = [
    { nome: 'Mercado Pago', saldo: 0 },
    { nome: 'Sicredi', saldo: 0 },
    { nome: 'SumUp', saldo: 0 },
    { nome: 'iFood Pago', saldo: 0 },
    { nome: 'Cofrinho - Banco Icesoft (MP)', saldo: 0 },
    { nome: 'Cofrinho - Reserva (MP)', saldo: 0 },
    { nome: 'Caixa Físico (Gaveta)', saldo: 0 },
    { nome: 'Conta de Transição (A Receber)', saldo: 0 }
];

function abrirModalViradaAno() {
    const containerBancos = document.getElementById('virada-lista-bancos');
    containerBancos.innerHTML = '';

    BANCOS_OFICIAIS_ICESOFT.forEach((b, idx) => {
        // Se o banco já existir cadastrado hoje, puxa o saldo atual dele como sugestão
        const existente = contasBancariasGlobais.find(atual => atual.nome.toLowerCase() === b.nome.toLowerCase());
        const saldoSugerido = existente ? parseFloat(existente.saldo_atual).toFixed(2) : '0.00';

        containerBancos.innerHTML += `
            <div style="background: white; padding: 8px 10px; border-radius: 8px; border: 1px solid #d1d9ff;">
                <label style="font-size: 0.78rem; font-weight: 700; color: #333; display: block; margin-bottom: 4px;">${b.nome}</label>
                <input type="number" step="0.01" class="input-saldo-virada" data-nome="${b.nome}" value="${saldoSugerido}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 6px; font-weight: 700; box-sizing: border-box;">
            </div>
        `;
    });

    document.getElementById('modal-virada-ano').style.display = 'flex';
}

function fecharModalViradaAno() {
    document.getElementById('modal-virada-ano').style.display = 'none';
}

async function baixarBackupFinanceiroCSV() {
    try {
        const res = await fetch(`${API_URL}/financeiro/backup-lancamentos`);
        const dados = await res.json();

        let csv = 'ID;Vencimento;Descricao;Tipo;Valor;Status;Categoria;Banco\n';
        dados.forEach(d => {
            const dataF = d.data_vencimento ? d.data_vencimento.split('T')[0] : '';
            const descLimpa = (d.descricao || '').replace(/;/g, ',').replace(/\r?\n/g, ' ');
            csv += `${d.id};${dataF};"${descLimpa}";${d.tipo};${String(d.valor).replace('.', ',')};${d.status};"${d.categoria}";"${d.banco}"\n`;
        });

        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_financeiro_icesoft_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
    } catch (e) {
        alert("❌ Erro ao baixar planilha de backup.");
        return false;
    }
}

async function executarViradaAnoIcesoft() {
    const dataCorte = document.getElementById('virada-data-corte').value;
    const recriarPlano = document.getElementById('virada-recriar-plano').checked;

    if (!dataCorte) return alert("⚠️ Defina a Data de Corte do novo ciclo financeiro.");

    const confirmacao = prompt(
        `⚠️ ATENÇÃO: O sistema vai baixar o seu backup em Excel (.CSV), arquivar e limpar os lançamentos antigos, configurar seus 8 bancos/cofrinhos e instalar o Novo Plano de Contas da Icesoft.\n\nPara confirmar, digite ZERAR abaixo:`
    );

    if (!confirmacao || confirmacao.trim().toUpperCase() !== 'ZERAR') {
        return alert("Operação cancelada.");
    }

    // 1. Faz o download automático do arquivo CSV de backup para o computador antes de limpar
    await baixarBackupFinanceiroCSV();

    const inputsBancos = document.querySelectorAll('.input-saldo-virada');
    const bancosIniciais = [];
    inputsBancos.forEach(inp => {
        bancosIniciais.push({
            nome: inp.getAttribute('data-nome'),
            saldo_inicial: parseFloat(inp.value) || 0
        });
    });

    const btn = document.getElementById('btn-executar-virada');
    btn.disabled = true;
    btn.innerText = "Processando Virada...";

    try {
        const res = await fetch(`${API_URL}/financeiro/virada-ano`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data_corte: dataCorte,
                bancos_iniciais: bancosIniciais,
                recriar_plano_icesoft: recriarPlano
            })
        });

        if (res.ok) {
            alert("✅ Virada Financeira Icesoft concluída com sucesso! Seu arquivo de backup foi baixado e o novo sistema já está limpo e pronto.");
            fecharModalViradaAno();
            await carregarCategorias();
            await carregarBancos();
            popularFiltroBancos();
            popularFiltroCategorias();
            await carregarResumoFinanceiro();
            await carregarLancamentos();
        } else {
            alert("❌ Erro ao executar a virada no servidor.");
        }
    } catch (e) {
        alert("❌ Falha de conexão com o servidor.");
    } finally {
        btn.disabled = false;
        btn.innerText = "🚀 2. Executar Virada Limpa";
    }
}