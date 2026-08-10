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
    console.log('[Seed] Cleared existing tasks from database.');

    const createdTasks = await Task.insertMany(initialTasks);
    console.log(`[Seed] Successfully inserted ${createdTasks.length} initial tasks into MongoDB!`);

    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error] Seeding failed:`, error);
    process.exit(1);
  }
};

seedDB();
