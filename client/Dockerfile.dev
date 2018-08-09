# No bash, can still use once confident
# FROM node:alpine

FROM node

RUN mkdir -p /app/client
WORKDIR /app/client

COPY yarn.lock /app/client/
COPY package*.json /app/client/

RUN npm install

COPY . /app/client/

CMD ["npm", "start"]
