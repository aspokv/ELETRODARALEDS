# Stage 1: build do site (React + Vite)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: servidor Node (site + cadastros + painel), sem dependências externas
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=80 \
    DIST_DIR=/app/dist \
    DATA_DIR=/data

COPY --from=builder /app/dist ./dist
COPY server ./server

# Cadastros e contas ficam em /data — monte um volume persistente aqui.
VOLUME /data
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1/api/health || exit 1

CMD ["node", "server/server.mjs"]
