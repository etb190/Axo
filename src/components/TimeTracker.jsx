import Navbar from './Navbar'
import chevron from '../assets/icons/chevron-down.svg'
import Start from '../assets/icons/start.svg'
import Stop from '../assets/icons/stop.svg'
import Chart from '../assets/icons/chart.svg'
import Edit from '../assets/icons/edit.svg'
import Delete from '../assets/icons/delete.svg'
const fs = require('fs').promises;
const path = require('path');
const DATA_FILE_PATH = 'D:/Axo/TimeTracker/tasks.json';
const SESSION_FILE_PATH = 'D:/Axo/TimeTracker/sessions.json'
const TIMEGOALS_FILE_PATH = 'D:/Axo/TimeTracker/timeGoals.json'
import React, {useEffect, useState, useRef} from 'react';
import { v4 as uuidv4 } from 'uuid';
import { createSession } from 'react-router-dom'
import '../assets/styles/timetracker.css'



function Timetracker() {
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
        const today = new Date();
        return today.toISOString().split('T')[0]
    });

    const [taskTotals, setTaskTotals] = useState({})

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

                const todayStr = now.toISOString().split('T')[0];
                

                const yesterday = new Date();
                yesterday.setDate(now.getDate() - 1)
                const yesterdayStr = yesterday.toISOString().split('T')[0]

                const lastWeek = new Date();
                lastWeek.setDate(now.getDate() - 6)

                const sumDuration = (filterFn) => allSessions.filter(filterFn).reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

                let totalToday = sumDuration(s => s.date === todayStr)
                

                let totalYesterday = sumDuration(s => s.date === yesterdayStr)
                

                let totalWeek = sumDuration(s => {
                    const d = new Date(s.date);
                    return d >= lastWeek && d <= now;
                });
                

                let totalMonth = sumDuration(s => {
                    const d = new Date(s.date);
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                })
                

                let totalYear = sumDuration(s => new Date(s.date).getFullYear() === now.getFullYear())
                

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
    }, [seconds, running, taskTotals])
    
    const now = new Date();
    // Resume stopped task
    

    const handleStart = async () => {
        if (!selectedTask) { 
            showMessage('Please Select a task first')
            return;
        } 
    if (!running) { 
        const now = new Date()
        setStartTime(now)
        setRunning(true);
        intervalRef.current = setInterval(() => {
            setSeconds(prev => prev +1);
        }, 1000)

        const taskId = taskNames.find(t => t.content === selectedTask)?.id;

        const session = {
                date: new Date().toISOString().split('T')[0],
                durationSeconds: null,
                startTime: now.toISOString(),
                stopTime: null,
                taskId: taskId,
                taskName: selectedTask,

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
            await fs.writeFile(SESSION_FILE_PATH, JSON.stringify(sessions, null, 2))
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

           const end = new Date()
           setEndTime(end)
           setRunning(false)

           if (selectedTask) {
            const taskId = taskNames.find(t => t.content === selectedTask)?.id
            const session = {
                date: new Date().toISOString().split('T')[0],
                durationSeconds: seconds,
                startTime: startTime.toISOString(),
                stopTime: end.toISOString(),
                taskId: taskId,
                taskName: selectedTask,
            }
            await saveSession(session)
            showMessage('Session saved Successfully')
            
           }

        }
        
        
        setSeconds(0)
        setSelectedTask(null)
        setStartTime(null)
        setEndTime(null)
    };

    const fetchSessions = async () => {
        try {
            const data = await fs.readFile(SESSION_FILE_PATH, 'utf-8');
             return data ? JSON.parse(data)  : []
        } catch (err) {
            if (err.code === 'ENOENT') return []
            console.error(err)
            return []
        }
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
        }, {} )

        setTaskTotals(totals)
    };
    loadSessions();
}, [seconds, displayByDay, taskTotals]);

useEffect(() => {
        const restore = async () => {
            try {
                const data = await fs.readFile(SESSION_FILE_PATH, 'utf-8');
                let sessions =  [];
                try {
                    sessions = data ? JSON.parse(data) : [];
                } catch (err) {
                    console.error(err)
                    sessions = []
                }

                const ongoing = sessions.find(s => s.stopTime === null);

                if (ongoing) {
                    const start = new Date(ongoing.startTime)
                    const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);

                    setStartTime(start);
                    setSeconds(elapsed);
                    setSelectedTask(ongoing.taskName);
                    setRunning(true);

                    intervalRef.current = setInterval(() => {
                        setSeconds(prev => prev + 1)
                    }, 1000)
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
        
        await fs.writeFile(SESSION_FILE_PATH, JSON.stringify(sessions, null, 2))
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
        <div className='flex space-x-1'>
            <div className='flex items-baseline 1'>
                
                <div className='text-4xl'>{hours}</div>
                {hours < 2 ? 
                <div className='text-gray-300 text-xl'>hr</div> : <div className='text-gray-300 text-xl'>hrs</div>
                }
                       
            </div>
            <div className='flex items-baseline'>
                <div className='text-4xl'>{String(minutes).padStart(2, '0')}</div>
                <div className='tex-xl'>mins</div>
            </div>

            
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
            await fs.mkdir(dir, {recursive: true});
        } catch (error) {
            console.error('Error Creating Directory', error)
            setMessage(`Error Creating Directory ${error.message}`)
        }
    };

    const saveTaskName = async () => {
    try {
        await directoryCheck();
        const newTaskName = { id: uuidv4(), content: input.trim() };
        if (!newTaskName.content) {
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
            if (error.code !== 'ENOENT') {$
                console.error('Read error:', error);
                showMessage('Failed to read tasks');
                return;
            }
            taskNames = [];
        }

        const updatedTaskNames = [...taskNames, newTaskName];
        await fs.writeFile(DATA_FILE_PATH, JSON.stringify(updatedTaskNames, null, 2));
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
            const goals = {dayGoal, weekGoal, monthGoal, yearGoal}
            await fs.writeFile(TIMEGOALS_FILE_PATH, JSON.stringify(goals, null, 2))
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
            // Optionally: backup or delete corrupted file
            try {
                await fs.unlink(DATA_FILE_PATH);
            } catch {}
        }
    }
};

    const updatedTaskName = async (taskId, newName) => {
        newName = newName?.trim();
        if (!newName) return;

        const tasks = JSON.parse(await fs.readFile(DATA_FILE_PATH, 'utf-8'));
        const updatedTasks = tasks.map(t => (
            t.id === taskId ? {...t, content: newName} : t
        ))

        await fs.writeFile(DATA_FILE_PATH, JSON.stringify(updatedTasks, null, 2))
        setTasknames(updatedTasks)
        showMessage('Task Renamed Successfully!')
        setViewTasks(false)
        
    }

    const deleteTask = async (taskId) => {
        const tasks = JSON.parse(await fs.readFile(DATA_FILE_PATH, 'utf-8'));
        const updatedTasks = tasks.filter(t => (
            t.id !== taskId
        ))

        await fs.writeFile(DATA_FILE_PATH, JSON.stringify(updatedTasks, null, 2))
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
const diffColor = diffToday >= 0 ? 'text-green-500': 'text-red-500'

const handleDay = (direction) => {
    const date = new Date(displayByDay)
    date.setDate(date.getDate() + direction)
    setDisplayByDay(date.toISOString().split('T')[0])
}

useEffect(() => {
    const fetchAnalytics = async () => {
        const now = new Date();
         const allSessions = await fetchSessions();

         let startDate, endDate;

         switch (selectedPeriod) {
            
            case 'yesterday':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 1);
                endDate = startDate
                break;
                
            case 'thisWeek':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay());
                endDate = now;
                break;

            case 'lastWeek':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay() - 7)
                endDate = new Date(startDate)
                endDate.setDate(startDate.getDate() + 6)
                break;

            case 'thisMonth':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = now;
                break;
            
            case 'lastMonth':
               startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
               endDate = new Date(now.getFullYear, now.getMonth(), 0);
               break;
            
            case 'thisYear':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = now;
                break;
            case 'lastYear':
                startDate = new Date(now.getFullYear() - 1, 0, 1);
                endDate = new Date(now.getFullYear(), 0, 0);
                break;
            case 'allTime':
                startDate = null;
                endDate = null;
            break;
            default :
            startDate = null;
                endDate = null;
            break;
            
         }

         const totals = allSessions.reduce((acc, s) => {
            const sessionDate = new Date(s.date);
            if ((!startDate || sessionDate >= startDate) && (!endDate || sessionDate <= endDate)) {
                acc[s.taskName] = (acc[s.taskName] || 0) + (s.durationSeconds || 0);
            }
            return acc;  
         }, {})

         setAnalytics(totals);
};
fetchAnalytics();

}, [selectedPeriod, taskTotals])


// Mapped out 365 days of the year'
useEffect(() => {
    const year = new Date().getFullYear();
    const daysArray = Array.from({length: 364}, (_, index) => {
    const date = new Date(year, 0, 1 + index );
    return {date, index}
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
            const today = new Date().toISOString().split('T')[0];
            totals[today] = (totals[today] || 0) + seconds;
        }
        setMappedTotals(totals)
        } catch (err) {
            console.error(err)
        }
    };
    mapDailyTotals()
}, [running, seconds, taskTotals])

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

// edit session function
const editSession = async () => {
    try {
   const allSessions =  await fetchSessions();
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
    

    const updatedSessions = allSessions.map(s => {
        const origStart = new Date(s.startTime).getTime();
        const origStop = s.stopTime ? new Date(s.stopTime).getTime() : null;
        const selStart = new Date(selectedSession.startTime).getTime();
        const selStop = selectedSession.stopTime ? 
            new Date(selectedSession.stopTime).getTime() : null
        
            if (origStart === selStart && origStop === selStop) {
                return {
                    ...s,
                startTime: newStart.toISOString(),
                stopTime: isRunningSession ? null : (newStop ? newStop.toISOString() : s.stopTime),
                durationSeconds: isRunningSession ? null : durationSeconds,
                date: newStart.toISOString().split('T')[0],
                };
            }
            return s;
    });


    await fs.writeFile(SESSION_FILE_PATH, JSON.stringify(updatedSessions, null, 2))

    if (isRunningSession) {
        const elapsed = Math.floor((Date.now() - newStart.getTime()) / 1000)
        setStartTime(newStart);
        setSeconds(Math.max(0, elapsed));

        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            setSeconds(prev => prev + 1)
        }, 1000)
    }
    setSessionEditView(false);
    showMessage('Session Updated!')

    setEditStartHour('');
        setEditStartMinute('');
        setEditStartDate('');
        setEditStopHour('');
        setEditStopMinute('');
        setEditStopDate('');
   

   } catch (err) {
    console.error(err)
    showMessage('Session Failed')
   }
    
}

    // Create session states

const [viewCreateSession , setViewCreateSession] = useState(false)

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
            
            
            const durationSeconds = Math.max(0, Math.floor(newStop - newStart)/ 1000)

            const newSession = {
                date: newStart.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
                durationSeconds,
                startTime: newStart.toISOString(),
                stopTime: newStop.toISOString(),
                taskId: createSessionSelectTask.id,
                taskName: createSessionSelectTask.content
                
            }
            await fs.writeFile(SESSION_FILE_PATH, JSON.stringify([...allSessions, newSession], null, 2));
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
        setSessions(updatedSessions.filter(s => s.date === displayByDay). reverse());
        setTaskTotals(prev => {
            const newTotals = {...prev};
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


    return(
        <>
        <main className=''>
        <div className='flex flex-col max-w-screen-2xl mx-auto pl-20 p-3 w-screen '>
        <Navbar />
        {/*Header Components*/}
        <div className='grid grid-cols-[repeat(auto-fill,200px)] gap-1 w-full   lg:text-xl mb-2'>
           
            
            <div className="bg-slate-950/10 backdrop-blur-xs  lg:p-3 p-4 rounded-2xl border border-slate-200/40  flex flex-col h-48 col-span-2 space-y-">
                
                <div className='flex flex-col items-center w-full space-y-2 '>
                    <div className='grid grid-cols-2 space-x-2 w-full items-center' >
                    <p className='bg-gray-400/10 p-1 rounded-xl items-center flex justify-center'>{displayTime}</p>
                    <p className='p-1 bg-green-400/40 rounded-xl hover:cursor-pointer flex justify-center' onClick={() => setAddTaskOpen(!addTaskOpen)} >+ Add Task</p>
                </div>
                    <p className='flex flex-col items-center border border-slate-200/40 p-1 rounded-2xl hover:cursor-pointer w-full space-x-2 pl-2s' onClick={() => setViewTasks(true)}>
                        {selectedTask || 'no task selected'}
                        
                    </p>
                    <div className='flex w-full space-x-2'  onClick={handleStart}>
                         <div className={`flex  p-1   rounded-xl hover:cursor-pointer items-center space-x-1 w-5/10 justify-center ${running ? 'bg-slate-900' : 'bg-green-700'}`}>
                        <img src={Start} className='h-4'></img>
                        <p className='' >Start</p>
                    </div>

                    <div onClick={handleStop} className={`flex  p-1  rounded-xl hover:cursor-pointer items-center space-x-1 w-5/10 justify-center ${running ? 'bg-red-700' :'bg-slate-900' }`}>
                        <img src={Stop} className='h-4'></img>
                        <p className=''>Stop</p>
                    </div>

                    </div>
                   
                    
                    <p className='p-1 rounded-xl bg-gray-800 w-full flex justify-center'>{formatHrsMinsSecs(seconds)}</p>
                </div>
            </div>
            <div className='bg-slate-950/10 backdrop-blur-xs  p-3 rounded-2xl shadow-2xl border border-slate-200/40  space-y-1  h-48 col-span-1 hover:cursor-pointer' onClick={() => setViewTimeGoals(true)}>
                <p className=''>Today</p>
                <div className='text-lg'>

                <div className=''>{formatHrsMinsLarge(todayDuration)}</div>
                <p className=''>⏳ {formatHrsMins(dayLeft)} Left</p>
                <p className=''>✅ {dayDone}% Done</p>
                </div>
                
                <p className='text-gray-200/50'>Total Time Logged</p>
                
                

            </div>
            <div className='bg-slate-950/10 backdrop-blur-xs  p-3 rounded-2xl border border-slate-200/40   h-48 col-span-1 space-y-4 hover:cursor-pointer' onClick={() => setViewTimeGoals(true)}>
                <p className=''>Yesterday</p>
                    <div className='flex flex-col'>
                    <div>{formatHrsMinsLarge(yesterdayDuration)} </div>
                    
                    <div className={`${diffColor} flex items-center text-xl` } >{diffSign}{formatHrsMins(Math.abs(diffToday))}</div>
                </div>
                    
                <p className='text-gray-200/50'>Total Time Logged</p>
            </div>

            <div className='bg-slate-950/10 backdrop-blur-xs  p-3 rounded-2xl border border-slate-200/40   h-48 col-span-1 space-y-1 hover:cursor-pointer' onClick={() => setViewTimeGoals(true)}>
                <p className=''>This Week</p>
                    <div className='flex flex-col text-lg'>
                    <div>{formatHrsMinsLarge(weekDuration)}</div>
                    <p className=''>⏳ {formatHrsMins(weekLeft)} Left</p>
                <p className=''>✅ {weekDone}% Done</p>
                    
                </div>
                    
                <p className='text-gray-200/50'>Total Time Logged</p>
            
            </div>

            <div className='bg-slate-950/10 backdrop-blur-xs  p-3 rounded-2xl border border-slate-200/40   h-48 col-span-1 space-y-1 hover:cursor-pointer' onClick={() => setViewTimeGoals(true)}>
                <p className=''>This Month</p>
                    <div className='flex flex-col text-lg'>
                    <div>{formatHrsMinsLarge(monthDuration)}</div>
                    <p>⏳ {formatHrsMins(monthLeft)}</p>
                    <p>✅ {monthDone}% Done</p>
                    
                </div>
                    
                <p className='text-gray-200/50'>Total Time Logged</p>
                <div>
                    
                </div>
            </div>

            <div className='bg-slate-950/10 backdrop-blur-xs  p-3 rounded-2xl border border-slate-200/40 flex-col flex  h-48 col-span-1 space-y-1 hover:cursor-pointer' onClick={() => setViewTimeGoals(true)}>
                <div className=''>This Year</div>
                
                <div>{formatHrsMinsLarge(yearDuration)}</div>
                <div className='flex flex-col whitespace-nowrap'>
                <div>⏳ {formatHrsMins(yearLeft)} </div>
                <div>✅ {yearDone}% Done</div>
                </div>
                    
                <p className='text-gray-200/50 '>Total Time Logged</p>
            </div>
        </div>
        {/*Under Components*/}
        <div className='sm:grid grid-cols-2 flex-1 gap-2 h-96 space-y-2 '>
            <div className='border border-slate-200/40 grid-cols-1   rounded-2xl bg-slate-950/10 backdrop-blur-xs  h-96'>
                <div className=' border-b border-slate-200/40   p-2  '>
                <div className='  flex space-x-2 justify-between items-center mx-2'>

                
                    <p>Time Blocks</p>
                    
                    <div className='flex space-x-1 items-center border border-slate-200/40 p-3 rounded-xl text-sm hover:cursor-pointer bg-slate-800' onClick={() => setViewAnalytics(!viewAnalytics)}>
                        {viewAnalytics ? (
                            <p>Back to Blocks</p>
                    ):
                    <>
                     
                        
                        <p>Analytics</p>
                        </> 
                        }
                    </div>
                </div>
                    

                </div>
                {viewAnalytics ? (
                <div className='h-full'>
                    <div className='w-full  flex flex-col'>
                        <div className='flex justify-between p-3 items-center bg-slate-600'>
                            <div>
                                Analytics
                            </div>

                             <div>
                                <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className='bg-slate-800 p-1 rounded-2xl'>
                                    <option value="allTime">All Time</option>
                                    <option value="yesterday">Yesterday</option>
                                    <option value="thisWeek">This Week</option>
                                    <option value="lastWeek">Last Week</option>
                                    <option value="thisMonth">this Month</option>
                                    <option value="lastMonth">Last Month</option>
                                    <option value="thisYear">This Year</option>
                                    <option value="lastYear">Last Year</option>
                                    
                                </select>
                            </div>
                            </div>

                            <div className=' p-3 flex-1 overflow-auto flex-col space-y-2 '>
                                {Object.keys(analytics).length === 0 ? (
                                    <p>No Data for this period</p>
                                ) : (
                                    [...Object.entries(analytics)].reverse().map(([task, total]) => (
                                        <div className='bg-slate-700 p-2 rounded-xl flex justify-between' key={task}>
                                            <p>{task}</p>
                                            {running && task === selectedTask ?
                                            <p>{formatHrsMins(seconds)}</p>

                                            :
                                            <p>{formatHrsMins(total)}</p>
                                            }
                                            
                                                 </div>
                                    ))
                                    

                               

                                )}
                                
                                

                            </div>

                    </div>
                    
                </div>
                
                

                 ) : 
                 Object.entries(taskTotals).map(([task, total]) => (
                    <div key={task} className='mx-3 mt-2 mb-2 p-3 bg-slate-200/10 rounded-2xl  flex justify-between'>
                    <p>{task}</p>
                    {running && task === selectedTask ? 
                    <p>{formatHrsMins(seconds + total)}</p> : 
                    <p>{formatHrsMins(total)}</p>
                    }
                    
                    </div>
                ))
                 }
                </div>
               

                <div className='border border-slate-200/40 flex flex-col   rounded-2xl bg-slate-950/10 backdrop-blur-xs  h-96  w-full grid-cols-1'>
                <div className='  flex space-x-2 justify-between items-center border-b border-slate-200/40  p-4 '>
                    <p>{`${new Date(displayByDay).toLocaleDateString('en-US', {weekday: 'long'})} ${new Date(displayByDay).toLocaleDateString('en-US', {month: 'short'})}  ${new Date (displayByDay).getDate()}`}</p>
                    <p className='p-1 rounded-md bg-green-800 lg:w-40 lg:text-base text-sm w-18 text-center hover:cursor-pointer hover:bg-green-900' onClick={() => setViewCreateSession(true)}>+ Add</p>
                    <div className='flex items-center space-x-2'>
                        <p onClick={() => handleDay(-1)} className='hover:cursor-pointer'>⬅️</p>
                        <input type='date' className=' bg-slate-800 items-center flex justify-center px-2 rounded-xl text-white'
                        value={displayByDay}
                        onChange={(e) => setDisplayByDay(e.target.value)}></input>
                        <p onClick={() => handleDay(1)} className='hover:cursor-pointer'>➡️</p>

                    </div>
                </div>
                
                

            
        <div className='overflow-auto   flex-1'>
        {sessions.map((session, index) => (
           
            <div key={index} onClick={() => {setSelectedSession(session), setSessionEditView(true)}}  className={sessions &&
             `mx-3 mt-2 p-3  rounded-2xl   flex justify-between ${session.taskName == selectedTask && session.stopTime == null ? 'bg-green-800' : 'bg-slate-800'} `}>
                <p>{session.taskName}</p>
                <p>{setElapsedTime(new Date(session.startTime))} - { session.stopTime == null && session.taskName == selectedTask ? setElapsedTime(new Date()) : setElapsedTime(new Date(session.stopTime)) }</p>
                <p>{session.stopTime == null &&  session.taskName === selectedTask  ? formatHrsMinsSecs(seconds) : formatHrsMinsSecs(session.durationSeconds)}</p>
            </div>
        
            ))
        }
    </div>
                </div>

        </div>
    <div className="col-span-2  p-6 bg-slate-950/10 backdrop-blur-xs  rounded-2xl border border-slate-200/40">
  
    {/*364 Day map */}


  <div className="grid grid-cols-52 gap-px justify-center">
    {statsMap.map((block, i) => (
      <div
        key={i}
        className={`aspect-square rounded-sm border border-slate-200/40 -700 transition-colors ${
        (() => {
          const d = mappedTotals[new Date(block.date.getTime() + 86400000).toISOString().split('T')[0]] || 0;
          if (d >= 18000) return 'bg-green-900';
          if (d >= 14400) return 'bg-green-600';
          if (d >= 10800) return 'bg-green-500';
          if (d >= 7200) return 'bg-green-300';
          if (d >= 3600) return 'bg-green-200';
          if (d > 0) return 'bg-green-100';
          return 'bg-slate-800';
        })()
      } hover:bg-emerald-500`}
        title={block.date.toLocaleDateString() + '\n' + (
    mappedTotals[new Date(block.date.getTime() + 86400000).toISOString().split('T')[0]]
        ? formatHrsMins(mappedTotals[new Date(block.date.getTime() + 86400000).toISOString().split('T')[0]])
        : 'No time logged'
)}
      />
    ))}
  </div>
</div>
        </div>

        
        
        

        
        

        
        

        </main>

        {message && 
        <div className='fixed w-full inset-0  top-0 p-3  rounded-xl   flex justify-center h-fit  transition-transform ease-in-out duration-300 z-100'>
            <div className='bg-slate-700/40 border border-slate-500/20 flex justify-center w-5/10 rounded-xl'>{message}</div>
        </div>
        }
        
        {/*  Session time Edit */ }
        {sessionEditView && selectedSession && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-xs z-100" >
     
      <div className=" bg-slate-700/80 rounded-xl p-3 text-center w-80  " ref={sessionEditRef} >
       <div className='flex flex-col space-y-3'>
        <div className='flex items-center  flex-col'>
            <div className='flex items-center space-x-1'>
                <p>Start Time</p>
                <input type='date' placeholder={new Date(selectedSession.startTime).toISOString().split('T')[0]} value={editStartDate || (selectedSession.startTime ? new Date(selectedSession.startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])} onChange={(e) => setEditStartDate(e.target.value)}></input>
            </div>
            
            <div className='flex items-center space-x-2'>
            <input type='number' placeholder={new Date(selectedSession.startTime).getHours().toString().padStart(2, '0')} value={editStartHour} onChange={(e) => setEditStartHour(e.target.value)} className='bg-slate-600 p-1 rounded-lg  flex text-center w-35' ></input>
            
            <input type='number' placeholder={new Date(selectedSession.startTime).getMinutes().toString().padStart(2, '0')} value={editStartMinute} onChange={(e) => setEditStartMinute(e.target.value)} className='bg-slate-600 p-1 rounded-lg  flex text-center w-35'></input>
            
            </div>
            

        </div>

        
        <div className='flex items-center  flex-col '>
            <div className='flex items-center space-x-1'>
            <p>Stop Time</p>
            <input type='date' placeholder={new Date(selectedSession.stopTime).toISOString().split('T')[0]} value={editStopDate || (selectedSession.stopTime ? new Date(selectedSession.stopTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])} onChange={(e) => setEditStopDate(e.target.value)}></input>
            </div>
            <div className='flex items-center space-x-2 '>
            <input type='number' placeholder={new Date(selectedSession.stopTime).getHours().toString().padStart(2, '0')} value={editStopHour} onChange={(e) => setEditStopHour(e.target.value)} className='bg-slate-600 p-1 rounded-lg  flex text-center w-35' ></input>
            
            <input  type='number' placeholder={new Date(selectedSession.stopTime).getMinutes().toString().padStart(2, '0')} value={editStopMinute} onChange={(e) => setEditStopMinute(e.target.value)} className='bg-slate-600 p-1 rounded-lg  flex text-center w-35'></input>
            
            </div>
            
        </div>

        <div className='flex p-1 items-center space-x-2 w-full  justify-center'>

    
        <button className='w-full  p-2 rounded-xl hover:cursor-pointer bg-green-800' onClick={editSession}>Save</button>
        <button className='w-full bg-red-800 p-2 rounded-xl hover:cursor-pointer' onClick={deleteSession}>Delete</button>
        
        </div>


       </div>
      </div>
    </div>
    )}

    {/* View time goals Modal*/}
    {viewTimeGoals &&

        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-xs z-100" >
        <div className='bg-slate-800/60 rounded-xl p-2' ref={timeGoalsRef}>
            <div className='flex flex-col space-y-2'>
                <p className='text-white/60 p-2 text-center'>Enter Your Time Goals </p>
                <div className='flex flex-col items-center justify-center space-y-1'>
                    <p>Daily Goal</p>
                    <input type='number' placeholder={dayGoal} onChange={(e) => setDayGoal(e.target.value)} className='bg-slate-600 rounded-xl p-2 text-center'></input>
                </div>

                <div className='flex flex-col items-center justify-center space-y-1'>
                    <p>Weekly Goal</p>
                    <input type='number' placeholder={weekGoal} onChange={(e) => setWeekGoal(e.target.value)} className='bg-slate-600 rounded-xl p-2 text-center shadow'></input>

                </div>

                <div className='flex flex-col items-center justify-center space-y-1'>
                    <p>Monthly Goal</p>
                    <input type='number' placeholder={monthGoal} onChange={(e) => setMonthGoal(e.target.value)} className='bg-slate-600 rounded-xl p-2 text-center'></input>
                </div>

                <div className='flex flex-col items-center justify-center space-y-1'>
                    <p>Yearly Goal</p>

                        <input type='number' placeholder={yearGoal} onChange={(e) => setYearGoal(e.target.value)} className='bg-slate-600 rounded-xl p-2 text-center'></input>
                        

                    
                </div>
                
                
                
                
                <button className='bg-slate-800 rounded-xl p-2 hover:cursor-pointer' onClick={() =>saveTimeGoals(dayGoal, weekGoal, monthGoal, yearGoal)}>Save Values</button>

            </div>
        </div>
     
      
    </div>

    }
    {/* Create Session Modal */}

    {viewCreateSession && 
     <div className="fixed inset-0 flex items-center justify-center backdrop-blur-xs z-100" >
     
      <div className=" bg-slate-700/80 rounded-xl p-3 text-center w-80 " ref={viewTasks ? null : createSessionRef } >
       <div className='flex flex-col space-y-3'>
        <div className='flex items-center  flex-col'>
            <div>{message}</div>

            <div className='bg-slate-600 p-2 w-full rounded-xl mb-2 h-8 flex items-center justify-center hover:cursor-pointer' placeholder='No Task Selected' onClick={() => setViewTasks(true)}>{createSessionSelectTask ? createSessionSelectTask.content : 'No Task Selected'}</div>
            <div className='flex items-center space-x-1'>
                <p>Start Time</p>
                <input type='date' onChange={(e) => setCreateStartDate(e.target.value)} value={createStartDate}></input>
            </div>
            
            <div className='flex items-center space-x-2'>
            <input onChange={(e) => setCreateStartHour(e.target.value)} placeholder='HH' value={createStartHour} type='number' className='bg-slate-600 p-1 rounded-lg  flex text-center w-35' ></input>
            
            <input onChange={(e) => setCreateStartMinute(e.target.value)} placeholder='MM' type='number' value={createStartMinute} className='bg-slate-600 p-1 rounded-lg  flex text-center w-35'></input>
            
            </div>
            

        </div>

        
        <div className='flex items-center  flex-col '>
            <div className='flex items-center space-x-1'>
            <p>Stop Time</p>
            <input type='date' value={createStopDate} onChange={(e) => setCreateStopDate(e.target.value)}></input>
            </div>
            <div className='flex items-center space-x-2 '>
            <input onChange={(e) => setCreateStopHour(e.target.value)} value={createStopHour} placeholder='HH' type='number' className='bg-slate-600 p-1 rounded-lg  flex text-center w-35' ></input>
            
            <input onChange={(e) => setCreateStopMinute(e.target.value)} value={createStopMinute} placeholder='MM' type='number'  className='bg-slate-600 p-1 rounded-lg  flex text-center w-35'></input>
            
            </div>
            
        </div>

        <div className='flex p-1 items-center space-x-2 w-full  justify-center'>

    
        <button className='w-full  p-2 rounded-xl hover:cursor-pointer bg-green-800'  onClick={() => createSession()}>Create Session</button>
       
        
        </div>


       </div>
      </div>
    </div>

    }

    {viewTasks && (
  <div className='inset-0 fixed flex justify-center items-center w-full backdrop-blur-xs z-100'>
    <div className='bg-slate-800/70 p-1 rounded-xl w-100 h-50 overflow-y-auto' ref={taskListRef}>
      <div className='flex flex-col gap-1 p-3'>

        {/* Editing Input Field */}
        {editingInput && (
          <div className='flex items-center space-x-2'>
            <input
              className='p-1 border border-slate-200/40 rounded-xl flex-1'
              placeholder={selectedEditingDefault}
              onChange={(e) => setEditTask(e.target.value)}
              autoFocus
            />
            <button
              className='bg-green-500 py-1 rounded-xl px-3'
              onClick={() => {
                updatedTaskName(editingId, EditTask);
                setEditingInput(false);
                setEditTask('');
                setSelectedEditingDefault('');
              }}
            >
              Save
            </button>
            <button
              className='bg-gray-600 py-1 rounded-xl px-3'
              onClick={() => {
                setEditingInput(false);
                setEditTask('');
                setSelectedEditingDefault('');
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Task List */}
        {taskNames.map((task) => (
  <div className='flex items-center hover:bg-slate-700 rounded-xl z-100' key={task.id}>
    <div
      className='hover:cursor-pointer rounded-lg p-2 flex-1 '
      onClick={() => {
        viewCreateSession ? setCreateSessionSelectTask(task) : (setSelectedTask(task.content), showMessage(`Selected ${task.content}`));
        setViewTasks(false);

        
        
      }}
    >
      {task.content}
    </div>

    <div className='flex gap-1 pr-2'>
      <img
        src={Edit}
        className='h-4 hover:cursor-pointer'
        onClick={() => {
          setEditingInput(true);
          setSelectedEditingDefault(task.content);
          setEditingId(task.id);
          setEditTask(task.content);
        }}
        alt="Edit"
      />
      <img
        src={Delete}
        className='h-4 hover:cursor-pointer'
        onClick={() => deleteTask(task.id)}
        alt="Delete"
      />
    </div>
  </div>
))}
      </div>
    </div>
  </div>
)}

{/* POPUP WINDOW TO CREATE TASKS */}

{addTaskOpen && (
            <div className="fixed inset-0  backdrop-blur-xs flex items-center justify-center z-100 ">
                
          <div className="bg-slate-800/60 p-6 rounded-xl  shadow-lg " ref={addTaskRef}>
            
            <h3 className="text-lg  text-center mask-b-from-15%" >Add Task</h3>
            <input 
            placeholder='Enter task name' type='text' value={input}
            onChange={(e) => setInput(e.target.value)}
            className='border-b border-slate-200/40   p-2 my-1 rounded-xl w-full bg-slate-700/20'
            />
            
            <button
              onClick={() => {
                saveTaskName(), 
                setAddTaskOpen(false)
            }} 
              className="my-1 bg-green-800 text-white p-1 rounded-xl w-full hover:cursor-pointer"
            >
              Create Task
            </button>
          </div>
        </div>
        )}
    
    
        
        
       
        </>
        
    )
}
export default Timetracker