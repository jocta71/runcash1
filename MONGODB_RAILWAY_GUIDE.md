# Guia de Configuração do MongoDB no Railway

Este guia explica como configurar corretamente a variável de ambiente `MONGODB_URI` no Railway para que o scraper possa se conectar ao MongoDB.

## Problema

O scraper está extraindo dados normalmente, mas eles não estão sendo salvos no MongoDB. Isso geralmente acontece porque a variável de ambiente `MONGODB_URI` não está configurada corretamente no Railway.

## Solução

### 1. Verificar a string de conexão do MongoDB

A string de conexão do MongoDB usada no projeto é:

```
mongodb+srv://runcash:8867Jpp@runcash.g2ixx79.mongodb.net/runcash?retryWrites=true&w=majority&appName=runcash
```

### 2. Configurar a variável de ambiente no Railway

Siga estes passos para configurar a variável de ambiente no Railway:

1. Faça login no [Railway](https://railway.app/)
2. Selecione seu projeto RunCash
3. Vá para a aba "Variables"
4. Adicione uma nova variável:
   - **Nome**: `MONGODB_URI`
   - **Valor**: `mongodb+srv://runcash:8867Jpp@runcash.g2ixx79.mongodb.net/runcash?retryWrites=true&w=majority&appName=runcash`
5. Clique em "Add" para salvar a variável
6. Reinicie o serviço para que as alterações tenham efeito

### 3. Verificar se a conexão está funcionando

Após configurar a variável de ambiente, você pode verificar se a conexão está funcionando corretamente:

1. Vá para a aba "Deployments" no Railway
2. Selecione o deployment mais recente
3. Verifique os logs para confirmar se a conexão com o MongoDB foi estabelecida com sucesso

## Verificação Local

Se quiser verificar a conexão localmente, você pode executar o script `check_mongo_config.py` no diretório `backend/scraper`:

```bash
cd backend/scraper
python check_mongo_config.py
```

Este script mostrará se a conexão com o MongoDB está funcionando corretamente.

## Outras Variáveis Relacionadas

Além do `MONGODB_URI`, você também pode configurar estas variáveis no Railway:

- `MONGODB_DB_NAME`: Nome do banco de dados MongoDB (padrão: runcash)
- `MONGODB_ENABLED`: Habilita o uso do MongoDB (defina como "true")

## Solução de Problemas

Se ainda estiver enfrentando problemas após configurar a variável de ambiente:

1. Verifique se a string de conexão está correta e não contém espaços extras
2. Confirme se o IP do Railway está na lista de IPs permitidos no MongoDB Atlas
3. Verifique os logs do Railway para identificar mensagens de erro específicas relacionadas à conexão com o MongoDB