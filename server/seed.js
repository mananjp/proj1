import dotenv from 'dotenv';
import Task from './models/Task.js';
import User from './models/User.js';
import connectDB from './config/db.js';

dotenv.config();

const seedDB = async () => {
  try {
    await connectDB();
    
    // Clear existing tasks and users
    await Task.deleteMany({});
    await User.deleteMany({});
    console.log('[Seed] Cleared existing tasks and users from database.');

    // 1. Create Admin User
    const adminUser = await User.create({
      name: 'Manan Panchal (Admin)',
      email: '24aiml024@charusat.edu.in',
      password: 'Admin@12345',
      role: 'admin',
    });
    console.log(`[Seed] Created Admin: ${adminUser.email} (Password: Admin@12345, Role: admin)`);

    // 2. Create Demo User
    const demoUser = await User.create({
      name: 'Demo User',
      email: 'demo@example.com',
      password: 'password123',
      role: 'user',
    });
    console.log(`[Seed] Created Demo User: ${demoUser.email} (Password: password123, Role: user)`);

    // 3. Create Initial Tasks assigned to Demo User by Admin
    const initialTasks = [
      {
        title: "Design database schema & REST API specifications",
        description: "Define Mongoose models for Tasks and Users with role-based permissions and relations.",
        status: "completed",
        priority: "high",
        user: demoUser._id,
        assignedTo: demoUser._id,
        createdBy: adminUser._id,
        dueDate: new Date(Date.now() - 86400000 * 1)
      },
      {
        title: "Setup Node.js & Express server with Nodemailer",
        description: "Configure Express app with CORS, JSON parsing, logging, and Nodemailer integration for admin alerts.",
        status: "completed",
        priority: "high",
        user: demoUser._id,
        assignedTo: demoUser._id,
        createdBy: adminUser._id,
        dueDate: new Date(Date.now() + 86400000 * 1)
      },
      {
        title: "Build interactive Drag-and-Drop Kanban Board",
        description: "Create Kanban columns for Pending, In Progress, and Completed with smooth HTML5 drag-and-drop.",
        status: "in-progress",
        priority: "high",
        user: demoUser._id,
        assignedTo: demoUser._id,
        createdBy: adminUser._id,
        dueDate: new Date(Date.now() + 86400000 * 3)
      },
      {
        title: "Implement Priority filtering & visual badges",
        description: "Add quick filters for High, Medium, and Low priorities with vibrant color tags.",
        status: "in-progress",
        priority: "medium",
        user: demoUser._id,
        assignedTo: demoUser._id,
        createdBy: adminUser._id,
        dueDate: new Date(Date.now() + 86400000 * 4)
      },
      {
        title: "Admin task assignment workflow",
        description: "Allow the admin to create tasks and assign them to specific team members.",
        status: "pending",
        priority: "high",
        user: demoUser._id,
        assignedTo: demoUser._id,
        createdBy: adminUser._id,
        dueDate: new Date(Date.now() + 86400000 * 6)
      },
      {
        title: "Write end-to-end documentation & verification",
        description: "Document API endpoints and test email delivery to admin on task completion.",
        status: "pending",
        priority: "low",
        user: demoUser._id,
        assignedTo: demoUser._id,
        createdBy: adminUser._id,
        dueDate: new Date(Date.now() + 86400000 * 8)
      }
    ];

    const createdTasks = await Task.insertMany(initialTasks);
    console.log(`[Seed] Successfully inserted ${createdTasks.length} initial tasks assigned to ${demoUser.email}!`);

    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error] Seeding failed:`, error);
    process.exit(1);
  }
};

seedDB();
