import React from "react";
import ReactDOM from "react-dom";
import "../css/app.css"; // Import the main stylesheet
import TodoList from "./TodoList";

const App = () => {
  return (
    <div className="app-container">
      <h1>TODO List</h1>
      <TodoList />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
