FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

ENV PORT=3001
ENV DATA_DIR=/data
EXPOSE 3001

CMD ["npm", "start"]
