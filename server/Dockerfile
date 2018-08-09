# No bash, can still use once confident
# FROM node:alpine

FROM node
RUN npm install -g nodemon

RUN mkdir -p /app/server
WORKDIR /app/server


COPY package*.json /app/server/

RUN npm install

COPY . /app/server/

CMD ["nodemon", "server.js"]
