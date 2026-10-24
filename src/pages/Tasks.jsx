import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  Search, 
  Filter, 
  User, 
  Mail, 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  Trash2, 
  Edit3, 
  Sparkles,
  ShieldCheck,
  Check,
  X,
  Lock
} from 'lucide-react';
import './Tasks.css';

const API_BASE_URL = 'http://localhost:5000/api/tasks';
const AUTH_BASE_URL = 'http://localhost:5000/api/auth';

const COLUMNS = [
  { id: 'pending', label: 'Pending', icon: Clock, color: '#f59e0b' },
  { id: 'in-progress', label: 'In Progress', icon: AlertCircle, color: '#3b82f6' },
  { id: 'completed', label: 'Completed', icon: CheckCircle2, color: '#10b981' }
];

const Tasks = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState('all');

  // Drag and Drop state
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium',
    dueDate: '',
    assignedTo: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${user?.token}`,
  });

  const handleAuthError = () => {
    logout();
    navigate('/auth');
  };

  // Fetch tasks
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = `${API_BASE_URL}?`;
      if (priorityFilter !== 'all') url += `priority=${priorityFilter}&`;
      if (searchQuery.trim()) url += `search=${encodeURIComponent(searchQuery.trim())}&`;
      if (user?.role === 'admin' && selectedUserFilter !== 'all') {
        url += `assignedTo=${selectedUserFilter}&`;
      }

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.status === 401) return handleAuthError();

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

  // Fetch users list (for admin task assignment)
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${AUTH_BASE_URL}/users`, { headers: getAuthHeaders() });
      if (res.status === 401) return handleAuthError();
      const data = await res.json();
      if (data.success) {
        setUsersList(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch users list:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchUsers();
    }
  }, [user, priorityFilter, selectedUserFilter]);

  // Handle live search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user) fetchTasks();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle Task Creation
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      setIsSubmitting(true);
      const payload = {
        title: formData.title.trim(),
        body: formData.title.trim(),
        description: formData.description.trim(),
        status: formData.status,
        priority: formData.priority,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
      };

      if (user?.role === 'admin' && formData.assignedTo) {
        payload.assignedTo = formData.assignedTo;
      }

      const res = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.status === 401) return handleAuthError();
      const data = await res.json();

      if (data.success) {
        setIsCreateModalOpen(false);
        setFormData({
          title: '',
          description: '',
          status: 'pending',
          priority: 'medium',
          dueDate: '',
          assignedTo: ''
        });
        showToast('✨ Task successfully created and added to the board!');
        fetchTasks();
      } else {
        alert(data.message || 'Failed to create task');
      }
    } catch (err) {
      alert('Error creating task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Task Status (Drag & Drop or Button Click)
  const updateTaskStatus = async (taskId, newStatus) => {
    const currentTask = tasks.find(t => (t.id || t._id) === taskId);
    if (!currentTask || currentTask.status === newStatus) return;

    // Completed task immutability: once completed, status cannot be reverted
    if (currentTask.status === 'completed') {
      showToast('🔒 Completed tasks are locked and cannot be moved back.', 'info');
      return;
    }

    // Optimistic UI update
    const previousTasks = [...tasks];
    setTasks(prev => prev.map(t => (t.id || t._id) === taskId ? { ...t, status: newStatus } : t));

    try {
      const res = await fetch(`${API_BASE_URL}/${taskId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.status === 401) return handleAuthError();
      const data = await res.json();

      if (data.success) {
        if (newStatus === 'completed') {
          showToast(
            `🎉 Task completed! An email alert was sent to the admin (24aiml024@charusat.edu.in).`,
            'email'
          );
        } else {
          showToast(`Task moved to ${newStatus.replace('-', ' ')}.`);
        }
        fetchTasks();
      } else {
        setTasks(previousTasks);
        alert(data.message || 'Failed to update task status');
      }
    } catch (err) {
      setTasks(previousTasks);
      alert('Error updating task');
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, taskId) => {
    const currentTask = tasks.find(t => (t.id || t._id) === taskId);
    if (currentTask?.status === 'completed') {
      e.preventDefault();
      showToast('🔒 Completed tasks are locked and cannot be dragged.', 'info');
      return;
    }
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e, colId) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      updateTaskStatus(taskId, colId);
      setDraggedTaskId(null);
    }
  };

  // Save Edit Task
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      setIsSubmitting(true);
      const payload = {
        title: editingTask.title.trim(),
        description: editingTask.description?.trim() || '',
        status: editingTask.status,
        priority: editingTask.priority,
        dueDate: editingTask.dueDate ? new Date(editingTask.dueDate).toISOString() : null,
      };

      if (user?.role === 'admin' && editingTask.assignedTo) {
        payload.assignedTo = typeof editingTask.assignedTo === 'object' 
          ? (editingTask.assignedTo._id || editingTask.assignedTo.id) 
          : editingTask.assignedTo;
      }

      const res = await fetch(`${API_BASE_URL}/${editingTask.id || editingTask._id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.status === 401) return handleAuthError();
      const data = await res.json();

      if (data.success) {
        if (data.emailNotified) {
          showToast(`🎉 Task marked as completed! Admin (24aiml024@charusat.edu.in) notified via email.`, 'email');
        } else {
          showToast('Task details updated successfully.');
        }
        setEditingTask(null);
        fetchTasks();
      } else {
        alert(data.message || 'Failed to update task');
      }
    } catch (err) {
      alert('Error updating task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Task
  const handleDeleteTask = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.status === 401) return handleAuthError();
      const data = await res.json();
      if (data.success) {
        showToast('Task removed from board.', 'info');
        fetchTasks();
      } else {
        alert(data.message || 'Failed to delete task');
      }
    } catch (err) {
      alert('Error deleting task');
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return { total, pending, inProgress, completed };
  }, [tasks]);

  const getPriorityBadge = (priority) => {
    const p = (priority || 'medium').toLowerCase();
    switch (p) {
      case 'high':
        return <span className="kanban-badge badge-high">🔥 High</span>;
      case 'medium':
        return <span className="kanban-badge badge-medium">⚡ Medium</span>;
      case 'low':
      default:
        return <span className="kanban-badge badge-low">🌱 Low</span>;
    }
  };

  return (
    <div className="kanban-container">
      {/* Toast Alert */}
      {toast && (
        <div className={`kanban-toast toast-${toast.type}`}>
          {toast.type === 'email' ? <Mail className="toast-icon" /> : <Sparkles className="toast-icon" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="toast-close"><X size={16} /></button>
        </div>
      )}

      {/* Greeting & Header Banner */}
      <div className="kanban-header-banner">
        <div className="greeting-content">
          <div className="user-pill">
            {user?.role === 'admin' ? (
              <span className="role-tag admin-tag"><ShieldCheck size={14} /> Administrator</span>
            ) : (
              <span className="role-tag user-tag"><User size={14} /> Team Member</span>
            )}
          </div>
          <h1 className="greeting-title">
            Welcome back, <span className="highlight-name">{user?.name}</span>! 👋
          </h1>
          <p className="greeting-subtitle">
            {user?.role === 'admin'
              ? 'Admin Dashboard: Assign tasks to team members, monitor real-time progress, and receive email alerts on completion.'
              : 'Here is your interactive Kanban board. Tasks are grouped by status and prioritized for maximum productivity.'}
          </p>
        </div>

        {/* Action Buttons & Top Stats */}
        <div className="header-actions-area">
          <div className="stats-strip">
            <div className="stat-pill">
              <span className="stat-number">{stats.total}</span>
              <span className="stat-name">Total</span>
            </div>
            <div className="stat-pill">
              <span className="stat-number color-pending">{stats.pending}</span>
              <span className="stat-name">Pending</span>
            </div>
            <div className="stat-pill">
              <span className="stat-number color-in-progress">{stats.inProgress}</span>
              <span className="stat-name">In Progress</span>
            </div>
            <div className="stat-pill">
              <span className="stat-number color-completed">{stats.completed}</span>
              <span className="stat-name">Done</span>
            </div>
          </div>

          <button 
            className="btn-create-task"
            onClick={() => {
              setFormData({
                title: '',
                description: '',
                status: 'pending',
                priority: 'medium',
                dueDate: '',
                assignedTo: usersList[0]?.id || usersList[0]?._id || ''
              });
              setIsCreateModalOpen(true);
            }}
          >
            <Plus size={18} />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Controls Bar: Search & Priority Filters */}
      <div className="kanban-controls-bar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search tasks by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="clear-search">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-group">
          <div className="priority-filters">
            <span className="filter-label"><Filter size={14} /> Priority:</span>
            {['all', 'high', 'medium', 'low'].map((p) => (
              <button
                key={p}
                className={`priority-filter-btn ${priorityFilter === p ? 'active' : ''}`}
                onClick={() => setPriorityFilter(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Admin User Filter */}
          {user?.role === 'admin' && usersList.length > 0 && (
            <div className="admin-user-filter">
              <User size={14} className="user-icon" />
              <select
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
              >
                <option value="all">All Members</option>
                {usersList.map((u) => (
                  <option key={u.id || u._id} value={u.id || u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Kanban Columns Board */}
      {loading && tasks.length === 0 ? (
        <div className="kanban-loading">
          <div className="loading-spinner"></div>
          <p>Loading your board...</p>
        </div>
      ) : error ? (
        <div className="kanban-error">
          <AlertCircle size={24} />
          <p>{error}</p>
          <button onClick={fetchTasks} className="btn-retry">Retry</button>
        </div>
      ) : (
        <div className="kanban-board-grid">
          {COLUMNS.map((col, colIndex) => {
            const ColumnIcon = col.icon;
            const columnTasks = tasks.filter(t => t.status === col.id);

            return (
              <div
                key={col.id}
                className={`kanban-column ${dragOverColumn === col.id ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Column Header */}
                <div className="column-header">
                  <div className="col-title-group">
                    <ColumnIcon size={18} style={{ color: col.color }} />
                    <h2>{col.label}</h2>
                    <span className="col-count-badge" style={{ backgroundColor: `${col.color}20`, color: col.color }}>
                      {columnTasks.length}
                    </span>
                  </div>
                  <button 
                    className="col-add-btn" 
                    title={`Add task in ${col.label}`}
                    onClick={() => {
                      setFormData({
                        title: '',
                        description: '',
                        status: col.id,
                        priority: 'medium',
                        dueDate: '',
                        assignedTo: usersList[0]?._id || ''
                      });
                      setIsCreateModalOpen(true);
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Column Tasks List */}
                <div className="column-cards-list">
                  {columnTasks.length === 0 ? (
                    <div className="empty-column-placeholder">
                      <p>No {col.label.toLowerCase()} tasks</p>
                      <span>Drag tasks here or click + to add</span>
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const taskId = task.id || task._id;
                      const isAssignedToMe = task.assignedTo?._id === user?._id || task.user?._id === user?._id;
                      const isPastDue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

                      const isCompleted = task.status === 'completed';

                      return (
                        <div
                          key={taskId}
                          className={`kanban-card priority-${task.priority} ${isCompleted ? 'task-locked' : ''} ${draggedTaskId === taskId ? 'is-dragging' : ''}`}
                          draggable={!isCompleted}
                          onDragStart={(e) => handleDragStart(e, taskId)}
                        >
                          {/* Card Top: Priority & Controls */}
                          <div className="card-top">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {getPriorityBadge(task.priority)}
                              {isCompleted && (
                                <span className="kanban-badge badge-locked" title="Completed tasks are permanently locked">
                                  <Lock size={11} /> Locked
                                </span>
                              )}
                            </div>
                            
                            <div className="card-quick-actions">
                              <button
                                onClick={() => setEditingTask(task)}
                                className="card-action-btn"
                                title="Edit Task"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteTask(taskId, task.title)}
                                className="card-action-btn delete-btn"
                                title="Delete Task"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Card Body */}
                          <h3 className="card-title">{task.title}</h3>
                          {task.description && (
                            <p className="card-description">{task.description}</p>
                          )}

                          {/* Card Meta: Due date & Assignee */}
                          <div className="card-meta">
                            {task.dueDate && (
                              <div className={`meta-item due-date ${isPastDue ? 'overdue' : ''}`}>
                                <Calendar size={12} />
                                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                              </div>
                            )}

                            {task.assignedTo && (
                              <div className="meta-item assignee">
                                <User size={12} />
                                <span>
                                  {isAssignedToMe ? 'Assigned to you' : task.assignedTo.name}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Card Navigation Arrows (Quick Move) */}
                          <div className="card-footer">
                            {isCompleted ? (
                              <div className="locked-card-notice">
                                <Lock size={13} />
                                <span>Completed &amp; Locked</span>
                              </div>
                            ) : (
                              <div className="move-buttons">
                                {colIndex > 0 && (
                                  <button
                                    className="btn-move"
                                    title={`Move to ${COLUMNS[colIndex - 1].label}`}
                                    onClick={() => updateTaskStatus(taskId, COLUMNS[colIndex - 1].id)}
                                  >
                                    <ChevronLeft size={14} />
                                    <span>{COLUMNS[colIndex - 1].label}</span>
                                  </button>
                                )}
                                {colIndex < COLUMNS.length - 1 && (
                                  <button
                                    className={`btn-move btn-move-next ${COLUMNS[colIndex + 1].id === 'completed' ? 'btn-complete' : ''}`}
                                    title={`Move to ${COLUMNS[colIndex + 1].label}`}
                                    onClick={() => updateTaskStatus(taskId, COLUMNS[colIndex + 1].id)}
                                  >
                                    <span>{COLUMNS[colIndex + 1].id === 'completed' ? 'Complete' : COLUMNS[colIndex + 1].label}</span>
                                    <ChevronRight size={14} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Task */}
      {isCreateModalOpen && (
        <div className="modal-backdrop">
          <div className="kanban-modal">
            <div className="modal-header">
              <h2>Create New Task</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="btn-close-modal">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="modal-form">
              <div className="form-group">
                <label>Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement OAuth login workflow"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={3}
                  placeholder="Detailed instructions or acceptance criteria..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>

                {/* Assign to user (Admin feature) */}
                {user?.role === 'admin' && (
                  <div className="form-group">
                    <label>Assign To User</label>
                    <select
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    >
                      <option value="">Assign to Me ({user.name})</option>
                      {usersList.map((u) => (
                        <option key={u.id || u._id} value={u.id || u._id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-submit"
                >
                  {isSubmitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Task */}
      {editingTask && (
        <div className="modal-backdrop">
          <div className="kanban-modal">
            <div className="modal-header">
              <h2>Edit Task</h2>
              <button onClick={() => setEditingTask(null)} className="btn-close-modal">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="modal-form">
              <div className="form-group">
                <label>Task Title *</label>
                <input
                  type="text"
                  required
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={3}
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editingTask.status}
                    disabled={editingTask.status === 'completed'}
                    onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value })}
                  >
                    {editingTask.status === 'completed' ? (
                      <option value="completed">Completed (Permanently Locked)</option>
                    ) : (
                      <>
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed (Will notify admin via email)</option>
                      </>
                    )}
                  </select>
                  {editingTask.status === 'completed' && (
                    <small style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>
                      🔒 Completed tasks are locked and cannot have their status reverted.
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                  />
                </div>

                {user?.role === 'admin' && (
                  <div className="form-group">
                    <label>Assigned User</label>
                    <select
                      value={typeof editingTask.assignedTo === 'object' ? (editingTask.assignedTo?.id || editingTask.assignedTo?._id || '') : (editingTask.assignedTo || '')}
                      onChange={(e) => setEditingTask({ ...editingTask, assignedTo: e.target.value })}
                    >
                      <option value="">Myself ({user.name})</option>
                      {usersList.map((u) => (
                        <option key={u.id || u._id} value={u.id || u._id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-submit"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
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
