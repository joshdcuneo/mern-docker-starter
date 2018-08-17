# DEMO REPO | MERN + DOCKER

## Overview

This repo provides an opinionated demo and instructions to setup a development and production environment within docker utilising the MERN stack. It includes:

- Hot reloading on both client and server
- Optional (recommended) auth settings on MongoDB

This is by no means the only correct way, just a simple and easy to work with methodology that provides modular services.

> Please note! The deployment method we are using did not work for me in a Windows 10 environment. This deployment method is ONLY tested from Linux.

## DEVELOPMENT

> This setup is a simple way to get a development environment up and running. In the production section I will give more detail on how to make it production ready. The final, optional section will cover enhancements to make the setup more efficient.

## Project file structure

```
project-name
    |
    |---/ client
            |
            |---/ public
            |---/ src
            |
            .dockerignore
            Dockerfile
            Dockerfile-dev
            nginx.conf
            package.json
            yarn.lock
    |
    |---/ server
            |
            |---/src
            |
            .dockerignore
            Dockerfile
            Dockerfile-dev
            yarn.lock
            package.json
    |
    |
    .env
    .gitignore
    dev-docker-compose.yml
    docker-compose.yml
    test-docker-compose.yml
    README.md
```

## Client setup

Working in the project root directory first bootstrap a React app using create-react-app (you can eject later if needed).

```
create-react-app client
```

Lets add axios to our client so we can easily make sure it can communicate with the server.

```
cd client && yarn add axios
```

Now we can add an axios request in `/client/src/App.js` to check the link with the server.

```javascript
// client/src/App.js
import React, { Component } from "react";
import axios from "axios";

class App extends Component {
  state = {
    welcome: "..."
  };

  componentDidMount = async () => {
    try {
      const res = await axios.get("/welcome");
      console.log(res);
      this.setState({ welcome: res.data });
    } catch (error) {
      console.log(error);
    }
  };
  render() {
    return (
      <div className="App">
        <h1>"Hello server!" says the client</h1>
        <h1>"{this.state.welcome}" says the server</h1>
      </div>
    );
  }
}

export default App;
```

Now lets get our client up ready for docker. We need to create two files `/client/Dockerfile-dev` and `/client/.dockerignore`.

Lets first create the Dockerfile:

```Dockerfile
# client/Dockerfile-dev

# This is the build file for the client module, Docker will use this to setup the client container image.

# Installs the node image
FROM node

# Creates the client directory in the container
RUN mkdir -p /app/client
# Sets the working directory to the client directory
WORKDIR /app/client

# Copies the yarn.lock file to the container
COPY yarn.lock /app/client/
# Copies the package.json to the container
COPY package*.json /app/client/

# Installs the client dependencies
RUN yarn install

# Copies the files from the client directory to the container
COPY . /app/client/

# Runs the client
CMD ["yarn", "start"]
```

And create a .dockerignore file:

```bash
# Tells Docker to ignore these files and directories when building the image.

.git
node_modules
npm-debug
build
```

Thats our client ready to go! But we will need to proxy requests to the server here in development. Luckily create-react-app includes a proxy server! So you can simply add this to your `client/package.json`:

```
"proxy": "http://server:4000",
```

## Server setup

Now let start on our server. Still working from the project root directory lets install express and mongoose to connect to our client and database.

```
mkdir server && cd server && npm install express mongoose
```

Next we need to setup a basic server to connect our client and database. In our current directory `/server` lets create a server.js file.

In server.js we can add the following code to handle requests from the client and serve data from the database.

```javascript
// server/src/server.js
const express = require("express");
const mongoose = require("mongoose");

// Assign environment variables
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/test";

/**
 * Setup services
 */

// Initiliase an express server
const app = express();

// Options to pass to mongodb to avoid deprecation warnings
const options = {
  useNewUrlParser: true
};

// Function to connect to the database
const conn = () => {
  mongoose.connect(
    mongoUri,
    options
  );
};
// Call it to connect
conn();

// Handle the database connection and retry as needed
const db = mongoose.connection;
db.on("error", err => {
  console.log("There was a problem connecting to mongo: ", err);
  console.log("Trying again");
  setTimeout(() => conn(), 5000);
});
db.once("open", () => console.log("Successfully connected to mongo"));

// Setup routes to respond to client
app.get("/welcome", async (req, res) => {
  console.log("Client request received");
  const user = await User.find().exec();
  console.log(user[0].name);
  res.send(
    `Hello Client! There is one record in the database for ${user[0].name}`
  );
});

// Setup a record in the database to retrieve
const { Schema } = mongoose;
const userSchema = new Schema(
  {
    name: String
  },
  {
    timestamps: true
  }
);
const User = mongoose.model("User", userSchema);
const user = new User({ name: "Big Bill Brown" });
user
  .save()
  .then(user => console.log(`${user.name} saved to the database`))
  .catch(err => console.log(err));

app.listen(port, () => console.log(`Listening on port ${port}`));
```

And finally we can get the server setup for Docker. Again we need to create two files `/server/Dockerfile-dev` and `/server/.dockerignore`.

Lets first create the Dockerfile:

```Dockerfile
# server/Dockerfile-dev

# Install node image in container
FROM node

# Install nodemon for hot reloading
RUN npm install -g nodemon

# Create and set the working directory
RUN mkdir -p /app/server
WORKDIR /app/server

# Copy the dependency files over
COPY package*.json /app/server/
COPY yarn* /app/server/

# Install dependencies
RUN yarn install

# Copy the server files over
COPY . /app/server/

# Command to run them
CMD ["nodemon", "server.js"]
```

and then the .dockerignore:

```bash
.git
node_modules
npm-debug
```

Great, all ready to roll. On to the database.

## Database

For this project we will use MongoDB from the standard image so no setup is required. Be aware that this standard configuration is insecure and not suitable for deployment to production. Please read the production section to see details on how to modify for production use.

This development database will not persist data when the container is closed because we have not mounted a physical drive. We will address this in production.

## Docker Compose

We can use docker-compose to run our containers and manage them.
Create `dev-docker-compose.yml` in the project root:

```yaml
version: "3"

services:
  ##########################
  ### SETUP SERVER CONTAINER
  ##########################
  server:
    # Tell docker what file to build the server from
    build:
      context: ./server
      dockerfile: Dockerfile-dev
    # The ports to expose
    expose:
      - 4000
    # Environment variables
    environment:
      - MONGO_URI=mongodb://db:27017/db
      - PORT=4000
      - JWT_SECRET=secretsecret
      - JWT_EXPIRY=30d
      - DEBUG=worker:*
      - MORGAN=combined
      - NODE_ENV=development
    # Port mapping
    ports:
      - 4000:4000
    # Volumes to mount
    volumes:
      - ./server/src:/app/server/src
    # Run command
    # Nodemon for hot reloading (-L flag required for polling in Docker)
    command: nodemon -L src/server.js
    # Connect to other containers
    links:
      - db
    # Restart action
    restart: always
  ##########################
  ### SETUP CLIENT CONTAINER
  ##########################
  client:
    build:
      context: ./client
      dockerfile: Dockerfile-dev
    environment:
      - REACT_APP_PORT=3000
      - CHOKIDAR_USEPOLLING=true
    expose:
      - 3000
    ports:
      - 3000:3000
    volumes:
      - ./client/src:/app/client/src
      - ./client/public:/app/client/public
    links:
      - server
    command: npm run start
    restart: always
  ##########################
  ### SETUP DB CONTAINER
  ##########################
  db:
    image: mongo
    ports:
      - 27017:27017
    restart: always
```

Our development environment is ready! From the project root run:

```
docker-compose -f dev-docker-compose.yml up --build
```

This command will build the containers as specified and run them. You can now navigate to localhost:3000 to access the site! Test that hot reloading is working.

## PRODUCTION

There are a few changes required to make this setup production ready. There is no particularly great order to do them in so we will just start and work our way through. The things are:

- Use .env file to set environment variables
- Setup authentication for MongoDB
- Configure Mongoose to authenticate with MongoDB
- Improve container size and build speed
- Setup nginx proxy
- Setup production build process for React
- Setup production container for our server and client

## Environment

Your secrets (passwords etc) should NEVER be in your files that are commited to a repo or otherwise available. A safer place for them is in a .env file. Docker will parse this file in during image builds. There are safer options available but this approach is adequate so we will keep it simple.
First we need to create `.env` in our project root:

```env
# .env
MONGO_URI=db:27017/db?authSource=admin
PORT=4000
MONGO_PORT=27017
MONGO_INITDB_ROOT_USERNAME=your-username-here
MONGO_INITDB_ROOT_PASSWORD=your-secure-password-here
NODE_ENV=production
```

Next I like to have a local production test environment to make sure that the production build is working. You can call this file whatever you like but I prefer `test-docker-compose.yml`:

```yaml
version: "3"

services:
  ##########################
  ### SETUP SERVER CONTAINER
  ##########################
  server:
    build: ./server
    environment:
      - MONGO_URI=mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@${MONGO_URI}
      - PORT=${PORT}
      - NODE_ENV=${NODE_ENV}
    ports:
      - ${PORT}:${PORT}
    command: node src/server.js
    links:
      - db
    restart: always
  ##########################
  ### SETUP CLIENT CONTAINER
  ##########################
  client:
    build: ./client
    ports:
      - 80:80
    links:
      - server
    restart: always
  ##########################
  ### SETUP DB CONTAINER
  ##########################
  db:
    image: mongo
    ports:
      - ${MONGO_PORT}:${MONGO_PORT}
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_INITDB_ROOT_PASSWORD}
    volumes:
      # Map physical volume to virtual for data persistence
      # On server could be /data/db
      # For this case we will create a Docker volume and use it instead
      # You need to run docker volume create yourproject-dbdata
      - board-dbdata:/data/db
# Add this to include data volume for mongo
# Confirm this is working later
volumes:
  ? board-dbdata
```

## Database

> !! Pay close attention the construction of the MONGO_URI variable. Don't miss a ":" or "@"

As well as keeping our secrets safe .env allows easy configuration for different environments by simply providing a different .env file.

That also just happens to include the setup for securing Mongo. The `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD` variables will create an admin user when the container is setup. If you have trouble creating this user you may need to remove the containers. Docker will only add the user on build if there is no existing data.

There are script methods to add additional users that you can research if needed.

Now that we have configured Mongo to require authentication Mongoose will need to be configured to provide it. Conveniently since we are already using an Environment variable to set the URI we were able to configure this in docker-compose.yml with this line:

```
MONGO_URI=mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@${MONGO_URI}
```

and the section on the end of the env var tells mongo which database to look for the user in:

```
MONGO_URI=db:27017/db?authSource=admin
```

## NGINX Proxy

During development create-react-app has been running a server for us. Returning the static files and sending any requests for the server to localhost:4000. This tool is for development only so we will have to set up our own NGINX server to handle this.

We can do this by making a few modifications to our client container. First lets create our nginx configuration at `client/nginx.conf`. The [base file can be found in this gist](https://gist.github.com/joshdcuneo/f8af9299fb5222403f8ff6e41a9f35bf). Then replace the server block with the code below:

```conf
    server {
        listen      80 default_server;

        root /usr/share/nginx/html;

        index index.html index.htm;

        location / {
            try_files $uri /index.html;
        }

        location /welcome {
            proxy_pass http://server:4000;
        }
    }
```

The nginx server will serve our built React files for requests to the root, any requests to /welcome (you can change this to whatever you would like to make your server requests on) will be proxied to the node server container.

For more info on nginx configuration [read the docs!](https://docs.nginx.com/nginx/admin-guide/web-server/web-server/)

## Client

The next change is to set up the React build process to produce our static files. This all happens in `client/Dockerfile`:

```Dockerfile
# Build in this container
FROM node:10.9.0-alpine as builder

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package* /usr/src/app
COPY yarn* /usr/src/app

# Set production flag so dev dependencies aren't installed
RUN yarn install --production=true

COPY . /usr/src/app

# Build the production build
RUN yarn build

# Start and nginx container
FROM nginx

# Set our custom nginx.conf in the container
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/nginx.conf

# Copy the react build from the build container
COPY --from=builder /usr/src/app/build /usr/share/nginx/html

# Set permissions so nginx can serve it
RUN chown nginx.nginx /usr/share/nginx/html/ -R

EXPOSE 80
```

## Server

Now we need a production Dockerfile for our server. Lets create `server/Dockerfile`:

```Dockerfile
FROM node:10.9.0-alpine as builder

RUN mkdir -p /app/server
WORKDIR /app/server

COPY package*.json /app/server/
COPY yarn* /app/server/

#! Install the build requirements for bcrypt
RUN apk update && apk upgrade \
  && apk --no-cache add --virtual builds-deps build-base python \
  && yarn add node-gyp node-pre-gyp

# Install dependencies
RUN yarn install --production=true

# Copy the server files over
COPY . /app/server/

FROM node:10.9.0-alpine

# Create and set the working directory
RUN mkdir -p /app/server
WORKDIR /app/server

# Copy the server from the build container
COPY --from=builder /app/server /app/server

CMD ["node", "server.js"]
```

## Docker in Production

Now we have a local test environment for our production build. This is a great environment to run tests in but we won't cover that here. You can just spin up your containers and test manually with:

```
docker-compose -f test-docker-compose.yml up --build
```

Test that everything is working and then we are ready to deploy!

## Deploying with Docker-Machine + Docker-Compose

We will use docker-machine to deploy our app. To provision a server for use you could [follow these instructions to provision a DigitalOcean server (droplet)](https://www.digitalocean.com/community/tutorials/how-to-provision-and-manage-remote-docker-hosts-with-docker-machine-on-ubuntu-16-04).

We will also need a docker hub account to host our images, [you can create one here].(https://hub.docker.com) Then run `docker login` to connect.

Once that is all setup and ready there are just a couple more things to do.

We need to build our images and push them to docker hub so that the host server can access them. From the project root run:

```
cd server && docker build \
    -t <your-docker-username>/<your-project-name>_server:latest && \
    docker push <your-docker-username>/<your-project-name>_server:latest
```

and then:

```
cd ../client && docker build \
    -t <your-docker-username>/<your-project-name>_client:latest && \
    docker push <your-docker-username>/<your-project-name>_client:latest
```

Now that the images are ready we need to prepare our last `docker-compose.yml`:

```yaml
version: "3"

services:
  ##########################
  ### SETUP SERVER CONTAINER
  ##########################
  server:
    # Tells docker-compose which image to pull from docker hub
    image: <your-docker-username>/<your-project-name>_server:latest
    environment:
      - MONGO_URI=mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@${MONGO_URI}
      - PORT=${PORT}
      - NODE_ENV=${NODE_ENV}
    ports:
      - ${PORT}:${PORT}
    command: node src/server.js
    links:
      - db
    restart: always
  ##########################
  ### SETUP CLIENT CONTAINER
  ##########################
  client:
    image: <your-docker-username>/<your-project-name>_client:latest
    ports:
      - 80:80
    links:
      - server
    restart: always
  ##########################
  ### SETUP DB CONTAINER
  ##########################
  db:
    image: mongo
    ports:
      - ${MONGO_PORT}:${MONGO_PORT}
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_INITDB_ROOT_PASSWORD}
    volumes:
      # Map physical volume to virtual for data persistence
      # On server could be /data/db
      # For this case we will create a Docker volume and use it instead
      # You need to run docker volume create yourproject-dbdata
      - board-dbdata:/data/db
# Add this to include data volume for mongo
# Confirm this is working later
volumes:
  ? board-dbdata
```

Now we are ready to deploy!

## Deploying!!

If you can't remember the name of the machine you created then `docker-machine ls`!

Connect to our remote docker machine:

```
eval $(docker-machine env <your-docker-machine-name>)
```

And just:

```
docker-compose up
```

Run `docker-machine ip <your-docker-machine-name>` to get the ip of your remote machine and hit it in the browser to see your site live!

## Other resources

- [A complicated yet optimised create-react-app setup with Docker (untested)](https://www.peterbe.com/plog/how-to-create-react-app-with-docker)
- [Production build method with create-react-app and nginx (used in production section)](https://medium.com/@shakyShane/lets-talk-about-docker-artifacts-27454560384f)
- [Detailed full stack production article (untested but looks good)](https://blog.bam.tech/developper-news/dockerize-your-app-and-keep-hot-reloading)
- [Very helpful is slightly hard to react article on a node-react-docker setup](https://medium.com/@xiaolishen/develop-in-docker-a-node-backend-and-a-react-front-end-talking-to-each-other-5c522156f634)

## General library plugs

- [Gatsby: Blazing fast site generator for React](https://github.com/gatsbyjs/gatsby)

- [Razzle: Create server-rendered universal JavaScript applications with no configuration](https://github.com/jaredpalmer/razzle)
- [Formik: Build forms in React, without the tears](https://github.com/jaredpalmer/formik)
- [React-select: The Select for React.js](https://github.com/jaredpalmer/formik)
- [Yup: Dead simple Object schema validation](https://github.com/jquense/yup)
- [Emotion: style as a function of state](https://github.com/emotion-js/emotion)
- [Typography: A powerful toolkit for building websites with beautiful design](https://github.com/KyleAMathews/typography.js)

# TODO

- Review mongo data security
