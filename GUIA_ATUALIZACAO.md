# Guia de Atualização do Scraper para o Banco de Dados Roletas_DB

Este guia explica as alterações feitas no sistema e como atualizar o contêiner Docker para usar o novo banco de dados `roletas_db` com coleções específicas para cada roleta.

## Alterações Realizadas

### 1. Modificações na Classe `MongoDataSource`
- Adicionado suporte ao novo banco de dados `roletas_db`
- Implementado uso de coleções específicas para cada roleta
- Adicionado método `fechar()` para encerrar a conexão com o banco
- Otimizados métodos para trabalhar com coleções específicas:
  - `inserir_numero`
  - `obter_ultimos_numeros`
  - `obter_timestamp_numero`
  - `garantir_roleta_existe`

### 2. Variável de Ambiente
- Criada variável `ROLETAS_MONGODB_DB_NAME` para definir o nome do banco de dados
- O sistema agora prioriza esta variável sobre a antiga `MONGODB_DB_NAME`

### 3. Melhorias na Performance
- Consultas mais eficientes com coleções específicas por roleta
- Redução do volume de dados processados em cada consulta
- Melhor organização dos dados no banco de dados

## Como Atualizar o Contêiner Docker

### Pré-requisitos
- Acesso ao servidor onde o Docker está sendo executado
- Permissão para executar comandos Docker
- Os arquivos modificados já presentes na máquina host

### Passo a Passo

1. **Identificar o ID do contêiner:**
   ```bash
   docker ps
   ```
   Anote o ID do contêiner que executa o scraper.

2. **Executar o script de atualização:**
   ```bash
   chmod +x atualizar_docker.sh
   ./atualizar_docker.sh <CONTAINER_ID>
   ```
   Substitua `<CONTAINER_ID>` pelo ID anotado no passo anterior.

3. **Verificar os logs:**
   O script irá mostrar os logs recentes do contêiner após a atualização.
   Confirme se o scraper está utilizando o banco `roletas_db` e as coleções específicas.

### Verificação Manual

Para verificar manualmente se a atualização foi bem-sucedida, você pode:

1. **Acessar o contêiner:**
   ```bash
   docker exec -it <CONTAINER_ID> bash
   ```

2. **Verificar o log do scraper:**
   ```bash
   cat /app/logs/scraper.log | grep "banco de dados"
   ```
   Deverá mostrar mensagens como "Usando banco de dados: roletas_db"

3. **Verificar o MongoDB:**
   ```bash
   mongo mongodb+srv://<USUARIO>:<SENHA>@<HOST>/roletas_db
   db.getCollectionNames()
   ```
   Deverá mostrar as coleções específicas por roleta (ex: "2010165")

## Restauração em Caso de Problemas

Se a atualização causar problemas, você pode restaurar os arquivos originais:

```bash
docker cp backup/data_source_mongo.py <CONTAINER_ID>:/app/backend/scraper/
docker cp backup/mongo_config.py <CONTAINER_ID>:/app/backend/scraper/
docker cp backup/run_real_scraper.py <CONTAINER_ID>:/app/backend/scraper/
docker restart <CONTAINER_ID>
```

## Suporte

Em caso de dúvidas ou problemas, verifique:
- Logs do contêiner: `docker logs <CONTAINER_ID>`
- Logs do scraper: `/app/logs/scraper.log` dentro do contêiner
- Configurações do MongoDB Atlas no painel de controle 