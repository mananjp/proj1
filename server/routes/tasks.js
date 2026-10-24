import express from 'express';
import mongoose from 'mongoose';
import Task from '../models/Task.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTaskSchema, updateTaskSchema, getTaskSchema, deleteTaskSchema } from '../validators/task.js';
import { sendTaskCompletedEmail } from '../services/mailService.js';

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// GET /api/tasks - Get tasks (Admin sees all or filtered; User sees assigned tasks)
router.get('/', async (req, res) => {
  try {
    const { status, priority, search, assignedTo } = req.query;
    const filter = {};

    // Role-based filtering
    if (req.user.role === 'admin') {
      if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
        filter.$or = [{ assignedTo }, { user: assignedTo }];
      }
    } else {
      // Regular users only see tasks assigned to them (or where user matches)
      filter.$or = [{ assignedTo: req.user._id }, { user: req.user._id }];
    }

    if (status && status !== 'all') {
      filter.status = status.toLowerCase();
    }

    if (priority && priority !== 'all') {
      filter.priority = priority.toLowerCase();
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchCondition = [
        { title: searchRegex },
        { description: searchRegex }
      ];
      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          { $or: searchCondition }
        ];
        delete filter.$or;
      } else {
        filter.$or = searchCondition;
      }
    }

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email role')
      .populate('user', 'name email role')
      .sort({ createdAt: -1 });

    console.log(`[CRUD LOG] GET /api/tasks - User: ${req.user.email} (${req.user.role}) | Found ${tasks.length} tasks`);

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

// GET /api/tasks/:id - Get single task
router.get('/:id', validate(getTaskSchema), async (req, res) => {
  try {
    const { id } = req.params;

    let query = { _id: id };
    if (req.user.role !== 'admin') {
      query.$or = [{ assignedTo: req.user._id }, { user: req.user._id }];
    }

    const task = await Task.findOne(query)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email role')
      .populate('user', 'name email role');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found or not authorized' });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    console.error(`[CRUD ERROR] GET /api/tasks/:id:`, error);
    res.status(500).json({ success: false, message: 'Server error retrieving task', error: error.message });
  }
});

// POST /api/tasks - Create a new task
router.post('/', validate(createTaskSchema), async (req, res) => {
  try {
    const { title, body, description, status, priority, dueDate, assignedTo } = req.body;
    const taskTitle = title || body;

    // Determine assignee
    let targetAssignee = req.user._id;
    if (req.user.role === 'admin' && assignedTo) {
      targetAssignee = assignedTo;
    }

    const taskPayload = {
      title: taskTitle.trim(),
      user: targetAssignee,
      assignedTo: targetAssignee,
      createdBy: req.user._id,
      ...(description !== undefined && { description: description.trim() }),
      ...(status && { status: status.toLowerCase() }),
      ...(priority && { priority: priority.toLowerCase() }),
      ...(dueDate && { dueDate: new Date(dueDate) })
    };

    let newTask = await Task.create(taskPayload);
    newTask = await newTask.populate('assignedTo', 'name email role');
    newTask = await newTask.populate('createdBy', 'name email role');

    console.log(`[CRUD LOG] POST /api/tasks - Created Task "${newTask.title}" assigned to ${targetAssignee}`);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: newTask
    });
  } catch (error) {
    console.error(`[CRUD ERROR] POST /api/tasks:`, error);
    res.status(500).json({ success: false, message: 'Server error creating task', error: error.message });
  }
});

// PUT /api/tasks/:id - Update task & trigger Nodemailer on completion
router.put('/:id', validate(updateTaskSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, description, status, priority, dueDate, assignedTo } = req.body;
    const taskTitle = title !== undefined ? title : body;

    const existingTask = await Task.findById(id);
    if (!existingTask) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Permission check
    const isOwnerOrAssignee =
      existingTask.user?.toString() === req.user._id.toString() ||
      existingTask.assignedTo?.toString() === req.user._id.toString() ||
      existingTask.createdBy?.toString() === req.user._id.toString();

    if (req.user.role !== 'admin' && !isOwnerOrAssignee) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this task' });
    }

    const updates = {};
    if (taskTitle !== undefined) updates.title = taskTitle.trim();
    if (description !== undefined) updates.description = description.trim();
    if (status !== undefined) updates.status = status.toLowerCase();
    if (priority !== undefined) updates.priority = priority.toLowerCase();
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;

    // Enforce completed task immutability: once completed, status cannot be reverted
    if (existingTask.status === 'completed' && updates.status && updates.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Completed tasks are locked and cannot have their status reverted.'
      });
    }

    // Admin can reassign tasks
    if (req.user.role === 'admin' && assignedTo) {
      updates.assignedTo = assignedTo;
      updates.user = assignedTo;
    }

    const isTransitioningToCompleted =
      updates.status === 'completed' && existingTask.status !== 'completed';

    const updatedTask = await Task.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email role')
      .populate('user', 'name email role');

    console.log(`[CRUD LOG] PUT /api/tasks/${id} - UPDATED "${updatedTask.title}" (Status: ${updatedTask.status})`);

    // If task was marked as completed, trigger email notification to the admin
    if (isTransitioningToCompleted) {
      sendTaskCompletedEmail({
        task: updatedTask,
        completedBy: req.user
      }).catch(err => {
        console.error('[MailService Background Error]:', err);
      });
    }

    res.json({
      success: true,
      message: isTransitioningToCompleted
        ? 'Task completed and admin notified via email'
        : 'Task updated successfully',
      data: updatedTask,
      emailNotified: isTransitioningToCompleted
    });
  } catch (error) {
    console.error(`[CRUD ERROR] PUT /api/tasks/:id:`, error);
    res.status(500).json({ success: false, message: 'Server error updating task', error: error.message });
  }
});

// DELETE /api/tasks/:id - Delete a task
router.delete('/:id', validate(deleteTaskSchema), async (req, res) => {
  try {
    const { id } = req.params;

    const existingTask = await Task.findById(id);
    if (!existingTask) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Permission check
    const isOwnerOrAssignee =
      existingTask.user?.toString() === req.user._id.toString() ||
      existingTask.assignedTo?.toString() === req.user._id.toString() ||
      existingTask.createdBy?.toString() === req.user._id.toString();

    if (req.user.role !== 'admin' && !isOwnerOrAssignee) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this task' });
    }

    await Task.findByIdAndDelete(id);

    console.log(`[CRUD LOG] DELETE /api/tasks/${id} - DELETED "${existingTask.title}"`);

    res.json({
      success: true,
      message: `Task "${existingTask.title}" deleted successfully`,
      data: existingTask
    });
  } catch (error) {
    console.error(`[CRUD ERROR] DELETE /api/tasks/:id:`, error);
    res.status(500).json({ success: false, message: 'Server error deleting task', error: error.message });
  }
});

export default router;
