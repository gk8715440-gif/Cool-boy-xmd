FROM node:22-alpine

RUN apk add --no-cache \
    git \
    ffmpeg \
    libwebp-tools \
    python3 \
    make \
    g++

WORKDIR /app

RUN mkdir -p temp

ENV TZ=Asia/Kolkata

RUN npm install -g pm2

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
