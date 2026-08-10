import React, { useState, useEffect } from 'react';
import './Tasks.css';

const API_BASE_URL = 'http://localhost:5000/api/tasks';

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStatus, setNewStatus] = useState('pending');
  const [newPriority, setNewPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit task modal state
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState('pending');
  const [editPriority, setEditPriority] = useState('medium');

  // Fetch tasks
  const fetchTasks = async (statusFilter = filter) => {
    try {
      setLoading(true);
      setError(null);
      const url = statusFilter && statusFilter !== 'all' 
        ? `${API_BASE_URL}?status=${statusFilter}` 
        : API_BASE_URL;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTasks(data.data);
      } else {
        setError(data.message || 'Failed to fetch tasks');
      }
    } catch (err) {
      setError('Unable to connect to backend server. Make sure server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks(filter);
  }, [filter]);

  // Create Task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          body: newTitle, // fallback
          description: newDescription,
          status: newStatus,
          priority: newPriority
        }),
      });
      const data = await res.json();

      if (data.success) {
        setNewTitle('');
        setNewDescription('');
        setNewStatus('pending');
        setNewPriority('medium');
        fetchTasks();
      } else {
        alert(data.message || 'Failed to add task');
      }
    } catch (err) {
      alert('Error creating task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Status Update
  const handleStatusChange = async (task, nextStatus) => {
    try {
      const res = await fetch(`${API_BASE_URL}/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchTasks();
      } else {
        alert(data.message || 'Failed to update task status');
      }
    } catch (err) {
      alert('Error updating task');
    }
  };

  // Open Edit Modal
  const startEditing = (task) => {
    setEditingTask(task);
    setEditTitle(task.title || task.body || '');
    setEditDescription(task.description || '');
    setEditStatus(task.status || 'pending');
    setEditPriority(task.priority || 'medium');
  };

  // Save Edit Task
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      const res = await fetch(`${API_BASE_URL}/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          body: editTitle,
          description: editDescription,
          status: editStatus,
          priority: editPriority
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingTask(null);
        fetchTasks();
      } else {
        alert(data.message || 'Failed to update task');
      }
    } catch (err) {
      alert('Error saving task updates');
    }
  };

  // Delete Task
  const handleDeleteTask = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchTasks();
      } else {
        alert(data.message || 'Failed to delete task');
      }
    } catch (err) {
      alert('Error deleting task');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'completed': return 'badge status-completed';
      case 'in-progress': return 'badge status-in-progress';
      default: return 'badge status-pending';
    }
  };

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'high': return 'badge priority-high';
      case 'medium': return 'badge priority-medium';
      default: return 'badge priority-low';
    }
  };

  return (
    <div className="tasks-page-container">
      <div className="tasks-header">
        <div>
          <h1 className="tasks-title">Task Management</h1>
          <p className="tasks-subtitle">Manage tasks efficiently with MongoDB & Express Mongoose API integration.</p>
        </div>
        <div className="tasks-stats">
          <div className="stat-card">
            <span className="stat-value">{tasks.length}</span>
            <span className="stat-label">Total Tasks</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{tasks.filter(t => t.status === 'completed').length}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>
      </div>

      {/* Form & Controls Section */}
      <div className="tasks-grid">
        <div className="task-card form-card">
          <h2>Create New Task</h2>
          <form onSubmit={handleCreateTask} className="task-form">
            <div className="form-group">
              <label htmlFor="taskTitle">Task Title</label>
              <input
                type="text"
                id="taskTitle"
                placeholder="e.g. Design Database Schema"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="taskDescription">Description (Optional)</label>
              <textarea
                id="taskDescription"
                placeholder="Enter details..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="taskStatus">Status</label>
                <select
                  id="taskStatus"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="taskPriority">Priority</label>
                <select
                  id="taskPriority"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? 'Adding...' : '+ Add Task'}
            </button>
          </form>
        </div>

        {/* Filter Controls */}
        <div className="task-card list-card">
          <div className="list-header">
            <h2>Task List</h2>
            <div className="filter-buttons">
              {['all', 'pending', 'in-progress', 'completed'].map((st) => (
                <button
                  key={st}
                  className={`filter-btn ${filter === st ? 'active' : ''}`}
                  onClick={() => setFilter(st)}
                >
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="error-banner">
              <span>⚠️ {error}</span>
              <button onClick={() => fetchTasks()} className="btn btn-secondary btn-sm">Retry</button>
            </div>
          )}

          {loading ? (
            <div className="loading-state">Loading tasks from Express server...</div>
          ) : tasks.length === 0 ? (
            <div className="empty-state">No tasks found. Create one above!</div>
          ) : (
            <ul className="task-list">
              {tasks.map((task) => (
                <li key={task.id || task._id} className="task-item">
                  <div className="task-content">
                    <div className="task-top">
                      <span className="task-title-text">{task.title || task.body}</span>
                      <span className={getStatusBadgeClass(task.status)}>
                        {task.status}
                      </span>
                      {task.priority && (
                        <span className={getPriorityBadgeClass(task.priority)}>
                          {task.priority}
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="task-description-text">{task.description}</p>
                    )}
                  </div>
                  <div className="task-actions">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task, e.target.value)}
                      className="status-select"
                      title="Quick Change Status"
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                    <button
                      onClick={() => startEditing(task)}
                      className="btn btn-icon btn-edit"
                      title="Edit Task"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id || task._id)}
                      className="btn btn-icon btn-delete"
                      title="Delete Task"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingTask && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Task: {editingTask.title || editingTask.body}</h3>
              <button onClick={() => setEditingTask(null)} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleSaveEdit} className="task-form">
              <div className="form-group">
                <label>Task Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setEditingTask(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

};

export default Tasks;
