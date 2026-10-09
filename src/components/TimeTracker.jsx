import Navbar from './Navbar'
import { useData } from '../contexts/DataContext';
import chevron from '../assets/icons/chevron-down.svg'
import Start from '../assets/icons/start.svg'
import Stop from '../assets/icons/stop.svg'
import Chart from '../assets/icons/chart.svg'
import Edit from '../assets/icons/edit.svg'
import Delete from '../assets/icons/delete.svg'
const fs = require('fs').promises;
const path = require('path');
const DATA_FILE_PATH = 'C:/Users/PC/Desktop/Database/TimeTracker/tasks.json';
const SESSION_FILE_PATH = 'C:/Users/PC/Desktop/Database/TimeTracker/sessions.json'
const TIMEGOALS_FILE_PATH = 'C:/Users/PC/Desktop/Database/TimeTracker/timeGoals.json'
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import '../assets/styles/timetracker.css'



const getYMD = (d = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

function Timetracker() {
    const { data: contextData, refreshData } = useData();
    const navigate = useNavigate();
    const [addTaskOpen, setAddTaskOpen] = useState(false)
    const [viewTasks, setViewTasks] = useState(false)
    const [taskNames, setTasknames] = useState([])
    const [input, setInput] = useState('');
    const ref = useRef();
    const [EditTask, setEditTask] = useState('')
    const [selectedTask, setSelectedTask] = useState('')
    const [editingInput, setEditingInput] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [selectedEditingDefault, setSelectedEditingDefault] = useState('')

    // Clock States
    const [seconds, setSeconds] = useState(0)
    const [running, setRunning] = useState(false)
    const [startTime, setStartTime] = useState(null)
    const [endTime, setEndTime] = useState(null)
    const intervalRef = useRef(null)
    const [message, setMessage] = useState(null)

    const messageRef = useRef(null);
    const [sessions, setSessions] = useState([]);


    // Stats States
    const [todayDuration, setTodayDuration] = useState(0);
    const [yesterdayDuration, setYesterdayDuration] = useState(0);
    const [weekDuration, setWeekDuration] = useState(0);
    const [monthDuration, setMonthDuration] = useState(0);
    const [yearDuration, setYearDuration] = useState(0);
    const [viewAnalytics, setViewAnalytics] = useState(false);

    // Analytics States
    const [selectedPeriod, setSelectedPeriod] = useState('All Time');
    const [analytics, setAnalytics] = useState({});
    const [statsMap, setStatsMap] = useState([]);
    const [mappedTotals, setMappedTotals] = useState({});

    const [displayByDay, setDisplayByDay] = useState(() => {
        return getYMD(new Date());
    });

    const [taskTotals, setTaskTotals] = useState({})
    const [heatmapTooltip, setHeatmapTooltip] = useState(null);

    const createSessionRef = useRef(null);
    const taskListRef = useRef(null);
    const addTaskRef = useRef(null);
    const timeGoalsRef = useRef(null);
    const sessionEditRef = useRef(null);







    useEffect(() => {
        const calculateDurations = async () => {
            try {
                const allSessions = await fetchSessions();
                const now = new Date()

                const todayStr = getYMD(now);


                const yesterday = new Date();
                yesterday.setDate(now.getDate() - 1)
                const yesterdayStr = getYMD(yesterday);

                const lastWeek = new Date();
                lastWeek.setDate(now.getDate() - 6)

                const sumDuration = (filterFn) => allSessions.filter(s => {
                    if (!s.date) return false;
                    const [y, m, d] = s.date.split('-').map(Number);
                    const sessionDate = new Date(y, m - 1, d);
                    return filterFn(s, sessionDate);
                }).reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

                let totalToday = sumDuration((s, sd) => s.date === todayStr);

                let totalYesterday = sumDuration((s, sd) => s.date === yesterdayStr);

                let totalWeek = sumDuration((s, sd) => {
                    const startOfWeek = new Date(now);
                    const day = startOfWeek.getDay();
                    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
                    startOfWeek.setDate(diff);
                    startOfWeek.setHours(0, 0, 0, 0);
                    return sd >= startOfWeek && sd <= now;
                });

                let totalMonth = sumDuration((s, sd) => {
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    return sd >= startOfMonth && sd <= now;
                });

                let totalYear = sumDuration((s, sd) => sd.getFullYear() === now.getFullYear());


                if (running) {
                    totalToday += seconds;
                    totalWeek += seconds;
                    totalMonth += seconds;
                    totalYear += seconds;
                }
                setTodayDuration(totalToday)
                setYesterdayDuration(totalYesterday)
                setWeekDuration(totalWeek)
                setMonthDuration(totalMonth)
                setYearDuration(totalYear)


            } catch (err) {
                console.error(err)
            }
        }
        calculateDurations()
    }, [seconds, running, contextData.time])

    const now = new Date();
    // Resume stopped task


    const handleStart = async (taskNameOverride = null) => {
        const isOverride = taskNameOverride && typeof taskNameOverride === 'string';
        const taskToUse = isOverride ? taskNameOverride : selectedTask;
        if (!taskToUse) {
            showMessage('Please Select a task first')
            return;
        }
        if (!running || isOverride) {
            const now = new Date()
            setStartTime(now)
            setSeconds(0)
            setRunning(true);
            if (intervalRef.current) clearInterval(intervalRef.current);
            // Use timestamp-based elapsed time to avoid drift
            const startMs = now.getTime();
            intervalRef.current = setInterval(() => {
                setSeconds(Math.floor((Date.now() - startMs) / 1000));
            }, 250)

            const taskId = taskNames.find(t => t.name === taskToUse)?.id;

            const session = {
                date: getYMD(now),
                durationSeconds: null,
                startTime: now.toISOString(),
                stopTime: null,
                taskId: taskId,
                taskName: taskToUse,

            };
            try {
                let sessions = []
                try {
                    const data = await fs.readFile(SESSION_FILE_PATH, 'utf-8')
                    sessions = data ? JSON.parse(data) : [];

                } catch (err) {
                    if (err.code !== 'ENOENT') throw err
                }

                sessions.push(session)
                const tempPath = SESSION_FILE_PATH + '.tmp';
                await fs.writeFile(tempPath, JSON.stringify(sessions, null, 2))
                await fs.rename(tempPath, SESSION_FILE_PATH)
                refreshData();
                showMessage('Sessions Started')
            } catch (err) {
                console.error(err)
                showMessage('failed to start session')
            }


        }
    }


    const handleStop = async () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        const end = new Date()
        // Compute actual elapsed from wall clock, not from the counter
        const actualElapsed = startTime ? Math.floor((end.getTime() - startTime.getTime()) / 1000) : seconds;
        setEndTime(end)
        setRunning(false)

        if (selectedTask && startTime) {
            const taskId = taskNames.find(t => t.name === selectedTask)?.id
            const session = {
                date: getYMD(startTime),
                durationSeconds: actualElapsed,
                startTime: startTime.toISOString(),
                stopTime: end.toISOString(),
                taskId: taskId,
                taskName: selectedTask,
            }
            await saveSession(session)
            showMessage('Session saved Successfully')
        }

        setSeconds(0)
        setSelectedTask(null)
        setStartTime(null)
        setEndTime(null)
    };

    const handleTaskSelection = async (task) => {
        if (running) {
            if (task.name === selectedTask) return;
            await handleStop();
            // Allow React state to flush after handleStop before starting new task
            await new Promise(r => setTimeout(r, 50));
        }
        setSelectedTask(task.name);
        handleStart(task.name);
    };

    const fetchSessions = async () => {
        return contextData.time?.allSessions || [];
    }

    useEffect(() => {
        const loadSessions = async () => {
            const allSessions = await fetchSessions();
            const filtered = allSessions.filter(s => s.date === displayByDay)
            setSessions(filtered.reverse());

            const totals = allSessions.reduce((acc, s) => {
                if (s.date === displayByDay) {
                    acc[s.taskName] = (acc[s.taskName] || 0) + (s.durationSeconds || 0)
                }
                return acc;
            }, {})

            setTaskTotals(totals)
        };
        loadSessions();
    }, [seconds, displayByDay, contextData.time]);

    useEffect(() => {
        const restore = async () => {
            try {
                const data = await fs.readFile(SESSION_FILE_PATH, 'utf-8');
                let sessions = [];
                try {
                    sessions = data ? JSON.parse(data) : [];
                } catch (err) {
                    console.error(err)
                    sessions = []
                }

                const ongoing = sessions.find(s => s.stopTime === null);

                if (ongoing) {
                    const start = new Date(ongoing.startTime)
                    const startMs = start.getTime();
                    const elapsed = Math.floor((Date.now() - startMs) / 1000);

                    setStartTime(start);
                    setSeconds(elapsed);
                    setSelectedTask(ongoing.taskName);
                    setRunning(true);

                    // Use timestamp-based elapsed time to avoid drift
                    intervalRef.current = setInterval(() => {
                        setSeconds(Math.floor((Date.now() - startMs) / 1000));
                    }, 250)
                    showMessage(`Resumed ${ongoing.taskName}`)
                }
            } catch (err) {
                console.error(err)
            }
        }
        restore();

        return () => clearInterval(intervalRef.current)
    }, [])

    const saveSession = async (session) => {
        const sessions = await fetchSessions()

        const ongoingIndex = sessions.findIndex(
            s => s.taskName === session.taskName && s.stopTime === null
        );

        if (ongoingIndex !== -1) {
            sessions[ongoingIndex] = session
        } else {
            sessions.push(session)
        }

        const tempPath = SESSION_FILE_PATH + '.tmp';
        await fs.writeFile(tempPath, JSON.stringify(sessions, null, 2))
        await fs.rename(tempPath, SESSION_FILE_PATH)
        refreshData();
    }

    // Time formatting
    const formatHrsMinsSecs = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = Math.floor(totalSeconds % 60)

        return (`${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
    }
    const formatHrsMins = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)

        return (hours < 2 ? `${hours}hr ${String(minutes).padStart(2, '0')}min` : `${hours}hrs ${String(minutes).padStart(2, '0')}min`)
    }

    const formatHrsMinsLarge = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)

        return (
            <div className='flex items-baseline space-x-1 font-mono'>
                <span className='text-3xl font-bold'>{hours}</span>
                <span className='text-neutral-500 text-xs font-bold uppercase'>h</span>
                <span className='text-3xl font-bold ml-1'>{String(minutes).padStart(2, '0')}</span>
                <span className='text-neutral-500 text-xs font-bold uppercase'>m</span>
            </div>)
    }

    const setElapsedTime = (date) => {
        if (!date) return '--:--';
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${hours}:${minutes}`;
    }

    const displayTime = `${setElapsedTime(startTime)} - ${setElapsedTime(running ? new Date() : endTime)}`


    // Open and close view added task modal
    useEffect(() => {
        const handleOpen = (e) => {
            if (viewTasks && taskListRef.current && !taskListRef.current.contains(e.target)) {
                setViewTasks(false)
            }
        };
        if (viewTasks) document.addEventListener('mousedown', handleOpen);
        return () => document.removeEventListener('mousedown', handleOpen)
    }, [viewTasks])

    // Open and close add task modal
    useEffect(() => {
        const handleOpen = (e) => {
            if (addTaskOpen && addTaskRef.current && !addTaskRef.current.contains(e.target)) {
                setAddTaskOpen(false);
            }
        };
        if (addTaskOpen) document.addEventListener('mousedown', handleOpen);
        return () => {
            document.removeEventListener('mousedown', handleOpen);
        }
    }, [addTaskOpen])
    const [sessionEditView, setSessionEditView] = useState(false);


    useEffect(() => {
        const handleOpen = (e) => {
            if (sessionEditView && sessionEditRef.current && !sessionEditRef.current.contains(e.target)) {
                setSessionEditView(false);
            }
        };
        if (sessionEditView) document.addEventListener('mousedown', handleOpen);
        return () => {
            document.removeEventListener('mousedown', handleOpen);
        }
    }, [sessionEditView])


    const directoryCheck = async () => {
        const dir = path.dirname(DATA_FILE_PATH)
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            console.error('Error Creating Directory', error)
            setMessage(`Error Creating Directory ${error.message}`)
        }
    };

    const saveTaskName = async () => {
        try {
            await directoryCheck();
            const newTaskName = {
                id: uuidv4(),
                name: input.trim(),
                color: '#2563eb' // Default blue
            };
            if (!newTaskName.name) {
                showMessage('Task name cannot be empty');
                return;
            }

            let taskNames = [];
            try {
                const data = await fs.readFile(DATA_FILE_PATH, 'utf-8');
                // Safely parse: if empty or invalid, default to []
                taskNames = data.trim() ? JSON.parse(data) : [];
                if (!Array.isArray(taskNames)) taskNames = [];
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error('Read error:', error);
                    showMessage('Failed to read tasks');
                    return;
                }
                taskNames = [];
            }

            const updatedTaskNames = [...taskNames, newTaskName];
            const tempPath = DATA_FILE_PATH + '.tmp';
            await fs.writeFile(tempPath, JSON.stringify(updatedTaskNames, null, 2));
            await fs.rename(tempPath, DATA_FILE_PATH);
            await refreshData();
            setTasknames(updatedTaskNames);
            setInput('');
            setAddTaskOpen(false);
            showMessage('Task saved successfully!');

        } catch (error) {
            console.error('Save error:', error);
            showMessage(`Failed to save: ${error.message}`);
        }
    };

    const [dayGoal, setDayGoal] = useState('');
    const [weekGoal, setWeekGoal] = useState('');
    const [monthGoal, setMonthGoal] = useState('');
    const [yearGoal, setYearGoal] = useState('');


    const saveTimeGoals = async (dayGoal, weekGoal, monthGoal, yearGoal) => {
        try {
            const goals = { dayGoal, weekGoal, monthGoal, yearGoal }
            const tempPath = TIMEGOALS_FILE_PATH + '.tmp';
            await fs.writeFile(tempPath, JSON.stringify(goals, null, 2))
            await fs.rename(tempPath, TIMEGOALS_FILE_PATH)
            await refreshData();
        } catch (err) {
            console.error(err)
        }
    }


    useEffect(() => {
        const loadGoals = async () => {
            try {
                const data = await fs.readFile(TIMEGOALS_FILE_PATH, 'utf-8');
                const goals = data.trim() ? JSON.parse(data) : {};
                setDayGoal(goals.dayGoal || '');
                setWeekGoal(goals.weekGoal || '')
                setMonthGoal(goals.monthGoal || '')
                setYearGoal(goals.yearGoal || '')

            } catch (err) {
                console.error(err)
            }


        };

        loadGoals();
    }, [])

    const [dayDone, setDayDone] = useState();
    const [dayLeft, setDayLeft] = useState();
    const [weekLeft, setWeekLeft] = useState();
    const [weekDone, setWeekDone] = useState();
    const [monthLeft, setMonthLeft] = useState();
    const [monthDone, setMonthDone] = useState();
    const [yearLeft, setYearLeft] = useState();
    const [yearDone, setYearDone] = useState();

    useEffect(() => {
        if (dayGoal && todayDuration !== undefined) {
            const dayGoalSeconds = parseInt(dayGoal) * 3600
            const dayLeft = Math.max(0, dayGoalSeconds - todayDuration);
            const dayPercent = Math.round((todayDuration / dayGoalSeconds) * 100); // assuming goals in hours
            setDayLeft(dayLeft);
            setDayDone(dayPercent);
        }
        if (weekGoal && weekDuration !== undefined) {
            const weekGoalSeconds = parseInt(weekGoal) * 3600
            const weekLeft = Math.max(0, weekGoalSeconds - weekDuration);
            const weekPercent = Math.round((weekDuration / weekGoalSeconds) * 100);
            setWeekLeft(weekLeft)
            setWeekDone(weekPercent)
        }
        if (monthGoal && monthDuration !== undefined) {
            const monthGoalSeconds = parseInt(monthGoal) * 3600
            const monthLeft = Math.max(0, monthGoalSeconds - monthDuration);
            const yearPercent = Math.round((monthDuration / monthGoalSeconds) * 100);
            setMonthLeft(monthLeft)
            setMonthDone(yearPercent)
        }
        if (yearGoal && yearDuration !== undefined) {
            const yearGoalSeconds = parseInt(yearGoal) * 3600
            const yearLeft = Math.max(0, yearGoalSeconds - yearDuration)
            const yearDone = Math.round((yearDuration / yearGoalSeconds) * 100)
            setYearLeft(yearLeft);
            setYearDone(yearDone)
        }
    }, [dayGoal, todayDuration, weekGoal, weekDuration, monthGoal, monthDuration, yearGoal, yearDuration]);


    const fetchTaskNames = async () => {
        try {
            await directoryCheck();
            const data = await fs.readFile(DATA_FILE_PATH, 'utf-8');
            const parsed = data.trim() ? JSON.parse(data) : [];
            setTasknames(Array.isArray(parsed) ? parsed : []);
        } catch (error) {
            if (error.code === 'ENOENT') {
                setTasknames([]);
            } else {
                console.error('Corrupted tasks.json:', error);
                showMessage('Tasks file corrupted. Starting fresh.');
                setTasknames([]);
                try {
                    await fs.unlink(DATA_FILE_PATH);
                } catch { }
            }
        }
    };

    const updatedTaskName = async (taskId, newName) => {
        newName = newName?.trim();
        if (!newName) return;

        const tasks = JSON.parse(await fs.readFile(DATA_FILE_PATH, 'utf-8'));
        const updatedTasks = tasks.map(t => (
            t.id === taskId ? { ...t, name: newName } : t
        ))

        const tempPath = DATA_FILE_PATH + '.tmp';
        await fs.writeFile(tempPath, JSON.stringify(updatedTasks, null, 2))
        await fs.rename(tempPath, DATA_FILE_PATH)
        await refreshData();
        setTasknames(updatedTasks)
        showMessage('Task Renamed Successfully!')
        setViewTasks(false)
    }

    const deleteTask = async (taskId) => {
        const tasks = JSON.parse(await fs.readFile(DATA_FILE_PATH, 'utf-8'));
        const updatedTasks = tasks.filter(t => (
            t.id !== taskId
        ))

        const tempPath = DATA_FILE_PATH + '.tmp';
        await fs.writeFile(tempPath, JSON.stringify(updatedTasks, null, 2))
        await fs.rename(tempPath, DATA_FILE_PATH)
        await refreshData();
        setTasknames(updatedTasks)
        showMessage('Task Deleted Successfully!')
        setViewTasks(false)
    }

    useEffect(() => {
        fetchTaskNames();
    }, []);




    const showMessage = (text) => {
        setMessage(text)
        clearTimeout(messageRef.current);
        messageRef.current = setTimeout(() => setMessage(null), 1000)
    }

    // Conditional by date rendering for sessions




    const diffToday = todayDuration - yesterdayDuration;
    const diffSign = diffToday >= 0 ? '+' : '-'
    const diffColor = diffToday >= 0 ? 'text-green-500' : 'text-red-500'

    const handleDay = (direction) => {
        const date = new Date(displayByDay)
        date.setDate(date.getDate() + direction)
        setDisplayByDay(date.toISOString().split('T')[0])
    }

    const handleJournalClick = async () => {
        const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const JOURNAL_DB = 'C:\\Users\\PC\\Desktop\\database\\DailyJournal';

        try {
            await fs.mkdir(JOURNAL_DB, { recursive: true });
            const files = await fs.readdir(JOURNAL_DB);
            const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.tmp'));

            let targetEntry = null;
            let targetFile = null;

            for (const file of jsonFiles) {
                try {
                    const content = await fs.readFile(path.join(JOURNAL_DB, file), 'utf8');
                    const entry = JSON.parse(content);
                    if (entry.title === todayStr) {
                        targetEntry = entry;
                        targetFile = file;
                        break;
                    }
                } catch (e) { }
            }

            const now = new Date().toISOString();
            if (targetEntry) {
                targetEntry.updatedAt = now;
                const tempPath = path.join(JOURNAL_DB, `${targetFile}.tmp`);
                await fs.writeFile(tempPath, JSON.stringify(targetEntry, null, 2));
                await fs.rename(tempPath, path.join(JOURNAL_DB, targetFile));
            } else {
                const newId = uuidv4();
                const newEntry = {
                    id: newId,
                    title: todayStr,
                    content: "",
                    createdAt: now,
                    updatedAt: now
                };
                const fileName = `${newId}.json`;
                const tempPath = path.join(JOURNAL_DB, `${fileName}.tmp`);
                await fs.writeFile(tempPath, JSON.stringify(newEntry, null, 2));
                await fs.rename(tempPath, path.join(JOURNAL_DB, fileName));
            }
            navigate('/DailyJournal');
        } catch (err) {
            console.error("Journal navigation error:", err);
            navigate('/DailyJournal');
        }
    };

    useEffect(() => {
        const fetchAnalytics = async () => {
            const now = new Date();
            const allSessions = await fetchSessions();

            let startDate, endDate;

            switch (selectedPeriod) {

                case 'yesterday':
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - 1);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(startDate);
                    endDate.setHours(23, 59, 59, 999);
                    break;

                case 'thisWeek':
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - now.getDay());
                    startDate.setHours(0, 0, 0, 0);
                    endDate = now;
                    break;

                case 'lastWeek':
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - now.getDay() - 7);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 6);
                    endDate.setHours(23, 59, 59, 999);
                    break;

                case 'thisMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = now;
                    break;

                case 'lastMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                    endDate.setHours(23, 59, 59, 999);
                    break;

                case 'thisYear':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = now;
                    break;

                case 'lastYear':
                    startDate = new Date(now.getFullYear() - 1, 0, 1);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(now.getFullYear() - 1, 11, 31);
                    endDate.setHours(23, 59, 59, 999);
                    break;
                case 'allTime':
                    startDate = null;
                    endDate = null;
                    break;
                default:
                    startDate = null;
                    endDate = null;
                    break;

            }

            const totals = allSessions.reduce((acc, s) => {
                if (!s.date) return acc;
                // Parse "YYYY-MM-DD" manually to avoid UTC/Local confusion
                const [y, m, d] = s.date.split('-').map(Number);
                const sessionDate = new Date(y, m - 1, d); // Local time 00:00:00

                const isWithinRange =
                    (!startDate || sessionDate >= startDate) &&
                    (!endDate || sessionDate <= endDate);

                if (isWithinRange) {
                    acc[s.taskName] = (acc[s.taskName] || 0) + (s.durationSeconds || 0);
                }
                return acc;
            }, {})

            setAnalytics(totals);
        };
        fetchAnalytics();

    }, [selectedPeriod, contextData.time])


    // Mapped out 365 days of the year'
    useEffect(() => {
        const year = new Date().getFullYear();
        const daysArray = Array.from({ length: 364 }, (_, index) => {
            const date = new Date(year, 0, 1 + index);
            return { date, index }
        })

        setStatsMap(daysArray)
    }, [])

    // 365 day fetching and mapping
    useEffect(() => {
        const mapDailyTotals = async () => {
            try {
                const allSessions = await fetchSessions();
                const totals = {};

                allSessions.forEach(session => {
                    if (session.durationSeconds && session.date) {
                        totals[session.date] = (totals[session.date] || 0) + session.durationSeconds
                    }
                });
                if (running && startTime) {
                    const today = getYMD(new Date());
                    totals[today] = (totals[today] || 0) + seconds;
                }
                setMappedTotals(totals)
            } catch (err) {
                console.error(err)
            }
        };
        mapDailyTotals()
    }, [running, seconds, contextData.time])

    const [viewTimeGoals, setViewTimeGoals] = useState(false)

    useEffect(() => {
        const handleOpen = (e) => {
            if (viewTimeGoals && timeGoalsRef.current && !timeGoalsRef.current.contains(e.target)) {
                setViewTimeGoals(false)
            }
        };
        if (viewTimeGoals) document.addEventListener('mousedown', handleOpen);
        return () => document.removeEventListener('mousedown', handleOpen)
    }, [viewTimeGoals])

    // useEffect for stats


    ///////////////////////////////////////////////////// editing sessions /////////////////////////////////

    // edit session states
    const [selectedSession, setSelectedSession] = useState(null);


    const [editStartHour, setEditStartHour] = useState('')
    const [editStartMinute, setEditStartMinute] = useState('')
    const [editStartDate, setEditStartDate] = useState('')

    const [editStopHour, setEditStopHour] = useState('')
    const [editStopMinute, setEditStopMinute] = useState('')
    const [editStopDate, setEditStopDate] = useState('')
    const [editTaskName, setEditTaskName] = useState('')

    // Pre-fill edit fields when a session is selected
    useEffect(() => {
        if (selectedSession) {
            setEditTaskName(selectedSession.taskName || '');
            const start = new Date(selectedSession.startTime);
            setEditStartHour(String(start.getHours()).padStart(2, '0'));
            setEditStartMinute(String(start.getMinutes()).padStart(2, '0'));
            setEditStartDate(getYMD(start));

            if (selectedSession.stopTime) {
                const stop = new Date(selectedSession.stopTime);
                setEditStopHour(String(stop.getHours()).padStart(2, '0'));
                setEditStopMinute(String(stop.getMinutes()).padStart(2, '0'));
                setEditStopDate(getYMD(stop));
            } else {
                setEditStopHour('');
                setEditStopMinute('');
                setEditStopDate('');
            }
        }
    }, [selectedSession]);

    const handleOpenActiveSessionEdit = async () => {
        if (running && selectedTask) {
            try {
                const allSessions = await fetchSessions();
                const active = allSessions.find(s => s.taskName === selectedTask && s.stopTime === null);
                if (active) {
                    setSelectedSession(active);
                } else {
                    setSelectedSession({
                        taskName: selectedTask,
                        taskId: taskNames.find(t => t.name === selectedTask)?.id,
                        startTime: (startTime || new Date()).toISOString(),
                        stopTime: null,
                        durationSeconds: seconds,
                        date: getYMD(startTime || new Date())
                    });
                }
                setSessionEditView(true);
            } catch (e) {
                setSelectedSession({
                    taskName: selectedTask,
                    taskId: taskNames.find(t => t.name === selectedTask)?.id,
                    startTime: (startTime || new Date()).toISOString(),
                    stopTime: null,
                    durationSeconds: seconds,
                    date: getYMD(startTime || new Date())
                });
                setSessionEditView(true);
            }
        }
    };

    // edit session function
    const editSession = async () => {
        try {
            const allSessions = await fetchSessions();
            // find sessions
            const startHour = editStartHour !== '' ? parseInt(editStartHour) || 0 : new Date(selectedSession.startTime).getHours();
            const startMinute = editStartMinute !== '' ? parseInt(editStartMinute) || 0 : new Date(selectedSession.startTime).getMinutes();
            const baseStartDate = editStartDate ? new Date(editStartDate) : new Date(selectedSession.startTime);

            const newStart = new Date(baseStartDate);
            newStart.setHours(startHour, startMinute, 0, 0);

            const isRunningSession = running && selectedSession.taskName === selectedTask && selectedSession.stopTime === null

            let newStop = null;
            let durationSeconds = null;

            if (!isRunningSession && (editStopDate || selectedSession.stopTime)) {

                const stopHour = editStopHour !== '' ? parseInt(editStopHour) || 0 : new Date(selectedSession.stopTime || Date.now()).getHours();
                const stopMinute = editStopMinute !== '' ? parseInt(editStopMinute) || 0 : new Date(selectedSession.stopTime || Date.now()).getMinutes();
                const baseStopDate = editStopDate ? new Date(editStopDate) : new Date(selectedSession.stopTime || new Date());


                newStop = new Date(baseStopDate);
                newStop.setHours(stopHour, stopMinute, 0, 0);

                durationSeconds = Math.max(0, Math.floor((newStop - newStart) / 1000))

            }

            const chosenTask = editTaskName.trim() || selectedSession.taskName;
            const chosenTaskId = taskNames.find(t => t.name === chosenTask)?.id || selectedSession.taskId;

            const updatedSessions = allSessions.map(s => {
                const origStart = new Date(s.startTime).getTime();
                const origStop = s.stopTime ? new Date(s.stopTime).getTime() : null;
                const selStart = new Date(selectedSession.startTime).getTime();
                const selStop = selectedSession.stopTime ?
                    new Date(selectedSession.stopTime).getTime() : null

                if (origStart === selStart && origStop === selStop) {
                    return {
                        ...s,
                        taskName: chosenTask,
                        taskId: chosenTaskId,
                        startTime: newStart.toISOString(),
                        stopTime: isRunningSession ? null : (newStop ? newStop.toISOString() : s.stopTime),
                        durationSeconds: isRunningSession ? null : durationSeconds,
                        date: getYMD(newStart),
                    };
                }
                return s;
            });


            await fs.writeFile(SESSION_FILE_PATH, JSON.stringify(updatedSessions, null, 2))
            await refreshData();

            if (isRunningSession) {
                setSelectedTask(chosenTask);
                const elapsed = Math.floor((Date.now() - newStart.getTime()) / 1000)
                setStartTime(newStart);
                setSeconds(Math.max(0, elapsed));

                if (intervalRef.current) clearInterval(intervalRef.current);
                const startMs = newStart.getTime();
                intervalRef.current = setInterval(() => {
                    setSeconds(Math.floor((Date.now() - startMs) / 1000));
                }, 250)
            }
            setSessionEditView(false);
            showMessage('Session Updated!')

            setEditStartHour('');
            setEditStartMinute('');
            setEditStartDate('');
            setEditStopHour('');
            setEditStopMinute('');
            setEditStopDate('');
            setEditTaskName('');


        } catch (err) {
            console.error(err)
            showMessage('Session Failed')
        }

    }

    // Create session states

    const [viewCreateSession, setViewCreateSession] = useState(false)

    useEffect(() => {
        const handleOpen = (e) => {
            if (viewCreateSession && createSessionRef.current && !createSessionRef.current.contains(e.target)) {
                setViewCreateSession(false)
            }
        };
        if (viewCreateSession) document.addEventListener('mousedown', handleOpen);
        return () => document.removeEventListener('mousedown', handleOpen)
    }, [viewCreateSession])

    const [createStartHour, setCreateStartHour] = useState('')
    const [createStartMinute, setCreateStartMinute] = useState('')
    const [createStartDate, setCreateStartDate] = useState('')

    const [createStopHour, setCreateStopHour] = useState('')
    const [createStopMinute, setCreateStopMinute] = useState('')
    const [createStopDate, setCreateStopDate] = useState('')

    const [createSessionSelectTask, setCreateSessionSelectTask] = useState('')


    // Create a session function

    const createSession = async () => {
        try {
            const allSessions = await fetchSessions();

            const startHour = parseInt(createStartHour);
            const startMinute = createStartMinute ? parseInt(createStartMinute) : 0;

            const stopHour = parseInt(createStopHour);
            const stopMinute = createStopMinute ? parseInt(createStopMinute) : 0;

            const startDate = createStartDate ? new Date(createStartDate) : new Date();
            const stopDate = createStopDate ? new Date(createStopDate) : new Date();

            const newStart = new Date(startDate);
            newStart.setHours(startHour, startMinute, 0, 0);

            const newStop = new Date(stopDate);
            newStop.setHours(stopHour, stopMinute, 0, 0);


            const durationSeconds = Math.max(0, Math.floor(newStop - newStart) / 1000)

            const newSession = {
                date: getYMD(startDate),
                durationSeconds,
                startTime: newStart.toISOString(),
                stopTime: newStop.toISOString(),
                taskId: createSessionSelectTask.id,
                taskName: createSessionSelectTask.name

            }
            await fs.writeFile(SESSION_FILE_PATH, JSON.stringify([...allSessions, newSession], null, 2));
            await refreshData();
            showMessage('Session Created!')
            setViewCreateSession(false)

        } catch (err) {
            console.error(err);
            showMessage('Session Creation Failed')
        }
    }



    // delete session function

    const deleteSession = async () => {
        try {
            const allSessions = await fetchSessions();

            const updatedSessions = allSessions.filter(s => {
                const sameSession =
                    s.startTime === selectedSession.startTime &&
                    (s.stopTime === selectedSession.stopTime || (s.stopTime == null && selectedSession.startTime == null));

                return !sameSession
            });
            await fs.writeFile(SESSION_FILE_PATH, JSON.stringify(updatedSessions, null, 2))
            await refreshData();
            setSessions(updatedSessions.filter(s => s.date === displayByDay).reverse());
            setTaskTotals(prev => {
                const newTotals = { ...prev };
                delete newTotals[selectedSession.taskName]
                return newTotals
            });
            setSelectedSession(null)
            showMessage('Session deleted!')

        } catch (err) {
            showMessage('failed to delete session')
            console.error(err)
        }
    }


    return (
        <>
            <main className='bg-black min-h-screen text-white font-sans selection:bg-white/10'>
                <div className='flex flex-col max-w-[1920px] mx-auto pl-15 pr-4 py-4 w-full space-y-4'>

                    {/*Header Components*/}
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 w-full text-sm mb-2'>

                        {/* Active Task Status */}
                        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 rounded-xl shadow-sm flex flex-col h-44 col-span-1 md:col-span-2 space-y-3">
                            <div className='flex flex-col w-full space-y-3'>
                                <div className='flex justify-between items-center w-full'>
                                    <span className='text-[10px] uppercase tracking-wider text-neutral-500 font-bold'>Session Status</span>
                                    <div className='flex items-center space-x-2'>
                                        <span className='bg-neutral-900 px-2 py-0.5 rounded text-[11px] border border-neutral-800 text-neutral-400'>{displayTime}</span>
                                        <button
                                            className='px-2 py-0.5 bg-white text-black text-[11px] rounded hover:bg-neutral-200 transition-colors font-medium cursor-pointer'
                                            onClick={() => setAddTaskOpen(!addTaskOpen)}
                                        >
                                            + NEW TASK
                                        </button>
                                    </div>
                                </div>

                                <div className='flex items-center space-x-1.5 w-full'>
                                    <button
                                        className={`flex-1 text-left px-3 py-2 rounded-lg border transition-all cursor-pointer ${selectedTask ? 'border-neutral-700 bg-neutral-900 text-neutral-200' : 'border-dashed border-neutral-800 text-neutral-500'} hover:border-neutral-600`}
                                        onClick={() => {
                                            if (running) {
                                                handleOpenActiveSessionEdit();
                                            } else {
                                                setViewTasks(true);
                                            }
                                        }}
                                    >
                                        <span className='truncate block'>{selectedTask || 'Select a task to start tracking'}</span>
                                    </button>
                                    {running && (
                                        <button
                                            onClick={handleOpenActiveSessionEdit}
                                            title="Change or edit active session"
                                            className="p-2 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0"
                                        >
                                            <img src={Edit} className="h-3.5 w-3.5 opacity-70 hover:opacity-100" alt="Edit Session" />
                                        </button>
                                    )}
                                </div>

                                <div className='flex w-full space-x-2'>
                                    <button
                                        onClick={handleStart}
                                        className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg transition-all cursor-pointer ${running ? 'bg-neutral-900 text-neutral-600 cursor-not-allowed' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'}`}
                                        disabled={running}
                                    >
                                        <img src={Start} className={`h-3 ${running ? 'opacity-20' : 'opacity-80'}`} alt="Start" />
                                        <span className='text-xs font-bold uppercase tracking-tight'>Start</span>
                                    </button>

                                    <button
                                        onClick={handleStop}
                                        className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg transition-all cursor-pointer ${running ? 'bg-white text-black font-bold' : 'bg-neutral-900 text-neutral-700 cursor-not-allowed opacity-50'}`}
                                        disabled={!running}
                                    >
                                        <img src={Stop} className={`h-3 ${running ? 'invert' : 'opacity-20'}`} alt="Stop" />
                                        <span className='text-xs uppercase tracking-tight'>Stop</span>
                                    </button>

                                    <div className='flex-[0.8] flex items-center justify-center bg-neutral-900 rounded-lg border border-neutral-800 text-xs font-mono tabular-nums text-neutral-300'>
                                        {formatHrsMinsSecs(seconds)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        {[
                            { label: 'Today', duration: todayDuration, left: dayLeft, done: dayDone, border: 'border-emerald-500/20' },
                            { label: 'Yesterday', duration: yesterdayDuration, diff: diffToday, border: 'border-neutral-800' },
                            { label: 'This Week', duration: weekDuration, left: weekLeft, done: weekDone, border: 'border-neutral-800' },
                            { label: 'This Month', duration: monthDuration, left: monthLeft, done: monthDone, border: 'border-neutral-800' },
                            { label: 'This Year', duration: yearDuration, left: yearLeft, done: yearDone, border: 'border-neutral-800', extraClass: 'flex' }
                        ].map((stat, idx) => (
                            <div
                                key={idx}
                                className={`bg-[#0a0a0a] p-4 rounded-xl border ${stat.border} shadow-sm h-44 flex flex-col justify-between hover:bg-[#0f0f0f] transition-all cursor-pointer ${stat.extraClass || ''}`}
                                onClick={() => setViewTimeGoals(true)}
                            >
                                <div>
                                    <div className='flex justify-between items-start'>
                                        <span className='text-[10px] uppercase tracking-wider text-neutral-500 font-bold'>{stat.label}</span>
                                        {stat.diff !== undefined && (
                                            <span className={`${diffColor} text-[10px] font-bold tabular-nums`}>
                                                {diffSign}{formatHrsMins(Math.abs(stat.diff))}
                                            </span>
                                        )}
                                    </div>
                                    <div className='mt-2'>
                                        {formatHrsMinsLarge(stat.duration)}
                                    </div>
                                </div>

                                <div className='space-y-1.5'>
                                    {stat.left !== undefined && (
                                        <div className='flex justify-between items-center text-[10px]'>
                                            <span className='text-neutral-500'>REMAINING</span>
                                            <span className='text-neutral-300 font-mono'>{formatHrsMins(stat.left)}</span>
                                        </div>
                                    )}
                                    {stat.done !== undefined && (
                                        <div className='w-full bg-neutral-900 h-1 rounded-full overflow-hidden'>
                                            <div
                                                className='bg-neutral-400 h-full transition-all duration-500'
                                                style={{ width: `${Math.min(100, stat.done)}%` }}
                                            />
                                        </div>
                                    )}
                                    <span className='text-[9px] text-neutral-600 block text-right font-medium'>{stat.duration > 0 ? 'LOGGED TIME' : 'NO DATA'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/*Under Components*/}
                    <div className='grid grid-cols-2 gap-4 flex-1'>
                        {/* Time Blocks / Totals */}
                        <div className='bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden flex flex-col h-[400px]'>
                            <div className='px-4 py-2 border-b border-[#1a1a1a] flex justify-between items-center h-10'>
                                <span className='text-[10px] uppercase tracking-wider text-neutral-500 font-bold'>Task Allocation</span>
                                <div className='flex items-center space-x-2'>
                                    <button
                                        onClick={handleJournalClick}
                                        className='px-3 py-1 bg-neutral-900 border border-neutral-800 rounded text-[10px] font-bold uppercase tracking-tight hover:bg-neutral-800 transition-colors cursor-pointer text-neutral-400'
                                    >
                                        Journal
                                    </button>
                                    <button
                                        className='px-3 py-1 bg-neutral-900 border border-neutral-800 rounded text-[10px] font-bold uppercase tracking-tight hover:bg-neutral-800 transition-colors cursor-pointer'
                                        onClick={() => setViewAnalytics(!viewAnalytics)}
                                    >
                                        {viewAnalytics ? 'Summary' : 'Analytics'}
                                    </button>
                                </div>
                            </div>

                            <div className='flex-1 overflow-auto p-2 space-y-1 custom-scrollbar'>
                                {viewAnalytics ? (
                                    <div className='flex flex-col h-full'>
                                        <div className='flex justify-between px-3 py-1.5 items-center mb-2'>
                                            <span className='text-[10px] text-neutral-400 font-medium'>PERIOD</span>
                                            <select
                                                value={selectedPeriod}
                                                onChange={(e) => setSelectedPeriod(e.target.value)}
                                                className='bg-black border border-neutral-800 text-[10px] p-1 rounded font-bold text-neutral-300'
                                            >
                                                <option value="allTime">All Time</option>
                                                <option value="yesterday">Yesterday</option>
                                                <option value="thisWeek">This Week</option>
                                                <option value="lastWeek">Last Week</option>
                                                <option value="thisMonth">This Month</option>
                                                <option value="lastMonth">Last Month</option>
                                                <option value="thisYear">This Year</option>
                                                <option value="lastYear">Last Year</option>
                                            </select>
                                        </div>

                                        <div className='flex-1 space-y-1'>
                                            {Object.keys(analytics).length === 0 ? (
                                                <div className='h-full flex items-center justify-center text-neutral-600 text-xs italic'>No data available</div>
                                            ) : (
                                                [...Object.entries(analytics)].reverse().map(([task, total]) => (
                                                    <div className='bg-neutral-900/50 border border-neutral-900 px-3 py-2 rounded-lg flex justify-between items-center group hover:border-neutral-800 transition-colors' key={task}>
                                                        <span className='text-xs text-neutral-300'>{task}</span>
                                                        <span className='text-xs font-mono tabular-nums text-neutral-400'>
                                                            {running && task === selectedTask ? formatHrsMins(seconds) : formatHrsMins(total)}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    Object.entries(taskTotals).length > 0 ? (
                                        Object.entries(taskTotals).map(([task, total]) => (
                                            <div key={task} className='px-3 py-2.5 bg-neutral-900/40 border border-neutral-900/60 rounded-lg flex justify-between items-center group hover:bg-neutral-900 transition-all'>
                                                <div className='flex flex-col'>
                                                    <span className='text-xs font-semibold text-neutral-200'>{task}</span>
                                                    <span className='text-[9px] text-neutral-600 uppercase tracking-tighter'>Logged Today</span>
                                                </div>
                                                <span className='text-xs font-mono tabular-nums text-neutral-400 bg-black px-2 py-1 rounded border border-neutral-900'>
                                                    {running && task === selectedTask ? formatHrsMins(seconds + total) : formatHrsMins(total)}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className='h-full flex flex-col items-center justify-center text-neutral-700 space-y-2 opacity-50'>
                                            <span className='text-[10px] font-bold uppercase tracking-widest'>Idle</span>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Daily Timeline */}
                        <div className='bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden flex flex-col h-[400px]'>
                            <div className='px-4 py-2 border-b border-[#1a1a1a] flex justify-between items-center h-10'>
                                <div className='flex items-center space-x-3'>
                                    <span className='text-[10px] uppercase tracking-wider text-neutral-500 font-bold'>Session Logs</span>
                                    <span className='text-[10px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded'>
                                        {new Date(displayByDay).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                <div className='flex items-center space-x-1'>
                                    <button
                                        className='w-6 h-6 flex items-center justify-center rounded border border-[#1a1a1a] text-neutral-500 hover:bg-[#1a1a1a] hover:text-white transition-all cursor-pointer'
                                        onClick={() => handleDay(-1)}
                                    >
                                        ‹
                                    </button>
                                    <div className="relative group">
                                        <input
                                            type='date'
                                            className='bg-transparent border border-[#1a1a1a] text-[9px] font-bold py-1 px-1.5 rounded text-neutral-400 hover:border-neutral-700 focus:border-neutral-600 outline-none transition-all cursor-pointer uppercase'
                                            value={displayByDay}
                                            onChange={(e) => setDisplayByDay(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        className='w-6 h-6 flex items-center justify-center rounded border border-[#1a1a1a] text-neutral-500 hover:bg-[#1a1a1a] hover:text-white transition-all cursor-pointer'
                                        onClick={() => handleDay(1)}
                                    >
                                        ›
                                    </button>
                                </div>
                            </div>

                            <div className='flex-1 overflow-auto p-2 space-y-1.5 custom-scrollbar'>
                                {sessions.map((session, index) => (
                                    <div
                                        key={index}
                                        onClick={() => { setSelectedSession(session); setSessionEditView(true); }}
                                        className={`px-3 py-2 rounded-lg border flex justify-between items-center cursor-pointer transition-all ${session.taskName == selectedTask && session.stopTime == null ? 'bg-white border-white text-black' : 'bg-neutral-900/40 border-neutral-900 hover:border-neutral-700'}`}
                                    >
                                        <div className='flex flex-col'>
                                            <span className={`text-xs font-bold truncate max-w-[140px] ${session.taskName == selectedTask && session.stopTime == null ? 'text-black' : 'text-neutral-200'}`}>
                                                {session.taskName}
                                            </span>
                                            <span className={`text-[10px] font-mono tabular-nums ${session.taskName == selectedTask && session.stopTime == null ? 'text-neutral-700' : 'text-neutral-500'}`}>
                                                {setElapsedTime(new Date(session.startTime))} - {session.stopTime == null && session.taskName == selectedTask ? setElapsedTime(new Date()) : setElapsedTime(new Date(session.stopTime))}
                                            </span>
                                        </div>
                                        <div className={`text-xs font-mono font-bold tabular-nums ${session.taskName == selectedTask && session.stopTime == null ? 'text-black' : 'text-neutral-400'}`}>
                                            {session.stopTime == null && session.taskName === selectedTask ? formatHrsMinsSecs(seconds) : formatHrsMinsSecs(session.durationSeconds)}
                                        </div>
                                    </div>
                                ))}
                                {sessions.length === 0 && (
                                    <div className='h-full flex items-center justify-center text-neutral-700 italic text-xs'>No sessions logged for this day</div>
                                )}
                            </div>

                            <button
                                className='m-2 py-1.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-[10px] font-bold uppercase tracking-widest text-neutral-400 rounded-lg transition-all cursor-pointer'
                                onClick={() => setViewCreateSession(true)}
                            >
                                Manual Entry
                            </button>
                        </div>
                    </div>

                    {/* Heatmap Section */}
                    <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 lg:p-6 rounded-xl shadow-sm">
                        <div className='flex justify-between items-center mb-4'>
                            <span className='text-[10px] uppercase tracking-wider text-neutral-500 font-bold'>Annual Activity</span>
                            <div className='flex items-center space-x-2'>
                                <span className='text-[9px] text-neutral-600'>LESS</span>
                                <div className='flex space-x-1'>
                                    <div className='w-2 h-2 rounded-sm bg-neutral-900 border border-neutral-800'></div>
                                    <div className='w-2 h-2 rounded-sm bg-emerald-400'></div>
                                    <div className='w-2 h-2 rounded-sm bg-emerald-600'></div>
                                    <div className='w-2 h-2 rounded-sm bg-emerald-800'></div>
                                    <div className='w-2 h-2 rounded-sm bg-emerald-950'></div>
                                </div>
                                <span className='text-[9px] text-neutral-600'>MORE</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-52 gap-px justify-center">
                            {statsMap.map((block, i) => {
                                const dateStr = getYMD(block.date);
                                const isToday = dateStr === getYMD(new Date());
                                const d = mappedTotals[dateStr] || 0;

                                return (
                                    <div
                                        key={i}
                                        onClick={() => setDisplayByDay(dateStr)}
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setHeatmapTooltip({
                                                date: block.date,
                                                dateStr,
                                                duration: d,
                                                x: rect.left + rect.width / 2,
                                                y: rect.top,
                                            });
                                        }}
                                        onMouseLeave={() => setHeatmapTooltip(null)}
                                        className={`aspect-square rounded-[2px] transition-all duration-300 cursor-pointer ${(() => {
                                            if (d >= 18000) return 'bg-emerald-950';
                                            if (d >= 14400) return 'bg-emerald-900';
                                            if (d >= 10800) return 'bg-emerald-800';
                                            if (d >= 7200) return 'bg-emerald-700';
                                            if (d >= 3600) return 'bg-emerald-600';
                                            if (d > 0) return 'bg-emerald-400/60';
                                            return 'bg-neutral-900 border border-neutral-800/10';
                                        })()} ${isToday ? 'ring-1 ring-emerald-400 ring-offset-1 ring-offset-[#0a0a0a] z-10 scale-125 rounded-[1px]' : ''} hover:scale-150 hover:z-10 hover:shadow-lg`}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>











            </main>

            {/* Fancy Professional Annual Activity Tooltip */}
            {heatmapTooltip && createPortal(
                <div
                    className="fixed z-[999] pointer-events-none transition-all duration-150 ease-out"
                    style={{
                        left: `${Math.max(100, Math.min(window.innerWidth - 100, heatmapTooltip.x))}px`,
                        top: `${heatmapTooltip.y - 12}px`,
                        transform: 'translate(-50%, -100%)',
                    }}
                >
                    <div className="relative bg-[#0c0c0c]/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl min-w-[180px] max-w-[240px] animate-in fade-in zoom-in-95 duration-150">
                        {/* Header: Date with clean typography */}
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                {heatmapTooltip.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {heatmapTooltip.dateStr === getYMD(new Date()) && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    Today
                                </span>
                            )}
                        </div>

                        {/* Time logged & status pill */}
                        <div className="flex items-baseline gap-2">
                            {heatmapTooltip.duration > 0 ? (
                                <>
                                    <span className="text-base font-black font-mono tracking-tight text-white">
                                        {formatHrsMins(heatmapTooltip.duration)}
                                    </span>
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                        Logged
                                    </span>
                                </>
                            ) : (
                                <span className="text-xs font-medium text-neutral-500 italic">
                                    No time logged
                                </span>
                            )}
                        </div>

                        {/* Intensity / Details Footer */}
                        {heatmapTooltip.duration > 0 && (
                            <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[9px] text-neutral-500">
                                <span className="uppercase tracking-widest text-[8px] font-bold">Total Time</span>
                                <span className="font-mono font-bold text-neutral-300">
                                    {(heatmapTooltip.duration / 3600).toFixed(1)} hrs
                                </span>
                            </div>
                        )}

                        {/* Downward pointer caret */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-[#0c0c0c] border-r border-b border-white/10 rotate-45" />
                    </div>
                </div>,
                document.body
            )}

            {message &&
                <div className='fixed w-full inset-0  top-0 p-3  rounded-xl   flex justify-center h-fit  transition-transform ease-in-out duration-300 z-100'>
                    <div className='bg-slate-700/40 border border-slate-500/20 flex justify-center w-5/10 rounded-xl'>{message}</div>
                </div>
            }

            {/*  Session time Edit */}
            {sessionEditView && selectedSession && createPortal(
                <>
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999]"
                        onMouseDown={(e) => { if (e.target === e.currentTarget) { setSessionEditView(false) } }}
                    />
                    <div
                        className="fixed top-1/2 left-1/2 z-[10000] w-full max-w-xs px-4"
                        style={{
                            transform: 'translate(-50%, -50%)',
                            position: 'fixed'
                        }}
                    >
                        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl p-5 shadow-2xl space-y-5" ref={sessionEditRef} onClick={(e) => e.stopPropagation()} >
                            <div className='flex flex-col space-y-4'>
                                <div className='space-y-3'>
                                    <div className='flex justify-between items-center'>
                                        <span className='text-[10px] uppercase tracking-widest text-neutral-500 font-bold'>Edit Session</span>
                                        {selectedSession && !selectedSession.stopTime && running && (
                                            <span className='text-[9px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold'>
                                                Active / Logging
                                            </span>
                                        )}
                                    </div>

                                    <div className='space-y-1.5'>
                                        <label className='text-[10px] text-neutral-400 font-medium block uppercase tracking-tight'>Session Logged</label>
                                        <select
                                            value={editTaskName}
                                            onChange={(e) => setEditTaskName(e.target.value)}
                                            className='bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-xs text-white w-full outline-none focus:border-neutral-600 cursor-pointer'
                                        >
                                            {taskNames.map((t, idx) => (
                                                <option key={t.id || idx} value={t.name}>{t.name}</option>
                                            ))}
                                            {editTaskName && !taskNames.some(t => t.name === editTaskName) && (
                                                <option value={editTaskName}>{editTaskName}</option>
                                            )}
                                        </select>
                                    </div>

                                    <div className='space-y-1.5'>
                                        <label className='text-[10px] text-neutral-400 font-medium block uppercase tracking-tight'>Start Time</label>
                                        <div className='flex space-x-2'>
                                            <input type='date' className='bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-white w-full' style={{ colorScheme: 'dark' }} value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                                        </div>
                                        <div className='flex space-x-2 items-center'>
                                            <input type='number' placeholder='HH' value={editStartHour} onChange={(e) => setEditStartHour(e.target.value)} className='bg-neutral-900 border border-neutral-800 rounded p-1.5 text-xs text-center w-full min-w-0 tabular-nums font-mono text-neutral-200 focus:border-neutral-600 outline-none' />
                                            <input type='number' placeholder='MM' value={editStartMinute} onChange={(e) => setEditStartMinute(e.target.value)} className='bg-neutral-900 border border-neutral-800 rounded p-1.5 text-xs text-center w-full min-w-0 tabular-nums font-mono text-neutral-200 focus:border-neutral-600 outline-none' />
                                        </div>
                                    </div>

                                    <div className='space-y-1.5'>
                                        <label className='text-[10px] text-neutral-400 font-medium block uppercase tracking-tight'>Stop Time</label>
                                        <div className='flex space-x-2'>
                                            <input type='date' className='bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-white w-full' style={{ colorScheme: 'dark' }} value={editStopDate} onChange={(e) => setEditStopDate(e.target.value)} />
                                        </div>
                                        <div className='flex space-x-2 items-center'>
                                            <input type='number' placeholder='HH' value={editStopHour} onChange={(e) => setEditStopHour(e.target.value)} className='bg-neutral-900 border border-neutral-800 rounded p-1.5 text-xs text-center w-full min-w-0 tabular-nums font-mono text-neutral-200 focus:border-neutral-600 outline-none' />
                                            <input type='number' placeholder='MM' value={editStopMinute} onChange={(e) => setEditStopMinute(e.target.value)} className='bg-neutral-900 border border-neutral-800 rounded p-1.5 text-xs text-center w-full min-w-0 tabular-nums font-mono text-neutral-200 focus:border-neutral-600 outline-none' />
                                        </div>
                                    </div>
                                </div>

                                <div className='flex flex-col space-y-2 pt-2'>
                                    <button className='w-full py-2 rounded-lg bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 transition-colors cursor-pointer' onClick={editSession}>Apply Changes</button>
                                    <button className='w-full py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-500 text-[10px] font-bold uppercase tracking-widest hover:bg-rose-950/20 hover:text-rose-500 hover:border-rose-900/50 transition-all cursor-pointer' onClick={deleteSession}>Delete Session</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>, document.body
            )}

            {/* View time goals Modal*/}
            {viewTimeGoals && createPortal(
                <>
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999]"
                        onMouseDown={(e) => { if (e.target === e.currentTarget) { setViewTimeGoals(false) } }}
                    />
                    <div
                        className="fixed top-1/2 left-1/2 z-[10000] w-full max-w-xs px-4"
                        style={{
                            transform: 'translate(-50%, -50%)',
                            position: 'fixed'
                        }}
                    >
                        <div className='bg-[#0a0a0a] border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-6' ref={timeGoalsRef} onClick={(e) => e.stopPropagation()}>
                            <div className='space-y-4'>
                                <div className='text-center space-y-1'>
                                    <span className='text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold'>Configuration</span>
                                    <h3 className='text-sm font-bold text-neutral-200'>Time Objectives</h3>
                                </div>

                                <div className='grid grid-cols-2 gap-4'>
                                    {[
                                        { label: 'Daily', state: dayGoal, set: setDayGoal },
                                        { label: 'Weekly', state: weekGoal, set: setWeekGoal },
                                        { label: 'Monthly', state: monthGoal, set: setMonthGoal },
                                        { label: 'Yearly', state: yearGoal, set: setYearGoal }
                                    ].map((goal, i) => (
                                        <div key={i} className='space-y-1.5'>
                                            <label className='text-[10px] text-neutral-500 font-medium block uppercase tracking-tighter'>{goal.label} (HRS)</label>
                                            <input
                                                type='number'
                                                placeholder={goal.state || '0'}
                                                onChange={(e) => goal.set(e.target.value)}
                                                className='bg-black border border-neutral-800 rounded-lg p-2 text-xs text-center w-full tabular-nums font-mono text-neutral-200 focus:border-neutral-600 outline-none'
                                            />
                                        </div>
                                    ))}
                                </div>

                                <button
                                    className='w-full py-2.5 bg-neutral-100 text-black text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-white transition-colors mt-2 cursor-pointer'
                                    onClick={() => { saveTimeGoals(dayGoal, weekGoal, monthGoal, yearGoal); setViewTimeGoals(false); }}
                                >
                                    Save Objectives
                                </button>
                            </div>
                        </div>
                    </div>
                </>, document.body
            )}

            {/* Create Session Modal */}
            {viewCreateSession && createPortal(
                <>
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999]"
                        onMouseDown={(e) => { if (e.target === e.currentTarget) { setViewCreateSession(false) } }}
                    />
                    <div
                        className="fixed top-1/2 left-1/2 z-[10000] w-full max-w-xs px-4"
                        style={{
                            transform: 'translate(-50%, -50%)',
                            position: 'fixed'
                        }}
                    >
                        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-5" ref={viewTasks ? null : createSessionRef} onClick={(e) => e.stopPropagation()}>
                            <div className='text-center space-y-1'>
                                <span className='text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold'>Session Logger</span>
                                <h3 className="text-sm font-bold text-neutral-200">Manual Entry</h3>
                            </div>

                            <div className='flex flex-col space-y-4'>
                                <div className='space-y-3'>
                                    <div className='space-y-1.5'>
                                        <label className='text-[10px] text-neutral-400 font-medium block uppercase tracking-tight'>Associated Task</label>
                                        <button
                                            className='bg-black border border-neutral-800 p-2.5 w-full rounded-lg text-xs flex items-center justify-between hover:border-neutral-700 transition-colors text-neutral-300 cursor-pointer'
                                            onClick={() => setViewTasks(true)}
                                        >
                                            <span className='truncate'>{createSessionSelectTask ? createSessionSelectTask.name : 'Select Task'}</span>
                                            <span className='text-[10px] text-neutral-600'>▼</span>
                                        </button>
                                    </div>

                                    <div className='space-y-1.5'>
                                        <label className='text-[10px] text-neutral-400 font-medium block uppercase tracking-tight'>Start Time</label>
                                        <div className='flex space-x-2'>
                                            <input type='date' value={createStartDate} onChange={(e) => setCreateStartDate(e.target.value)} className='bg-black border border-neutral-800 rounded px-2 py-1.5 text-xs text-white w-full' />
                                        </div>
                                        <div className='flex space-x-2 items-center'>
                                            <input onChange={(e) => setCreateStartHour(e.target.value)} placeholder='HH' value={createStartHour} type='number' className='bg-neutral-900 border border-neutral-800 rounded p-1.5 text-xs text-center w-full min-w-0 tabular-nums font-mono text-neutral-200 focus:border-neutral-600 outline-none' />
                                            <input onChange={(e) => setCreateStartMinute(e.target.value)} placeholder='MM' type='number' value={createStartMinute} className='bg-neutral-900 border border-neutral-800 rounded p-1.5 text-xs text-center w-full min-w-0 tabular-nums font-mono text-neutral-200 focus:border-neutral-600 outline-none' />
                                        </div>
                                    </div>

                                    <div className='space-y-1.5'>
                                        <label className='text-[10px] text-neutral-400 font-medium block uppercase tracking-tight'>Stop Time</label>
                                        <div className='flex space-x-2'>
                                            <input type='date' value={createStopDate} onChange={(e) => setCreateStopDate(e.target.value)} className='bg-black border border-neutral-800 rounded px-2 py-1.5 text-xs text-white w-full' />
                                        </div>
                                        <div className='flex space-x-2 items-center'>
                                            <input onChange={(e) => setCreateStopHour(e.target.value)} value={createStopHour} placeholder='HH' type='number' className='bg-neutral-900 border border-neutral-800 rounded p-1.5 text-xs text-center w-full min-w-0 tabular-nums font-mono text-neutral-200 focus:border-neutral-600 outline-none' />
                                            <input onChange={(e) => setCreateStopMinute(e.target.value)} value={createStopMinute} placeholder='MM' type='number' className='bg-neutral-900 border border-neutral-800 rounded p-1.5 text-xs text-center w-full min-w-0 tabular-nums font-mono text-neutral-200 focus:border-neutral-600 outline-none' />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className='w-full py-2.5 bg-white text-black text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer'
                                    onClick={() => createSession()}
                                >
                                    Record Session
                                </button>
                            </div>
                        </div>
                    </div>
                </>, document.body
            )}

            {viewTasks && createPortal(
                <>
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[11000]"
                        onMouseDown={(e) => { if (e.target === e.currentTarget) { setViewTasks(false) } }}
                    />
                    <div
                        className="fixed top-1/2 left-1/2 z-[11001] w-full max-w-sm px-4"
                        style={{
                            transform: 'translate(-50%, -50%)',
                            position: 'fixed'
                        }}
                    >
                        <div className='bg-[#0a0a0a] border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[400px]' ref={taskListRef} onClick={(e) => e.stopPropagation()}>
                            <div className='px-5 py-4 border-b border-neutral-800 flex justify-between items-center'>
                                <span className='text-[10px] uppercase tracking-[0.1em] text-neutral-500 font-bold'>Classifications</span>
                                <span className='text-xs tabular-nums text-neutral-600'>{taskNames.length} items</span>
                            </div>

                            <div className='flex-1 overflow-y-auto p-2 custom-scrollbar'>
                                <div className='flex flex-col space-y-1'>
                                    {/* Task List */}
                                    {taskNames.map((task) => (
                                        <div className='flex items-center p-1 rounded-lg hover:bg-neutral-900 group transition-colors cursor-pointer' key={task.id}>
                                            <button
                                                className='flex-1 text-left px-3 py-2 text-xs text-neutral-300 font-medium cursor-pointer'
                                                onClick={() => {
                                                    if (viewCreateSession) {
                                                        setCreateSessionSelectTask(task);
                                                    } else {
                                                        handleTaskSelection(task);
                                                    }
                                                    setViewTasks(false);
                                                }}
                                            >
                                                {task.name}
                                            </button>

                                            <div className='flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-2 space-x-1'>
                                                <button
                                                    className='p-1.5 hover:bg-neutral-800 rounded-md transition-colors cursor-pointer'
                                                    onClick={() => {
                                                        setEditingInput(true);
                                                        setSelectedEditingDefault(task.name);
                                                        setEditingId(task.id);
                                                        setEditTask(task.name);
                                                    }}
                                                >
                                                    <img src={Edit} className='h-3 opacity-50' alt="Edit" />
                                                </button>
                                                <button
                                                    className='p-1.5 hover:bg-neutral-800 rounded-md transition-colors cursor-pointer'
                                                    onClick={() => deleteTask(task.id)}
                                                >
                                                    <img src={Delete} className='h-3 opacity-50' alt="Delete" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Editing Overlay (Simplified) */}
                            {editingInput && (
                                <div className='absolute inset-0 bg-black/95 z-10 flex flex-col p-6 rounded-2xl justify-center space-y-4'>
                                    <span className='text-[10px] uppercase tracking-widest text-neutral-500 font-bold text-center'>Rename Classification</span>
                                    <input
                                        className='bg-neutral-900 border border-neutral-800 p-3 rounded-lg text-xs text-neutral-200 focus:border-neutral-600 outline-none'
                                        placeholder={selectedEditingDefault}
                                        value={EditTask}
                                        onChange={(e) => setEditTask(e.target.value)}
                                        autoFocus
                                    />
                                    <div className='flex space-x-2'>
                                        <button className='flex-1 py-2 bg-white text-black text-xs font-bold rounded-lg cursor-pointer' onClick={() => { updatedTaskName(editingId, EditTask); setEditingInput(false); }}>Update</button>
                                        <button className='flex-1 py-2 bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs rounded-lg cursor-pointer' onClick={() => setEditingInput(false)}>Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>, document.body
            )}

            {/* POPUP WINDOW TO CREATE TASKS */}
            {addTaskOpen && createPortal(
                <>
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999]"
                        onMouseDown={(e) => { if (e.target === e.currentTarget) { setAddTaskOpen(false) } }}
                    />
                    <div
                        className="fixed top-1/2 left-1/2 z-[10000] w-full max-w-xs px-4"
                        style={{
                            transform: 'translate(-50%, -50%)',
                            position: 'fixed'
                        }}
                    >
                        <div className="bg-[#0a0a0a] border border-neutral-800 p-6 rounded-2xl shadow-2xl space-y-5" ref={addTaskRef} onClick={(e) => e.stopPropagation()}>
                            <div className='text-center space-y-1'>
                                <span className='text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold'>Definition</span>
                                <h3 className="text-sm font-bold text-neutral-200">New Category</h3>
                            </div>

                            <input
                                placeholder='Project or Task name'
                                type='text'
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                autoFocus
                                className='w-full bg-neutral-900 border border-neutral-800 p-3 rounded-lg text-xs text-neutral-200 focus:border-neutral-600 outline-none transition-colors'
                            />

                            <button
                                onClick={() => { saveTaskName(); setAddTaskOpen(false); }}
                                className="w-full bg-white text-black py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-neutral-200 transition-colors cursor-pointer"
                            >
                                Register Task
                            </button>
                        </div>
                    </div>
                </>, document.body
            )}
        </>

    )
}
export default Timetracker