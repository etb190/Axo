import Navbar from './Navbar';
import React, { useEffect, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Trash2, Plus, Clock, CheckCircle2, X, ChevronRight } from 'lucide-react';
import TaskDetailer from './TaskDetailer';
import editIcon from '../assets/icons/edit.svg';

const LocalIcon = ({ src, size = 16, className = "" }) => (
  <div
    className={`inline-block bg-current ${className}`}
    style={{
      width: size,
      height: size,
      maskImage: `url("${src}")`,
      maskSize: 'contain',
      maskRepeat: 'no-repeat',
      WebkitMaskImage: `url("${src}")`,
      WebkitMaskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
    }}
  />
);



const fs = require('fs').promises;
const path = require('path');

const DB_DIR = 'C:\\Users\\PC\\Desktop\\Database\\Todos';
const TASKS_FILE = path.join(DB_DIR, 'tasks.json');

function Todos() {
  const { data, refreshData } = useData();
  const [tasks, setTasks] = useState((data.todos.allTasks || []).filter(t => !t.completed));
  const [loading, setLoading] = useState(false);

  // For adding new task
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDueDateTime, setNewTaskDueDateTime] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');

  // For editing existing task (reuses the add modal)
  const [editingId, setEditingId] = useState(null);

  // For Task Detailer
  const [detailedTask, setDetailedTask] = useState(null);

  // For live countdown update (only for active tasks)
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const interval = setInterval(() => forceUpdate({}), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (data.todos.allTasks) {
      setTasks(data.todos.allTasks.filter(t => !t.completed));
    }
  }, [data.todos.allTasks]);

  const persistTasks = async (newTasks) => {
    try {
      await fs.mkdir(DB_DIR, { recursive: true });
      const activeTasks = newTasks.filter(task => !task.completed);
      const tempPath = TASKS_FILE + '.tmp';
      await fs.writeFile(tempPath, JSON.stringify(activeTasks, null, 2));
      await fs.rename(tempPath, TASKS_FILE);
      refreshData();
    } catch (err) {
      console.error('Error saving tasks:', err);
    }
  };

  const addTask = () => {
    if (newTaskName.trim() === '') return;

    const task = {
      id: Date.now(),
      title: newTaskName.trim(),
      dueDateTime: newTaskDueDateTime || null,
      priority: newTaskPriority,
      completed: false,
      updatedAt: new Date().toISOString(),
    };

    const newTasks = [...tasks, task];
    setTasks(newTasks);
    persistTasks(newTasks);

    setNewTaskName('');
    setNewTaskDueDateTime('');
    setNewTaskPriority('medium');
    setShowAddModal(false);
  };

  const startEdit = (task) => {
    setEditingId(task.id);
    setNewTaskName(task.title);
    setNewTaskPriority(task.priority || 'medium');
    setNewTaskDueDateTime(task.dueDateTime || '');
    setShowAddModal(true);
  };

  const saveEdit = () => {
    if (newTaskName.trim() === '') return;
    const newTasks = tasks.map(task =>
      task.id === editingId ? { ...task, title: newTaskName.trim(), priority: newTaskPriority, dueDateTime: newTaskDueDateTime || null, updatedAt: new Date().toISOString() } : task
    );
    setTasks(newTasks);
    persistTasks(newTasks);

    setEditingId(null);
    setNewTaskName('');
    setNewTaskDueDateTime('');
    setNewTaskPriority('medium');
    setShowAddModal(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewTaskName('');
    setNewTaskDueDateTime('');
    setNewTaskPriority('medium');
    setShowAddModal(false);
  };

  const completeTask = (id) => {
    const newTasks = tasks.filter(task => task.id !== id);
    setTasks(newTasks);
    persistTasks(newTasks);
  };

  const deleteTask = (id) => {
    const newTasks = tasks.filter(task => task.id !== id);
    setTasks(newTasks);
    persistTasks(newTasks);
  };

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'high':
        return {
          dot: 'bg-red-500',
          bg: 'bg-red-500/5',
          border: 'border-red-500/20',
          colorCode: '#ef4444'
        };
      case 'medium':
        return {
          dot: 'bg-amber-500',
          bg: 'bg-amber-500/5',
          border: 'border-amber-500/20',
          colorCode: '#f59e0b'
        };
      case 'low':
        return {
          dot: 'bg-emerald-500',
          bg: 'bg-emerald-500/5',
          border: 'border-emerald-500/20',
          colorCode: '#10b981'
        };
      default:
        return {
          dot: 'bg-zinc-500',
          bg: 'bg-zinc-500/5',
          border: 'border-zinc-500/20',
          colorCode: '#71717a'
        };
    }
  };

  const formatTimeLeft = (dueDateTime) => {
    if (!dueDateTime) return null;
    const due = new Date(dueDateTime);
    const now = new Date();
    const diffMs = due - now;
    if (diffMs <= 0) return 'Overdue';

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds}s`;
  };

  if (loading) {
    return (
      <div className="h-[200px] bg-[#0f1115] flex items-center justify-center">
        <div className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em] animate-pulse">Initializing Streams...</div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#0f1115] text-zinc-400 font-sans selection:bg-white selection:text-black">
      <div className="max-w-md mx-auto px-4 py-6">

        {/* Header Section */}
        <div className="flex items-end justify-between mb-4 pb-2.5 border-b border-white/10 px-1">
          <div>
            <h1 className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.4em] mb-1">Queue</h1>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white tracking-tighter">{tasks.length}</span>
              <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest">Active</span>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="h-6 px-2 flex items-center justify-center gap-1 bg-white text-black text-[9px] font-bold uppercase tracking-widest rounded hover:bg-zinc-200 transition-all active:scale-95"
          >
            <Plus size={10} strokeWidth={3} />
            <span>Add</span>
          </button>
        </div>

        {/* Task List */}
        {tasks.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-white/10 bg-zinc-950/20 rounded-xl">
            <div className="text-zinc-800 text-[8px] font-bold uppercase tracking-[0.3em]">Operational 100%</div>
          </div>
        ) : (
          <ul className="space-y-1">
            {tasks
              .sort((a, b) => {
                // Primary sort: last edited (updatedAt) descending
                const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.id);
                const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.id);
                return dateB - dateA;
              })
              .map((task) => {
                const timeLeft = formatTimeLeft(task.dueDateTime);
                const isOverdue = timeLeft === 'Overdue';
                const style = getPriorityStyles(task.priority);

                return (
                  <li
                    key={task.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setDetailedTask(task);
                    }}
                    className={`group bg-zinc-950/20 border border-white/[0.02] hover:border-white/10 transition-all duration-200 cursor-pointer rounded-xl overflow-hidden`}
                    onClick={() => completeTask(task.id)}
                  >
                    <div className="px-3 py-2 flex items-center gap-3">
                      {/* Sub-Checkbox Control */}
                      <div className="w-4 h-4 rounded-full border border-white/10 flex items-center justify-center group-hover:border-emerald-500/50 transition-colors">
                        <div className="w-1.5 h-1.5 bg-emerald-500 scale-0 group-hover:scale-100 transition-transform rounded-full" />
                      </div>

                      <div className="flex-1 min-w-0">
                        {(
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <div
                                className="text-sm font-bold text-white tracking-tight break-words"
                              >
                                {task.title}
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <div className={`w-1 h-1 rounded-full ${style.dot}`} />
                                  <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{task.priority}</span>
                                </div>
                                {task.dueDateTime && (
                                  <div className={`flex items-center gap-1.5 font-mono text-[9px] flex-shrink-0 ${isOverdue ? 'text-red-500' : 'text-zinc-500'}`}>
                                    <Clock size={10} />
                                    <span>{timeLeft}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col justify-center items-center m-0 p-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(task);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-all p-0.5 text-zinc-600 hover:text-white cursor-pointer"
                              >
                                <LocalIcon src={editIcon} size={12} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTask(task.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-all p-0.5 text-zinc-600 hover:text-rose-500 cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      {/* Task Detailer Overlay */}
      {detailedTask && (
        <TaskDetailer
          event={{
            id: detailedTask.id,
            taskName: detailedTask.title,
            color: getPriorityStyles(detailedTask.priority).colorCode,
            // Tasks don't have start/end minutes, so we pass undefined or rely on TaskDetailer handling
          }}
          // We can omit currentMinutes since we updated TaskDetailer to handle missing minutes
          onBack={() => setDetailedTask(null)}
          onEditOriginal={() => {
            setDetailedTask(null);
            startEdit(detailedTask);
          }}
        />
      )}

      {/* MODAL SYSTEM - Aggressively Compact */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 max-w-[280px] w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.4em]">{editingId ? 'Modify' : 'Initialize'}</h2>
              <button onClick={cancelEdit} className="text-zinc-700 hover:text-white"><X size={14} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTask()}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-white focus:border-white/30 outline-none placeholder:text-zinc-800"
                  placeholder="Identification..."
                  autoFocus
                />
              </div>

              <div>
                <input
                  type="datetime-local"
                  value={newTaskDueDateTime}
                  onChange={(e) => setNewTaskDueDateTime(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] font-bold text-white focus:border-white/30 outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-1">
                {['L', 'M', 'H'].map((p, i) => {
                  const labels = ['low', 'medium', 'high'];
                  const label = labels[i];
                  return (
                    <button
                      key={label}
                      onClick={() => setNewTaskPriority(label)}
                      className={`h-6 rounded text-[8px] font-bold uppercase transition-all border ${newTaskPriority === label ? 'bg-white text-black border-white' : 'bg-white/5 text-zinc-700 border-white/5 hover:border-white/20'}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={editingId ? saveEdit : addTask}
                className="w-full h-8 bg-white text-black text-[9px] font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-200"
              >
                {editingId ? 'Update' : 'Authorize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Todos;