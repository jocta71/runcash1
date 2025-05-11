document.addEventListener('DOMContentLoaded', function() {
    // Obter referências aos elementos DOM
    const filtroTexto = document.getElementById('filtroTexto');
    const filtroFornecedor = document.getElementById('filtroFornecedor');
    
    // Chamar a função de atualização imediatamente
    atualizarDados();
    
    // Configurar atualização automática a cada 5 segundos
    setInterval(atualizarDados, 5000);
    
    // Adicionar event listeners para os filtros
    filtroTexto.addEventListener('input', aplicarFiltros);
    filtroFornecedor.addEventListener('change', aplicarFiltros);
    
    // Função para atualizar os dados
    function atualizarDados() {
        fetch('/api/mesas')
            .then(response => response.json())
            .then(data => {
                renderizarMesas(data.mesas);
                atualizarContadores(data.contadores);
                atualizarTimestamp(data.timestamp);
                aplicarFiltros(); // Aplicar filtros aos novos dados
            })
            .catch(error => console.error('Erro ao buscar dados:', error));
    }
    
    // Função para renderizar as mesas por seção
    function renderizarMesas(mesas) {
        // Limpar contêineres
        document.getElementById('evolution-mesas').innerHTML = '';
        document.getElementById('pragmatic-mesas').innerHTML = '';
        document.getElementById('onair-mesas').innerHTML = '';
        document.getElementById('stakelogic-mesas').innerHTML = '';
        
        // Contadores por seção
        let countEvolution = 0;
        let countPragmatic = 0;
        let countOnair = 0;
        let countStakelogic = 0;
        
        // Processar cada mesa
        mesas.forEach(mesa => {
            const mesaCard = criarCardMesa(mesa);
            
            // Adicionar à seção correta
            switch (mesa.fornecedor) {
                case 'Evolution':
                    document.getElementById('evolution-mesas').appendChild(mesaCard);
                    countEvolution++;
                    break;
                case 'Pragmatic Play':
                    document.getElementById('pragmatic-mesas').appendChild(mesaCard);
                    countPragmatic++;
                    break;
                case 'OnAir':
                    document.getElementById('onair-mesas').appendChild(mesaCard);
                    countOnair++;
                    break;
                case 'Stakelogic':
                    document.getElementById('stakelogic-mesas').appendChild(mesaCard);
                    countStakelogic++;
                    break;
            }
        });
        
        // Atualizar contadores nas seções
        document.querySelector('#evolution-section h2').setAttribute('data-count', `(${countEvolution})`);
        document.querySelector('#pragmatic-section h2').setAttribute('data-count', `(${countPragmatic})`);
        document.querySelector('#onair-section h2').setAttribute('data-count', `(${countOnair})`);
        document.querySelector('#stakelogic-section h2').setAttribute('data-count', `(${countStakelogic})`);
        
        // Mostrar/ocultar seções vazias
        document.getElementById('evolution-section').classList.toggle('secao-vazia', countEvolution === 0);
        document.getElementById('pragmatic-section').classList.toggle('secao-vazia', countPragmatic === 0);
        document.getElementById('onair-section').classList.toggle('secao-vazia', countOnair === 0);
        document.getElementById('stakelogic-section').classList.toggle('secao-vazia', countStakelogic === 0);
    }
    
    // Função para criar um card de mesa
    function criarCardMesa(mesa) {
        const card = document.createElement('div');
        card.className = 'mesa-card';
        card.setAttribute('data-fornecedor', mesa.fornecedor);
        card.setAttribute('data-nome', mesa.nome_mesa);
        
        // Determinar a imagem da mesa
        const imgSrc = mesa.imagen || '/static/placeholder.jpg';
        
        // Criar HTML para o número
        let numerosHTML = '';
        if (mesa.historico && mesa.historico.length > 0) {
            numerosHTML = `<div class="mesa-numeros">`;
            mesa.historico.slice(0, 10).forEach(numero => {
                let classe = 'numero-verde';
                if (numero > 0) {
                    classe = numero % 2 === 0 ? 'numero-preto' : 'numero-vermelho';
                }
                numerosHTML += `<div class="numero ${classe}">${numero}</div>`;
            });
            numerosHTML += `</div>`;
        }
        
        // Conteúdo do card
        card.innerHTML = `
            <img src="${imgSrc}" alt="${mesa.nome_mesa}" class="mesa-img" onerror="this.src='/static/placeholder.jpg'">
            <div class="mesa-info">
                <div class="mesa-header">
                    <h3 class="mesa-nome">${mesa.nome_mesa}</h3>
                    <span class="mesa-aposta">${mesa.aposta_min}</span>
                </div>
                <div class="mesa-id">${mesa.mesa_id}</div>
                ${numerosHTML}
                <div class="mesa-footer">
                    <div class="mesa-jogadores">${mesa.jogadores || 0}</div>
                    <div class="mesa-timestamp">${mesa.timestamp_formatado || '-'}</div>
                </div>
            </div>
        `;
        
        return card;
    }
    
    // Função para atualizar o timestamp de última atualização
    function atualizarTimestamp(timestamp) {
        const data = new Date(timestamp * 1000);
        const horas = data.getHours().toString().padStart(2, '0');
        const minutos = data.getMinutes().toString().padStart(2, '0');
        const segundos = data.getSeconds().toString().padStart(2, '0');
        
        document.getElementById('tempo-atualizacao').textContent = `${horas}:${minutos}:${segundos}`;
    }
    
    // Função para atualizar os contadores
    function atualizarContadores(contadores) {
        document.getElementById('contador-total').textContent = contadores.total;
        document.getElementById('contador-evolution').textContent = contadores.evolution;
        document.getElementById('contador-pragmatic').textContent = contadores.pragmatic;
        document.getElementById('contador-mg').textContent = contadores.mg;
        document.getElementById('contador-stakelogic').textContent = contadores.stakelogic;
    }
    
    // Função para aplicar filtros
    function aplicarFiltros() {
        const textoBusca = filtroTexto.value.toLowerCase();
        const fornecedorSelecionado = filtroFornecedor.value;
        
        // Selecionar todos os cards
        const cards = document.querySelectorAll('.mesa-card');
        
        // Verificar cada card
        cards.forEach(card => {
            const nome = card.getAttribute('data-nome').toLowerCase();
            const fornecedor = card.getAttribute('data-fornecedor');
            
            // Verificar se o card atende aos critérios de filtro
            const atendeTexto = nome.includes(textoBusca);
            const atendeFornecedor = fornecedorSelecionado === '' || fornecedor === fornecedorSelecionado;
            
            // Mostrar ou ocultar o card
            card.style.display = atendeTexto && atendeFornecedor ? 'block' : 'none';
        });
        
        // Verificar se as seções estão vazias após a filtragem
        const secoes = ['evolution', 'pragmatic', 'onair', 'stakelogic'];
        
        secoes.forEach(secao => {
            const sectionElement = document.getElementById(`${secao}-section`);
            const visibleCards = sectionElement.querySelectorAll('.mesa-card[style="display: block"]').length;
            sectionElement.classList.toggle('secao-vazia', visibleCards === 0);
        });
    }
});