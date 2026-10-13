import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import editIcon from '../assets/icons/edit.svg';
import trashIcon from '../assets/icons/delete.svg';
import closeIcon from '../assets/icons/close.svg';
import plusIcon from '../assets/icons/plus.svg';
import calendarIcon from '../assets/icons/calendar.svg';
import clockIcon from '../assets/icons/clock.svg';
import TaskDetailer from './TaskDetailer';
import { getNow, toAppTime } from '../utils/appClock';

const LocalIcon = ({ src, size = 16, className = '' }) => (
  <div
    className={`inline-block bg-current flex-shrink-0 ${className}`}
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

const DB_DIR = 'C:\\Users\\PC\\Desktop\\Database\\DayPlanner';
const EVENTS_FILE = path.join(DB_DIR, 'events.json');
const TASKS_FILE = path.join(DB_DIR, 'tasks.json');
const PLANS_FILE = path.join(DB_DIR, 'session_plans.json');

const COLORS = [
  '#2563eb', // blue
  '#7c3aed', // violet
  '#db2777', // pink
  '#059669', // emerald
  '#d97706', // amber
  '#4f46e5', // indigo
  '#9333ea', // purple
  '#0891b2', // cyan
  '#16a34a', // green
  '#c026d3', // fuchsia
];

const DayPlanner = () => {
  const [currentHour, setCurrentHour] = useState(() => getNow().getHours());
  const [events, setEvents] = useState([]);
  const [savedTasks, setSavedTasks] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [taskName, setTaskName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [sleepStart, setSleepStart] = useState('23:00');
  const [isWorkTask, setIsWorkTask] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showClearDayModal, setShowClearDayModal] = useState(false);
  const [dayToClear, setDayToClear] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState('0.5');
  const [currentTime, setCurrentTime] = useState(() => getNow());
  const [activeWorkSession, setActiveWorkSession] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('axo_dayplanner_viewMode') || 'plan'; } catch { return 'plan'; }
  }); // 'plan' or 'log'

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem('axo_dayplanner_viewMode', mode); } catch { }
  };

  const { data, refreshData } = useData();
  useEffect(() => {
    loadSavedTasks();

    // Load sleep time from localStorage
    const savedSleepStart = localStorage.getItem('sleepStart');
    if (savedSleepStart) setSleepStart(savedSleepStart);
  }, []);

  useEffect(() => {
    if (data.planner && data.planner.allEvents) {
      setEvents(data.planner.allEvents);
    }
  }, [data.planner]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(getNow().getHours());
      setCurrentTime(getNow());
    }, 1000); // Update every second for countdown
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      const el = document.getElementById('current-time-block');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, []);



  const loadSavedTasks = async () => {
    try {
      await fs.mkdir(DB_DIR, { recursive: true });
      const data = await fs.readFile(TASKS_FILE, 'utf-8');
      setSavedTasks(JSON.parse(data));
    } catch (err) {
      if (err.code === 'ENOENT') {
        setSavedTasks([]);
      }
    }
  };

  const saveEvents = async (updatedEvents) => {
    try {
      await fs.mkdir(DB_DIR, { recursive: true });
      await fs.writeFile(EVENTS_FILE, JSON.stringify(updatedEvents, null, 2));
      refreshData();
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const saveTasks = async (updatedTasks) => {
    try {
      await fs.mkdir(DB_DIR, { recursive: true });
      await fs.writeFile(TASKS_FILE, JSON.stringify(updatedTasks, null, 2));
    } catch (err) {
      console.error('Save tasks error:', err);
    }
  };

  const parseTimeToMinutes = (timeStr) => {
    const [hh, mm] = timeStr.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      return null;
    }
    return hh * 60 + mm;
  };

  const parseFlexibleTimeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const trimmed = timeStr.trim();
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      const hh = parseInt(parts[0], 10);
      const mm = parts[1] === '' ? 0 : parseInt(parts[1], 10);
      if (!isNaN(hh) && hh >= 0 && hh < 30 && !isNaN(mm) && mm >= 0 && mm < 60) {
        return hh * 60 + mm;
      }
    } else {
      const hh = parseInt(trimmed, 10);
      if (!isNaN(hh) && hh >= 0 && hh < 30) {
        return hh * 60;
      }
    }
    return null;
  };

  const formatMinutesToTime = (minutes) => {
    const totalHours = Math.floor(minutes / 60);
    const hh = (totalHours % 24).toString().padStart(2, '0');
    const mm = (minutes % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const handleTimeClick = (e) => {
    const input = e.target;
    const pos = input.selectionStart;
    if (input.selectionStart === input.selectionEnd) {
      if (pos <= 2) {
        input.setSelectionRange(0, 2);
      } else if (pos >= 3) {
        input.setSelectionRange(3, 5);
      }
    }
  };

  const timeBlocks = [];
  for (let h = 5; h < 29; h++) {
    const startHour = h % 24;
    const label = `${startHour.toString().padStart(2, '0')}:00`;
    const isCurrent = startHour === currentHour;
    timeBlocks.push({ label, isCurrent, startHour, actualHour: h });
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const getCurrentWeekDates = () => {
    const now = getNow();
    // If it's before 5 AM, use yesterday's date to determine the week
    const effectiveNow = now.getHours() < 5 ? new Date(now.getTime() - 24 * 60 * 60 * 1000) : now;
    const currentDay = effectiveNow.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

    const monday = new Date(effectiveNow);
    monday.setDate(effectiveNow.getDate() + mondayOffset);

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  };

  const weekDates = getCurrentWeekDates();
  const getEffectiveDayIndex = () => {
    const now = getNow();
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
    return now.getHours() < 5 ? (day - 1 + 7) % 7 : day;
  };
  const todayDayIndex = getEffectiveDayIndex();

  // --- ACTIVITY LOG: Convert TimeTracker sessions to planner events ---
  const LOG_COLORS = [
    '#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706',
    '#4f46e5', '#9333ea', '#0891b2', '#16a34a', '#c026d3',
  ];

  const getLogEvents = () => {
    const sessions = data.time?.allSessions || [];
    if (sessions.length === 0) return [];

    // Build color map from task names
    const taskColorMap = {};
    let colorIdx = 0;
    // Try to use DayPlanner saved task colors first
    savedTasks.forEach(t => { taskColorMap[t.name.toLowerCase()] = t.color; });

    const mondayDate = weekDates[0];
    const mondayStart = new Date(mondayDate);
    mondayStart.setHours(0, 0, 0, 0);
    const sundayEnd = new Date(weekDates[6]);
    sundayEnd.setHours(23, 59, 59, 999);

    const logEvents = [];

    sessions.forEach(session => {
      if (!session.startTime || !session.stopTime) return;
      const start = toAppTime(new Date(session.startTime));
      const stop = toAppTime(new Date(session.stopTime));

      // Filter to current week
      if (stop < mondayStart || start > sundayEnd) return;

      // Assign color
      const taskKey = (session.taskName || 'Unknown').toLowerCase();
      if (!taskColorMap[taskKey]) {
        taskColorMap[taskKey] = LOG_COLORS[colorIdx % LOG_COLORS.length];
        colorIdx++;
      }
      const color = taskColorMap[taskKey];

      // Determine day index (0=Mon..6=Sun)
      const sessionDay = start.getDay(); // 0=Sun
      let dayIndex = sessionDay === 0 ? 6 : sessionDay - 1;

      // Convert to minutes since midnight
      let startMinutes = start.getHours() * 60 + start.getMinutes();
      let endMinutes = stop.getHours() * 60 + stop.getMinutes();

      // Handle sessions crossing midnight
      if (stop.getDate() !== start.getDate() || stop.getMonth() !== start.getMonth()) {
        // First segment: start to midnight
        const midnightMins = 24 * 60;
        logEvents.push({
          id: `log-${session.startTime}-a`,
          dayIndex,
          startMinutes,
          endMinutes: midnightMins,
          taskName: session.taskName || 'Unknown',
          color,
          isWork: true,
        });
        // Second segment: midnight to stop (next day)
        const nextDayIndex = (dayIndex + 1) % 7;
        // For late-night (before 5am), keep on same logical day with minutes > 1440
        if (stop.getHours() < 5) {
          logEvents.push({
            id: `log-${session.startTime}-b`,
            dayIndex,
            startMinutes: 1440,
            endMinutes: 1440 + endMinutes,
            taskName: session.taskName || 'Unknown',
            color,
            isWork: true,
          });
        } else {
          logEvents.push({
            id: `log-${session.startTime}-b`,
            dayIndex: nextDayIndex,
            startMinutes: 0,
            endMinutes,
            taskName: session.taskName || 'Unknown',
            color,
            isWork: true,
          });
        }
        return;
      }

      // Handle late-night sessions (before 5 AM) - attach to previous day
      if (start.getHours() < 5) {
        dayIndex = (dayIndex - 1 + 7) % 7;
        startMinutes += 1440;
        endMinutes += 1440;
      }

      if (endMinutes <= startMinutes) endMinutes = startMinutes + 1; // safety

      logEvents.push({
        id: `log-${session.startTime}`,
        dayIndex,
        startMinutes,
        endMinutes,
        taskName: session.taskName || 'Unknown',
        color,
        isWork: true,
      });
    });

    return logEvents;
  };

  const displayEvents = viewMode === 'log' ? getLogEvents() : events;

  const openCreateModal = (dayIndex, hourIndex) => {
    const clickedActualHour = timeBlocks[hourIndex].actualHour;
    setSelectedCell({ dayIndex, hourIndex, actualHour: clickedActualHour });
    setEditingEvent(null);
    setTaskName('');

    const hrStart = clickedActualHour * 60;
    const hrEnd = hrStart + 60;

    // Find the latest task ending within this hour block on the selected day
    const prevTask = events
      .filter(e => e.dayIndex === dayIndex && e.endMinutes > hrStart && e.endMinutes < hrEnd)
      .sort((a, b) => b.endMinutes - a.endMinutes)[0];

    let startMins = hrStart;
    if (prevTask) {
      startMins = prevTask.endMinutes;
    }

    const displayHour = clickedActualHour % 24;
    const dur = selectedDuration || '0.5';
    const durMins = Math.round(parseFloat(dur) * 60);

    setStartTime(formatMinutesToTime(startMins));
    setEndTime(formatMinutesToTime(startMins + durMins));
    setSelectedDays([dayIndex]);
    setSelectedDuration(dur);
    setShowTaskSelector(true);
  };

  const openEditModal = (event, e) => {
    e.stopPropagation();
    setEditingEvent(event);
    setTaskName(event.taskName);
    setStartTime(formatMinutesToTime(event.startMinutes));
    setEndTime(formatMinutesToTime(event.endMinutes));

    const durMinutes = event.endMinutes - event.startMinutes;
    const durHours = durMinutes / 60;
    const supportedDurations = ['0.25', '0.5', '0.75', '1', '1.5', '2', '3', '4'];
    const matchedDur = supportedDurations.find(d => Math.abs(parseFloat(d) - durHours) < 0.01);
    setSelectedDuration(matchedDur || '0.5');

    const matchingEvents = events.filter(ev =>
      ev.taskName === event.taskName &&
      ev.startMinutes === event.startMinutes &&
      ev.endMinutes === event.endMinutes
    );
    setSelectedDays(matchingEvents.map(ev => ev.dayIndex));

    setShowEventModal(true);
  };

  const handleDurationChange = (duration) => {
    const nextDur = duration || '0.5';
    setSelectedDuration(nextDur);
    if (nextDur && startTime) {
      const startMin = parseFlexibleTimeToMinutes(startTime);
      if (startMin !== null) {
        const durationMinutes = parseFloat(nextDur) * 60;
        const endMin = startMin + durationMinutes;
        setEndTime(formatMinutesToTime(endMin));
      }
    }
  };

  const handleStartTimeChange = (newStartTime) => {
    setStartTime(newStartTime);
    const startMin = parseFlexibleTimeToMinutes(newStartTime);
    if (startMin !== null) {
      const dur = selectedDuration || '0.5';
      const durationMinutes = parseFloat(dur) * 60;
      const endMin = startMin + durationMinutes;
      setEndTime(formatMinutesToTime(endMin));
    }
  };

  const handleEndTimeChange = (newEndTime) => {
    setEndTime(newEndTime);
    const startM = parseFlexibleTimeToMinutes(startTime);
    const endM = parseFlexibleTimeToMinutes(newEndTime);
    if (startM !== null && endM !== null && endM > startM) {
      const durMinutes = endM - startM;
      const durHours = durMinutes / 60;
      const supportedDurations = ['0.25', '0.5', '0.75', '1', '1.5', '2', '3', '4'];
      const matchedDur = supportedDurations.find(d => Math.abs(parseFloat(d) - durHours) < 0.01);
      if (matchedDur) {
        setSelectedDuration(matchedDur);
      }
    }
  };

  const closeModals = () => {
    setShowEventModal(false);
    setShowTaskSelector(false);
    setSelectedCell(null);
    setEditingEvent(null);
    setIsWorkTask(false);
    setShowNewTaskModal(false);
    setShowEditTaskModal(false);
    setShowDeleteModal(false);
    setShowSleepModal(false);
    setShowClearDayModal(false);
    setDayToClear(null);
    setErrorMessage('');
    if (!selectedDuration) setSelectedDuration('0.5');
  };

  const toggleDay = (dayIndex) => {
    setSelectedDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const selectTask = (task) => {
    setTaskName(task.name);
    setShowTaskSelector(false);
    setShowEventModal(true);
  };

  const createNewTask = () => {
    setNewTaskName('');
    setShowTaskSelector(false);
    setShowNewTaskModal(true);
  };

  const saveNewTask = () => {
    if (!newTaskName || !newTaskName.trim()) return;

    const existingTask = savedTasks.find(t => t.name.toLowerCase() === newTaskName.trim().toLowerCase());
    if (existingTask) {
      setErrorMessage('Task already exists!');
      return;
    }

    const taskColor = COLORS[savedTasks.length % COLORS.length];

    const newTask = {
      id: uuidv4(),
      name: newTaskName.trim(),
      color: taskColor,
      isWork: isWorkTask
    };

    const updated = [...savedTasks, newTask];
    setSavedTasks(updated);
    saveTasks(updated);
    setShowNewTaskModal(false);
    setIsWorkTask(false);
    selectTask(newTask);
  };

  const openEditTaskModal = (task, e) => {
    e.stopPropagation();
    setTaskToEdit(task);
    setEditTaskName(task.name);
    setIsWorkTask(task.isWork || false);
    setShowTaskSelector(false); // hide task selector so only edit panel renders
    setShowEditTaskModal(true);
  };

  const saveTaskEdit = () => {
    if (!editTaskName.trim()) return;

    const updated = savedTasks.map(t =>
      t.name === taskToEdit.name ? { ...t, name: editTaskName.trim(), isWork: isWorkTask } : t
    );
    setSavedTasks(updated);
    saveTasks(updated);

    const updatedEvents = events.map(e =>
      e.taskName === taskToEdit.name ? { ...e, taskName: editTaskName.trim(), isWork: isWorkTask } : e
    );
    setEvents(updatedEvents);
    saveEvents(updatedEvents);

    // Return to task selector
    setShowEditTaskModal(false);
    setTaskToEdit(null);
    setIsWorkTask(false);
    setShowTaskSelector(true);
  };

  const confirmDeleteTask = (task, e) => {
    e.stopPropagation();
    setTaskToDelete(task);
    setShowTaskSelector(false); // hide task selector so only delete modal renders
    setShowDeleteModal(true);
  };

  const deleteTask = () => {
    const updatedTasks = savedTasks.filter(t => t.name !== taskToDelete.name);
    setSavedTasks(updatedTasks);
    saveTasks(updatedTasks);

    const updatedEvents = events.filter(e => e.taskName !== taskToDelete.name);
    setEvents(updatedEvents);
    saveEvents(updatedEvents);

    // Return to task selector
    setShowDeleteModal(false);
    setTaskToDelete(null);
    setShowTaskSelector(true);
  };

  const deleteEvent = async () => {
    if (!editingEvent) return;

    // Identify events being deleted to clean up plans
    const eventsToDelete = events.filter(ev => (ev.taskName === editingEvent.taskName && ev.startMinutes === editingEvent.startMinutes && ev.endMinutes === editingEvent.endMinutes));
    const idsToDelete = eventsToDelete.map(e => e.id);

    const updatedEvents = events.filter(ev => !(ev.taskName === editingEvent.taskName && ev.startMinutes === editingEvent.startMinutes && ev.endMinutes === editingEvent.endMinutes));
    setEvents(updatedEvents);
    saveEvents(updatedEvents);

    // Clean up session plans
    try {
      const plansData = await fs.readFile(PLANS_FILE, 'utf-8').catch(() => '{}');
      const plans = JSON.parse(plansData);
      let changed = false;
      idsToDelete.forEach(id => {
        if (plans[id]) {
          delete plans[id];
          changed = true;
        }
      });
      if (changed) {
        await fs.writeFile(PLANS_FILE, JSON.stringify(plans, null, 2));
      }
    } catch (err) {
      console.error('Error cleaning up plans:', err);
    }

    closeModals();
  };

  const handleDayHeaderClick = (dayIndex, e) => {
    e.stopPropagation();
    const dayEvents = events.filter(ev => ev.dayIndex === dayIndex);
    if (dayEvents.length === 0) return; // nothing to clear
    setDayToClear(dayIndex);
    setShowClearDayModal(true);
  };

  const clearDayEvents = async () => {
    if (dayToClear === null) return;

    const eventsToRemove = events.filter(ev => ev.dayIndex === dayToClear);
    const idsToRemove = eventsToRemove.map(e => e.id);
    const updatedEvents = events.filter(ev => ev.dayIndex !== dayToClear);
    setEvents(updatedEvents);
    saveEvents(updatedEvents);

    // Clean up session plans
    try {
      const plansData = await fs.readFile(PLANS_FILE, 'utf-8').catch(() => '{}');
      const plans = JSON.parse(plansData);
      let changed = false;
      idsToRemove.forEach(id => {
        if (plans[id]) {
          delete plans[id];
          changed = true;
        }
      });
      if (changed) {
        await fs.writeFile(PLANS_FILE, JSON.stringify(plans, null, 2));
      }
    } catch (err) {
      console.error('Error cleaning up plans:', err);
    }

    closeModals();
  };

  const resolveDayOverlaps = (fixedEvent, otherEventsOnDay) => {
    let beforeEvents = [];
    let afterEvents = [];

    otherEventsOnDay.forEach(ev => {
      const clone = { ...ev };
      if (clone.startMinutes < fixedEvent.startMinutes) {
        beforeEvents.push(clone);
      } else {
        afterEvents.push(clone);
      }
    });

    // 1. Process beforeEvents (events starting before fixedEvent)
    // Sort descending by startMinutes so we process the closest one to fixedEvent first
    beforeEvents.sort((a, b) => b.startMinutes - a.startMinutes);
    let currentUpperBound = fixedEvent.startMinutes;

    const finalBefore = [];
    for (let ev of beforeEvents) {
      if (ev.endMinutes > currentUpperBound) {
        // Overlap detected! Push up
        const duration = ev.endMinutes - ev.startMinutes;
        const newStart = currentUpperBound - duration;
        if (newStart >= 0) {
          ev.endMinutes = currentUpperBound;
          ev.startMinutes = newStart;
          currentUpperBound = ev.startMinutes;
          finalBefore.push(ev);
        } else {
          // No room above (would be negative time), push down into afterEvents instead
          afterEvents.push(ev);
        }
      } else {
        currentUpperBound = Math.min(currentUpperBound, ev.startMinutes);
        finalBefore.push(ev);
      }
    }

    // 2. Process afterEvents (events starting at or after fixedEvent, plus any displaced beforeEvents)
    // Sort ascending by startMinutes
    afterEvents.sort((a, b) => a.startMinutes - b.startMinutes);
    let currentLowerBound = fixedEvent.endMinutes;

    const finalAfter = [];
    for (let ev of afterEvents) {
      const duration = ev.endMinutes - ev.startMinutes;
      if (ev.startMinutes < currentLowerBound) {
        // Overlap detected! Push down
        ev.startMinutes = currentLowerBound;
        ev.endMinutes = ev.startMinutes + duration;
        currentLowerBound = ev.endMinutes;
      } else {
        currentLowerBound = Math.max(currentLowerBound, ev.endMinutes);
      }
      finalAfter.push(ev);
    }

    // Return all events for this day, sorted ascending by startMinutes
    return [...finalBefore, fixedEvent, ...finalAfter].sort((a, b) => a.startMinutes - b.startMinutes);
  };

  const saveEvent = () => {
    if (!taskName.trim() || selectedDays.length === 0) return;

    let startMin = parseTimeToMinutes(startTime);
    let endMin = parseTimeToMinutes(endTime);

    if (startMin === null || endMin === null) return;

    if (selectedCell && selectedCell.actualHour >= 24) {
      if (startMin >= 0 && startMin < 300) startMin += 1440;
      if (endMin >= 0 && endMin < 300) endMin += 1440;
    }

    if (editingEvent) {
      if (editingEvent.startMinutes >= 1440 && startMin < 300) startMin += 1440;
      if (editingEvent.endMinutes >= 1440 && endMin < 300) endMin += 1440;
    }

    if (endMin <= startMin) endMin += 1440;

    const task = savedTasks.find(t => t.name.trim().toLowerCase() === taskName.trim().toLowerCase());

    // Filter out the event(s) being edited so they don't collide with themselves
    let remainingEvents = events.filter(ev => {
      if (editingEvent) {
        return !(ev.taskName === editingEvent.taskName && ev.startMinutes === editingEvent.startMinutes && ev.endMinutes === editingEvent.endMinutes);
      }
      return true;
    });

    let allUpdatedEvents = [...remainingEvents];

    selectedDays.forEach(dayIndex => {
      let id = Date.now() + dayIndex;
      if (editingEvent && editingEvent.dayIndex === dayIndex) {
        id = editingEvent.id;
      }

      const newEv = {
        id,
        dayIndex,
        startMinutes: startMin,
        endMinutes: endMin,
        taskName: task ? task.name : taskName.trim(),
        color: task ? task.color : '#2563eb',
        isWork: task ? task.isWork : false
      };

      const dayEvents = allUpdatedEvents.filter(e => e.dayIndex === dayIndex);
      const otherDayEvents = allUpdatedEvents.filter(e => e.dayIndex !== dayIndex);

      const resolvedDayEvents = resolveDayOverlaps(newEv, dayEvents);
      allUpdatedEvents = [...otherDayEvents, ...resolvedDayEvents];
    });

    setEvents(allUpdatedEvents);
    saveEvents(allUpdatedEvents);
    closeModals();
  };

  const calculateTimeUntilSleep = () => {
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const currentSeconds = currentTime.getSeconds();

    const sleepStartMin = parseTimeToMinutes(sleepStart);
    if (sleepStartMin === null) return '--:--';

    let mins = sleepStartMin > currentMinutes ? sleepStartMin - currentMinutes : (1440 - currentMinutes) + sleepStartMin;
    const totalSeconds = (mins * 60) - currentSeconds;

    const hours = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  const calculateScheduledHours = () => {
    const now = getNow();
    const currentDayIndex = now.getHours() < 5
      ? (now.getDay() === 0 ? 5 : (now.getDay() === 1 ? 6 : now.getDay() - 2))
      : (now.getDay() === 0 ? 6 : now.getDay() - 1);

    const today = events.filter(e => e.dayIndex === currentDayIndex && e.isWork).reduce((sum, e) => sum + (e.endMinutes - e.startMinutes), 0) / 60;
    const week = events.filter(e => e.isWork).reduce((sum, e) => sum + (e.endMinutes - e.startMinutes), 0) / 60;
    const month = week * 4.33;
    const year = week * 52;

    return {
      today: today.toFixed(1),
      week: week.toFixed(1),
      month: month.toFixed(0),
      year: year.toFixed(0)
    };
  };

  const getCurrentAndNextTask = () => {
    const now = getNow();
    let currentDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
    let currentMinutes = now.getHours() * 60 + now.getMinutes();
    let accurateMinutes = currentMinutes + now.getSeconds() / 60;

    // Shift coordinate system for late night (before 5 AM)
    if (now.getHours() < 5) {
      currentDayIndex = (currentDayIndex - 1 + 7) % 7;
      currentMinutes += 1440;
      accurateMinutes += 1440;
    }

    const todayEvents = events.filter(e => e.dayIndex === currentDayIndex).sort((a, b) => a.startMinutes - b.startMinutes);

    return {
      currentTask: todayEvents.find(e => currentMinutes >= e.startMinutes && currentMinutes < e.endMinutes),
      nextTask: todayEvents.find(e => e.startMinutes > currentMinutes),
      currentMinutes,
      accurateMinutes
    };
  };

  const formatTimeRemaining = (totalMin) => {
    const h = Math.floor(totalMin / 60);
    const m = Math.round(totalMin % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const formatDuration = (totalMinutes) => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const { currentTask, nextTask, currentMinutes, accurateMinutes } = getCurrentAndNextTask();

  if (activeWorkSession) {
    return (
      <TaskDetailer
        event={activeWorkSession}
        currentMinutes={currentMinutes}
        onBack={() => setActiveWorkSession(null)}
        onEditOriginal={() => {
          const ev = activeWorkSession;
          // Populate all edit form state (same as openEditModal)
          setEditingEvent(ev);
          setTaskName(ev.taskName);
          setStartTime(formatMinutesToTime(ev.startMinutes));
          setEndTime(formatMinutesToTime(ev.endMinutes));
          const durMinutes = ev.endMinutes - ev.startMinutes;
          const durHours = durMinutes / 60;
          const supportedDurations = ['0.25', '0.5', '0.75', '1', '1.5', '2', '3', '4'];
          const matchedDur = supportedDurations.find(d => Math.abs(parseFloat(d) - durHours) < 0.01);
          setSelectedDuration(matchedDur || '0.5');
          const matchingEvents = events.filter(e =>
            e.taskName === ev.taskName &&
            e.startMinutes === ev.startMinutes &&
            e.endMinutes === ev.endMinutes
          );
          setSelectedDays(matchingEvents.map(e => e.dayIndex));
          // Now switch views
          setActiveWorkSession(null);
          setShowEventModal(true);
        }}
      />
    );
  }

  return (
    <div className=" pl-3  min-h-screen bg-black transition-colors duration-500 font-sans relative">
      <div className="max-w-[1700px] mx-auto p-4 pl-12 lg:pl-6 pt-6 animate-in slide-in-from-left duration-300">

        {/* Info Squares - Back to top, refined */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div
            onClick={() => setShowSleepModal(true)}
            className="bg-zinc-950 rounded-xl border border-white/5 p-3 hover:border-white/10 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-[0.3em]">Until Bedtime</span>
              <div className="p-1 rounded-lg bg-white/5">
                <LocalIcon src={clockIcon} size={12} className="text-zinc-400" />
              </div>
            </div>
            <div className="text-xl font-bold text-white tracking-tight mb-0.5">
              {calculateTimeUntilSleep()}
            </div>
            <div className="text-[9px] text-zinc-600 font-medium font-mono leading-none">Sleep at {sleepStart}</div>
          </div>

          <div className="bg-zinc-950 rounded-xl border border-white/5 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-[0.3em]">Scheduled Hours</span>
              <div className="p-1 rounded-lg bg-white/5">
                <LocalIcon src={calendarIcon} size={12} className="text-zinc-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-white font-mono">{calculateScheduledHours().today}h</span>
                <span className="text-[7px] text-zinc-600 uppercase font-bold tracking-wider">Day</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-white font-mono">{calculateScheduledHours().week}h</span>
                <span className="text-[7px] text-zinc-600 uppercase font-bold tracking-wider">Week</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] font-bold text-zinc-400 font-mono">{calculateScheduledHours().month}h</span>
                <span className="text-[7px] text-zinc-700 uppercase font-bold tracking-wider">Month</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] font-bold text-zinc-400 font-mono">{calculateScheduledHours().year}h</span>
                <span className="text-[7px] text-zinc-700 uppercase font-bold tracking-wider">Year</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-950 rounded-xl border border-white/5 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-[0.3em]">Current Task</span>
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10">
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[7px] text-emerald-500 font-bold uppercase tracking-widest leading-none">Active</span>
              </div>
            </div>
            {currentTask ? (
              <>
                <div className="text-sm font-bold text-white mb-0.5 truncate tracking-tight">{currentTask.taskName}</div>
                <div className="text-[9px] text-zinc-500 font-medium">
                  {formatMinutesToTime(currentTask.endMinutes)} • {formatTimeRemaining(currentTask.endMinutes - currentMinutes)} left
                </div>
              </>
            ) : (
              <div className="text-[10px] text-zinc-600 font-medium italic">No active task</div>
            )}
          </div>

          <div className="bg-zinc-950 rounded-xl border border-white/5 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-[0.3em]">Next Task</span>
              <div className="px-1.5 py-0.5 rounded bg-zinc-800 text-[7px] text-zinc-400 font-bold uppercase tracking-widest leading-none">
                Pending
              </div>
            </div>
            {nextTask ? (
              <>
                <div className="text-sm font-bold text-white mb-0.5 truncate tracking-tight">{nextTask.taskName}</div>
                <div className="text-[9px] text-zinc-500 font-medium">
                  Starts {formatMinutesToTime(nextTask.startMinutes)} • in {formatTimeRemaining(nextTask.startMinutes - currentMinutes)}
                </div>
              </>
            ) : (
              <div className="text-[10px] text-zinc-600 font-medium italic">No upcoming tasks</div>
            )}
          </div>
        </div>

        {/* Schedule Grid - Compact and Professional */}
        <div className="bg-black border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse table-fixed min-w-[800px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="w-20 h-10 sticky left-0 z-30 bg-black/95 backdrop-blur-md border-r border-white/5">
                    <div className="flex items-center justify-center h-full">
                      <button
                        onClick={() => handleViewModeChange(viewMode === 'plan' ? 'log' : 'plan')}
                        className={`w-4 h-4 rounded-full border transition-all cursor-pointer ${
                          viewMode === 'plan'
                            ? 'bg-white border-white/30'
                            : 'bg-black border-white/20'
                        }`}
                      />
                    </div>
                  </th>
                  {days.map((day, idx) => {
                    const date = weekDates[idx];
                    const isToday = idx === todayDayIndex;
                    return (
                      <th
                        key={day}
                        onClick={(e) => handleDayHeaderClick(idx, e)}
                        className={`px-2 py-2 text-center transition-all cursor-pointer group/day hover:bg-white/[0.04] ${isToday ? 'bg-blue-500/[0.09] border-x border-blue-400/30' : ''} border-r border-white/5`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-[8px] font-bold uppercase tracking-[0.3em] ${isToday ? 'text-blue-500' : 'text-zinc-600'}`}>
                            {day.slice(0, 3)}
                          </span>
                          <span className={`text-base font-bold tracking-tight transition-colors group-hover/day:text-red-400 ${isToday ? 'text-white' : 'text-zinc-400'}`}>
                            {date.getDate()}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {timeBlocks.map((block, hourIndex) => (
                  <tr key={hourIndex} id={block.isCurrent ? "current-time-block" : undefined} className="group border-b border-white/[0.03]">
                    <td className={`w-20 h-10 px-3 text-[10px] font-bold sticky left-0 z-20 backdrop-blur-md border-r border-white/5 transition-all font-mono ${block.isCurrent ? 'bg-blue-500/[0.09] text-blue-400 border-y border-blue-400/30' : 'bg-black/95 text-zinc-600'}`}>
                      <div className="flex items-center gap-2">
                        {block.isCurrent && <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>}
                        {block.label}
                      </div>
                    </td>
                    {days.map((_, dayIndex) => {
                      const isToday = dayIndex === todayDayIndex;
                      return (
                        <td
                          key={dayIndex}
                          onClick={() => viewMode === 'plan' ? openCreateModal(dayIndex, hourIndex) : null}
                          className={`h-10 border-r border-white/5 ${viewMode === 'plan' ? 'cursor-pointer hover:bg-white/[0.05]' : ''} relative transition-all ${block.isCurrent && isToday ? 'bg-blue-500/[0.18] border border-blue-400/30' : block.isCurrent ? 'bg-blue-500/[0.09] border-y border-blue-400/30' : isToday ? 'bg-blue-500/[0.09] border-x border-blue-400/30' : ''}`}
                        >
                          {(() => {
                            const prevDayIndex = (dayIndex - 1 + 7) % 7;
                            const dEvents = [
                              ...displayEvents.filter(e => e.dayIndex === dayIndex).map(e => ({ ...e, realEvent: e })),
                              ...displayEvents.filter(e => e.dayIndex === prevDayIndex && e.endMinutes > 1740).map(e => ({ ...e, id: e.id + '-w', startMinutes: 300, endMinutes: 300 + (e.endMinutes - 1740), realEvent: e }))
                            ].sort((a, b) => a.startMinutes - b.startMinutes);
                            const merged = [];
                            dEvents.forEach(e => {
                              const last = merged[merged.length - 1];
                              if (last && last.taskName === e.taskName && last.color === e.color && last.endMinutes === e.startMinutes) {
                                last.endMinutes = e.endMinutes;
                              } else {
                                merged.push({ ...e, originalEvent: e.realEvent });
                              }
                            });

                            return merged.map(e => {
                              const hrStart = block.actualHour * 60;
                              const hrEnd = hrStart + 60;
                              const effEnd = Math.min(e.endMinutes, 1740);
                              if (e.startMinutes >= hrEnd || effEnd <= hrStart) return null;
                              const segStart = Math.max(e.startMinutes, hrStart);
                              const segEnd = Math.min(effEnd, hrEnd);
                              const top = ((segStart - hrStart) / 60) * 100;
                              const height = ((segEnd - segStart) / 60) * 100;
                              if (height <= 0) return null;
                              const isStart = segStart === e.startMinutes;
                              const isEnd = segEnd === effEnd;

                              const isToday = dayIndex === todayDayIndex;
                              const isPast = dayIndex < todayDayIndex || (isToday && accurateMinutes >= segEnd);
                              const isRunning = isToday && accurateMinutes >= segStart && accurateMinutes < segEnd;

                              let background = e.color;

                              if (isPast) {
                                background = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), ${e.color}`;
                              } else if (isRunning) {
                                const percentInDiv = ((accurateMinutes - segStart) / (segEnd - segStart)) * 100;
                                // Dim the time that has passed (top), keep the rest clear
                                background = `linear-gradient(to bottom, rgba(0,0,0,0.4) ${percentInDiv - 0.5}%, transparent ${percentInDiv + 0.5}%), ${e.color}`;
                              }

                              return (
                                <div
                                  key={e.id}
                                  onClick={(ev) => viewMode === 'plan' ? openEditModal(e.originalEvent, ev) : ev.stopPropagation()}
                                  onContextMenu={(ev) => {
                                    ev.preventDefault();
                                    if (viewMode === 'plan') setActiveWorkSession(e.originalEvent);
                                  }}
                                  className={`absolute left-0.5 right-0.5 ${height <= 60 ? 'z-20' : 'z-10'} p-1 flex items-center justify-center border border-white/10 shadow-sm transition-all ${viewMode === 'plan' ? 'hover:brightness-110 active:scale-95 cursor-pointer' : 'cursor-default'} ${isStart ? 'rounded-t-lg' : ''} ${isEnd ? 'rounded-b-lg' : ''} ${height <= 60 ? 'overflow-visible' : 'overflow-hidden'}`}
                                  style={{
                                    top: `${top}%`,
                                    height: `${height}%`,
                                    background: background,
                                    boxShadow: isRunning ? `0 0 15px ${e.color}33` : 'none'
                                  }}
                                >
                                  {isStart && (
                                    height > 60 ? (
                                      <div className="flex flex-col items-center justify-center w-full px-1">
                                        <span className="text-[9px] font-bold text-white truncate shadow-black/20 text-shadow">
                                          {e.taskName}
                                        </span>
                                        <span className="text-[7px] font-bold text-white/80 font-mono mt-0.5">
                                          {formatDuration(e.originalEvent.endMinutes - e.originalEvent.startMinutes)}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center w-full px-1 gap-1 overflow-hidden">
                                        <span className="text-[8px] font-bold text-white truncate whitespace-nowrap">
                                          {e.taskName}
                                        </span>
                                        <span className="text-[8px] font-bold text-white/70 whitespace-nowrap">
                                          — {formatDuration(e.originalEvent.endMinutes - e.originalEvent.startMinutes)}
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODALS - Refined for "Standard" Pro Look */}
      {(showTaskSelector || showEventModal || showNewTaskModal || showEditTaskModal || showDeleteModal || showSleepModal || showClearDayModal) && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModals} />
          <div className="relative w-full max-w-sm bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 scale-in-center">

            {showTaskSelector && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Select Task</h3>
                  <button onClick={() => { if (editingEvent) { setShowTaskSelector(false); setShowEventModal(true); } else { closeModals(); } }} className="text-zinc-500 hover:text-white cursor-pointer"><LocalIcon src={closeIcon} size={18} className="text-zinc-500 hover:text-white" /></button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1 mb-4">
                  {savedTasks.map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] transition-all group cursor-pointer" onClick={() => selectTask(t)}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                        <span className="text-xs font-bold text-white truncate">{t.name}</span>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); openEditTaskModal(t, e); }} className="p-0.5 text-zinc-500 hover:text-white cursor-pointer"><LocalIcon src={editIcon} size={11} className="text-zinc-500" /></button>
                        <button onClick={(e) => { e.stopPropagation(); confirmDeleteTask(t, e); }} className="p-0.5 text-zinc-500 hover:text-red-500 cursor-pointer"><LocalIcon src={trashIcon} size={11} className="text-zinc-500" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={createNewTask} className="w-full h-10 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors cursor-pointer">
                  <LocalIcon src={plusIcon} size={14} className="text-black" /> New Task Type
                </button>
              </>
            )}

            {showEventModal && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">{editingEvent ? 'Edit Entry' : 'New Entry'}</h3>
                  <button onClick={closeModals} className="text-zinc-500 hover:text-white cursor-pointer"><LocalIcon src={closeIcon} size={18} className="text-zinc-500" /></button>
                </div>
                <div className="space-y-5">
                  <div 
                    onClick={() => {
                      setShowEventModal(false);
                      setShowTaskSelector(true);
                    }}
                    className="p-3 bg-white/[0.03] border border-white/5 rounded-xl flex items-center justify-between cursor-pointer hover:bg-white/[0.06] hover:border-white/15 transition-all group"
                    title="Click to select or change task"
                  >
                    <div>
                      <label className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Task</label>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const matched = savedTasks.find(t => t.name.toLowerCase() === taskName.trim().toLowerCase());
                          return matched ? (
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: matched.color }} />
                          ) : null;
                        })()}
                        <span className="text-xs font-bold text-white tracking-tight">{taskName || 'Select a task...'}</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-white transition-colors bg-white/5 group-hover:bg-white/10 px-2 py-1 rounded-md border border-white/5">
                      Change
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Start</label>
                      <input type="text" value={startTime} onChange={(e) => handleStartTimeChange(e.target.value)} onClick={handleTimeClick} className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">End</label>
                      <input type="text" value={endTime} onChange={(e) => handleEndTimeChange(e.target.value)} onClick={handleTimeClick} className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:border-blue-500 outline-none transition-all" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Duration</label>
                    <div className="flex gap-1">
                      {[
                        { value: '0.25', label: '15m' },
                        { value: '0.5', label: '30m' },
                        { value: '0.75', label: '45m' },
                        { value: '1', label: '1h' },
                        { value: '1.5', label: '1h30' },
                        { value: '2', label: '2h' },
                        { value: '3', label: '3h' },
                        { value: '4', label: '4h' },
                      ].map(d => (
                        <button
                          key={d.value}
                          onClick={() => handleDurationChange(d.value)}
                          className={`flex-1 h-7 rounded-lg text-[9px] font-bold transition-all border cursor-pointer ${
                            selectedDuration === d.value
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 text-zinc-400 border-white/5 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Repeat</label>
                    <div className="flex gap-1">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <button key={i} onClick={() => toggleDay(i)} className={`flex-1 h-8 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${selectedDays.includes(i) ? 'bg-white text-black border-white' : 'bg-white/5 text-zinc-500 border-white/5 hover:border-white/20'}`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    {editingEvent && (
                      <button onClick={deleteEvent} className="h-10 px-4 border border-red-900/50 text-red-500 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-red-500/10 transition-all cursor-pointer">Delete</button>
                    )}
                    <button onClick={saveEvent} className="flex-1 h-10 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-200 transition-all cursor-pointer">Save Entry</button>
                  </div>
                </div>
              </>
            )}

            {showNewTaskModal && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">New Definition</h3>
                  <button onClick={() => setShowNewTaskModal(false)} className="text-zinc-500 hover:text-white cursor-pointer"><LocalIcon src={closeIcon} size={18} className="text-zinc-500" /></button>
                </div>
                <div className="space-y-4">
                  <input autoFocus type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="Task Name..." className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none transition-all" />
                  <label className="flex items-center gap-3 cursor-pointer group p-3 bg-white/[0.02] rounded-xl border border-white/5">
                    <input type="checkbox" checked={isWorkTask} onChange={(e) => setIsWorkTask(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-transparent text-blue-500 focus:ring-0" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Mark as Professional</span>
                  </label>
                  <button onClick={saveNewTask} className="w-full h-11 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all cursor-pointer">Authorize Task</button>
                </div>
              </>
            )}

            {showEditTaskModal && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Modify Identifier</h3>
                  <button onClick={() => setShowEditTaskModal(false)} className="text-zinc-500 hover:text-white cursor-pointer"><LocalIcon src={closeIcon} size={18} className="text-zinc-500" /></button>
                </div>
                <div className="space-y-4">
                  <input autoFocus type="text" value={editTaskName} onChange={(e) => setEditTaskName(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none transition-all" />
                  <label className="flex items-center gap-3 cursor-pointer group p-3 bg-white/[0.02] rounded-xl border border-white/5">
                    <input type="checkbox" checked={isWorkTask} onChange={(e) => setIsWorkTask(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-transparent text-blue-500 focus:ring-0" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Mark as Professional</span>
                  </label>
                  <button onClick={saveTaskEdit} className="w-full h-11 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all">Apply Changes</button>
                </div>
              </>
            )}

            {showDeleteModal && (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <LocalIcon src={trashIcon} size={20} className="text-red-500" />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">Delete Resource?</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed mb-6">This will purge <span className="text-white">"{taskToDelete?.name}"</span> and all schedules.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDeleteModal(false)} className="flex-1 h-10 border border-white/10 text-zinc-500 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-white/5 transition-all">Abort</button>
                  <button onClick={deleteTask} className="flex-1 h-10 bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-red-700 transition-all">Confirm</button>
                </div>
              </div>
            )}

            {showSleepModal && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Rest Cycle</h3>
                  <button onClick={() => setShowSleepModal(false)} className="text-zinc-500 hover:text-white"><LocalIcon src={closeIcon} size={18} className="text-zinc-500" /></button>
                </div>
                <div className="space-y-6">
                  <div className="text-center">
                    <label className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Shutdown Time</label>
                    <input type="text" value={sleepStart} onChange={(e) => { setSleepStart(e.target.value); localStorage.setItem('sleepStart', e.target.value); }} onClick={handleTimeClick} className="w-full bg-transparent border-b border-white/10 py-2 text-2xl font-mono font-bold text-white text-center focus:border-white outline-none transition-all" />
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Countdown</span>
                    <span className="text-2xl font-mono font-bold text-white tracking-tighter">{calculateTimeUntilSleep()}</span>
                  </div>
                  <button onClick={() => { localStorage.setItem('sleepStart', sleepStart); setShowSleepModal(false); }} className="w-full h-11 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all">Synchronize</button>
                </div>
              </>
            )}

            {showClearDayModal && (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <LocalIcon src={trashIcon} size={20} className="text-red-500" />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">Clear Day?</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed mb-6">
                  This will remove all <span className="text-white">{events.filter(e => e.dayIndex === dayToClear).length}</span> scheduled entries from <span className="text-white">{dayToClear !== null ? days[dayToClear] : ''}</span>.
                </p>
                <div className="flex gap-3">
                  <button onClick={closeModals} className="flex-1 h-10 border border-white/10 text-zinc-500 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-white/5 transition-all cursor-pointer">Abort</button>
                  <button onClick={clearDayEvents} className="flex-1 h-10 bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-red-700 transition-all cursor-pointer">Confirm</button>
                </div>
              </div>
            )}
          </div>
        </div>
        , document.body)}
    </div>
  );
};

export default DayPlanner;