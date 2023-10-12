import React from "react";
import { Todo } from "./TodoList";

interface Props {
  todo: Todo;
  onComplete: () => void;
  onDelete: () => void;
}

const TodoItem = ({ todo, onComplete, onDelete }: Props) => {
  return (
    <li>
      <span className={todo.completed ? "completed" : ""}>{todo.text}</span>
      <div>
        <button onClick={onComplete}>{todo.completed ? "Uncomplete" : "Complete"}</button>
        <button onClick={onDelete}>Delete</button>
      </div>
    </li>
  );
};

export default TodoItem;
