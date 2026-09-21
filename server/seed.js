import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from './models/Task.js';
import connectDB from './config/db.js';

dotenv.config();

const initialTasks = [
  {
    title: "Design database schema and REST API specifications",
    description: "Define Mongoose Task model with title, description, status, priority, and dueDate",
    status: "completed",
    priority: "high",
    dueDate: new Date(Date.now() + 86400000 * 2)
  },
  {
    title: "Setup Node.js and Express server with dotenv configuration",
    description: "Configure Express app with CORS, JSON parsing, logging, and error handling",
    status: "completed",
    priority: "high",
    dueDate: new Date(Date.now() + 86400000 * 3)
  },
  {
    title: "Implement full CRUD endpoints with Mongoose model operations",
    description: "Replace in-memory logic with find, findById, create, findByIdAndUpdate, and findByIdAndDelete",
    status: "in-progress",
    priority: "high",
    dueDate: new Date(Date.now() + 86400000 * 5)
  },
  {
    title: "Integrate backend API with portfolio React frontend",
    description: "Connect React frontend components with live MongoDB database endpoints",
    status: "pending",
    priority: "medium",
    dueDate: new Date(Date.now() + 86400000 * 7)
  }
];

const seedDB = async () => {
  try {
    await connectDB();
    await Task.deleteMany({});
    const { default: User } = await import('./models/User.js');
    await User.deleteMany({});
    console.log('[Seed] Cleared existing tasks and users from database.');

    const defaultUser = await User.create({
      name: 'Demo User',
      email: 'demo@example.com',
      password: 'password123',
    });
    console.log('[Seed] Created default demo user.');

    const tasksWithUser = initialTasks.map(task => ({ ...task, user: defaultUser._id }));

    const createdTasks = await Task.insertMany(tasksWithUser);
    console.log(`[Seed] Successfully inserted ${createdTasks.length} initial tasks into MongoDB!`);

    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error] Seeding failed:`, error);
    process.exit(1);
  }
};

seedDB();
