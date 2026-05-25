const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
let categoriasFinanceiras = []; // Memória global para as categorias
let contasBancariasGlobais = []; // 👇 NOVO: Guarda os bancos na memória

window.onload = async () => {
    await carregarCategorias(); // Carrega as categorias antes de tudo
    await carregarBancos(); // 👇 NOVO: Carrega os bancos ao iniciar
    await carregarResumoFinanceiro();
    await carregarLancamentos();
};

async function carregarCategorias() {
    try {
        const res = await fetch(`${API_URL}/financeiro/categorias`);
        categoriasFinanceiras = await res.json();
    } catch (e) { console.error("Erro ao carregar categorias"); }
}

async function carregarResumoFinanceiro() {
    try {
        // Asegura que temos os saldos de bancos mais atualizados na memória
        await carregarBancos();

        const res = await fetch(`${API_URL}/financeiro/resumo`);
        const dados = await res.json();
        
        // Pinta os valores nos cards tradicionais
        document.getElementById('fin-saldo').innerText = `R$ ${dados.saldo.toFixed(2).replace('.', ',')}`;
        document.getElementById('fin-receber').innerText = `R$ ${dados.receber.toFixed(2).replace('.', ',')}`;
        document.getElementById('fin-pagar').innerText = `R$ ${dados.pagar.toFixed(2).replace('.', ',')}`;
        
        // 🧠 MÁGICA: Filtra e soma o saldo atual de todas as contas, IGNORANDO o Caixa Físico / Gaveta
        const saldoApenasBancos = contasBancariasGlobais
            .filter(b => !b.nome.toLowerCase().includes('caixa físico') && !b.nome.toLowerCase().includes('gaveta'))
            .reduce((soma, b) => soma + b.saldo_atual, 0);

        // Alimenta o novo card
        document.getElementById('fin-saldo-bancos').innerText = `R$ ${saldoApenasBancos.toFixed(2).replace('.', ',')}`;

        // Alerta visual de saldo negativo para o Saldo Geral
        if (dados.saldo < 0) {
            document.getElementById('fin-saldo').style.color = '#f44336';
        } else {
            document.getElementById('fin-saldo').style.color = '#333';
        }

        // Alerta visual de saldo negativo para o Saldo de Bancos
        if (saldoApenasBancos < 0) {
            document.getElementById('fin-saldo-bancos').style.color = '#f44336';
        } else {
            document.getElementById('fin-saldo-bancos').style.color = '#333';
        }
    } catch (e) {
        console.error("Erro ao carregar resumo:", e);
    }
}

async function carregarLancamentos() {
    const container = document.getElementById('fin-lista-lancamentos');
    try {
        const res = await fetch(`${API_URL}/financeiro/lancamentos`);
        const lista = await res.json();
        
        if (lista.length === 0) {
            container.innerHTML = '<p style="color: #999; font-style: italic;">Nenhum lançamento encontrado ainda.</p>';
            return;
        }

        // Desenha a tabela com a nova coluna de Ações
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

            html += `<tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px;">${dataFormatada}</td>
                        <td style="padding: 10px; font-weight: 500;">${item.descricao}</td>
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
                            <button onclick="deletarLancamento(${item.id})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.2rem; transition: 0.2s;" title="Excluir Lançamento">🗑️</button>
                        </td>
                     </tr>`;
        });
        
        html += `</table>`;
        container.innerHTML = html;

    } catch (e) {
        container.innerHTML = '<p style="color: red;">Erro ao buscar os lançamentos no banco de dados.</p>';
    }
}

// Nova função que o botão da lixeira chama
async function deletarLancamento(id) {
    if (!confirm("⚠️ Tem certeza que deseja excluir este lançamento? Essa ação não tem volta.")) return;
    
    try {
        const res = await fetch(`${API_URL}/financeiro/lancamentos/${id}`, { method: 'DELETE' });
        
        if (res.ok) {
            // Se deu certo, manda a tela recalcular os cards e a tabela na hora!
            await carregarResumoFinanceiro();
            await carregarLancamentos();
        } else {
            alert("❌ Erro ao tentar excluir no banco de dados.");
        }
    } catch (e) {
        alert("❌ Falha de conexão com o servidor.");
    }
}

// ==========================================
// LÓGICA DO MODAL (NOVO LANÇAMENTO)
// ==========================================
let tipoLancamentoAtual = '';

function abrirModalLancamento(tipo) {
    tipoLancamentoAtual = tipo; 
    document.getElementById('modal-titulo').innerText = `Nova ${tipo}`;
    
    document.getElementById('lan-descricao').value = '';
    document.getElementById('lan-valor').value = '';
    document.getElementById('lan-data').value = '';
    document.getElementById('lan-status').value = 'Pendente';
    
    // 👇 NOVO: Popula o select filtrando apenas Receitas ou apenas Despesas
    const selectCat = document.getElementById('lan-categoria');
    selectCat.innerHTML = '<option value="">Selecione a Categoria</option>';
    const catsFiltradas = categoriasFinanceiras.filter(c => c.tipo === tipo);
    catsFiltradas.forEach(c => {
        selectCat.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
    });

    // 👇 NOVO: Popula o select de Bancos
    const selectConta = document.getElementById('lan-conta');
    selectConta.innerHTML = '<option value="">Selecione o Banco</option>';
    contasBancariasGlobais.forEach(b => {
        selectConta.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
    });

    const btnSalvar = document.getElementById('btn-salvar-lan');
    btnSalvar.style.backgroundColor = (tipo === 'Receita') ? '#4CAF50' : '#f44336';
    
    document.getElementById('modal-lancamento').style.display = 'flex';
}

function fecharModalLancamento() {
    document.getElementById('modal-lancamento').style.display = 'none';
}

async function salvarLancamento() {
    const descricao = document.getElementById('lan-descricao').value.trim();
    const valor = parseFloat(document.getElementById('lan-valor').value);
    const data_vencimento = document.getElementById('lan-data').value;
    const status = document.getElementById('lan-status').value;
    const categoria_id = document.getElementById('lan-categoria').value; // 👇 Pega a categoria
    const conta_id = document.getElementById('lan-conta').value; // 👇 NOVO

    if (!descricao || isNaN(valor) || valor <= 0 || !data_vencimento) {
        return alert("⚠️ Por favor, preencha a descrição, o valor e o vencimento.");
    }
    if (!categoria_id) {
        return alert("⚠️ Selecione uma Categoria para classificar este lançamento no DRE.");
    }

    const btnSalvar = document.getElementById('btn-salvar-lan');
    btnSalvar.innerText = "Salvando...";
    btnSalvar.disabled = true;

    try {
        const res = await fetch(`${API_URL}/financeiro/lancamentos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                descricao, valor, data_vencimento, status,
                tipo: tipoLancamentoAtual,
                categoria_id, // 👇 Envia a categoria para o banco
                conta_id // 👇 Envia pro backend
            })
        });

        if (res.ok) {
            fecharModalLancamento();
            // MÁGICA: Manda a tela recalcular os cards e a tabela sozinhos!
            await carregarResumoFinanceiro();
            await carregarLancamentos();
        } else {
            alert("❌ Erro ao salvar lançamento no banco.");
        }
    } catch (e) {
        alert("❌ Falha de conexão com o servidor.");
    } finally {
        btnSalvar.innerText = "Salvar";
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