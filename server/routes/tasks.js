import express from 'express';
import mongoose from 'mongoose';
import Task from '../models/Task.js';

const router = express.Router();

// GET /api/tasks - Get all tasks (with optional status, priority, and search filtering)
router.get('/', async (req, res) => {
  try {
    const { status, priority, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status.toLowerCase();
    }

    if (priority) {
      filter.priority = priority.toLowerCase();
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(filter).sort({ createdAt: -1 });

    console.log(`[CRUD LOG] GET /api/tasks - Filter: ${JSON.stringify(filter)} | Found ${tasks.length} tasks`);

    res.json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    console.error(`[CRUD ERROR] GET /api/tasks:`, error);
    res.status(500).json({ success: false, message: 'Server error retrieving tasks', error: error.message });
  }
});

// GET /api/tasks/:id - Get single task by Mongoose ObjectId
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log(`[CRUD LOG] GET /api/tasks/${id} - FAILED (Invalid ObjectId)`);
      return res.status(400).json({ success: false, message: 'Invalid Task ID format. Must be a 24-character hex string.' });
    }

    const task = await Task.findById(id);

    if (!task) {
      console.log(`[CRUD LOG] GET /api/tasks/${id} - FAILED (Task not found)`);
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    console.log(`[CRUD LOG] GET /api/tasks/${id} - SUCCESS:`, task.title);
    res.json({ success: true, data: task });
  } catch (error) {
    console.error(`[CRUD ERROR] GET /api/tasks/:id:`, error);
    res.status(500).json({ success: false, message: 'Server error retrieving task', error: error.message });
  }
});

// POST /api/tasks - Create a new task using Task.create()
router.post('/', async (req, res) => {
  try {
    const { title, body, description, status, priority, dueDate } = req.body;

    // Backward compatibility: accept 'body' if 'title' is not passed
    const taskTitle = title || body;

    if (!taskTitle || typeof taskTitle !== 'string' || !taskTitle.trim()) {
      console.log(`[CRUD LOG] POST /api/tasks - FAILED (Title missing)`);
      return res.status(400).json({
        success: false,
        message: 'Task title (or body) is required and must be a non-empty string'
      });
    }

    const taskPayload = {
      title: taskTitle.trim(),
      ...(description !== undefined && { description: description.trim() }),
      ...(status && { status: status.toLowerCase() }),
      ...(priority && { priority: priority.toLowerCase() }),
      ...(dueDate && { dueDate: new Date(dueDate) })
    };

    const newTask = await Task.create(taskPayload);

    console.log(`[CRUD LOG] POST /api/tasks - CREATED Task ID #${newTask._id}: "${newTask.title}"`);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: newTask
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      console.log(`[CRUD LOG] POST /api/tasks - FAILED (Validation Error):`, messages);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }

    console.error(`[CRUD ERROR] POST /api/tasks:`, error);
    res.status(500).json({ success: false, message: 'Server error creating task', error: error.message });
  }
});

// PUT /api/tasks/:id - Update a task using Task.findByIdAndUpdate()
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log(`[CRUD LOG] PUT /api/tasks/${id} - FAILED (Invalid ObjectId)`);
      return res.status(400).json({ success: false, message: 'Invalid Task ID format' });
    }

    const { title, body, description, status, priority, dueDate } = req.body;
    const taskTitle = title !== undefined ? title : body;

    const updates = {};
    if (taskTitle !== undefined) {
      if (typeof taskTitle !== 'string' || !taskTitle.trim()) {
        return res.status(400).json({ success: false, message: 'Title cannot be an empty string' });
      }
      updates.title = taskTitle.trim();
    }

    if (description !== undefined) updates.description = description.trim();
    if (status !== undefined) updates.status = status.toLowerCase();
    if (priority !== undefined) updates.priority = priority.toLowerCase();
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;

    const updatedTask = await Task.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!updatedTask) {
      console.log(`[CRUD LOG] PUT /api/tasks/${id} - FAILED (Task not found)`);
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    console.log(`[CRUD LOG] PUT /api/tasks/${id} - UPDATED Task ID #${id}: "${updatedTask.title}"`);

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      console.log(`[CRUD LOG] PUT /api/tasks - FAILED (Validation Error):`, messages);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }

    console.error(`[CRUD ERROR] PUT /api/tasks/:id:`, error);
    res.status(500).json({ success: false, message: 'Server error updating task', error: error.message });
  }
});

// DELETE /api/tasks/:id - Delete a task using Task.findByIdAndDelete()
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log(`[CRUD LOG] DELETE /api/tasks/${id} - FAILED (Invalid ObjectId)`);
      return res.status(400).json({ success: false, message: 'Invalid Task ID format' });
    }

    const deletedTask = await Task.findByIdAndDelete(id);

    if (!deletedTask) {
      console.log(`[CRUD LOG] DELETE /api/tasks/${id} - FAILED (Task not found)`);
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    console.log(`[CRUD LOG] DELETE /api/tasks/${id} - DELETED Task ID #${id}`);

    res.json({
      success: true,
      message: `Task "${deletedTask.title}" deleted successfully`,
      data: deletedTask
    });
  } catch (error) {
    console.error(`[CRUD ERROR] DELETE /api/tasks/:id:`, error);
    res.status(500).json({ success: false, message: 'Server error deleting task', error: error.message });
  }
});

export default router;
