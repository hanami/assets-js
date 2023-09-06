import React, { useState } from 'react';
import TodoItem from './TodoItem';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const TodoList = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState<string>('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!text.trim()) return;
    const newTodo: Todo = { id: Date.now(), text, completed: false };
    setTodos([...todos, newTodo]);
    setText('');
  };

  const handleComplete = (id: number) => {
    setTodos((prevTodos) =>
      prevTodos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const handleDelete = (id: number) => {
    setTodos((prevTodos) => prevTodos.filter((todo) => todo.id !== id));
  };

  return (
    <div style={{ backgroundImage: `url(${backgroundImage})` }}>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Add a new todo"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
      <ul>
        {todos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onComplete={() => handleComplete(todo.id)}
            onDelete={() => handleDelete(todo.id)}
          />
        ))}
      </ul>
      <style>
        {`
          @font-face {
            font-family: 'Custom Font';
            src: url(${customFont}) format('truetype');
            font-weight: normal;
            font-style: normal;
          }
        `}
      </style>
    </div>
  );
};

export default TodoList;
