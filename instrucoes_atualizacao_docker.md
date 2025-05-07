# Instruções para Atualização do Scraper no Docker

Este documento contém instruções detalhadas para atualizar o scraper em execução no Docker para usar o banco de dados `roletas_db`.

## Arquivos Modificados

Modificamos os seguintes arquivos para usar a variável de ambiente `ROLETAS_MONGODB_DB_NAME`:

1. `backend/scraper/run_real_scraper.py` - Agora tenta usar o adaptador primeiro
2. `backend/scraper/data_source_mongo.py` - Modificado para priorizar `ROLETAS_MONGODB_DB_NAME`
3. `backend/scraper/mongo_config.py` - Modificado para priorizar `ROLETAS_MONGODB_DB_NAME`

## Passos para Atualização

### Passo 1: Identificar o Contêiner em Execução

```bash
docker ps
```

Anote o ID do contêiner do scraper.

### Passo 2: Copiar os Arquivos Modificados

```bash
# Copiar os arquivos modificados para o contêiner
docker cp backend/scraper/run_real_scraper.py CONTAINER_ID:/app/backend/scraper/
docker cp backend/scraper/data_source_mongo.py CONTAINER_ID:/app/backend/scraper/
docker cp backend/scraper/mongo_config.py CONTAINER_ID:/app/backend/scraper/
```

### Passo 3: Copiar os Arquivos do Adaptador

```bash
# Copiar os arquivos do adaptador para o contêiner
docker cp data_source_roletas_db.py CONTAINER_ID:/app/
docker cp adaptar_scraper_roletas_db.py CONTAINER_ID:/app/
docker cp scraper_mongodb.py CONTAINER_ID:/app/
```

### Passo 4: Verificar Permissões dos Arquivos

```bash
# Verificar se os arquivos têm as permissões corretas
docker exec CONTAINER_ID chmod +x /app/backend/scraper/run_real_scraper.py
```

### Passo 5: Reiniciar o Contêiner

```bash
docker restart CONTAINER_ID
```

### Passo 6: Verificar Logs

```bash
docker logs CONTAINER_ID
```

Verifique os logs para confirmar que o scraper está usando o banco de dados `roletas_db`. Procure as mensagens:

```
🔧 Configurando banco de dados: roletas_db
Usando banco de dados: roletas_db
```

## Solução de Problemas

### Erro "No module named 'adaptar_scraper_roletas_db'"

Se você ver essa mensagem nos logs, significa que os arquivos do adaptador não foram copiados corretamente. Verifique:

1. Se os arquivos foram copiados para o diretório correto
2. Se os arquivos têm permissões de leitura

```bash
# Verificar se os arquivos existem no contêiner
docker exec CONTAINER_ID ls -la /app/adaptar_scraper_roletas_db.py
```

### Erro de Conexão com o MongoDB

Se houver erros de conexão, verifique se a URI do MongoDB está correta:

```bash
# Verificar variáveis de ambiente no contêiner
docker exec CONTAINER_ID env | grep MONGODB
```

## Verificação Final

Para verificar se o scraper está registrando números no banco de dados correto, você pode:

1. Conectar-se ao MongoDB Atlas
2. Verificar se a database `roletas_db` está recebendo novos dados
3. Verificar coleções específicas para as roletas com IDs numéricos

## Restauração

Se algo der errado, você pode restaurar a versão anterior dos arquivos:

```bash
# Restaurar a configuração anterior (se necessário)
docker cp backup/run_real_scraper.py CONTAINER_ID:/app/backend/scraper/
docker cp backup/data_source_mongo.py CONTAINER_ID:/app/backend/scraper/
docker cp backup/mongo_config.py CONTAINER_ID:/app/backend/scraper/
docker restart CONTAINER_ID
``` 