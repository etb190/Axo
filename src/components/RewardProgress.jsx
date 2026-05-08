import React, { useState, useEffect } from "react";
import { useData } from "../contexts/DataContext";
import PlusIcon from "../assets/icons/plus.svg";
import TrashIcon from "../assets/icons/delete.svg";
import BookIcon from "../assets/icons/book.svg";
import ClockIcon from "../assets/icons/clock.svg";
import CloseIcon from "../assets/icons/close.svg";
import CheckIcon from "../assets/icons/check.svg";
import TargetIcon from "../assets/icons/goals.svg";
import EditIcon from "../assets/icons/edit.svg";
import ListIcon from "../assets/icons/todos.svg";
import PlayIcon from "../assets/icons/play.svg";
import StopIcon from "../assets/icons/stop.svg";
import ZapIcon from "../assets/icons/zap.svg";
import FinanceIcon from "../assets/icons/Finances.svg";
import AccountIcon from "../assets/icons/accounts.svg";

const fs = window.require("fs").promises;
const path = window.require("path");

const BASE_DB = "C:\\Users\\PC\\Desktop\\database";
const REWARDS_DIR = path.join(BASE_DB, "Rewards");
const REWARDS_FILE = path.join(REWARDS_DIR, "rewards.json");

const RewardProgress = ({ showNavbar = true }) => {
  const { data } = useData();
  const [rewards, setRewards] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const openModalForAdd = () => {
    setTitle("");
    setBookReqs([]);
    setTimeReqs([]);
    setTodoReqs([]);
    setEditingId(null);
    setGrantedHours("");
    setGrantedMinutes("");
    setPhysicalReward("");
    setError("");
    setIsModalOpen(true);
  };

  const openModalForEdit = (reward) => {
    setTitle(reward.title);
    setBookReqs(reward.requirements?.books || []);
    setTimeReqs(reward.requirements?.time || []);
    setTodoReqs(reward.requirements?.todos || []);
    setEditingId(reward.id);
    setGrantedHours(reward.grantedHours || "");
    setGrantedMinutes(reward.grantedMinutes || "");
    setPhysicalReward(reward.physicalReward || "");
    setError("");
    setIsModalOpen(true);
  };

  // Form states
  const [title, setTitle] = useState("");
  const [grantedHours, setGrantedHours] = useState("");
  const [grantedMinutes, setGrantedMinutes] = useState("");
  const [physicalReward, setPhysicalReward] = useState("");

  // Dynamic lists of requirements
  const [bookReqs, setBookReqs] = useState([]); // [{ bookName, targetPages, baselinePages }]
  const [timeReqs, setTimeReqs] = useState([]); // [{ taskName, targetHours, timeframe }]
  const [todoReqs, setTodoReqs] = useState([]); // [{ text: "", isCompleted: false }]
  const [globalCountdownStatus, setGlobalCountdownStatus] = useState("idle"); // "idle" | "active"
  const [globalCountdownLastStarted, setGlobalCountdownLastStarted] = useState(null);
  const [globalCountdownDebt, setGlobalCountdownDebt] = useState(0);
  const [activeTab, setActiveTab] = useState("pending");

  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    loadRewards();
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadRewards = async () => {
    try {
      await fs.mkdir(REWARDS_DIR, { recursive: true });
      try {
        const raw = await fs.readFile(REWARDS_FILE, "utf8");
        const parsed = JSON.parse(raw);
        setRewards(parsed.rewards || []);
        if (parsed.globalState) {
          setGlobalCountdownStatus(parsed.globalState.status || "idle");
          setGlobalCountdownLastStarted(parsed.globalState.lastStarted || null);
          setGlobalCountdownDebt(parsed.globalState.overdrawnSeconds || 0);
        } else {
          // Migration logic for old structure
          setRewards(Array.isArray(parsed) ? parsed : []);
        }
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
        setRewards([]);
      }
    } catch (error) {
      console.error("Failed to load rewards", error);
    }
  };

  const saveRewards = async (newRewards, globalStateOverride) => {
    try {
      await fs.mkdir(REWARDS_DIR, { recursive: true });
      const tempPath = REWARDS_FILE + ".tmp";
      const payload = {
        rewards: newRewards,
        globalState: {
          status: globalStateOverride ? globalStateOverride.status : globalCountdownStatus,
          lastStarted: globalStateOverride !== undefined ? globalStateOverride.lastStarted : globalCountdownLastStarted,
          overdrawnSeconds: globalStateOverride !== undefined ? (globalStateOverride.overdrawnSeconds ?? globalCountdownDebt) : globalCountdownDebt
        }
      };
      await fs.writeFile(tempPath, JSON.stringify(payload, null, 2));
      await fs.rename(tempPath, REWARDS_FILE);
      setRewards(newRewards);
      if (globalStateOverride) {
        setGlobalCountdownStatus(globalStateOverride.status);
        setGlobalCountdownLastStarted(globalStateOverride.lastStarted);
        if (globalStateOverride.overdrawnSeconds !== undefined) {
          setGlobalCountdownDebt(globalStateOverride.overdrawnSeconds);
        }
      }
    } catch (error) {
      console.error("Failed to save rewards", error);
    }
  };

  const toggleGlobalCountdown = async () => {
    let overrideState;
    if (globalCountdownStatus === "active") {
      // Pausing: subtract time from a reward
      let totalToClear = Math.floor((Date.now() - new Date(globalCountdownLastStarted).getTime()) / 1000) + globalCountdownDebt;
      let updatedRewards = [...rewards];

      // Sort a copy of unlocked rewards by creation time (oldest first)
      let unlockedRewards = updatedRewards
        .filter(r => r.status === "unlocked" && (r.remainingSeconds || 0) > 0)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Greedily subtract from rewards with remaining seconds, oldest first
      for (let r of unlockedRewards) {
        if (totalToClear <= 0) break;
        const subAmt = Math.min(totalToClear, r.remainingSeconds);
        r.remainingSeconds -= subAmt;
        totalToClear -= subAmt;
      }

      // Leftover totalToClear becomes the new globalCountdownDebt
      overrideState = { status: "idle", lastStarted: null, overdrawnSeconds: totalToClear };
      await saveRewards(updatedRewards, overrideState);
    } else {
      overrideState = { status: "active", lastStarted: new Date().toISOString() };
      await saveRewards(rewards, overrideState);
    }
  };

  const getBookDetails = (name) => {
    if (!data?.reading?.shelves) return null;
    for (const shelf of Object.values(data.reading.shelves)) {
      const book = shelf.find((b) => b.name === name);
      if (book) return book;
    }
    return null;
  };

  const getAllBooks = () => {
    if (!data?.reading?.shelves) return [];
    let all = [];
    for (const shelf of Object.values(data.reading.shelves)) {
      all = [...all, ...shelf];
    }
    return all;
  };

  const uniqueTasks = () => {
    // If tasks are exported from tasks.json, use those. 
    // Otherwise calculate a fallback from past sessions.
    if (data?.time?.workTasks) {
      return data.time.workTasks.map(t => t.name);
    }
    if (!data?.time?.allSessions) return [];
    const tasks = new Set();
    data.time.allSessions.forEach((s) => {
      if (s.taskName) tasks.add(s.taskName);
    });
    return Array.from(tasks);
  };

  const handleSaveReward = async (e) => {
    e.preventDefault();
    setError("");

    if (
      bookReqs.length === 0 &&
      timeReqs.length === 0 &&
      todoReqs.length === 0
    ) {
      setError("Please add at least one requirement to unlock the reward.");
      return;
    }

    const existingReward = editingId
      ? rewards.find((r) => r.id === editingId)
      : null;
    const existingBookReqs = existingReward
      ? existingReward.requirements?.books || []
      : [];

    // Snapshot current pages as baselines for new book requirements
    const initializedBookReqs = bookReqs.map((req) => {
      // If targetAll is checked, baseline is ALWAYS 0 (count all pages ever read)
      if (req.targetAll) {
        return { ...req, baselinePages: 0 };
      }

      const existingReq = existingBookReqs.find(
        (er) => er.bookName === req.bookName,
      );
      if (existingReq && existingReq.baselinePages !== undefined) {
        return { ...req, baselinePages: existingReq.baselinePages };
      }
      const book = getBookDetails(req.bookName);
      return {
        ...req,
        baselinePages: book?.progress?.current || 0,
      };
    });

    const hasHours = grantedHours && parseFloat(grantedHours) > 0;
    const hasMinutes = grantedMinutes && parseFloat(grantedMinutes) > 0;
    const gHoursVal = hasHours ? parseFloat(grantedHours) : null;
    const gMinutesVal = hasMinutes ? parseFloat(grantedMinutes) : null;
    const totalGrantedSeconds = (gHoursVal || 0) * 3600 + (gMinutesVal || 0) * 60;

    if (editingId) {
      const updatedReward = {
        ...existingReward,
        title,
        grantedHours: gHoursVal,
        grantedMinutes: gMinutesVal,
        physicalReward: physicalReward.trim() || null,
        isPhysicalRewardUsed: existingReward && existingReward.physicalReward === physicalReward.trim() ? existingReward.isPhysicalRewardUsed : false,
        remainingSeconds: (existingReward.grantedHours !== gHoursVal || existingReward.grantedMinutes !== gMinutesVal)
          ? totalGrantedSeconds
          : existingReward.remainingSeconds,
        requirements: {
          books: initializedBookReqs,
          time: timeReqs,
          todos: todoReqs,
        },
      };
      const updatedRewards = rewards.map((r) =>
        r.id === editingId ? updatedReward : r,
      );
      await saveRewards(updatedRewards);
    } else {
      const newReward = {
        id: Date.now().toString(),
        title,
        status: "locked",
        createdAt: new Date().toISOString(),
        grantedHours: gHoursVal,
        grantedMinutes: gMinutesVal,
        physicalReward: physicalReward.trim() || null,
        isPhysicalRewardUsed: false,
        remainingSeconds: totalGrantedSeconds > 0 ? totalGrantedSeconds : null,
        countdownStatus: "idle",
        requirements: {
          books: initializedBookReqs,
          time: timeReqs,
          todos: todoReqs,
        },
      };
      await saveRewards([newReward, ...rewards]);
    }

    setIsModalOpen(false);

    // Reset form
    setTitle("");
    setBookReqs([]);
    setTimeReqs([]);
    setTodoReqs([]);
    setPhysicalReward("");
    setEditingId(null);
  };

  const deleteReward = async (id) => {
    const updated = rewards.filter((r) => r.id !== id);
    await saveRewards(updated);
  };

  const unlockReward = async (id) => {
    const rewardToUnlock = rewards.find(r => r.id === id);
    if (!rewardToUnlock) return;

    let debt = globalCountdownDebt;
    let newRemaining = rewardToUnlock.remainingSeconds || 0;

    if (debt > 0 && newRemaining > 0) {
      const deduction = Math.min(debt, newRemaining);
      newRemaining -= deduction;
      debt -= deduction;
    }

    const updated = rewards.map((r) =>
      r.id === id ? { ...r, status: "unlocked", remainingSeconds: newRemaining } : r,
    );
    await saveRewards(updated, { overdrawnSeconds: debt });
  };

  const togglePhysicalRewardUsed = async (id) => {
    const updated = rewards.map((r) =>
      r.id === id ? { ...r, isPhysicalRewardUsed: !r.isPhysicalRewardUsed } : r,
    );
    await saveRewards(updated);
  };

  const toggleTodo = async (rewardId, todoIndex) => {
    const updatedRewards = rewards.map((r) => {
      if (r.id === rewardId && r.status !== "unlocked") {
        const newTodos = [...(r.requirements?.todos || [])];
        if (newTodos[todoIndex]) {
          newTodos[todoIndex] = {
            ...newTodos[todoIndex],
            isCompleted: !newTodos[todoIndex].isCompleted,
          };
        }
        return {
          ...r,
          requirements: {
            ...r.requirements,
            todos: newTodos,
          },
        };
      }
      return r;
    });
    await saveRewards(updatedRewards);
  };

  const calculateRequirementProgress = (reward) => {
    const details = [];
    let totalPercent = 0;
    let count = 0;

    // legacy support for flat structure
    const books =
      reward.requirements?.books ||
      (reward.requirementType === "book"
        ? [
          {
            bookName: reward.bookName,
            targetPages: reward.targetPages,
            baselinePages: reward.baselinePages,
          },
        ]
        : []);
    const times =
      reward.requirements?.time ||
      (reward.requirementType === "time"
        ? [
          {
            taskName: reward.taskName,
            targetHours: reward.targetHours,
            timeframe: reward.timeframe,
          },
        ]
        : []);

    // Process Books
    books.forEach((req) => {
      const book = getBookDetails(req.bookName);
      let current = 0;
      if (book) {
        const currentPages = book.progress.current;
        current = Math.max(0, currentPages - (req.baselinePages || 0));
      }
      const target = req.targetPages;
      const percent = Math.min(100, (current / target) * 100);

      details.push({
        type: "book",
        label: req.targetAll ? `Finish ${req.bookName}` : `Read ${req.bookName}`,
        current,
        target,
        percent,
        metric: "pages",
        cover: book?.cover,
      });
      totalPercent += percent;
      count++;
    });

    // Process Time
    const sessions = data?.time?.allSessions || [];
    const now = new Date();

    times.forEach((req) => {
      let loggedSeconds = 0;

      sessions.forEach((s) => {
        if (s.taskName !== req.taskName) return;

        const sStart = new Date(s.startTime);
        let duration = s.durationSeconds || 0;

        if (s.stopTime === null) {
          duration = Math.floor((now.getTime() - sStart.getTime()) / 1000);
        }

        if (req.timeframe === "24h") {
          const twentyFourHoursAgo = new Date(
            now.getTime() - 24 * 60 * 60 * 1000,
          );
          if (sStart >= twentyFourHoursAgo) {
            loggedSeconds += duration;
          }
        } else if (req.timeframe === "since_creation") {
          const createdAt = new Date(reward.createdAt);
          if (sStart >= createdAt) {
            loggedSeconds += duration;
          }
        }
      });

      const current = loggedSeconds / 3600;
      const target = req.targetHours;
      const percent = Math.min(100, (current / target) * 100);

      details.push({
        type: "time",
        label: `Log time on ${req.taskName} ${req.timeframe === "24h" ? "(24h)" : ""}`,
        current,
        target,
        percent,
        metric: "hrs",
      });
      totalPercent += percent;
      count++;
    });

    const todos = reward.requirements?.todos || [];

    // Process Todos
    todos.forEach((req, index) => {
      details.push({
        type: "todo",
        label: req.text,
        current: req.isCompleted ? 1 : 0,
        target: 1,
        percent: req.isCompleted ? 100 : 0,
        metric: "done",
        index: index,
      });
      totalPercent += req.isCompleted ? 100 : 0;
      count++;
    });

    return {
      overallPercent: count > 0 ? totalPercent / count : 0,
      details,
    };
  };

  const addBookRequirement = () => {
    setBookReqs([...bookReqs, { bookName: "", targetPages: "", targetAll: false }]);
  };

  const addTimeRequirement = () => {
    setTimeReqs([
      ...timeReqs,
      { taskName: "", targetHours: "", timeframe: "24h" },
    ]);
  };

  const updateBookReq = (index, field, value) => {
    const newReqs = [...bookReqs];
    newReqs[index][field] = value;

    // Handle "All Pages" logic
    if (field === "targetAll" && value === true) {
      const book = getBookDetails(newReqs[index].bookName);
      if (book) {
        newReqs[index].targetPages = book.progress.total || book.totalPages || 0;
      }
    } else if (field === "bookName" && newReqs[index].targetAll) {
      const book = getBookDetails(value);
      if (book) {
        newReqs[index].targetPages = book.progress.total || book.totalPages || 0;
      }
    }

    setBookReqs(newReqs);
  };

  const updateTimeReq = (index, field, value) => {
    const newReqs = [...timeReqs];
    newReqs[index][field] = value;
    setTimeReqs(newReqs);
  };

  const removeBookReq = (index) => {
    setBookReqs(bookReqs.filter((_, i) => i !== index));
  };

  const removeTimeReq = (index) => {
    setTimeReqs(timeReqs.filter((_, i) => i !== index));
  };

  const addTodoRequirement = () => {
    setTodoReqs([...todoReqs, { text: "", isCompleted: false }]);
  };

  const updateTodoReq = (index, value) => {
    const newReqs = [...todoReqs];
    newReqs[index].text = value;
    setTodoReqs(newReqs);
  };

  const removeTodoReq = (index) => {
    setTodoReqs(todoReqs.filter((_, i) => i !== index));
  };

  const getRewardRemainingTime = (reward) => {
    if (reward.status !== "unlocked" || !reward.remainingSeconds) return reward.remainingSeconds;

    let effectiveRemaining = reward.remainingSeconds;

    if (globalCountdownStatus === "active" && globalCountdownLastStarted) {
      const totalElapsed = Math.floor((nowTick - new Date(globalCountdownLastStarted).getTime()) / 1000);

      const unlockedRewards = rewards
        .filter(r => r.status === "unlocked" && (r.remainingSeconds || 0) > 0)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      let remainingElapsed = totalElapsed;
      for (const r of unlockedRewards) {
        if (remainingElapsed <= 0) break;
        if (r.id === reward.id) {
          const consumption = Math.min(remainingElapsed, effectiveRemaining);
          effectiveRemaining -= consumption;
          break;
        } else {
          const consumption = Math.min(remainingElapsed, r.remainingSeconds);
          remainingElapsed -= consumption;
        }
      }
    }

    return Math.max(0, effectiveRemaining);
  };

  const formatSeconds = (totalSecs) => {
    if (totalSecs === null || totalSecs === undefined) return "00:00:00";
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = Math.floor(totalSecs % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const calculateTotalPoolSeconds = () => {
    let base = rewards.reduce((acc, r) => {
      if (r.status === 'unlocked' && r.remainingSeconds > 0) {
        return acc + r.remainingSeconds;
      }
      return acc;
    }, 0);

    base -= globalCountdownDebt;

    if (globalCountdownStatus === "active" && globalCountdownLastStarted) {
      const msPassed = nowTick - new Date(globalCountdownLastStarted).getTime();
      base -= Math.floor(msPassed / 1000);
    }
    return base;
  };

  const totalPoolSeconds = calculateTotalPoolSeconds();
  const absPoolSeconds = Math.abs(totalPoolSeconds);
  const poolHours = Math.floor(absPoolSeconds / 3600);
  const poolMins = Math.floor((absPoolSeconds % 3600) / 60);
  const poolSecs = Math.floor(absPoolSeconds % 60);

  const filteredRewards = rewards.filter((r) => {
    const isAchieved = r.status === "unlocked";
    const hasRemainingTime = getRewardRemainingTime(r) > 0;
    const hasRemainingPhysical = r.physicalReward && !r.isPhysicalRewardUsed;
    const hasAnyRemaining = hasRemainingTime || hasRemainingPhysical;

    if (activeTab === "pending") return !isAchieved;
    if (activeTab === "fulfilled") return isAchieved && hasAnyRemaining;
    if (activeTab === "used") return isAchieved && !hasAnyRemaining;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30 p-2 pl-14">
      <div className="max-w-[1200px] mx-auto pt-2">
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={openModalForAdd}
            className="flex items-center gap-1.5 bg-white text-black px-3 py-1.5 rounded-full text-sm font-bold hover:scale-105 transition-transform cursor-pointer"
          >

            New Reward
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-3 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-zinc-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 pl-2">
                Balance
              </div>
              <div className={`text-2xl font-mono font-bold flex items-baseline gap-1 ${totalPoolSeconds < 0 ? 'text-red-500' : 'text-white'}`}>
                {totalPoolSeconds < 0 && <span className="text-red-400 mr-0.5 font-sans">-</span>}
                <span>{String(poolHours).padStart(2, '0')}</span><span className="text-zinc-500 text-xs font-sans">h</span>
                <span>{String(poolMins).padStart(2, '0')}</span><span className="text-zinc-500 text-xs font-sans">m</span>
                <span>{String(poolSecs).padStart(2, '0')}</span><span className="text-zinc-500 text-xs font-sans">s</span>
              </div>
            </div>

            <button
              onClick={toggleGlobalCountdown}
              className={`flex items-center hover:cursor-pointer justify-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${globalCountdownStatus === 'active' ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-blue-500 hover:bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]'}`}
            >
              {globalCountdownStatus === 'active' ? (
                <><img src={StopIcon} className="w-3.5 h-3.5 invert" alt="" /> Pause Usage</>
              ) : (
                <><img src={PlayIcon} className="w-3.5 h-3.5 invert" alt="" /> Use Reward</>
              )}
            </button>
          </div>

          {rewards.filter(r => r.status === 'unlocked' && r.physicalReward && !r.isPhysicalRewardUsed).length > 0 && (
            <div className="pt-3 border-t border-white/5 space-y-2">
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest pl-2">
                Unlocked Items
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {rewards.filter(r => r.status === 'unlocked' && r.physicalReward && !r.isPhysicalRewardUsed).map(r => (
                  <div key={r.id} className="bg-black/30 rounded-lg p-2 px-3 flex items-center justify-between border border-white/5 group/claim">
                    <span className="text-xs font-bold text-zinc-300 truncate pr-2">{r.physicalReward}</span>
                    <button
                      onClick={() => togglePhysicalRewardUsed(r.id)}
                      className="w-5 h-5 rounded-lg border border-white/10 flex items-center justify-center hover:bg-green-500/20 hover:border-green-500/50 transition-colors cursor-pointer"
                    >
                      <img src={CheckIcon} className="w-3 h-3 opacity-0 group-hover/claim:opacity-50" alt="" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-6 border-b border-zinc-800 mb-3 px-2 tracking-wide font-medium">
          <button
            onClick={() => setActiveTab("pending")}
            className={`pb-2.5 text-sm transition-colors border-b-2 cursor-pointer ${activeTab === "pending" ? "border-blue-500 text-blue-400 font-bold" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab("fulfilled")}
            className={`pb-2.5 text-sm transition-colors border-b-2 cursor-pointer ${activeTab === "fulfilled" ? "border-green-500 text-green-400 font-bold" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
          >
            Fulfilled
          </button>
          <button
            onClick={() => setActiveTab("used")}
            className={`pb-2.5 text-sm transition-colors border-b-2 cursor-pointer ${activeTab === "used" ? "border-orange-500 text-orange-400 font-bold" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
          >
            Used
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 pb-10">
          {filteredRewards.map((reward) => {
            const progress = calculateRequirementProgress(reward);
            const isUnlockable =
              progress.overallPercent >= 100 && reward.status === "locked";
            const isUnlocked = reward.status === "unlocked";

            // Check if it's mixed or what primary icon to show
            const hasBooks = progress.details.some((d) => d.type === "book");
            const hasTime = progress.details.some((d) => d.type === "time");
            const hasTodos = progress.details.some((d) => d.type === "todo");

            let typeCount = 0;
            if (hasBooks) typeCount++;
            if (hasTime) typeCount++;
            if (hasTodos) typeCount++;
            const mixed = typeCount > 1;

            return (
              <div
                key={reward.id}
                className="relative group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors"
              >
                <div className="p-3 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-2 rounded-lg flex items-center justify-center ${isUnlocked
                          ? "bg-green-500/20 text-green-400"
                          : "bg-blue-500/20 text-blue-400"
                          }`}
                      >
                        <img
                          src={isUnlocked ? ZapIcon : mixed ? TargetIcon : hasBooks ? BookIcon : hasTime ? ClockIcon : ListIcon}
                          className={`w-[18px] h-[18px] ${isUnlocked ? 'brightness-150' : 'brightness-110'}`}
                          alt=""
                        />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                          {reward.title}
                        </h3>
                        <div className="flex flex-col gap-1.5 mt-1 w-full min-w-[120px]">
                          <div className="text-[10px] text-zinc-500 flex items-center gap-1 uppercase tracking-wider font-bold">
                            {isUnlocked ? (
                              <img src={CheckIcon} className="w-2.5 h-2.5 brightness-150" alt="" />
                            ) : (
                              <img src={AccountIcon} className="w-2.5 h-2.5 opacity-30" alt="" />
                            )}
                            <span className={isUnlocked ? "text-green-500" : ""}>
                              {isUnlocked ? "Unlocked" : "Locked"}
                            </span>
                            <span className="ml-auto tabular-nums">{Math.round(progress.overallPercent)}%</span>
                          </div>
                          {!isUnlocked && (
                            <div className="w-full bg-black/50 h-1 rounded-full overflow-hidden border border-white/5">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
                                style={{ width: `${Math.min(100, progress.overallPercent)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isUnlocked && (
                        <button
                          onClick={() => openModalForEdit(reward)}
                          className="text-zinc-600 hover:text-blue-400 cursor-pointer"
                        >
                          <img src={EditIcon} className="w-3.5 h-3.5 opacity-50 hover:opacity-100" alt="" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteReward(reward.id)}
                        className="text-zinc-600 hover:text-red-400 cursor-pointer"
                      >
                        <img src={TrashIcon} className="w-3.5 h-3.5 opacity-50 hover:opacity-100" alt="" />
                      </button>
                    </div>
                  </div>

                  {!isUnlocked && (
                    <div className="mt-2 flex-1 space-y-1.5">
                      {progress.details.map((req, i) => (
                        <div key={i}>
                          {req.type === "todo" ? (
                            <div
                              className={`flex items-center gap-2 mb-1.5 ${isUnlocked ? "" : "cursor-pointer hover:bg-white/5"} p-1 -ml-1 rounded transition-colors w-max`}
                              onClick={() => {
                                if (!isUnlocked)
                                  toggleTodo(reward.id, req.index);
                              }}
                            >
                              <div className="shrink-0 flex items-center justify-center">
                                {req.current === 1 ? (
                                  <img src={CheckIcon} className="w-3.5 h-3.5 brightness-150" alt="" />
                                ) : (
                                  <div className="w-3.5 h-3.5 border border-zinc-700 rounded-sm" />
                                )}
                              </div>
                              <span
                                className={`text-[11px] font-medium leading-tight ${req.current === 1 ? "text-zinc-500 line-through" : "text-zinc-300"}`}
                              >
                                {req.label}
                              </span>
                            </div>
                          ) : (
                            <div className="flex gap-2 items-start mb-2 group/req">
                              {req.type === "book" && req.cover && (
                                <div className="shrink-0 w-8 h-11 bg-zinc-800 rounded border border-white/5 overflow-hidden shadow-sm">
                                  <img
                                    src={req.cover}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => e.target.style.display = 'none'}
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between text-[11px] text-zinc-400 mb-1 flex-wrap gap-x-2">
                                  <span className="truncate flex-1 min-w-[100px]">
                                    {req.label}
                                  </span>
                                  <span className="font-mono whitespace-nowrap text-right">
                                    {req.current.toFixed(
                                      req.type === "time" ? 1 : 0,
                                    )}{" "}
                                    / {req.target} {req.metric}
                                  </span>
                                </div>
                                <div className="w-full bg-black/50 rounded-full h-1">
                                  <div
                                    className="bg-blue-500 h-1 rounded-full transition-all duration-1000 ease-in-out"
                                    style={{ width: `${req.percent}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isUnlocked && (
                    <div className="mt-2 flex-1 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
                        <img src={CheckIcon} className="w-3.5 h-3.5 brightness-150" alt="" />
                        Reward unlocked! Enjoy.
                      </div>
                      {(reward.grantedHours > 0 || reward.grantedMinutes > 0) && (
                        <div className="mt-2 bg-black/40 rounded-xl p-3 border border-white/5 flex flex-col gap-2 shadow-inner">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Time Balance</span>
                            <span className="text-sm font-mono text-white font-bold tabular-nums">
                              {formatSeconds(getRewardRemainingTime(reward))}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 font-medium italic">
                            {(() => {
                              const liveRem = getRewardRemainingTime(reward);
                              const totalGranted = (reward.grantedHours || 0) * 3600 + (reward.grantedMinutes || 0) * 60;
                              if (liveRem <= 0) return "Time balance depleted";
                              if (globalCountdownStatus === 'active' && liveRem < reward.remainingSeconds) return "Currently using...";
                              return liveRem === totalGranted ? "Full balance available" : "Partially consumed";
                            })()}
                          </div>
                        </div>
                      )}

                      {reward.physicalReward && (
                        <div className="mt-2 bg-black/40 rounded-xl p-3 border border-white/5 flex justify-between items-center group/cardclaim shadow-inner">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Physical Reward</span>
                            <span className={`text-sm font-bold truncate pr-1 ${reward.isPhysicalRewardUsed ? 'text-zinc-600 line-through' : 'text-white'}`}>
                              {reward.physicalReward}
                            </span>
                          </div>
                          {!reward.isPhysicalRewardUsed && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePhysicalRewardUsed(reward.id);
                              }}
                              className="w-7 h-7 rounded-lg border border-white/5 bg-white/5 flex items-center justify-center hover:bg-green-500/20 hover:border-green-500/50 transition-all cursor-pointer shrink-0"
                              title="Mark as used"
                            >
                              <img src={CheckIcon} className="w-3.5 h-3.5 opacity-20 group-hover/cardclaim:opacity-100" alt="" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {isUnlockable && (
                    <button
                      onClick={() => unlockReward(reward.id)}
                      className="w-full mt-2 bg-white text-black text-xs font-bold py-1.5 rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <img src={ZapIcon} className="w-3.5 h-3.5" alt="" />
                      Claim Reward
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredRewards.length === 0 && (
            <div className="col-span-full py-12 text-center text-zinc-500 flex flex-col items-center">
              <img src={ZapIcon} className="w-8 h-8 mb-3 opacity-20" alt="" />
              <p className="text-base text-zinc-400">No {activeTab} rewards found.</p>
              <p className="text-xs mt-1">
                {activeTab === "pending" ? "Create a goal and reward yourself for completing it." : "Keep working on your goals to fulfill your rewards!"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-white/5 shrink-0">
              <h2 className="text-lg font-bold">
                {editingId ? "Edit Reward" : "New Reward"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <img src={CloseIcon} className="w-4 h-4 opacity-50 hover:opacity-100" alt="" />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar p-4 flex-1">
              {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm flex items-center gap-2">
                  <img src={CloseIcon} className="w-4 h-4 invert" style={{ filter: 'sepia(1) saturate(5) hue-rotate(-50deg)' }} alt="" />
                  {error}
                </div>
              )}
              <form
                id="reward-form"
                onSubmit={handleSaveReward}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px] gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Reward Description
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      placeholder="e.g. 5 hours of gaming"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 whitespace-nowrap">
                      Granted Hours
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={grantedHours}
                      onChange={(e) => setGrantedHours(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 whitespace-nowrap">
                      Granted Mins
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      value={grantedMinutes}
                      onChange={(e) => setGrantedMinutes(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Physical Reward (Unlocked upon fulfillment)
                  </label>
                  <input
                    type="text"
                    value={physicalReward}
                    onChange={(e) => setPhysicalReward(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Treat yourself to a pizza"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <label className="text-sm font-bold text-white flex items-center gap-2">
                      <img src={BookIcon} className="w-3.5 h-3.5 opacity-70" alt="" /> Reading Requirements
                    </label>
                    <button
                      type="button"
                      onClick={addBookRequirement}
                      className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded cursor-pointer"
                    >
                      <img src={PlusIcon} className="w-3 h-3 invert" alt="" /> Add Book
                    </button>
                  </div>

                  {bookReqs.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {bookReqs.map((req, index) => (
                        <div
                          key={`book-${index}`}
                          className="flex gap-2 items-start relative bg-black/30 p-3 rounded-xl border border-white/5"
                        >
                          <div className="flex-1 space-y-2">
                            <div className="flex gap-2">
                              {req.bookName && (
                                <div className="shrink-0 w-8 h-11 bg-zinc-800 rounded border border-white/5 overflow-hidden">
                                  <img
                                    src={getBookDetails(req.bookName)?.cover}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => e.target.style.display = 'none'}
                                  />
                                </div>
                              )}
                              <select
                                required
                                value={req.bookName}
                                onChange={(e) =>
                                  updateBookReq(index, "bookName", e.target.value)
                                }
                                className="flex-1 bg-black border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                              >
                                <option value="" disabled>
                                  Choose a book...
                                </option>
                                {getAllBooks().map((b, i) => (
                                  <option key={i} value={b.name}>
                                    {b.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-2 px-1">
                              <input
                                type="checkbox"
                                id={`all-pages-${index}`}
                                checked={req.targetAll || false}
                                onChange={(e) => updateBookReq(index, "targetAll", e.target.checked)}
                                className="w-3 h-3 rounded border-zinc-700 bg-black text-blue-500 focus:ring-blue-500/20"
                              />
                              <label htmlFor={`all-pages-${index}`} className="text-[10px] text-zinc-400 cursor-pointer select-none">
                                All pages
                              </label>
                            </div>
                            <input
                              type="number"
                              required
                              min="1"
                              value={req.targetPages}
                              disabled={req.targetAll}
                              onChange={(e) =>
                                updateBookReq(
                                  index,
                                  "targetPages",
                                  parseInt(e.target.value),
                                )
                              }
                              className={`w-full bg-black border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 ${req.targetAll ? 'opacity-50 cursor-not-allowed' : ''}`}
                              placeholder={req.targetAll ? "Auto-calculating..." : "Target pages (e.g. 25)"}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBookReq(index)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-white/5 cursor-pointer"
                          >
                            <img src={CloseIcon} className="w-3.5 h-3.5 opacity-50" alt="" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {bookReqs.length === 0 && (
                    <p className="text-xs text-zinc-600 italic">
                      No book requirements.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <label className="text-sm font-bold text-white flex items-center gap-2">
                      <img src={ClockIcon} className="w-3.5 h-3.5 opacity-70" alt="" /> Time Requirements
                    </label>
                    <button
                      type="button"
                      onClick={addTimeRequirement}
                      className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded cursor-pointer"
                    >
                      <img src={PlusIcon} className="w-3 h-3 invert" alt="" /> Add Task
                    </button>
                  </div>

                  {timeReqs.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {timeReqs.map((req, index) => (
                        <div
                          key={`time-${index}`}
                          className="flex gap-2 items-start relative bg-black/30 p-3 rounded-xl border border-white/5"
                        >
                          <div className="flex-1 space-y-2">
                            <select
                              required
                              value={req.taskName}
                              onChange={(e) =>
                                updateTimeReq(index, "taskName", e.target.value)
                              }
                              className="w-full bg-black border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                            >
                              <option value="" disabled>
                                Choose a task...
                              </option>
                              {uniqueTasks().map((t, i) => (
                                <option key={i} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                required
                                min="0.1"
                                step="0.1"
                                value={req.targetHours}
                                onChange={(e) =>
                                  updateTimeReq(
                                    index,
                                    "targetHours",
                                    parseFloat(e.target.value),
                                  )
                                }
                                className="w-1/2 bg-black border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                placeholder="Hours"
                              />
                              <select
                                value={req.timeframe}
                                onChange={(e) =>
                                  updateTimeReq(index, "timeframe", e.target.value)
                                }
                                className="w-1/2 bg-black border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                              >
                                <option value="24h">Last 24h</option>
                                <option value="since_creation">
                                  Creation
                                </option>
                              </select>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTimeReq(index)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-white/5 cursor-pointer"
                          >
                            <img src={CloseIcon} className="w-3.5 h-3.5 opacity-50" alt="" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {timeReqs.length === 0 && (
                    <p className="text-xs text-zinc-600 italic">
                      No time requirements.
                    </p>
                  )}
                </div>

                {/* To-Dos Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <label className="text-sm font-bold text-white flex items-center gap-2">
                      <img src={ListIcon} className="w-3.5 h-3.5 opacity-70" alt="" /> To-Do Requirements
                    </label>
                    <button
                      type="button"
                      onClick={addTodoRequirement}
                      className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded cursor-pointer"
                    >
                      <img src={PlusIcon} className="w-3 h-3 invert" alt="" /> Add To-Do
                    </button>
                  </div>

                  {todoReqs.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {todoReqs.map((req, index) => (
                        <div
                          key={`todo-${index}`}
                          className="flex gap-2 items-center relative bg-black/30 p-3 rounded-xl border border-white/5"
                        >
                          <div className="flex-1">
                            <input
                              type="text"
                              required
                              value={req.text}
                              onChange={(e) => updateTodoReq(index, e.target.value)}
                              className="w-full bg-black border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                              placeholder="To-Do Item (e.g. Clean room)"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTodoReq(index)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-white/5 cursor-pointer"
                          >
                            <img src={CloseIcon} className="w-3.5 h-3.5 opacity-50" alt="" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {todoReqs.length === 0 && (
                    <p className="text-xs text-zinc-600 italic">
                      No to-do requirements.
                    </p>
                  )}
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-white/5 bg-zinc-900 shrink-0">
              <button
                type="submit"
                form="reward-form"
                className="w-full bg-white text-black font-bold py-2 rounded-lg text-sm hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                Save Reward
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RewardProgress;
