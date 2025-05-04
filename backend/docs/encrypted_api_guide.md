# Guia de Integração - API Pública de Roletas

## Introdução

A API pública de roletas do RunCash foi redesenhada para fornecer dados de forma segura sem necessidade de autenticação. Em vez de usar JWT e validação de assinatura, a API agora implementa criptografia de dados Fe26.2, retornando tokens criptografados que só podem ser decodificados com a chave correta.

## Benefícios

1. **Acesso simplificado**: Não é mais necessário autenticar o usuário ou verificar assinatura a cada requisição
2. **Proteção de dados**: Os dados ainda são protegidos criptograficamente
3. **Cacheable**: As respostas podem ser cacheadas por CDNs, melhorando a performance
4. **Redução de carga no servidor**: Menos verificações de autenticação reduzem o processamento no backend

## Endpoints Disponíveis

### Listar todas as roletas

```
GET /api/roulettes
```

### Obter dados de uma roleta específica

```
GET /api/roulettes/:id
```

### Obter números de uma roleta específica

```
GET /api/roulettes/:id/numbers?limit=50
```

## Formato de Resposta

Todas as respostas têm o seguinte formato:

```json
{
  "_encryption": "Fe26.2",
  "data": "Fe26.2*[dados_criptografados]*[timestamp]*[assinatura]",
  "requestId": "7a8b9c0d",
  "timestamp": 1624512345678
}
```

## Integração no Frontend

Para consumir a API, o frontend precisa ser capaz de descriptografar os dados. Isso é feito usando a biblioteca `@hapi/iron`.

### Dependências Necessárias

```bash
npm install @hapi/iron
```

### Exemplo de Código (React/JavaScript)

```javascript
import Iron from '@hapi/iron';

// A chave de descriptografia deve ser a mesma usada no backend
const DECRYPTION_KEY = 'runcashh_data_encryption_secret_key_32ch';

// Função para buscar e descriptografar dados
async function fetchRouletteData() {
  const response = await fetch('/api/roulettes');
  const encryptedData = await response.json();
  
  if (encryptedData._encryption === 'Fe26.2') {
    const decrypted = await Iron.unseal(encryptedData.data, DECRYPTION_KEY, Iron.defaults);
    return decrypted.data;
  }
  
  return encryptedData; // Caso não esteja criptografado
}
```

## Utilitários Disponíveis

O RunCash já implementa utilitários que facilitam o consumo desta API. É recomendado usar estes utilitários:

### 1. Módulo de Descriptografia

```javascript
// Importe utilitário de descriptografia
import { decryptApiData, fetchAndDecrypt } from '../../utils/decryptionUtils';

// Exemplo de uso com fetch padrão
const response = await fetch('/api/roulettes');
const data = await response.json();
const decryptedData = await decryptApiData(data);

// Exemplo com o utilitário que combina fetch e decrypt
const decryptedData = await fetchAndDecrypt('/api/roulettes');
```

### 2. API de Roletas

```javascript
// Use o serviço de API já configurado
import RouletteApi from '../services/api/rouletteApi';

// Listar todas as roletas
const roulettes = await RouletteApi.getAll();

// Obter dados de uma roleta específica
const rouletteData = await RouletteApi.getById('12345');

// Obter números de uma roleta
const numbers = await RouletteApi.getNumbers('12345', 100);
```

## Considerações de Segurança

1. **Proteja a chave de descriptografia**: A chave deve ser mantida segura e não exposta publicamente
2. **Verificação de timestamp**: Os dados incluem um timestamp que deve ser verificado para evitar ataques de replay
3. **Suporte a múltiplas versões**: O formato Fe26.2 permite rotação de chaves no futuro

## Tratamento de Erros

A API pode retornar os seguintes códigos de erro:

- **400**: Requisição inválida
- **404**: Recurso não encontrado
- **500**: Erro interno do servidor
- **503**: Serviço indisponível (MongoDB não conectado)

## Perguntas Frequentes

### Como garantir a segurança sem autenticação?

A criptografia Fe26.2 é considerada segura para transmissão de dados. O token é assinado e criptografado, garantindo que apenas aplicações com a chave correta possam ler os dados.

### E se o frontend for comprometido?

Se o frontend for comprometido, o invasor terá acesso apenas aos dados que o usuário já teria acesso normalmente. Não é possível modificar os dados ou enviar dados falsos, pois a assinatura garante a integridade.

### Os dados estão limitados por plano?

Não. Como não há mais verificação de assinatura, os dados retornados são os mesmos para todos os usuários. Isso significa que todos recebem o conjunto completo de dados. 