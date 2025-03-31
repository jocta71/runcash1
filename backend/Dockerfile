FROM node:18-slim

WORKDIR /app

COPY api/package*.json ./

RUN npm install --omit=dev

COPY api/ ./
COPY websocket_server.js ./

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "websocket_server.js"] 