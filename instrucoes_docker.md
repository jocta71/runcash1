# Instruções para Atualizar o Scraper no Docker

Este documento contém instruções para atualizar o scraper que está rodando em contêiner Docker para usar o novo banco de dados `roletas_db` em vez do banco `runcash`.

## Arquivos Necessários

Verifique se você tem estes arquivos atualizados no seu sistema:

1. `data_source_roletas_db.py` - Classe de acesso ao banco de dados otimizado
2. `adaptar_scraper_roletas_db.py` - Adaptador para o scraper usar o novo banco
3. `scraper_mongodb.py` - Versão atualizada do scraper
4. `backend/scraper/run_real_scraper.py` - Script principal modificado

## Opção 1: Reconstruir a imagem Docker

Se você puder reconstruir a imagem Docker:

1. Copie os arquivos atualizados para o diretório do projeto
2. Reconstrua a imagem:
   ```bash
   docker build -t seu-nome-de-imagem .
   ```
3. Execute o contêiner novamente:
   ```bash
   docker run -d --name scraper --env ROLETAS_MONGODB_DB_NAME=roletas_db seu-nome-de-imagem
   ```

## Opção 2: Copiar os arquivos para um contêiner existente

Se você preferir atualizar um contêiner já em execução:

1. Encontre o ID do contêiner:
   ```bash
   docker ps
   ```

2. Copie os arquivos para o contêiner:
   ```bash
   docker cp data_source_roletas_db.py CONTAINER_ID:/app/
   docker cp adaptar_scraper_roletas_db.py CONTAINER_ID:/app/
   docker cp scraper_mongodb.py CONTAINER_ID:/app/
   docker cp backend/scraper/run_real_scraper.py CONTAINER_ID:/app/backend/scraper/
   ```

3. Reinicie o contêiner:
   ```bash
   docker restart CONTAINER_ID
   ```

## Opção 3: Atualizar com Docker Compose

Se você estiver usando Docker Compose:

1. Adicione a variável de ambiente no arquivo `docker-compose.yml`:
   ```yaml
   services:
     scraper:
       # ... outras configurações ...
       environment:
         - ROLETAS_MONGODB_DB_NAME=roletas_db
   ```

2. Atualize os arquivos no diretório do projeto

3. Reconstrua e reinicie:
   ```bash
   docker-compose up -d --build
   ```

## Verificação

Para verificar se o scraper está usando o banco de dados correto:

1. Veja os logs do contêiner:
   ```bash
   docker logs CONTAINER_ID
   ```

2. Confirme que aparece a mensagem:
   ```
   🔧 Configurando banco de dados: roletas_db
   ```

3. Verifique também:
   ```
   ✅ Adaptador para banco de dados otimizado importado com sucesso
   ```

Se você vir estas mensagens, o scraper está configurado corretamente para usar o banco de dados `roletas_db`. 