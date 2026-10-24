import express from 'express';
import mongoose from 'mongoose';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Apply protect and adminOnly to all report routes
router.use(protect);
router.use(adminOnly);

/**
 * Helper to resolve start and end date from query parameters
 */
const resolveDateRange = (query) => {
  const { startDate, endDate, days } = query;
  let start;
  let end = endDate ? new Date(endDate) : new Date();

  // Set end of day for end date
  end.setHours(23, 59, 59, 999);

  if (startDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
  } else if (days) {
    const numDays = parseInt(days, 10) || 5;
    start = new Date(Date.now() - (numDays - 1) * 86400000);
    start.setHours(0, 0, 0, 0);
  } else {
    // Default: 5 days
    start = new Date(Date.now() - 4 * 86400000);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
};

// GET /api/reports/employee - Employee-wise detailed report within timeline
router.get('/employee', async (req, res) => {
  try {
    const { start, end } = resolveDateRange(req.query);
    const { employeeId } = req.query;

    const usersQuery = employeeId && employeeId !== 'all' && mongoose.Types.ObjectId.isValid(employeeId)
      ? { _id: employeeId }
      : {};
    const employees = await User.find(usersQuery).select('name email role');

    // Fetch tasks created or updated within the date range
    const taskDateFilter = {
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { updatedAt: { $gte: start, $lte: end } }
      ]
    };

    const allTasks = await Task.find(taskDateFilter)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email role')
      .populate('user', 'name email role')
      .sort({ createdAt: -1 });

    const employeeReports = employees.map(emp => {
      const empIdStr = emp._id.toString();
      const empTasks = allTasks.filter(t => {
        const assignedId = 
          t.assignedTo?._id?.toString() || 
          t.assignedTo?.id?.toString() || 
          t.user?._id?.toString() || 
          t.user?.id?.toString() || 
          t.user?.toString();
        return assignedId === empIdStr;
      });

      const total = empTasks.length;
      const completed = empTasks.filter(t => t.status === 'completed').length;
      const inProgress = empTasks.filter(t => t.status === 'in-progress').length;
      const pending = empTasks.filter(t => t.status === 'pending').length;

      const highPriority = empTasks.filter(t => t.priority === 'high').length;
      const mediumPriority = empTasks.filter(t => t.priority === 'medium').length;
      const lowPriority = empTasks.filter(t => t.priority === 'low').length;

      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        employee: emp,
        summary: {
          total,
          completed,
          inProgress,
          pending,
          completionRate,
          highPriority,
          mediumPriority,
          lowPriority
        },
        tasks: empTasks
      };
    });

    res.json({
      success: true,
      timeline: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        days: Math.round((end - start) / 86400000)
      },
      data: employeeReports
    });
  } catch (error) {
    console.error('[REPORT ERROR] Employee Report:', error);
    res.status(500).json({ success: false, message: 'Server error generating employee report', error: error.message });
  }
});

// GET /api/reports/company - Company-wide overview report within timeline
router.get('/company', async (req, res) => {
  try {
    const { start, end } = resolveDateRange(req.query);

    const employees = await User.find({}).select('name email role');

    const taskDateFilter = {
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { updatedAt: { $gte: start, $lte: end } }
      ]
    };

    const tasks = await Task.find(taskDateFilter)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;

    const highPriority = tasks.filter(t => t.priority === 'high').length;
    const mediumPriority = tasks.filter(t => t.priority === 'medium').length;
    const lowPriority = tasks.filter(t => t.priority === 'low').length;

    const companyCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Breakdown per employee: how many tasks given to each employee and their status
    const employeeBreakdown = employees.map(emp => {
      const empIdStr = emp._id.toString();
      const empTasks = tasks.filter(t => {
        const assignedId = t.assignedTo?._id?.toString() || t.user?.toString();
        return assignedId === empIdStr;
      });

      const total = empTasks.length;
      const completed = empTasks.filter(t => t.status === 'completed').length;
      const inProgress = empTasks.filter(t => t.status === 'in-progress').length;
      const pending = empTasks.filter(t => t.status === 'pending').length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        employee: {
          id: emp._id,
          name: emp.name,
          email: emp.email,
          role: emp.role
        },
        tasksGiven: total,
        completed,
        inProgress,
        pending,
        completionRate: rate
      };
    });

    res.json({
      success: true,
      timeline: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        days: Math.round((end - start) / 86400000)
      },
      summary: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        companyCompletionRate,
        priorityBreakdown: {
          high: highPriority,
          medium: mediumPriority,
          low: lowPriority
        }
      },
      employeeBreakdown,
      tasks
    });
  } catch (error) {
    console.error('[REPORT ERROR] Company Report:', error);
    res.status(500).json({ success: false, message: 'Server error generating company report', error: error.message });
  }
});

export default router;
