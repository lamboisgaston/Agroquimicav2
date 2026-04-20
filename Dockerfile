FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
COPY public ./public/

RUN npm run build

CMD ["npm", "start"]
