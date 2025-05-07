# Utilitário de Remoção de Coleções UUID

Este diretório contém scripts para remover coleções no formato UUID do banco de dados MongoDB `roletas_db`. Estas coleções são criadas incorretamente quando IDs não numéricos são usados nas interações com o banco de dados.

## O problema

Como visto na imagem, várias coleções com nomes no formato UUID estão sendo criadas no banco de dados:

```
0b8fdf-47-e536-6f43-bff3-96b9c34cf3b7
1470972-2311-5460-ffec-b72232d363e
18bdc4ea-d884-c47a-d33f-27a268a4eecd
1920129d-760a-1755-c393-03d05c9de118
...
```

Essas coleções são criadas quando IDs não numéricos são usados para interagir com o banco. O código modificado já previne a criação de novas coleções, mas as existentes precisam ser removidas.

## Scripts disponíveis

### 1. `remover_colecoes_uuid.py`

Script Python principal que identifica e remove coleções UUID.

**Modos de execução:**
- Interativo: pede confirmação antes de remover
- Automático: remove sem confirmação

### 2. `remover_colecoes_uuid.sh`

Shell script para executar o Python com as variáveis de ambiente apropriadas.

**Uso:**
```bash
# Modo interativo (com confirmação)
./remover_colecoes_uuid.sh

# Modo automático (sem confirmação)
./remover_colecoes_uuid.sh --auto
```

### 3. `configurar_limpeza_automatica.sh`

Configura uma tarefa cron para executar a limpeza automática todos os dias.

**Uso:**
```bash
./configurar_limpeza_automatica.sh
```

Este script configurará uma tarefa cron que executa a limpeza todos os dias à 1h da manhã.

## Como usar

### Limpeza manual

1. Navegue até o diretório do projeto
2. Execute o script de limpeza:

```bash
cd backend
./scripts/remover_colecoes_uuid.sh
```

3. Siga as instruções na tela para confirmar a remoção das coleções UUID

### Limpeza automática

1. Navegue até o diretório do projeto
2. Configure a tarefa cron:

```bash
cd backend
./scripts/configurar_limpeza_automatica.sh
```

3. A tarefa será executada diariamente à 1h da manhã

## Logs

Os logs da limpeza automática são salvos no diretório `backend/logs/` com o formato `limpeza_uuid_YYYYMMDD.log`.

## Requisitos

- Python 3.6+
- pymongo
- Acesso ao MongoDB

## Personalização das variáveis de ambiente

Por padrão, os scripts usam:
- `MONGODB_URI=mongodb://localhost:27017/`
- `ROLETAS_MONGODB_DB_NAME=roletas_db`

Para personalizar, defina estas variáveis de ambiente antes de executar os scripts:

```bash
export MONGODB_URI="mongodb://usuario:senha@servidor:porta/"
export ROLETAS_MONGODB_DB_NAME="nome_do_banco"
./scripts/remover_colecoes_uuid.sh
```

## Notas adicionais

- O script identifica coleções UUID por padrão e também detecta outros formatos não numéricos
- Coleções numéricas (como "123456") são preservadas, pois são consideradas válidas
- Coleções de sistema como "metadados" também são preservadas 