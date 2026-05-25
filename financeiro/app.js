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
        const res = await fetch(`${API_URL}/financeiro/resumo`);
        const dados = await res.json();
        
        // Pinta os valores nos cards
        document.getElementById('fin-saldo').innerText = `R$ ${dados.saldo.toFixed(2).replace('.', ',')}`;
        document.getElementById('fin-receber').innerText = `R$ ${dados.receber.toFixed(2).replace('.', ',')}`;
        document.getElementById('fin-pagar').innerText = `R$ ${dados.pagar.toFixed(2).replace('.', ',')}`;
        
        // Regra visual: Se o saldo ficar negativo, a fonte fica vermelha
        if (dados.saldo < 0) {
            document.getElementById('fin-saldo').style.color = '#f44336';
        } else {
            document.getElementById('fin-saldo').style.color = '#333';
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
// 🏦 LÓGICA DE CONTAS BANCÁRIAS
// ==========================================
async function carregarBancos() {
    try {
        const res = await fetch(`${API_URL}/financeiro/bancos`);
        contasBancariasGlobais = await res.json();
    } catch (e) { console.error("Erro ao carregar bancos"); }
}

async function abrirModalBancos() {
    await carregarBancos(); // Atualiza a lista
    const container = document.getElementById('lista-bancos-cadastrados');
    container.innerHTML = '';
    
    contasBancariasGlobais.forEach(banco => {
        container.innerHTML += `
            <div style="padding: 8px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                <strong>${banco.nome}</strong>
                <span style="color: #666; font-size: 0.85rem;">Saldo: R$ ${parseFloat(banco.saldo_inicial).toFixed(2)}</span>
            </div>
        `;
    });

    document.getElementById('novo-banco-nome').value = '';
    document.getElementById('modal-bancos').style.display = 'flex';
}

async function salvarBanco() {
    const nome = document.getElementById('novo-banco-nome').value.trim();
    if (!nome) return alert("⚠️ Digite o nome do banco!");

    try {
        const res = await fetch(`${API_URL}/financeiro/bancos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: nome, saldo_inicial: 0 })
        });
        
        if (res.ok) {
            alert("✅ Banco cadastrado com sucesso!");
            await abrirModalBancos(); // Recarrega a lista no modal
        } else alert("❌ Erro ao salvar banco.");
    } catch (e) { alert("❌ Falha de conexão."); }
}