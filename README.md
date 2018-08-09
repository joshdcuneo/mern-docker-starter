# DEMO REPO | MERN + DOCKER

## Overview

This repo provides an opinionated demo and instructions to setup a development and production environment within docker utilising the MERN stack. It includes:

- Hot reloading on both client and server
- Optional (recommended) auth settings on MongoDB

This is by no means the only correct way, just a simple and easy to work with methodology that provides modular services.

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
            package.json
            yarn.lock
    |
    |---/ server
            |
            |---/src
            |
            .dockerignoe
            .Dockerfile
            package-lock.json
            package.json
    |
    |
    .gitignore
    docker-compose.yml
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

Now we can make a few changes to `/client/src/App.js` to use axios to make a request to the server.

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

Now lets get our client up ready for docker. We need to create two files `/client/Dockerfile` and `/client/.dockerignore`.

Lets first create the Dockerfile:

```bash
# client/Dockerfile

# This is the build file for the client module, Docker will use this to setup the client container image.

# Using the node image built with the alpine version of linux is much smaller
# But has no bash terminal # installed which makes it harder to troubleshoot.
# Go with a full node image for now and change later when you are more confident.

# FROM node:alpine

# Installs the node image
FROM node

# Creates the client directory in the container
RUN mkdir -p /app/client
# Sets the working directory to the client directory
WORKDIR /app/client

# Copies the yarn.lock file to the container
COPY yarn.lock /app/client/
# Copies the package.json and package-lock.json files to the container
COPY package*.json /app/client/

# Installs the client dependencies from npm
RUN npm install

# Copies the files from the client directory to the container
COPY . /app/client/

# Runs the client
CMD ["npm", "start"]
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

Next need to setup a basic server to connect our client and database. In our current directory `/server` lets create a directory for our server source code and a server.js file.

```
mkdir server && cd server && touch server.js
```

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

And finally we can get the server setup for Docker. Again we need to create two files `/server/Dockerfile` and `/server/.dockerignore`.

Lets first create the Dockerfile:

```bash
# Consider switching later to
# FROM node:alpine

# Install node image in container
FROM node

# Install nodemon for hot reloading
RUN npm install -g nodemon

# Create and set the working directory
RUN mkdir -p /app/server
WORKDIR /app/server

# Copy the package files over
COPY package*.json /app/server/

# Install dependencies
RUN npm install

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

## Docker Compose

Its easy from here. Though I should flesh out the details more. Create `docker-compose.yml` in the project root:

```yaml
version: "3"

services:
  ##########################
  ### SETUP SERVER CONTAINER
  ##########################
  server:
    #The image to build
    build: ./server
    # The ports to expose
    expose:
      - 4000
    # Environment variables
    environment:
      - MONGO_URI=mongodb://db:27017/db
      - PORT=4000
    # Port mapping (internal:external)
    ports:
      - 4000:4000
    # Volumes to mount (physical:virtual)
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
    build: ./client
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

## PRODUCTION

## Other resources

- [A complicated yet optimised create-react-app setup with Docker (untested)](https://www.peterbe.com/plog/how-to-create-react-app-with-docker)
- [Production build method with create-react-app and nginx (used in production section)](https://medium.com/@shakyShane/lets-talk-about-docker-artifacts-27454560384f)
- [Detailed full stack production article (untested but looks good)](https://blog.bam.tech/developper-news/dockerize-your-app-and-keep-hot-reloading)
- [Very helpful is slightly hard to react article on a node-react-docker setup](https://medium.com/@xiaolishen/develop-in-docker-a-node-backend-and-a-react-front-end-talking-to-each-other-5c522156f634)
