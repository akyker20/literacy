FROM node:8

WORKDIR /usr/src/app

RUN npm install -g forever

COPY package.json package-lock.json ./

RUN npm install

COPY . .

EXPOSE 5000

CMD [ "npm", "start" ]