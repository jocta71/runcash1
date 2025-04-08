# Corrigindo o erro de Mongoose não encontrado

O erro `Error: Cannot find module 'mongoose'` ocorre porque as novas funcionalidades de estratégias personalizadas dependem do módulo mongoose, que não está instalado no ambiente de execução.

## Solução

### 1. Adicione o mongoose ao package.json

Adicione a linha abaixo na seção de `dependencies` no arquivo `backend/api/package.json`:

```json
"mongoose": "^8.1.1"
```

O arquivo deve ficar parecido com isto:

```json
{
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "mongodb": "^6.3.0",
    "mongoose": "^8.1.1",
    "stripe": "^14.19.0"
  }
}
```

### 2. Instale o mongoose

Execute o seguinte comando no diretório `backend/api`:

```bash
npm install
```

### 3. Se estiver usando Docker, atualize a imagem

Se você estiver usando Docker, reconstrua a imagem com:

```bash
docker-compose build
# ou
docker build -t runcash-api -f backend-scraper.Dockerfile .
```

### 4. Modifique o Dockerfile para garantir a instalação do mongoose

No arquivo Dockerfile ou docker-compose.yml, adicione um comando explícito para instalar o mongoose:

```dockerfile
RUN npm install mongoose@8.1.1
```

### 5. Reinicie o serviço

Após fazer essas alterações, reinicie o serviço para aplicar as mudanças:

```bash
docker-compose down
docker-compose up -d
# ou
docker stop [container_id]
docker start [container_id]
```

Essas alterações garantirão que o mongoose seja instalado e esteja disponível para os novos modelos de estratégia. 