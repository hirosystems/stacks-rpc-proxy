FROM node:20-bullseye

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --production

ENV NODE_ENV=production
ENV LOG_LEVEL=debug

CMD ["node", "/app/build/index.js"]
