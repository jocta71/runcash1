# Banco de Dados Otimizado para Roletas

Este projeto implementa uma estrutura otimizada de banco de dados para o armazenamento e recuperação de dados de roletas, utilizando coleções separadas para cada roleta no MongoDB.

## Visão Geral

A estrutura implementada utiliza um banco de dados dedicado chamado `roletas_db` que armazena cada roleta em sua própria coleção. Isso oferece as seguintes vantagens:

- Consultas mais rápidas ao recuperar dados de uma roleta específica
- Escalabilidade melhorada para grandes volumes de dados
- Melhor organização dos dados
- Capacidade de aplicar políticas específicas por roleta (índices, TTL, etc.)
- Manutenção de compatibilidade com o banco de dados original

## Estrutura do Banco de Dados

O banco de dados `roletas_db` contém as seguintes coleções:

- `metadados`: Armazena informações sobre cada roleta, incluindo ID, nome e nome da coleção correspondente
- `roleta_{ID}`: Uma coleção para cada roleta, onde {ID} é o identificador único da roleta
- `estatisticas`: Armazena estatísticas calculadas para cada roleta (opcional)

## Arquivos do Projeto

Este projeto contém os seguintes arquivos:

1. `criar_banco_roletas.py`: Script para criar o banco de dados e migrar dados existentes (se necessário)
2. `data_source_roletas_db.py`: Implementação da fonte de dados que se conecta ao novo banco
3. `adaptar_scraper_roletas_db.py`: Adaptador para integrar o scraper existente com a nova estrutura

## Como Usar

### 1. Criação do Banco de Dados

Execute o script `criar_banco_roletas.py` para criar o novo banco de dados:

```bash
python criar_banco_roletas.py
```

Este script:
- Cria o banco de dados `roletas_db` se não existir
- Cria a coleção de metadados
- Recupera informações sobre roletas existentes no banco original
- Cria coleções separadas para cada roleta
- Configura índices apropriados para otimização

### 2. Utilizar em Código Existente

#### Opção 1: Usar o adaptador para scraper

A maneira mais simples de migrar para a nova estrutura é usar o adaptador fornecido:

```python
# Importar o adaptador
from adaptar_scraper_roletas_db import ScraperAdapter

# Criar instância do adaptador (em vez da classe original)
data_source = ScraperAdapter()

# Usar normalmente como na implementação anterior
roletas = data_source.obter_roletas()
for roleta in roletas:
    print(f"Roleta: {roleta['nome']}")

# Inserir um número
data_source.inserir_numero("12345", "Roleta Automática", 15)

# Obter os últimos números
numeros = data_source.obter_ultimos_numeros("12345", 20)

# Sempre fechar a conexão ao final
data_source.fechar()
```

#### Opção 2: Usar diretamente a classe RoletasDataSource

Para um controle mais granular, você pode usar diretamente a classe `RoletasDataSource`:

```python
from data_source_roletas_db import RoletasDataSource

# Criar instância
ds = RoletasDataSource()

# Obter roletas disponíveis
roletas = ds.obter_roletas()

# Inserir número
ds.inserir_numero("12345", "Roleta Automática", 15, "vermelho")

# Obter números com filtragem por data
from datetime import datetime, timedelta
data_inicio = datetime.now() - timedelta(days=7)
numeros = ds.obter_numeros("12345", limite=100, data_inicio=data_inicio)

# Atualizar estatísticas manualmente (opcional)
ds.atualizar_estatisticas("12345", "Roleta Automática")

# Fechar conexão
ds.fechar()
```

### 3. Migração Progressiva

Para uma migração progressiva, você pode:

1. Começar a usar o adaptador para novas inserções
2. Manter a compatibilidade com o banco de dados original
3. Avaliar o desempenho e estabilidade
4. Migrar completamente quando estiver confiante

## Manutenção

### Monitoramento de Performance

- Monitore o tamanho das coleções
- Verifique a performance das consultas
- Ajuste os índices conforme necessário

### Backup

- Configure backups regulares do banco de dados `roletas_db`
- Mantenha o banco original como backup até completar a migração

## Solução de Problemas

### Logs

Os logs são armazenados nos seguintes arquivos:
- `roletas_db.log`: Log da fonte de dados principal
- `scraper_adapter.log`: Log do adaptador de scraper

### Problemas Comuns

1. **Erro de conexão**: Verifique se as credenciais do MongoDB estão corretas e se o serviço está acessível
2. **Roleta não encontrada**: Certifique-se de que o ID da roleta está correto e que a roleta foi criada
3. **Erro ao inserir número**: Verifique se o banco de dados tem espaço suficiente e se os tipos de dados estão corretos

## Compatibilidade

A implementação mantém compatibilidade com o banco de dados original (`runcash`) através de:

1. Duplicação de inserções no banco original (para compatibilidade)
2. Interface compatível através do adaptador
3. Estrutura de documentos similar ao formato original

## Próximos Passos

Para desenvolvimento futuro, considere:

1. Implementar controle de acesso refinado por coleção
2. Configurar expiração automática de dados antigos (TTL)
3. Implementar compressão de dados para coleções maiores

---

**IMPORTANTE**: Esta implementação requer Python 3.7+ e pymongo 3.12+. Certifique-se de ter essas dependências instaladas antes de usar. 