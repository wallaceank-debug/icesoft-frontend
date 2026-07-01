const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
let categoriasFinanceiras = []; // Memória global para as categorias
let contasBancariasGlobais = []; // 👇 NOVO: Guarda os bancos na memória
let filtroLancamentosAtual = 'todos'; // 👇 NOVO: Guarda o filtro ativo

window.onload = async () => {
    await carregarCategorias(); 
    await carregarBancos(); 
    popularFiltroBancos(); // 👇 Alimenta a nova caixinha de seleção de bancos
    popularFiltroCategorias(); // 👇 NOVO: Preenche a caixinha de categorias!
    await carregarResumoFinanceiro();
    await carregarLancamentos();
    await carregarAlertasInteligentes(); // 👇 NOVO: Carrega os conselhos do CFO
};

function popularFiltroBancos() {
    const selectFiltro = document.getElementById('filtro-banco');
    if(selectFiltro) {
        selectFiltro.innerHTML = '<option value="">Todos os Bancos</option>';
        contasBancariasGlobais.forEach(b => {
            selectFiltro.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
        });
    }
}

function popularFiltroCategorias() {
    const selectFiltroCat = document.getElementById('filtro-categoria');
    if(!selectFiltroCat) return;
    
    selectFiltroCat.innerHTML = '<option value="">Todas as Categorias</option>';
    
    // Organiza bonito igual no DRE!
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

    const agrupadas = {};
    categoriasFinanceiras.forEach(c => {
        if(!agrupadas[c.dre_ref]) agrupadas[c.dre_ref] = [];
        agrupadas[c.dre_ref].push(c);
    });

    let indexPaiContador = 1;
    Object.keys(agrupadas).forEach((dre_ref) => {
        const nomePai = nomesDRE[dre_ref] || dre_ref;
        let optgroup = `<optgroup label="${nomePai}">`;
        
        agrupadas[dre_ref].forEach((cat, indexFilho) => {
            optgroup += `<option value="${cat.id}">[${indexPaiContador}.${indexFilho + 1}] ${cat.nome}</option>`;
        });
        optgroup += `</optgroup>`;
        selectFiltroCat.innerHTML += optgroup;
        indexPaiContador++;
    });
}

async function carregarCategorias() {
    try {
        const res = await fetch(`${API_URL}/financeiro/categorias`);
        categoriasFinanceiras = await res.json();
    } catch (e) { console.error("Erro ao carregar categorias"); }
}

async function carregarResumoFinanceiro() {
    try {
        // Assegura que temos os saldos de bancos mais atualizados na memória
        await carregarBancos();

        // 👇 1. Pega o crachá no bolso do navegador
        const cracha = localStorage.getItem('icesoft_token');
        
        // 👇 2. Mostra o crachá para o servidor
        const res = await fetch(`${API_URL}/financeiro/resumo`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${cracha}`
            }
        });
        
        // 👇 3. Se for barrado, joga para a tela de login
        if (res.status === 401 || res.status === 403) {
             window.location.href = '../login/index.html';
             return;
        }

        const dados = await res.json();
        
        // Pinta os valores nos cards tradicionais (Saldo Geral foi removido)
        document.getElementById('fin-receber').innerText = `R$ ${dados.receber.toFixed(2).replace('.', ',')}`;
        document.getElementById('fin-pagar').innerText = `R$ ${dados.pagar.toFixed(2).replace('.', ',')}`;
        
        // 🧠 MÁGICA: Filtra e soma o saldo atual de todas as contas, IGNORANDO o Caixa Físico / Gaveta
        const saldoApenasBancos = contasBancariasGlobais
            .filter(b => !b.nome.toLowerCase().includes('caixa físico') && !b.nome.toLowerCase().includes('gaveta'))
            .reduce((soma, b) => soma + b.saldo_atual, 0);

        // Alimenta o card de Saldo de Bancos
        document.getElementById('fin-saldo-bancos').innerText = `R$ ${saldoApenasBancos.toFixed(2).replace('.', ',')}`;

        // Alerta visual de saldo negativo para o Saldo de Bancos
        if (saldoApenasBancos < 0) {
            document.getElementById('fin-saldo-bancos').style.color = '#f44336';
        } else {
            document.getElementById('fin-saldo-bancos').style.color = '#333';
        }

        // 👇 NOVA MÁGICA: Renderiza os pequenos cards de bancos dinamicamente
        const containerBancos = document.getElementById('container-saldos-bancos');
        if (containerBancos) {
            containerBancos.innerHTML = '';
            contasBancariasGlobais.forEach(b => {
                const corSaldo = b.saldo_atual >= 0 ? '#4CAF50' : '#f44336';
                containerBancos.innerHTML += `
                    <div style="background: white; padding: 15px 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); min-width: 160px; flex-shrink: 0; border-left: 4px solid #2196F3;">
                        <div style="font-size: 0.85rem; color: #666; font-weight: 600; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${b.nome}">${b.nome}</div>
                        <div style="font-size: 1.1rem; font-weight: bold; color: ${corSaldo};">
                            R$ ${parseFloat(b.saldo_atual).toFixed(2).replace('.', ',')}
                        </div>
                    </div>
                `;
            });
        }

    } catch (e) {
        console.error("Erro ao carregar resumo:", e);
    }
}

// 👇 NOVA FUNÇÃO: Acionada quando você clica num dos cards
function filtrarLancamentos(tipo) {
    filtroLancamentosAtual = tipo;
    carregarLancamentos(); // Manda a tabela se redesenhar com o novo filtro
}

function limparFiltrosTabela() {
    document.getElementById('filtro-busca').value = '';
    document.getElementById('filtro-banco').value = '';
    document.getElementById('filtro-categoria').value = ''; // 👇 NOVO
    document.getElementById('filtro-data-inicio').value = '';
    document.getElementById('filtro-data-fim').value = '';
    filtroLancamentosAtual = 'todos';
    carregarLancamentos();
}

async function carregarLancamentos() {
    const container = document.getElementById('fin-lista-lancamentos');
    const tituloTabela = document.getElementById('fin-titulo-tabela');
    
    const busca = document.getElementById('filtro-busca')?.value || '';
    const bancoId = document.getElementById('filtro-banco')?.value || '';
    const categoriaId = document.getElementById('filtro-categoria')?.value || ''; // 👇 NOVO
    const dataInicio = document.getElementById('filtro-data-inicio')?.value || '';
    const dataFim = document.getElementById('filtro-data-fim')?.value || '';
    
    try {
        // 👇 MÁGICA: Avisa ao servidor exatamente o que o usuário quer ver
        const params = new URLSearchParams({ 
            busca, 
            banco_id: bancoId,
            categoria_id: categoriaId, // 👇 NOVO 
            data_inicio: dataInicio, 
            data_fim: dataFim,
            filtro_card: filtroLancamentosAtual
        });
        
        const res = await fetch(`${API_URL}/financeiro/lancamentos?${params}`);
        let lista = await res.json();
        
        // Formatação visual dos Títulos
        if (filtroLancamentosAtual === 'receber') {
            tituloTabela.innerHTML = '🔍 Filtrando: Contas a Receber (Pendentes)';
            tituloTabela.style.color = '#4CAF50';
        } else if (filtroLancamentosAtual === 'pagar') {
            tituloTabela.innerHTML = '🔍 Filtrando: Contas a Pagar (Pendentes)';
            tituloTabela.style.color = '#f44336';
        } else {
            tituloTabela.innerHTML = 'Últimos Lançamentos';
            tituloTabela.style.color = '#333';
        }

        if (lista.length === 0) {
            container.innerHTML = '<p style="color: #999; font-style: italic;">Nenhum lançamento encontrado para este filtro.</p>';
            return;
        }

        let html = `<table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <tr style="border-bottom: 2px solid #eee; color: #666;">
                            <th style="padding: 10px;">Vencimento</th>
                            <th style="padding: 10px;">Descrição</th>
                            <th style="padding: 10px;">Tipo</th>
                            <th style="padding: 10px;">Status</th>
                            <th style="padding: 10px; text-align: right;">Valor</th>
                            <th style="padding: 10px; text-align: center;">Ações</th>
                        </tr>`;
        
        lista.forEach(item => {
            const corValor = item.tipo === 'Receita' ? '#4CAF50' : '#f44336';
            const corStatus = item.status === 'Pago' ? '#4CAF50' : '#FF9800';
            
            let dataFormatada = 'Sem data';
            if (item.data_vencimento) {
                const d = new Date(item.data_vencimento);
                d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
                dataFormatada = d.toLocaleDateString('pt-BR');
            }
            
            let iconeRepeticao = item.recorrente ? `<span class="material-symbols-outlined" style="font-size: 1rem; color: #9c27b0; vertical-align: middle; margin-left: 5px;" title="Conta de Repetição">repeat</span>` : '';
            const itemString = encodeURIComponent(JSON.stringify(item));

            html += `<tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px;">${dataFormatada}</td>
                        <td style="padding: 10px; font-weight: 500;">${item.descricao} ${iconeRepeticao}</td>
                        <td style="padding: 10px;">${item.tipo}</td>
                        <td style="padding: 10px;">
                            <span style="background: ${corStatus}; color: white; padding: 3px 8px; border-radius: 10px; font-size: 0.8rem;">
                                ${item.status}
                            </span>
                        </td>
                        <td style="padding: 10px; text-align: right; font-weight: bold; color: ${corValor};">
                            R$ ${parseFloat(item.valor).toFixed(2).replace('.', ',')}
                        </td>
                        <td style="padding: 10px; text-align: center;">
                            <button onclick="prepararEdicaoLancamento('${itemString}')" style="background:none; border:none; color:#FF9800; cursor:pointer; font-size:1.2rem; transition: 0.2s;" title="Editar Lançamento">✏️</button>
                            <button onclick="deletarLancamento(${item.id}, ${item.recorrente})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.2rem; transition: 0.2s;" title="Excluir Lançamento">🗑️</button>
                        </td>
                     </tr>`;
        });
        
        html += `</table>`;
        container.innerHTML = html;

    } catch (e) {
        container.innerHTML = '<p style="color: red;">Erro ao buscar os lançamentos no banco de dados.</p>';
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
    document.getElementById('lan-data').value = '';
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
    const catFiltradas = categoriasFinanceiras.filter(c => c.tipo === tipoFiltro);
    
    const agrupadas = {};
    catFiltradas.forEach(c => {
        if(!agrupadas[c.dre_ref]) agrupadas[c.dre_ref] = [];
        agrupadas[c.dre_ref].push(c);
    });

    let indexPaiContador = 1;
    Object.keys(agrupadas).forEach((dre_ref) => {
        const nomePai = nomesDRE[dre_ref] || dre_ref;
        let optgroup = `<optgroup label="${nomePai}">`;
        
        agrupadas[dre_ref].forEach((cat, indexFilho) => {
            const numeroBadge = `${indexPaiContador}.${indexFilho + 1}`;
            const isSelected = (typeof item !== 'undefined' && cat.id === item.categoria_id) ? 'selected' : '';
            optgroup += `<option value="${cat.id}" ${isSelected}>[${numeroBadge}] ${cat.nome}</option>`;
        });
        
        optgroup += `</optgroup>`;
        selectCat.innerHTML += optgroup;
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
    const catFiltradas = categoriasFinanceiras.filter(c => c.tipo === tipoFiltro);
    
    const agrupadas = {};
    catFiltradas.forEach(c => {
        if(!agrupadas[c.dre_ref]) agrupadas[c.dre_ref] = [];
        agrupadas[c.dre_ref].push(c);
    });

    let indexPaiContador = 1;
    Object.keys(agrupadas).forEach((dre_ref) => {
        const nomePai = nomesDRE[dre_ref] || dre_ref;
        let optgroup = `<optgroup label="${nomePai}">`;
        
        agrupadas[dre_ref].forEach((cat, indexFilho) => {
            const numeroBadge = `${indexPaiContador}.${indexFilho + 1}`;
            const isSelected = (typeof item !== 'undefined' && cat.id === item.categoria_id) ? 'selected' : '';
            optgroup += `<option value="${cat.id}" ${isSelected}>[${numeroBadge}] ${cat.nome}</option>`;
        });
        
        optgroup += `</optgroup>`;
        selectCat.innerHTML += optgroup;
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
// 🔄 LÓGICA DE TRANSFERÊNCIA E AUDITORIA
// ==========================================
function abrirModalTransferencia() {
    const selectOrigem = document.getElementById('trans-origem');
    const selectDestino = document.getElementById('trans-destino');
    
    selectOrigem.innerHTML = '<option value="">Selecione a Origem</option>';
    selectDestino.innerHTML = '<option value="">Selecione o Destino</option>';
    
    contasBancariasGlobais.forEach(b => {
        selectOrigem.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
        selectDestino.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
    });

    // Inteligência: Já deixa a Conta de Transição pré-selecionada na origem
    const contaTransicao = contasBancariasGlobais.find(b => b.nome.toLowerCase().includes('transição'));
    if (contaTransicao) selectOrigem.value = contaTransicao.id;

    document.getElementById('trans-valor-bruto').value = '';
    document.getElementById('trans-taxa').value = '0.00';
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    document.getElementById('trans-data').value = d.toISOString().split('T')[0];
    document.getElementById('modal-transferencia').style.display = 'flex';
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
                data_transferencia: dataTrans, // 👇 Envia para o servidor
                descricao: `Conciliação de Cartões/Pix`
            })
        });

        if (res.ok) {
            alert("✅ Auditoria realizada! Dinheiro transferido e taxas computadas no DRE.");
            fecharModalTransferencia();
            await carregarResumoFinanceiro(); // Atualiza os cards principais
            await carregarLancamentos(); // Atualiza a tabela de lançamentos
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