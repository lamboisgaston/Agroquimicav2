FROM node:20-alpine

RUN apk add --no-cache libatomic python3 make g++

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY public ./public/
COPY src ./src/

RUN npm install
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
