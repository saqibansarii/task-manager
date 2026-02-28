import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const PRIORITY_COLORS = {
  low: { bg: '#1a3a2a', text: '#4ade80', border: '#166534' },
  medium: { bg: '#3a2e00', text: '#fbbf24', border: '#854d0e' },
  high: { bg: '#3a1a1a', text: '#f87171', border: '#991b1b' },
};

const STATUS_COLORS = {
  todo: { bg: '#1e1e3a', text: '#818cf8', border: '#3730a3' },
  'in-progress': { bg: '#2a1f3a', text: '#c084fc', border: '#7e22ce' },
  completed: { bg: '#1a3a2a', text: '#4ade80', border: '#166534' },
};

const STATUS_LABELS = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  completed: 'Completed',
};

const defaultForm = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
};

function Modal({ isOpen, onClose, children }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function TaskForm({ form, onChange, onSubmit, onCancel, editingId }) {
  return (
    <form onSubmit={onSubmit} className="task-form">
      <h2 className="form-title">{editingId ? '✏️ Edit Task' : '✨ New Task'}</h2>

      <div className="form-group">
        <label>Title *</label>
        <input
          type="text"
          name="title"
          value={form.title}
          onChange={onChange}
          placeholder="Enter task title..."
          required
          autoFocus
        />
      </div>

      <div className="form-group">
        <label>Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={onChange}
          placeholder="Add a description (optional)..."
          rows={3}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Status</label>
          <select name="status" value={form.status} onChange={onChange}>
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="form-group">
          <label>Priority</label>
          <select name="priority" value={form.priority} onChange={onChange}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Due Date</label>
        <input
          type="date"
          name="dueDate"
          value={form.dueDate}
          onChange={onChange}
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-submit">
          {editingId ? 'Update Task' : 'Add Task'}
        </button>
      </div>
    </form>
  );
}

function TaskCard({ task, onEdit, onDelete }) {
  const priorityStyle = PRIORITY_COLORS[task.priority];
  const statusStyle = STATUS_COLORS[task.status];

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  return (
    <div className={`task-card ${task.status === 'completed' ? 'completed' : ''}`}>
      <div className="task-card-header">
        <h3 className="task-title">{task.title}</h3>
        <div className="task-actions">
          <button className="icon-btn edit-btn" onClick={() => onEdit(task)} title="Edit">
            ✏️
          </button>
          <button className="icon-btn delete-btn" onClick={() => onDelete(task._id)} title="Delete">
            🗑️
          </button>
        </div>
      </div>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      <div className="task-badges">
        <span className="badge" style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}>
          {STATUS_LABELS[task.status]}
        </span>
        <span className="badge" style={{ background: priorityStyle.bg, color: priorityStyle.text, border: `1px solid ${priorityStyle.border}` }}>
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
        </span>
        {task.dueDate && (
          <span className={`badge ${isOverdue ? 'overdue' : ''}`}>
            📅 {new Date(task.dueDate).toLocaleDateString()}
            {isOverdue && ' ⚠️'}
          </span>
        )}
      </div>

      <div className="task-meta">
        Created {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
  );
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get(`${API_URL}/tasks`);
      setTasks(res.data.data);
    } catch (err) {
      setError('Failed to fetch tasks. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, dueDate: form.dueDate || null };
      if (editingId) {
        const res = await axios.put(`${API_URL}/tasks/${editingId}`, payload);
        setTasks(prev => prev.map(t => t._id === editingId ? res.data.data : t));
        showToast('Task updated successfully!');
      } else {
        const res = await axios.post(`${API_URL}/tasks`, payload);
        setTasks(prev => [res.data.data, ...prev]);
        showToast('Task created successfully!');
      }
      closeModal();
    } catch (err) {
      showToast(err.response?.data?.message || 'Something went wrong', 'error');
    }
  };

  const handleEdit = (task) => {
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
    });
    setEditingId(task._id);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/tasks/${id}`);
      setTasks(prev => prev.filter(t => t._id !== id));
      showToast('Task deleted successfully!');
      setDeleteConfirm(null);
    } catch {
      showToast('Failed to delete task', 'error');
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  const filtered = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !task.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <div className="app">
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo">
              <span className="logo-icon">⚡</span>
              <span className="logo-text">TaskFlow</span>
            </div>
            <p className="header-subtitle">Manage your tasks efficiently</p>
          </div>
          <button className="btn-add" onClick={() => setModalOpen(true)}>
            + New Task
          </button>
        </div>
      </header>

      <main className="main">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">Total Tasks</div>
          </div>
          <div className="stat-card stat-todo">
            <div className="stat-number">{stats.todo}</div>
            <div className="stat-label">To Do</div>
          </div>
          <div className="stat-card stat-progress">
            <div className="stat-number">{stats.inProgress}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-card stat-done">
            <div className="stat-number">{stats.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <select className="filter-select" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="all">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="error-banner">
            ⚠️ {error}
            <button onClick={fetchTasks} className="retry-btn">Retry</button>
          </div>
        )}

        {/* Tasks */}
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading tasks...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>{tasks.length === 0 ? 'No tasks yet' : 'No tasks match your filters'}</h3>
            <p>{tasks.length === 0 ? 'Create your first task to get started!' : 'Try adjusting your search or filters'}</p>
            {tasks.length === 0 && (
              <button className="btn-add" onClick={() => setModalOpen(true)}>+ Create First Task</button>
            )}
          </div>
        ) : (
          <div className="tasks-grid">
            {filtered.map(task => (
              <TaskCard
                key={task._id}
                task={task}
                onEdit={handleEdit}
                onDelete={(id) => setDeleteConfirm(id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Task Form Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal}>
        <TaskForm
          form={form}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          editingId={editingId}
        />
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <div className="confirm-dialog">
          <div className="confirm-icon">🗑️</div>
          <h2>Delete Task?</h2>
          <p>This action cannot be undone. Are you sure you want to delete this task?</p>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn-delete" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default App;
