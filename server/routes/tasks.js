import express from 'express';
import {
  getTasks,
  getTaskById,
  addTask,
  updateTask,
  deleteTask
} from '../data/tasks.js';

const router = express.Router();

// GET /api/tasks - Get all tasks (optional status filter)
router.get('/', (req, res) => {
  const { status } = req.query;
  let allTasks = getTasks();

  if (status) {
    allTasks = allTasks.filter(
      (task) => task.status.toLowerCase() === status.toLowerCase()
    );
  }

  console.log(`[CRUD LOG] GET /api/tasks - Status Filter: ${status || 'None'} | Retrieved ${allTasks.length} tasks`);

  res.json({
    success: true,
    count: allTasks.length,
    data: allTasks
  });
});

// GET /api/tasks/:id - Get a single task by ID
router.get('/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  if (isNaN(taskId)) {
    console.log(`[CRUD LOG] GET /api/tasks/${req.params.id} - FAILED (Invalid ID format)`);
    return res.status(400).json({ success: false, message: 'Invalid task ID' });
  }

  const task = getTaskById(taskId);
  if (!task) {
    console.log(`[CRUD LOG] GET /api/tasks/${taskId} - FAILED (Task not found)`);
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  console.log(`[CRUD LOG] GET /api/tasks/${taskId} - SUCCESS:`, task);
  res.json({ success: true, data: task });
});

// POST /api/tasks - Create a new task
router.post('/', (req, res) => {
  const { body, status } = req.body;

  if (!body || typeof body !== 'string' || !body.trim()) {
    console.log(`[CRUD LOG] POST /api/tasks - FAILED (Body missing or empty)`);
    return res.status(400).json({
      success: false,
      message: 'Task body is required and must be a non-empty string'
    });
  }

  const validStatuses = ['pending', 'in-progress', 'completed'];
  if (status && !validStatuses.includes(status.toLowerCase())) {
    console.log(`[CRUD LOG] POST /api/tasks - FAILED (Invalid status: ${status})`);
    return res.status(400).json({
      success: false,
      message: `Invalid status. Valid options are: ${validStatuses.join(', ')}`
    });
  }

  const newTask = addTask({
    body: body.trim(),
    status: status ? status.toLowerCase() : 'pending'
  });

  console.log(`[CRUD LOG] POST /api/tasks - CREATED Task ID #${newTask.id}:`, newTask);

  res.status(201).json({
    success: true,
    message: 'Task created successfully',
    data: newTask
  });
});

// PUT /api/tasks/:id - Update a task by ID
router.put('/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  if (isNaN(taskId)) {
    console.log(`[CRUD LOG] PUT /api/tasks/${req.params.id} - FAILED (Invalid ID format)`);
    return res.status(400).json({ success: false, message: 'Invalid task ID' });
  }

  const { body, status } = req.body;

  if (body !== undefined && (typeof body !== 'string' || !body.trim())) {
    console.log(`[CRUD LOG] PUT /api/tasks/${taskId} - FAILED (Task body empty)`);
    return res.status(400).json({
      success: false,
      message: 'Task body cannot be empty'
    });
  }

  const validStatuses = ['pending', 'in-progress', 'completed'];
  if (status && !validStatuses.includes(status.toLowerCase())) {
    console.log(`[CRUD LOG] PUT /api/tasks/${taskId} - FAILED (Invalid status: ${status})`);
    return res.status(400).json({
      success: false,
      message: `Invalid status. Valid options are: ${validStatuses.join(', ')}`
    });
  }

  const updated = updateTask(taskId, {
    ...(body !== undefined && { body: body.trim() }),
    ...(status !== undefined && { status: status.toLowerCase() })
  });

  if (!updated) {
    console.log(`[CRUD LOG] PUT /api/tasks/${taskId} - FAILED (Task not found)`);
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  console.log(`[CRUD LOG] PUT /api/tasks/${taskId} - UPDATED Task ID #${taskId}:`, updated);

  res.json({
    success: true,
    message: 'Task updated successfully',
    data: updated
  });
});

// DELETE /api/tasks/:id - Delete a task by ID
router.delete('/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  if (isNaN(taskId)) {
    console.log(`[CRUD LOG] DELETE /api/tasks/${req.params.id} - FAILED (Invalid ID format)`);
    return res.status(400).json({ success: false, message: 'Invalid task ID' });
  }

  const deleted = deleteTask(taskId);
  if (!deleted) {
    console.log(`[CRUD LOG] DELETE /api/tasks/${taskId} - FAILED (Task not found)`);
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  console.log(`[CRUD LOG] DELETE /api/tasks/${taskId} - DELETED Task ID #${taskId}`);

  res.json({
    success: true,
    message: `Task with id ${taskId} deleted successfully`
  });
});

export default router;
