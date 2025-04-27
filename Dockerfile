FROM node:18-alpine

WORKDIR /app

# Criar um arquivo index.js minimalista para teste
RUN echo 'const express = require("express"); \
const app = express(); \
app.get("/", (req, res) => { \
  res.json({ status: "online", message: "RunCash server is running" }); \
}); \
const PORT = process.env.PORT || 3000; \
app.listen(PORT, () => { \
  console.log(`Server running on port ${PORT}`); \
});' > index.js

# Instalar apenas o mínimo necessário
RUN npm init -y && \
    npm install express

# Expor porta
EXPOSE 3000

# Comando para iniciar
CMD ["node", "index.js"] 