import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import roadmapIcon from '../assets/icons/chart.svg';
import journalIcon from '../assets/icons/journal.svg';
import plusIcon from '../assets/icons/plus.svg';
import trashIcon from '../assets/icons/delete.svg';
import checkIcon from '../assets/icons/check.svg';
import closeIcon from '../assets/icons/close.svg';
import goalsIcon from '../assets/icons/goals.svg';
import calendarIcon from '../assets/icons/calendar.svg';
import clockIcon from '../assets/icons/clock.svg';
import zapIcon from '../assets/icons/zap.svg';
import editIcon from '../assets/icons/edit.svg';
import brainIcon from '../assets/icons/brain.svg';
import Navbar from './Navbar';
const fs = window.require('fs').promises;
const path = window.require('path');

const LocalIcon = ({ src, className = "", size = 16 }) => (
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

// --- COLORS & THEME ---
const THEME = {
  bg: 'bg-black',
  cardBg: 'bg-neutral-900/40',
  border: 'border-white/5',
  textSub: 'text-neutral-500',
  textMain: 'text-neutral-200',
  textHigh: 'text-white',
  accent: 'text-emerald-400',
  accentBg: 'bg-emerald-500',
};

// --- ICON COMPONENTS ---
const IconPlus = ({ className = "" }) => <LocalIcon src={plusIcon} size={14} className={className} />;
const IconTrash = ({ className = "" }) => <LocalIcon src={trashIcon} size={14} className={`text-zinc-600 hover:text-red-400 transition-colors ${className}`} />;
const IconCheck = ({ className = "" }) => <LocalIcon src={checkIcon} size={14} className={`text-emerald-500 ${className}`} />;
const IconX = ({ className = "" }) => <LocalIcon src={closeIcon} size={14} className={`text-zinc-500 hover:text-white transition-colors ${className}`} />;
const IconTarget = ({ className = "" }) => <LocalIcon src={goalsIcon} size={16} className={`text-blue-500 ${className}`} />;
const IconCalendar = ({ className = "" }) => <LocalIcon src={calendarIcon} size={14} className={`text-zinc-400 ${className}`} />;
const IconClock = ({ className = "" }) => <LocalIcon src={clockIcon} size={14} className={`text-zinc-400 ${className}`} />;
const IconZap = ({ className = "" }) => <LocalIcon src={zapIcon} size={14} className={`text-zinc-400 ${className}`} />;
const IconEdit = ({ className = "" }) => <LocalIcon src={editIcon} size={14} className={`text-zinc-600 hover:text-sky-400 transition-colors ${className}`} />;
const IconRoadmap = ({ className = "", size = 14 }) => <LocalIcon src={roadmapIcon} size={size} className={className} />;
const IconJournal = ({ className = "", size = 14 }) => <LocalIcon src={journalIcon} size={size} className={className} />;
const IconSkill = ({ className = "", size = 14 }) => <LocalIcon src={brainIcon} size={size} className={className} />;

const DEFAULT_BASE_PATH = 'C:\\Users\\PC\\Desktop\\database\\Goals';

// --- LOG HELPERS ---
const formatTimestamp = (isoStr) => {
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatLogAmount = (entry) => {
  const unit = entry.unit || entry.type || 'percentage';
  const amount = entry.displayAmount !== undefined ? entry.displayAmount : entry.amount;

  if (unit === 'time') {
    if (typeof amount === 'object') {
      const h = amount.h || 0;
      const m = amount.m || 0;
      if (h > 0 && m > 0) return `+${h}h ${m}m`;
      if (h > 0) return `+${h}h`;
      return `+${m}m`;
    }
    const h = Math.floor(amount / 60);
    const m = amount % 60;
    if (h > 0 && m > 0) return `+${h}h ${m}m`;
    if (h > 0) return `+${h}h`;
    return `+${m}m`;
  }
  if (unit === 'percentage') return `+${amount}%`;
  return `+${amount}`;
};

const ActivityHeatmap = ({ logs, type = 'percentage' }) => {
  // Generate last 21 days (3 weeks)
  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (20 - i)); // 20 days ago to today
    return d;
  });

  const getIntensity = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayLogs = logs.filter(l => l.timestamp.startsWith(dateStr));
    if (dayLogs.length === 0) return 0;

    // Simple heuristic for intensity based on count or amount
    // For now, just boolean activity is enough to show "streaks", 
    // but we can scale it.
    return Math.min(dayLogs.length, 4); // 0-4 scale
  };

  return (
    <div className="flex items-center gap-0.5 mt-3 mb-1">
      {days.map((day, i) => {
        const intensity = getIntensity(day);
        const intensityClass = [
          'bg-white/5',           // 0
          'bg-emerald-500/20',    // 1
          'bg-emerald-500/40',    // 2
          'bg-emerald-500/70',    // 3
          'bg-emerald-500',       // 4
        ][intensity] || 'bg-white/5';

        return (
          <div
            key={i}
            className={`w-1.5 h-4 rounded-sm ${intensityClass}`}
            title={day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (intensity > 0 ? ': Active' : '')}
          />
        );
      })}
    </div>
  );
};

const Goals = ({ showNavbar = true }) => {
  const navigate = useNavigate();
  // --- STATE ---
  const { data, refreshData } = useData();
  const [goals, setGoals] = useState([]);
  const [view, setView] = useState('ongoing'); // ongoing | scheduled | succeeded | failed
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editProgressId, setEditProgressId] = useState(null);
  const [logProgressId, setLogProgressId] = useState(null);
  const [progressVal, setProgressVal] = useState('');
  const [progressValMin, setProgressValMin] = useState('');
  const [logUnit, setLogUnit] = useState('percentage'); // percentage | time | rate
  const [expandedLogId, setExpandedLogId] = useState(null); // Which card shows the log history
  const [editingGoal, setEditingGoal] = useState(null);
  const [sortBy, setSortBy] = useState('progress'); // progress | newest | oldest
  const [roadmapModalOpen, setRoadmapModalOpen] = useState(false);
  const [attachRoadmapModalOpen, setAttachRoadmapModalOpen] = useState(false);
  const [selectedGoalForRoadmap, setSelectedGoalForRoadmap] = useState(null);
  const [existingRoadmaps, setExistingRoadmaps] = useState([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState(null);
  const [journalTitles, setJournalTitles] = useState([]);
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [attachJournalModalOpen, setAttachJournalModalOpen] = useState(false);
  const [existingSkills, setExistingSkills] = useState([]);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [attachSkillModalOpen, setAttachSkillModalOpen] = useState(false);
  const [selectedGoalForSkill, setSelectedGoalForSkill] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    importance: '',
    achievability: '',
    due: '',
    startDate: new Date().toISOString().split('T')[0],
    progressionType: 'percentage', // default primary
    enabledTypes: ['percentage'], // array of types
    targets: {
      percentage: 100,
      time: 0, // In minutes
      rate: 0
    },
    targetHours: '',   // for raw input
    targetMinutes: '', // for raw input
    targetTotal: '',    // for raw input
    status: 'ongoing',
    tags: [],
    roadmapId: null,
    journalId: null,
    skillId: null
  });

  // --- DERIVED STATE ---
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isFuture = useCallback((dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d > today;
  }, [today]);

  // --- DATA LOADING ---
  useEffect(() => {
    if (data.goals && data.goals.allGoals) {
      setGoals(data.goals.allGoals);
    }
    loadJournalTitles();
  }, [data.goals]);

  useEffect(() => {
    const { openSkillModalFor, openJournalModalFor, openRoadmapModalFor } = location.state || {};
    if (goals.length > 0) {
      if (openSkillModalFor) {
        const goal = goals.find(g => g.id === openSkillModalFor);
        if (goal) {
          setSelectedGoalForSkill(goal);
          setSkillModalOpen(true);
        }
      } else if (openJournalModalFor) {
        const goal = goals.find(g => g.id === openJournalModalFor);
        if (goal) {
          setSelectedGoalForRoadmap(goal);
          setJournalModalOpen(true);
        }
      } else if (openRoadmapModalFor) {
        const goal = goals.find(g => g.id === openRoadmapModalFor);
        if (goal) {
          setSelectedGoalForRoadmap(goal);
          setRoadmapModalOpen(true);
        }
      }
    }
  }, [location.state, goals]);

  const loadJournalTitles = async () => {
    const journalDir = 'C:\\Users\\PC\\Desktop\\database\\DailyJournal';
    try {
      const files = await fs.readdir(journalDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      const titles = await Promise.all(jsonFiles.map(async (file) => {
        const content = await fs.readFile(path.join(journalDir, file), 'utf-8');
        try {
          return JSON.parse(content).title;
        } catch (e) { return null; }
      }));
      setJournalTitles(titles.filter(t => t !== null));
    } catch (err) {
      setJournalTitles([]);
    }
  };

  // Lock scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen = isAddModalOpen || roadmapModalOpen || attachRoadmapModalOpen || deleteConfirmOpen || journalModalOpen || attachJournalModalOpen || skillModalOpen || attachSkillModalOpen;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAddModalOpen, roadmapModalOpen, attachRoadmapModalOpen, deleteConfirmOpen, journalModalOpen, attachJournalModalOpen, skillModalOpen, attachSkillModalOpen]);

  // --- ACTIONS ---
  const saveGoal = async () => {
    if (!formData.name.trim()) return;

    let currentTargets = { ...formData.targets };
    if (formData.enabledTypes.includes('time')) {
      currentTargets.time = (parseInt(formData.targetHours) || 0) * 60 + (parseInt(formData.targetMinutes) || 0);
    }
    if (formData.enabledTypes.includes('rate')) {
      currentTargets.rate = parseInt(formData.targetTotal) || 0;
    }
    if (formData.enabledTypes.includes('percentage')) {
      currentTargets.percentage = 100;
    }

    const goalData = editingGoal ? editingGoal : {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      status: 'ongoing',
      currentValues: { percentage: 0, time: 0, rate: 0 },
      progressLog: [],
      roadmapId: null,
      journalId: null,
    };

    const updatedGoal = {
      ...goalData,
      ...formData,
      importance: parseInt(formData.importance) || 5,
      achievability: parseInt(formData.achievability) || 5,
      targets: currentTargets,
    };

    // Helper to calculate progress for a specific tracker
    const calcTypeProgress = (type, currentValues, targets) => {
      const target = targets[type] || 0;
      if (target <= 0) return 0;
      return Math.min(100, Math.round(((currentValues[type] || 0) / target) * 100));
    };

    // Recalculate overall progress
    const activeTypes = updatedGoal.enabledTypes || ['percentage'];
    const totalProgress = activeTypes.reduce((acc, type) => {
      return acc + calcTypeProgress(type, updatedGoal.currentValues, updatedGoal.targets);
    }, 0);

    updatedGoal.progress = activeTypes.length > 0 ? Math.round(totalProgress / activeTypes.length) : 0;

    try {
      await fs.writeFile(
        path.join(DEFAULT_BASE_PATH, `${updatedGoal.id}.json`),
        JSON.stringify(updatedGoal, null, 2)
      );

      if (editingGoal) {
        setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g));
      } else {
        setGoals(prev => [updatedGoal, ...prev]);
      }

      refreshData();
      setIsAddModalOpen(false);
      setEditingGoal(null);
      setFormData({
        name: '', importance: '', achievability: '', due: '',
        startDate: new Date().toISOString().split('T')[0],
        enabledTypes: ['percentage'],
        targets: { percentage: 100, time: 0, rate: 0 },
        targetHours: '',
        targetMinutes: '',
        targetTotal: '',
        status: 'ongoing',
        tags: [],
        roadmapId: null,
        journalId: null,
        skillId: null
      });
    } catch (err) {
      console.error("Failed to save goal:", err);
      alert("Failed to save goal.");
    }
  };

  const updateGoal = async (updatedGoal) => {
    try {
      await fs.writeFile(
        path.join(DEFAULT_BASE_PATH, `${updatedGoal.id}.json`),
        JSON.stringify(updatedGoal, null, 2)
      );
      setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g));
      refreshData();
      return true;
    } catch (err) {
      console.error("Failed to update goal:", err);
      return false;
    }
  };

  const handleRoadmapNavigation = async (goal) => {
    let roadmapId = goal.roadmapId;
    const roadmapDir = 'C:\\Users\\PC\\Desktop\\database\\Workflows';

    if (roadmapId) {
      try {
        await fs.access(path.join(roadmapDir, `roadmap_${roadmapId}.json`));
        navigate('/Growth/roadmap', { state: { roadmapId, fromGoal: true, journalId: goal.journalId, skillId: goal.skillId, goalName: goal.name, goalId: goal.id } });
        return;
      } catch (e) {
        // Roadmap file missing, force re-link
      }
    }

    setSelectedGoalForRoadmap(goal);
    setRoadmapModalOpen(true);
  };

  const createNewRoadmap = async () => {
    if (!selectedGoalForRoadmap) return;
    const goal = selectedGoalForRoadmap;
    const roadmapDir = 'C:\\Users\\PC\\Desktop\\database\\Workflows';
    const indexFile = path.join(roadmapDir, 'index.json');

    const roadmapId = `roadmap_${goal.id}_${Math.random().toString(36).substr(2, 5)}`;
    const newRoadmap = {
      id: roadmapId,
      title: goal.name,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      nodeCount: 0
    };

    try {
      await fs.mkdir(roadmapDir, { recursive: true });
      let index = [];
      try {
        const content = await fs.readFile(indexFile, 'utf-8');
        index = JSON.parse(content);
      } catch (e) { }

      index.unshift(newRoadmap);
      await fs.writeFile(indexFile, JSON.stringify(index, null, 2));
      await fs.writeFile(path.join(roadmapDir, `roadmap_${roadmapId}.json`), JSON.stringify({ nodes: [], connections: [] }, null, 2));

      // Update the goal in DB
      const updatedGoal = { ...goal, roadmapId };
      const success = await updateGoal(updatedGoal);
      if (success) {
        setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g));
        refreshData();
      }
      setRoadmapModalOpen(false);
      navigate('/Growth/roadmap', {
        state: {
          roadmapId,
          fromGoal: true,
          goalId: updatedGoal.id,
          goalName: updatedGoal.name,
          journalId: updatedGoal.journalId,
          skillId: updatedGoal.skillId
        }
      });
    } catch (err) {
      console.error("Roadmap creation failed", err);
    }
  };

  const loadRoadmaps = async () => {
    const roadmapDir = 'C:\\Users\\PC\\Desktop\\database\\Workflows';
    const indexFile = path.join(roadmapDir, 'index.json');
    try {
      const content = await fs.readFile(indexFile, 'utf-8');
      setExistingRoadmaps(JSON.parse(content));
    } catch (e) {
      setExistingRoadmaps([]);
    }
  };

  const attachExistingRoadmap = async (roadmapId) => {
    if (!selectedGoalForRoadmap) return;
    const goal = selectedGoalForRoadmap;
    const updatedGoal = { ...goal, roadmapId };

    const success = await updateGoal(updatedGoal);
    if (success) {
      setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g));
      setAttachRoadmapModalOpen(false);
      setRoadmapModalOpen(false);
      refreshData();
      navigate('/Growth/roadmap', {
        state: {
          roadmapId,
          fromGoal: true,
          journalId: updatedGoal.journalId,
          goalName: updatedGoal.name,
          goalId: updatedGoal.id,
          skillId: updatedGoal.skillId
        }
      });
    }
  };
  const handleSkillNavigation = (goal) => {
    if (goal.skillId) {
      navigate('/Growth/skills', {
        state: {
          skillId: goal.skillId,
          fromGoal: true,
          goalName: goal.name,
          goalId: goal.id,
          roadmapId: goal.roadmapId,
          journalId: goal.journalId
        }
      });
      return;
    }
    setSelectedGoalForSkill(goal);
    setSkillModalOpen(true);
  };

  const createNewSkill = async () => {
    if (!selectedGoalForSkill) return;
    const goal = selectedGoalForSkill;
    const skillDir = 'C:\\Users\\PC\\Desktop\\database\\Skills';
    const skillId = `skill_${Math.random().toString(36).substr(2, 9)}`;
    const newSkill = { id: skillId, name: goal.name, phases: [], lessons: [] };

    try {
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, `${skillId}.json`), JSON.stringify(newSkill, null, 2));

      const updatedGoal = { ...goal, skillId };
      const success = await updateGoal(updatedGoal);
      if (success) {
        setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g));
        refreshData();
      }
      setSkillModalOpen(false);
      navigate('/Growth/skills', {
        state: {
          skillId,
          fromGoal: true,
          goalId: updatedGoal.id,
          goalName: updatedGoal.name,
          roadmapId: updatedGoal.roadmapId,
          journalId: updatedGoal.journalId
        }
      });
    } catch (err) {
      console.error("Skill creation failed", err);
    }
  };

  const loadSkills = async () => {
    const skillDir = 'C:\\Users\\PC\\Desktop\\database\\Skills';
    try {
      const files = await fs.readdir(skillDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      const skills = await Promise.all(jsonFiles.map(async (file) => {
        const content = await fs.readFile(path.join(skillDir, file), 'utf-8');
        try {
          return JSON.parse(content);
        } catch (e) { return null; }
      }));
      setExistingSkills(skills.filter(s => s !== null));
    } catch (err) {
      setExistingSkills([]);
    }
  };

  const attachExistingSkill = async (skillId) => {
    if (!selectedGoalForSkill) return;
    const goal = selectedGoalForSkill;
    const updatedGoal = { ...goal, skillId };

    const success = await updateGoal(updatedGoal);
    if (success) {
      setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g));
      setAttachSkillModalOpen(false);
      setSkillModalOpen(false);
      refreshData();
      navigate('/Growth/skills', {
        state: {
          skillId,
          fromGoal: true,
          journalId: updatedGoal.journalId,
          roadmapId: updatedGoal.roadmapId,
          goalName: updatedGoal.name,
          goalId: updatedGoal.id
        }
      });
    }
  };
  const deleteGoal = (goal) => {
    setGoalToDelete(goal);
    setDeleteConfirmOpen(true);
  };

  const handlePerformDelete = async (deleteRoadmap = false, deleteJournal = false, deleteSkill = false) => {
    if (!goalToDelete) return;
    try {
      const filePath = path.join(DEFAULT_BASE_PATH, `${goalToDelete.id}.json`);
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
      } catch (e) {
        console.warn("Goal file not found");
      }

      if (deleteRoadmap && goalToDelete.roadmapId) {
        const roadmapDir = 'C:\\\\Users\\\\PC\\\\Desktop\\\\database\\\\Workflows';
        const roadmapFiles = [
          path.join(roadmapDir, `roadmap_${goalToDelete.roadmapId}.json`),
          path.join(roadmapDir, `${goalToDelete.roadmapId}.json`)
        ];
        const indexFile = path.join(roadmapDir, 'index.json');

        for (const rf of roadmapFiles) {
          try {
            await fs.unlink(rf);
          } catch (e) { }
        }

        try {
          const content = await fs.readFile(indexFile, 'utf-8');
          let index = JSON.parse(content);
          const newIndex = index.filter(r => r.id !== goalToDelete.roadmapId);
          await fs.writeFile(indexFile, JSON.stringify(newIndex, null, 2));
        } catch (e) { }
      }

      if (deleteJournal && goalToDelete.journalId) {
        const journalDir = 'C:\\\\Users\\\\PC\\\\Desktop\\\\database\\\\DailyJournal';
        try {
          await fs.unlink(path.join(journalDir, `${goalToDelete.journalId}.json`));
        } catch (e) { }
      }

      if (deleteSkill && goalToDelete.skillId) {
        const skillDir = 'C:\\\\Users\\\\PC\\\\Desktop\\\\database\\\\Skills';
        try {
          await fs.unlink(path.join(skillDir, `${goalToDelete.skillId}.json`));
        } catch (e) { }
      }

      setGoals(prev => prev.filter(g => g.id !== goalToDelete.id));
      setDeleteConfirmOpen(false);
      setGoalToDelete(null);
      refreshData();
      loadJournalTitles();
    } catch (err) {
      console.error("Deletion failed", err);
    }
  };

  const handleJournalNavigation = async (goal) => {
    if (goal.journalId) {
      navigate('/DailyJournal', { state: { targetTitle: goal.name, fromGoal: true, roadmapId: goal.roadmapId, goalId: goal.id, skillId: goal.skillId } });
    } else {
      setSelectedGoalForRoadmap(goal);
      setJournalModalOpen(true);
    }
  };

  const createNewJournal = async () => {
    if (!selectedGoalForRoadmap) return;
    const journalDir = 'C:\\Users\\PC\\Desktop\\database\\DailyJournal';
    const id = crypto.randomUUID();
    const newJournal = {
      id,
      title: selectedGoalForRoadmap.name,
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await fs.writeFile(path.join(journalDir, `${id}.json`), JSON.stringify(newJournal, null, 2));

      // Update goal with journalId in state and disk
      const updatedGoal = { ...selectedGoalForRoadmap, journalId: id };
      await fs.writeFile(path.join(DEFAULT_BASE_PATH, `${selectedGoalForRoadmap.id}.json`), JSON.stringify(updatedGoal, null, 2));

      setGoals(prev => prev.map(g => g.id === selectedGoalForRoadmap.id ? updatedGoal : g));
      setJournalModalOpen(false);
      loadJournalTitles();
      refreshData();

      // Pass full context so "Back to Goals" and "MAP" appear immediately
      navigate('/DailyJournal', {
        state: {
          targetTitle: selectedGoalForRoadmap.name,
          fromGoal: true,
          roadmapId: selectedGoalForRoadmap.roadmapId,
          goalId: selectedGoalForRoadmap.id,
          skillId: selectedGoalForRoadmap.skillId
        }
      });
    } catch (err) {
      console.error("Journal creation failed", err);
    }
  };

  const loadJournals = async () => {
    const journalDir = 'C:\\Users\\PC\\Desktop\\database\\DailyJournal';
    try {
      const files = await fs.readdir(journalDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      const journals = await Promise.all(jsonFiles.map(async (file) => {
        const content = await fs.readFile(path.join(journalDir, file), 'utf-8');
        try {
          const data = JSON.parse(content);
          return { id: data.id, title: data.title, lastModified: data.updatedAt || data.createdAt };
        } catch (e) { return null; }
      }));
      setExistingJournals(journals.filter(j => j !== null));
    } catch (err) {
      console.error("Failed to load journals", err);
    }
  };

  const attachExistingJournal = async (journalId, journalTitle) => {
    if (!selectedGoalForRoadmap) return;
    try {
      const updatedGoal = { ...selectedGoalForRoadmap, journalId };
      await fs.writeFile(path.join(DEFAULT_BASE_PATH, `${selectedGoalForRoadmap.id}.json`), JSON.stringify(updatedGoal, null, 2));

      setGoals(prev => prev.map(g => g.id === selectedGoalForRoadmap.id ? updatedGoal : g));
      setJournalModalOpen(false);
      setAttachJournalModalOpen(false);
      loadJournalTitles();
      refreshData();
      navigate('/DailyJournal', {
        state: {
          targetTitle: journalTitle,
          fromGoal: true,
          roadmapId: selectedGoalForRoadmap.roadmapId,
          goalId: selectedGoalForRoadmap.id,
          skillId: selectedGoalForRoadmap.skillId
        }
      });
    } catch (err) {
      console.error("Linking journal failed", err);
    }
  };

  const handleProgressUpdate = async (id, isLogging = false) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;

    let newCurrentValue = 0;
    let newProgress = 0;
    let logAmount = 0;

    const val = parseFloat(progressVal) || 0;
    const valMin = parseFloat(progressValMin) || 0;
    let addedValue = 0;

    if (logUnit === 'time') {
      addedValue = val * 60 + valMin;
    } else if (logUnit === 'percentage') {
      // If logging by percentage, find out what that means for the primary or specific tracker
      // For simplicity, we just use the selected logUnit target if it exists
      const target = goal.targets?.[logUnit] || 100;
      addedValue = (val / 100) * target;
    } else {
      addedValue = val;
    }

    const newValues = {
      ...(goal.currentValues || { percentage: goal.progress || 0, time: 0, rate: 0 }),
      [logUnit]: isLogging ? ((goal.currentValues?.[logUnit] || 0) + addedValue) : addedValue
    };

    // Helper to calculate progress for a specific tracker
    const calcTypeProgress = (type, currentValues, targets) => {
      const target = targets[type] || 0;
      if (target <= 0) return 0;
      return Math.min(100, Math.round(((currentValues[type] || 0) / target) * 100));
    };

    // Overall progress is average of enabled tracks
    const activeTypes = goal.enabledTypes || ['percentage'];
    const totalProgress = activeTypes.reduce((acc, type) => {
      return acc + calcTypeProgress(type, newValues, goal.targets || {});
    }, 0);

    newProgress = activeTypes.length > 0 ? Math.round(totalProgress / activeTypes.length) : 0;
    logAmount = addedValue;

    // Build log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      amount: logAmount,
      displayAmount: logUnit === 'time' ? { h: val, m: valMin } : val,
      unit: logUnit,
      isLogging,
    };

    const existingLog = Array.isArray(goal.progressLog) ? goal.progressLog : [];

    const updatedGoal = {
      ...goal,
      currentValues: newValues,
      progress: newProgress,
      status: (newProgress >= 100) ? 'succeeded' : goal.status,
      progressLog: [...existingLog, logEntry],
    };
    await updateGoal(updatedGoal);
    setEditProgressId(null);
    setLogProgressId(null);
    setProgressVal('');
    setProgressValMin('');
  };



  // --- FILTERING ---
  const filteredGoals = useMemo(() => {
    let list = [];
    const scheduled = goals.filter(g => isFuture(g.startDate) && g.status === 'ongoing');
    const active = goals.filter(g => !isFuture(g.startDate) && g.status === 'ongoing');
    const succeeded = goals.filter(g => g.status === 'succeeded');
    const failed = goals.filter(g => g.status === 'failed');

    switch (view) {
      case 'scheduled': list = scheduled; break;
      case 'succeeded': list = succeeded; break;
      case 'failed': list = failed; break;
      case 'ongoing':
      default: list = active; break;
    }

    return list.slice().sort((a, b) => {
      if (sortBy === 'progress') {
        const pA = a.progress || 0;
        const pB = b.progress || 0;
        return pB - pA;
      }
      if (sortBy === 'newest') {
        const tA = new Date(a.createdAt || a.id).getTime();
        const tB = new Date(b.createdAt || b.id).getTime();
        return tB - tA;
      }
      if (sortBy === 'oldest') {
        const tA = new Date(a.createdAt || a.id).getTime();
        const tB = new Date(b.createdAt || b.id).getTime();
        return tA - tB;
      }
      return 0;
    });
  }, [goals, view, sortBy, isFuture]);

  const stats = useMemo(() => {
    return {
      ongoing: goals.filter(g => !isFuture(g.startDate) && g.status === 'ongoing').length,
      scheduled: goals.filter(g => isFuture(g.startDate) && g.status === 'ongoing').length,
      succeeded: goals.filter(g => g.status === 'succeeded').length,
      failed: goals.filter(g => g.status === 'failed').length,
    };
  }, [goals, isFuture]);

  const getDaysRemaining = useCallback((dueStr) => {
    if (!dueStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueStr);
    due.setHours(0, 0, 0, 0);
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }, []);

  const DailyTargetBadge = ({ target, current, due, type }) => {
    if (!due || target === undefined) return null;
    const days = getDaysRemaining(due);
    if (days === null || days <= 0) return null;

    const remaining = Math.max(0, target - current);
    const daily = remaining / days;

    if (daily <= 0) return (
      <span className="text-[7px] text-emerald-500/60 font-black tracking-widest uppercase">
        ON TRACK
      </span>
    );

    const formattedVal = (n) => {
      const s = n.toFixed(1);
      return s.endsWith('.0') ? s.slice(0, -2) : s;
    };

    const formatted = type === 'time'
      ? `${formatTimeMin(Math.ceil(daily))}/d`
      : type === 'percentage'
        ? `${formattedVal(daily)}%/d`
        : `${formattedVal(daily)}/d`;

    return (
      <div className="flex items-center gap-1 group/daily">
        <span className="text-[7px] text-neutral-600 font-bold uppercase tracking-widest group-hover/daily:text-neutral-400 transition-colors">Required:</span>
        <span className="text-[8px] text-amber-400 font-black tracking-tight bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded leading-none shadow-sm">
          {formatted}
        </span>
      </div>
    );
  };

  const formatTimeMin = (totalMin) => {
    const h = Math.floor(totalMin / 60);
    const m = Math.round(totalMin % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return '0m'; // Keep at least one if absolute 0
  };

  const getTimeRemaining = (dueDateStr) => {
    if (!dueDateStr) return null;
    const now = new Date();
    const due = new Date(dueDateStr);
    due.setHours(23, 59, 59, 999); // end of due day
    const diffMs = due - now;

    if (diffMs <= 0) return { text: 'Overdue', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };

    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);
    const diffW = Math.floor(diffD / 7);
    const diffMo = Math.floor(diffD / 30);

    let text;
    if (diffMo > 0) {
      const remDays = diffD - diffMo * 30;
      text = remDays > 0 ? `${diffMo}mo ${remDays}d left` : `${diffMo}mo left`;
    } else if (diffD > 0) {
      const remHours = diffH - diffD * 24;
      text = remHours > 0 ? `${diffD}d ${remHours}h left` : `${diffD}d left`;
    } else if (diffH > 0) {
      const remMin = diffMin % 60;
      text = remMin > 0 ? `${diffH}h ${remMin}m left` : `${diffH}h left`;
    } else {
      text = `${diffMin}m left`;
    }

    const color = diffD < 3
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : 'text-neutral-400 bg-white/5 border-white/5';

    return { text, color };
  };

  // --- RENDER HELPERS ---
  const getProgressColor = (status, progress) => {
    if (status === 'succeeded') return 'bg-emerald-500';
    if (status === 'failed') return 'bg-rose-500';
    if (progress >= 75) return 'bg-emerald-400';
    if (progress >= 40) return 'bg-sky-400';
    return 'bg-neutral-600';
  };

  const StatusBadge = ({ status }) => {
    const colors = {
      ongoing: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
      succeeded: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
      failed: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
    };
    const labels = { ongoing: 'ACTIVE', succeeded: 'DONE', failed: 'FAILED' };

    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${colors[status] || colors.ongoing}`}>
        {labels[status]}
      </span>
    );
  };

  // --- PROGRESS LOG for a goal, sorted newest first ---
  const getProgressLog = (goal) => {
    return (goal.progressLog || []).slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  return (
    <div className={`min-h-screen ${THEME.bg} text-neutral-300 font-sans selection:bg-emerald-500/30`}>
      {showNavbar && <Navbar />}

      <div className="max-w-[1600px] mx-auto p-4 pl-18">

        {/* HEADER DASHBOARD */}
        <header className="mb-3">
          <div className="flex items-end justify-between mb-2">

            <button
              onClick={() => {
                setEditingGoal(null);
                setFormData({
                  name: '', importance: '', achievability: '', due: '',
                  startDate: new Date().toISOString().split('T')[0],
                  enabledTypes: ['percentage'],
                  targets: { percentage: 100, time: 0, rate: 0 },
                  targetHours: '',
                  targetMinutes: '',
                  targetTotal: '',
                  status: 'ongoing',
                  tags: [],
                  roadmapId: null,
                  journalId: null
                });
                setIsAddModalOpen(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <IconPlus /> NEW GOAL
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[
              { id: 'ongoing', label: 'Active', count: stats.ongoing, color: 'text-sky-400', border: view === 'ongoing' ? 'border-sky-500/50 bg-sky-500/5' : '' },
              { id: 'scheduled', label: 'Scheduled', count: stats.scheduled, color: 'text-amber-400', border: view === 'scheduled' ? 'border-amber-500/50 bg-amber-500/5' : '' },
              { id: 'succeeded', label: 'Succeeded', count: stats.succeeded, color: 'text-emerald-400', border: view === 'succeeded' ? 'border-emerald-500/50 bg-emerald-500/5' : '' },
              { id: 'failed', label: 'Failed', count: stats.failed, color: 'text-rose-400', border: view === 'failed' ? 'border-rose-500/50 bg-rose-500/5' : '' },
            ].map(stat => (
              <button
                key={stat.id}
                onClick={() => setView(stat.id)}
                className={`flex items-center justify-between p-3 rounded-lg border ${THEME.border} ${THEME.cardBg} hover:bg-white/5 transition-all text-left group cursor-pointer ${stat.border}`}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 group-hover:text-neutral-300 transition-colors">
                  {stat.label}
                </span>
                <span className={`text-xl font-mono font-bold ${stat.color}`}>
                  {stat.count}
                </span>
              </button>
            ))}
          </div>
        </header>

        {/* TIMELINE & SORTING */}
        <section className="mb-4 flex items-center justify-between gap-4">
          <div className={`flex-1 h-1.5 bg-neutral-900 rounded-full overflow-hidden flex relative`}>
            <div className="h-full bg-gradient-to-r from-emerald-900 via-sky-900 to-emerald-900 w-full opacity-30" />
          </div>
          <div className="flex items-center bg-neutral-900/40 border border-white/5 px-1 py-1 rounded-lg">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-[10px] font-black text-white uppercase tracking-tighter focus:outline-none cursor-pointer appearance-none px-2 text-center"
            >
              <option value="progress" className="bg-neutral-950 font-black">Progress</option>
              <option value="newest" className="bg-neutral-950 font-black">Newest</option>
              <option value="oldest" className="bg-neutral-950 font-black">Oldest</option>
            </select>
          </div>
        </section>

        {/* GOALS GRID */}
        {isLoading ? (
          <div className="text-center py-20 text-neutral-600 text-sm font-mono animate-pulse">Scanning database...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredGoals.length === 0 && (
              <div className="col-span-full text-center py-20 border border-dashed border-white/5 rounded-xl">
                <p className="text-neutral-500 text-sm">No goals found in this view.</p>
              </div>
            )}

            {filteredGoals.map(goal => {
              const progressLog = getProgressLog(goal);
              const isLogExpanded = expandedLogId === goal.id;
              const isLoggingThis = logProgressId === goal.id;
              const isEditingThis = editProgressId === goal.id;
              const latestEntry = progressLog[0]; // for last-logged hint

              return (
                <div key={goal.id} className={`group relative rounded-xl border ${THEME.border} ${THEME.cardBg} hover:border-white/10 transition-all flex flex-col`}>
                  {/* Card Body */}
                  <div className="p-4 flex flex-col flex-1">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-sm font-bold text-white leading-tight line-clamp-2 pr-6" title={goal.name}>
                        {goal.name}
                      </h3>
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <button
                          onClick={() => {
                            setEditingGoal(goal);
                            setFormData({
                              name: goal.name,
                              importance: goal.importance.toString(),
                              achievability: goal.achievability.toString(),
                              due: goal.due || '',
                              startDate: goal.startDate,
                              enabledTypes: goal.enabledTypes || ['percentage'],
                              targets: goal.targets || { percentage: 100, time: 0, rate: 0 },
                              targetHours: goal.targets?.time ? Math.floor(goal.targets.time / 60).toString() : '',
                              targetMinutes: goal.targets?.time ? (goal.targets.time % 60).toString() : '',
                              targetTotal: goal.targets?.rate ? goal.targets.rate.toString() : '',
                              roadmapId: goal.roadmapId || null,
                              journalId: goal.journalId || null
                            });
                            setIsAddModalOpen(true);
                          }}
                          className="text-neutral-600 hover:text-sky-400 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <IconEdit />
                        </button>
                        <button
                          onClick={() => deleteGoal(goal)}
                          className="text-neutral-600 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="flex items-center gap-2 mb-4 text-[10px] font-mono text-neutral-500 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                        <IconCalendar />
                        <span>{new Date(goal.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        <span className="text-neutral-700">→</span>
                        <span className={goal.due ? 'text-neutral-300' : 'text-neutral-700'}>
                          {goal.due ? new Date(goal.due).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '∞'}
                        </span>
                      </div>
                      {goal.due && goal.status === 'ongoing' && (() => {
                        const remaining = getTimeRemaining(goal.due);
                        if (!remaining) return null;
                        return (
                          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${remaining.color}`}>
                            {remaining.text}
                          </span>
                        );
                      })()}
                      <StatusBadge status={goal.status} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRoadmapNavigation(goal);
                        }}
                        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded border transition-all cursor-pointer ${goal.roadmapId
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
                          : 'bg-white/5 border-dashed border-white/10 text-neutral-500 hover:text-neutral-300 hover:border-white/30'
                          }`}
                        title={goal.roadmapId ? "View Strategy Roadmap" : "Initialize Strategy Roadmap"}
                      >
                        <IconRoadmap size={10} className={goal.roadmapId ? "text-emerald-400" : "text-neutral-600"} />
                        <span className="text-[9px] font-black uppercase tracking-wider">
                          {goal.roadmapId ? 'STRATEGY' : 'ADD ROADMAP'}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSkillNavigation(goal);
                        }}
                        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded border transition-all cursor-pointer ${goal.skillId
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.05)]'
                          : 'bg-white/5 border-dashed border-white/10 text-neutral-500 hover:text-neutral-300 hover:border-white/30'
                          }`}
                        title={goal.skillId ? "View Skill Growth" : "Initialize Skill Growth"}
                      >
                        <IconSkill size={10} className={goal.skillId ? "text-amber-400" : "text-neutral-600"} />
                        <span className="text-[9px] font-black uppercase tracking-wider">
                          {goal.skillId ? 'SKILLS' : 'ADD SKILL'}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJournalNavigation(goal);
                        }}
                        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded border transition-all cursor-pointer ${goal.journalId
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.05)]'
                          : 'bg-white/5 border-dashed border-white/10 text-neutral-500 hover:text-neutral-300 hover:border-white/30'
                          }`}
                        title={goal.journalId ? "View Goal Journal" : "Create Goal Journal"}
                      >
                        <IconJournal size={10} className={goal.journalId ? "text-blue-400" : "text-neutral-600"} />
                        <span className="text-[9px] font-black uppercase tracking-wider">
                          {goal.journalId ? 'JOURNAL' : 'ADD JOURNAL'}
                        </span>
                      </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 mb-4 text-[10px] font-mono">
                      <div className="bg-black/20 p-1.5 rounded border border-white/5">
                        <div className="text-neutral-600 mb-0.5">IMP</div>
                        <div className="text-amber-400 font-bold">{goal.importance}/10</div>
                      </div>
                      <div className="bg-black/20 p-1.5 rounded border border-white/5">
                        <div className="text-neutral-600 mb-0.5">ACH</div>
                        <div className="text-emerald-400 font-bold">{goal.achievability}/10</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-auto">
                      {/* Progress label row */}
                      <div className="mb-1.5 flex justify-between items-center">
                        <span className="text-[10px] text-neutral-500">
                          OVERALL PROGRESS
                        </span>
                        {/* Current value display — click to set directly */}
                        <button
                          onClick={() => {
                            if (goal.status !== 'ongoing') return;
                            setEditProgressId(goal.id);
                            setLogProgressId(null);
                            const primaryType = goal.enabledTypes?.[0] || 'percentage';
                            setLogUnit(primaryType);
                            const val = goal.currentValues?.[primaryType] || 0;
                            if (primaryType === 'time') {
                              setProgressVal(Math.floor(val / 60).toString());
                              setProgressValMin((val % 60).toString());
                            } else {
                              setProgressVal(val.toString());
                            }
                          }}
                          className={`text-2xl font-black font-mono tracking-tighter transition-colors ${goal.status === 'ongoing' ? 'text-white hover:text-emerald-400 cursor-pointer' : 'text-white cursor-default'
                            }`}
                          title={goal.status === 'ongoing' ? 'Click to set total' : undefined}
                        >
                          {goal.progress}%
                        </button>
                      </div>

                      {/* Multi-Bar Display */}
                      {(goal.enabledTypes || []).filter(t => t !== 'percentage').length > 0 && (
                        <div className="space-y-4 mb-4">
                          {(goal.enabledTypes || []).filter(t => t !== 'percentage').map(type => {
                            const target = goal.targets?.[type] || 0;
                            const current = goal.currentValues?.[type] || 0;
                            const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                            const label = type === 'time' ? 'Time' : 'Value';
                            const icon = type === 'time' ? <IconClock size={10} /> : <IconZap size={10} />;

                            return (
                              <div key={type} className="group/track">
                                <div className="flex justify-between items-center mb-1.5 text-[9px] font-mono">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-neutral-500 flex items-center gap-1 group-hover/track:text-neutral-300 transition-colors uppercase">
                                      {icon}{label}
                                    </span>
                                    {goal.due && goal.status === 'ongoing' && (
                                      <DailyTargetBadge
                                        target={target}
                                        current={current}
                                        due={goal.due}
                                        type={type}
                                      />
                                    )}
                                  </div>
                                  <span className="text-neutral-400">
                                    {type === 'time' ? formatTimeMin(current) : Math.round(current)}
                                    <span className="text-neutral-600"> / </span>
                                    {type === 'time' ? formatTimeMin(target) : target}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-neutral-900/50 rounded-full overflow-hidden border border-white/5 relative">
                                  <div
                                    className={`h-full transition-all duration-1000 ${getProgressColor(goal.status, progress)} ${progress >= 90 && goal.status === 'ongoing' ? 'animate-pulse' : ''}`}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Overall Progress Section Label */}
                      <div className="flex items-center gap-2 mb-2 opacity-30">
                        <div className="h-[1px] flex-1 bg-white/20"></div>
                        <div className="flex items-center gap-2">
                          <span className="text-[7px] font-black tracking-[0.2em] text-white uppercase whitespace-nowrap">Integrated Score</span>
                          {goal.due && goal.status === 'ongoing' && (
                            <DailyTargetBadge
                              target={100}
                              current={goal.progress}
                              due={goal.due}
                              type="percentage"
                            />
                          )}
                        </div>
                        <div className="h-[1px] flex-1 bg-white/20"></div>
                      </div>
                      {/* Integrated Hero Bar */}
                      <div className="h-2.5 bg-neutral-900/50 rounded-full overflow-hidden mb-3 relative border border-white/10 shadow-inner">
                        <div
                          className={`h-full transition-all duration-1000 ease-out fill-mode-forwards ${getProgressColor(goal.status, goal.progress)} ${goal.progress >= 90 && goal.status === 'ongoing' ? 'animate-pulse' : ''}`}
                          style={{ width: `${goal.progress}%` }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                      </div>

                      {/* Last logged hint */}
                      {latestEntry && (
                        <div className="text-[9px] text-neutral-700 font-mono mb-2 flex items-center gap-1">
                          <LocalIcon src={clockIcon} size={8} className="text-neutral-700" />
                          Last logged {formatTimestamp(latestEntry.timestamp)}
                        </div>
                      )}

                      {/* Actions row */}
                      {goal.status === 'ongoing' && (
                        <div className="flex items-center gap-2">
                          {/* LOG PROGRESS — now a persistent visible button */}
                          <button
                            onClick={() => {
                              if (isLoggingThis) {
                                setLogProgressId(null);
                              } else {
                                setLogProgressId(goal.id);
                                setEditProgressId(null);
                                const firstActive = goal.enabledTypes?.[0] || 'percentage';
                                setLogUnit(firstActive);
                              }
                              setProgressVal('');
                              setProgressValMin('');
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${isLoggingThis
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 hover:border-emerald-500/40'
                              }`}
                          >
                            <IconPlus className="text-emerald-400" /> LOG PROGRESS
                          </button>

                          <div className="flex-1" />

                          <button
                            onClick={() => updateGoal({ ...goal, status: 'succeeded', progress: 100 })}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded hover:bg-emerald-500/10 hover:text-emerald-400 text-neutral-600 text-[10px] font-bold transition-all border border-transparent hover:border-emerald-500/20 cursor-pointer"
                            title="Mark as done"
                          >
                            <IconCheck /> Done
                          </button>
                          <button
                            onClick={() => updateGoal({ ...goal, status: 'failed' })}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded hover:bg-rose-500/10 hover:text-rose-400 text-neutral-600 text-[10px] font-bold transition-all border border-transparent hover:border-rose-500/20 cursor-pointer"
                            title="Mark as failed"
                          >
                            <IconX /> Fail
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* LOG PROGRESS PANEL — slides in below */}
                  {(isLoggingThis || isEditingThis) && goal.status === 'ongoing' && (
                    <div className="border-t border-emerald-500/20 bg-emerald-950/20 px-4 py-3 rounded-b-xl">
                      <div className="text-[9px] uppercase font-bold text-emerald-500/70 mb-2 tracking-wider">
                        {isLoggingThis ? '+ Log Progress' : '✎ Set Total'}
                      </div>
                      <div className="flex flex-col gap-3">
                        {isLoggingThis && (
                          <div className="grid grid-cols-3 gap-1 p-0.5 bg-black/40 rounded-lg border border-white/5">
                            {[
                              { id: 'percentage', label: '%', icon: null },
                              { id: 'time', label: 'Time', icon: <IconClock size={10} /> },
                              { id: 'rate', label: 'Value', icon: <IconZap size={10} /> },
                            ].filter(u => (goal.enabledTypes || ['percentage']).includes(u.id)).map(u => (
                              <button
                                key={u.id}
                                onClick={() => { setLogUnit(u.id); setProgressVal(''); setProgressValMin(''); }}
                                className={`flex items-center justify-center gap-1 py-1 rounded-md text-[9px] font-bold transition-all ${logUnit === u.id
                                  ? 'bg-emerald-500 text-black'
                                  : 'text-neutral-500 hover:text-neutral-300'
                                  }`}
                              >
                                {u.icon} {u.label}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {logUnit === 'time' ? (
                            <>
                              <input
                                type="number"
                                min="0"
                                className="w-12 bg-black/60 border border-white/15 text-white text-xs px-2 py-1 rounded focus:outline-none focus:border-emerald-500 text-center"
                                value={progressVal}
                                placeholder="h"
                                onChange={(e) => setProgressVal(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleProgressUpdate(goal.id, isLoggingThis)}
                              />
                              <span className="text-neutral-500 text-xs">h</span>
                              <input
                                type="number"
                                min="0" max="59"
                                className="w-12 bg-black/60 border border-white/15 text-white text-xs px-2 py-1 rounded focus:outline-none focus:border-emerald-500 text-center"
                                value={progressValMin}
                                placeholder="m"
                                onChange={(e) => setProgressValMin(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleProgressUpdate(goal.id, isLoggingThis)}
                              />
                              <span className="text-neutral-500 text-xs">m</span>
                            </>
                          ) : (
                            <>
                              <input
                                type="number"
                                className="w-full bg-black/60 border border-white/15 text-white text-xs px-2 py-1 rounded focus:outline-none focus:border-emerald-500 text-center"
                                value={progressVal}
                                placeholder={isLoggingThis ? (logUnit === 'percentage' ? 'Add percentage...' : 'Add value...') : 'Set total...'}
                                onChange={(e) => setProgressVal(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleProgressUpdate(goal.id, isLoggingThis)}
                              />
                              {logUnit === 'percentage' && <span className="text-neutral-500 text-xs">%</span>}
                            </>
                          )}
                          <button
                            onClick={() => handleProgressUpdate(goal.id, isLoggingThis)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold px-3 py-1 rounded transition-colors cursor-pointer flex-shrink-0"
                          >
                            SAVE
                          </button>
                          <button
                            onClick={() => { setLogProgressId(null); setEditProgressId(null); setProgressVal(''); setProgressValMin(''); }}
                            className="text-neutral-600 hover:text-neutral-300 text-[10px] cursor-pointer flex-shrink-0"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LOG HISTORY */}
                  {progressLog.length > 0 && (
                    <div className={`border-t border-white/5 ${(isLoggingThis || isEditingThis) && goal.status === 'ongoing' ? '' : 'rounded-b-xl'}`}>
                      <button
                        onClick={() => setExpandedLogId(isLogExpanded ? null : goal.id)}
                        className="flex items-center justify-between w-full px-4 py-2 text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1">
                          <LocalIcon src={clockIcon} size={10} className="text-neutral-600" />
                          {progressLog.length} log entr{progressLog.length === 1 ? 'y' : 'ies'}
                        </span>
                        <span className="font-mono">{isLogExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isLogExpanded && (
                        <div className="px-4 pb-3 space-y-1.5 max-h-52 overflow-y-auto">
                          {progressLog.map((entry, i) => (
                            <div
                              key={i}
                              className="flex items-start justify-between bg-black/30 rounded px-2 py-1.5 border border-white/5"
                            >
                              <div className="flex items-center gap-1.5">
                                {entry.type === 'time' ? (
                                  <LocalIcon src={clockIcon} size={9} className="text-emerald-500/70" />
                                ) : entry.type === 'rate' ? (
                                  <LocalIcon src={zapIcon} size={9} className="text-amber-500/70" />
                                ) : (
                                  <span className="text-emerald-500/70 text-[9px]">%</span>
                                )}
                                <span className="text-[10px] font-mono font-bold text-emerald-400">
                                  {formatLogAmount(entry)}
                                </span>
                                <span className="text-[9px] text-neutral-700">
                                  {entry.isLogging ? 'logged' : 'set'}
                                </span>
                              </div>
                              <span className="text-[9px] text-neutral-600 font-mono flex-shrink-0 ml-2">
                                {formatTimestamp(entry.timestamp)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
        }
      </div >

      {/* ADD MODAL */}
      {
        isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsAddModalOpen(false); setEditingGoal(null); }} />
            <div className="relative w-full max-w-[360px] bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl p-5 animate-fadeIn">
              <h2 className="text-base font-bold text-white mb-4">{editingGoal ? 'Edit Goal' : 'Create New Goal'}</h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-neutral-500 mb-1">Goal Name</label>
                  <input
                    type="text"
                    className="w-full bg-neutral-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-neutral-700"
                    placeholder="e.g. Learn Rust, Marathon Training..."
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-neutral-500 mb-1">Importance</label>
                    <input
                      type="number" min="1" max="10"
                      className="w-full bg-neutral-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                      value={formData.importance}
                      onChange={e => setFormData({ ...formData, importance: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-neutral-500 mb-1">Achievability</label>
                    <input
                      type="number" min="1" max="10"
                      className="w-full bg-neutral-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      value={formData.achievability}
                      onChange={e => setFormData({ ...formData, achievability: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-neutral-500 mb-1">Start Date</label>
                    <input
                      type="date"
                      className="w-full bg-neutral-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/20 items-center"
                      value={formData.startDate}
                      onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-neutral-500 mb-1">Due Date</label>
                    <input
                      type="date"
                      className="w-full bg-neutral-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/20"
                      value={formData.due}
                      onChange={e => setFormData({ ...formData, due: e.target.value })}
                    />
                  </div>
                </div>

                {/* PROGRESSION TYPE */}
                <div className="pt-1">
                  <label className="block text-[9px] uppercase font-bold text-neutral-500 mb-2">Trackers (Combinable)</label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { id: 'percentage', label: 'General %', icon: null },
                      { id: 'time', label: 'Time Spent', icon: <IconClock size={10} /> },
                      { id: 'rate', label: 'Quantity', icon: <IconZap size={10} /> },
                    ].map(t => {
                      const isEnabled = formData.enabledTypes.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            const newEnabled = isEnabled
                              ? formData.enabledTypes.filter(id => id !== t.id)
                              : [...formData.enabledTypes, t.id];
                            if (newEnabled.length === 0) newEnabled.push('percentage'); // force at least one
                            setFormData({ ...formData, enabledTypes: newEnabled });
                          }}
                          className={`flex flex-col items-center justify-center p-1.5 rounded-lg border text-[9px] font-bold transition-all ${isEnabled
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                            : 'bg-neutral-900/30 border-white/5 text-neutral-500 hover:border-white/10'
                            }`}
                        >
                          {t.icon && <span className="mb-0.5">{t.icon}</span>}
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  {formData.enabledTypes.includes('time') && (
                    <div className="grid grid-cols-2 gap-3 animate-fadeIn mb-3">
                      <div>
                        <label className="block text-[9px] text-neutral-600 mb-1">Target Hours</label>
                        <input
                          type="number"
                          className="w-full bg-neutral-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                          value={formData.targetHours}
                          onChange={e => setFormData({ ...formData, targetHours: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-neutral-600 mb-1">Target Minutes</label>
                        <input
                          type="number"
                          className="w-full bg-neutral-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                          value={formData.targetMinutes}
                          onChange={e => setFormData({ ...formData, targetMinutes: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {formData.enabledTypes.includes('rate') && (
                    <div className="animate-fadeIn">
                      <label className="block text-[9px] text-neutral-600 mb-1">Target Total (Value)</label>
                      <input
                        type="number"
                        className="w-full bg-neutral-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                        value={formData.targetTotal}
                        onChange={e => setFormData({ ...formData, targetTotal: e.target.value })}
                        placeholder="e.g. 50"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-5 pt-3 border-t border-white/5">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-neutral-400 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  onClick={saveGoal}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-900/20 cursor-pointer"
                >
                  {editingGoal ? 'SAVE CHANGES' : 'CREATE GOAL'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* ROADMAP CHOICE MODAL */}
      {
        roadmapModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => setRoadmapModalOpen(false)} />
            <div className="relative w-full max-w-[320px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl p-6 animate-fadeIn text-center">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <IconRoadmap className="text-emerald-500" size={20} />
              </div>
              <h2 className="text-base font-bold text-white mb-2">Initialize Strategy</h2>
              <p className="text-[10px] text-neutral-500 mb-6 leading-relaxed">
                This goal doesn't have a strategy roadmap linked yet. How would you like to proceed?
              </p>

              <div className="space-y-2">
                <button
                  onClick={createNewRoadmap}
                  className="w-full py-2.5 rounded-xl text-[10px] font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-900/20 cursor-pointer"
                >
                  CREATE NEW ROADMAP
                </button>
                <button
                  onClick={() => {
                    loadRoadmaps();
                    setAttachRoadmapModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl text-[10px] font-bold border border-white/5 text-neutral-300 hover:bg-white/5 transition-all cursor-pointer"
                >
                  ATTACH EXISTING ROADMAP
                </button>
                <button
                  onClick={() => setRoadmapModalOpen(false)}
                  className="w-full py-2.5 rounded-xl text-[10px] font-bold text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* SKILL CHOICE MODAL */}
      {skillModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSkillModalOpen(false)} />
          <div className="relative w-full max-w-[320px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl p-6 animate-fadeIn text-center">
            <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
              <IconSkill className="text-amber-500" size={20} />
            </div>
            <h2 className="text-base font-bold text-white mb-2">Skill Growth</h2>
            <p className="text-[10px] text-neutral-500 mb-6 leading-relaxed">
              Accelerate your expertise with structured skill tracking.
            </p>

            <div className="space-y-2">
              <button
                onClick={createNewSkill}
                className="w-full py-2.5 rounded-xl text-[10px] font-bold bg-amber-600 text-white hover:bg-amber-500 transition-all shadow-lg shadow-amber-900/20 cursor-pointer"
              >
                CREATE NEW SKILL
              </button>
              <button
                onClick={() => {
                  loadSkills();
                  setAttachSkillModalOpen(true);
                }}
                className="w-full py-2.5 rounded-xl text-[10px] font-bold border border-white/5 text-neutral-300 hover:bg-white/5 transition-all cursor-pointer"
              >
                ATTACH EXISTING SKILL
              </button>
              <button
                onClick={() => setSkillModalOpen(false)}
                className="w-full py-2.5 rounded-xl text-[10px] font-bold text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ATTACH EXISTING SKILL MODAL */}
      {attachSkillModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setAttachSkillModalOpen(false)} />
          <div className="relative w-full max-w-[400px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] animate-fadeIn">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Select Skill</h2>
                <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">Existing Expertise</p>
              </div>
              <button onClick={() => setAttachSkillModalOpen(false)} className="text-neutral-500 hover:text-white cursor-pointer transition-colors">
                <IconX size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {existingSkills.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-[10px] text-neutral-600">No skills found.</p>
                </div>
              ) : (
                existingSkills.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => attachExistingSkill(s.id)}
                    className="w-full p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-amber-500/30 transition-all group text-left flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center border border-white/10 group-hover:border-amber-500/30 transition-colors">
                      <IconSkill size={16} className="text-neutral-600 group-hover:text-amber-500 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-neutral-200 truncate group-hover:text-white transition-colors">{s.name}</div>
                      <div className="text-[9px] text-neutral-600 font-mono mt-0.5">
                        {s.phases?.length || 0} phases • {s.lessons?.length || 0} lessons
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-all">
                      <IconPlus className="text-amber-500" />
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="p-4 border-t border-white/5 bg-black/20 rounded-b-2xl">
              <button
                onClick={() => setAttachSkillModalOpen(false)}
                className="w-full py-2 rounded-lg text-[10px] font-bold text-neutral-400 hover:bg-white/5 transition-colors cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOURNAL CHOICE MODAL */}
      {
        journalModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => setJournalModalOpen(false)} />
            <div className="relative w-full max-w-[320px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl p-6 animate-fadeIn text-center">
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                <IconJournal className="text-blue-500" size={20} />
              </div>
              <h2 className="text-base font-bold text-white mb-2">Journal Notes</h2>
              <p className="text-[10px] text-neutral-500 mb-6 leading-relaxed">
                Link this goal to a journal for detailed logs and notes.
              </p>

              <div className="space-y-2">
                <button
                  onClick={createNewJournal}
                  className="w-full py-2.5 rounded-xl text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 cursor-pointer"
                >
                  CREATE NEW JOURNAL
                </button>
                <button
                  onClick={() => {
                    loadJournals();
                    setAttachJournalModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl text-[10px] font-bold border border-white/5 text-neutral-300 hover:bg-white/5 transition-all cursor-pointer"
                >
                  ATTACH EXISTING JOURNAL
                </button>
                <button
                  onClick={() => setJournalModalOpen(false)}
                  className="w-full py-2.5 rounded-xl text-[10px] font-bold text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* ATTACH EXISTING JOURNAL MODAL */}
      {
        attachJournalModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={() => setAttachJournalModalOpen(false)} />
            <div className="relative w-full max-w-[400px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] animate-fadeIn">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">Select Journal</h2>
                  <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">Your Library</p>
                </div>
                <button onClick={() => setAttachJournalModalOpen(false)} className="text-neutral-500 hover:text-white cursor-pointer transition-colors">
                  <IconX size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {existingJournals.length === 0 ? (
                  <div className="py-20 text-center">
                    <p className="text-[10px] text-neutral-600">No journals found.</p>
                  </div>
                ) : (
                  existingJournals.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => attachExistingJournal(j.id, j.title)}
                      className="w-full p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-blue-500/30 transition-all group text-left flex items-center gap-4"
                    >
                      <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center border border-white/10 group-hover:border-blue-500/30 transition-colors">
                        <IconJournal size={16} className="text-neutral-600 group-hover:text-blue-500 transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-neutral-200 truncate group-hover:text-white transition-colors">{j.title}</div>
                        <div className="text-[9px] text-neutral-600 font-mono mt-0.5">
                          Last modified {new Date(j.lastModified).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-all">
                        <IconPlus className="text-blue-500" />
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-white/5 bg-black/20 rounded-b-2xl">
                <button
                  onClick={() => setAttachJournalModalOpen(false)}
                  className="w-full py-2 rounded-lg text-[10px] font-bold text-neutral-400 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* ATTACH EXISTING ROADMAP MODAL */}
      {
        attachRoadmapModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setAttachRoadmapModalOpen(false)} />
            <div className="relative w-full max-w-[400px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] animate-fadeIn">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">Select Roadmap</h2>
                  <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">Existing Strategies</p>
                </div>
                <button onClick={() => setAttachRoadmapModalOpen(false)} className="text-neutral-500 hover:text-white cursor-pointer transition-colors">
                  <IconX size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {existingRoadmaps.length === 0 ? (
                  <div className="py-20 text-center">
                    <p className="text-[10px] text-neutral-600">No existing roadmaps found.</p>
                  </div>
                ) : (
                  existingRoadmaps.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => attachExistingRoadmap(r.id)}
                      className="w-full p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all group text-left flex items-center gap-4"
                    >
                      <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center border border-white/10 group-hover:border-emerald-500/30 transition-colors">
                        <IconRoadmap size={16} className="text-neutral-600 group-hover:text-emerald-500 transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-neutral-200 truncate group-hover:text-white transition-colors">{r.title}</div>
                        <div className="text-[9px] text-neutral-600 font-mono mt-0.5">
                          {r.nodeCount} steps • Updated {formatTimestamp(r.lastModified)}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                        <IconPlus className="text-emerald-500" />
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-white/5 bg-black/20 rounded-b-2xl">
                <button
                  onClick={() => setAttachRoadmapModalOpen(false)}
                  className="w-full py-2 rounded-lg text-[10px] font-bold text-neutral-400 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* DELETE CONFIRMATION MODAL */}
      {
        deleteConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={() => setDeleteConfirmOpen(false)} />
            <div className="relative w-full max-w-[360px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl p-6 animate-fadeIn text-center">
              <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                <IconTrash className="text-rose-500" />
              </div>
              <h2 className="text-base font-bold text-white mb-2">Delete Goal?</h2>
              <p className="text-[10px] text-neutral-500 mb-6 leading-relaxed">
                Are you sure you want to delete <span className="text-neutral-300 font-bold">"{goalToDelete?.name}"</span>?
                This action cannot be undone.
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => handlePerformDelete(false, false)}
                  className="w-full py-2.5 rounded-xl text-[10px] font-bold bg-rose-600 text-white hover:bg-rose-500 transition-all shadow-lg shadow-rose-900/20 cursor-pointer"
                >
                  DELETE GOAL ONLY
                </button>

                {(goalToDelete?.roadmapId || goalToDelete?.journalId || goalToDelete?.skillId) && (
                  <button
                    onClick={() => handlePerformDelete(!!goalToDelete.roadmapId, !!goalToDelete.journalId, !!goalToDelete.skillId)}
                    className="w-full py-2.5 rounded-xl text-[10px] font-bold border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                  >
                    DELETE GOAL {goalToDelete.roadmapId && "& ROADMAP"} {goalToDelete.journalId && "& JOURNAL"} {goalToDelete.skillId && "& SKILL"}
                  </button>
                )}

                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="w-full py-2.5 rounded-xl text-[10px] font-bold text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Goals;