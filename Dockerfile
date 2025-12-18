FROM node:20-alpine

# 👉 Alpine no trae git por defecto (npm lo necesita)
RUN apk add --no-cache git

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["node", "build/index.js"]
