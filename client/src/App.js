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
