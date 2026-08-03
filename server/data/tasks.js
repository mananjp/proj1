// Initial dataset with 4 tasks
export const initialTasks = [
  {
    id: 1,
    body: "Design database schema and REST API specifications",
    status: "completed"
  },
  {
    id: 2,
    body: "Setup Node.js and Express server with dotenv configuration",
    status: "in-progress"
  },
  {
    id: 3,
    body: "Implement full CRUD endpoints for Task resource",
    status: "in-progress"
  },
  {
    id: 4,
    body: "Integrate backend API with portfolio React frontend",
    status: "pending"
  }
];

// In-memory store for tasks
let tasks = [...initialTasks];

export const getTasks = () => tasks;

export const getTaskById = (id) => tasks.find((task) => task.id === id);

export const addTask = ({ body, status }) => {
  const newTask = {
    id: tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1,
    body,
    status: status || "pending"
  };
  tasks.push(newTask);
  return newTask;
};

export const updateTask = (id, { body, status }) => {
  const taskIndex = tasks.findIndex((task) => task.id === id);
  if (taskIndex === -1) return null;

  tasks[taskIndex] = {
    ...tasks[taskIndex],
    ...(body !== undefined && { body }),
    ...(status !== undefined && { status })
  };

  return tasks[taskIndex];
};

export const deleteTask = (id) => {
  const taskIndex = tasks.findIndex((task) => task.id === id);
  if (taskIndex === -1) return false;

  tasks.splice(taskIndex, 1);
  return true;
};
