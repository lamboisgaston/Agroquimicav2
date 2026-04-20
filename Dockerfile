FROM node:20-alpine

RUN apk add --no-cache libatomic python3 make g++

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY public ./public/
COPY src ./src/

RUN npm ci
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
