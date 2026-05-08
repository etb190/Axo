// src/renderer/src/components/RoleplayChat.jsx

import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Trash2, User, Briefcase, Calendar, DollarSign, Activity,
  Users, Info, PanelRightOpen, PanelRightClose, Plus, Save
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Navbar from '../Navbar';

// File System Integration
const fs = window.require('fs');
const path = window.require('path');
const fsPromises = fs.promises;

const DB_PATH = "C:\\Users\\PC\\Desktop\\Database\\RP";
const DB_FILE = path.join(DB_PATH, "RP_1950.json");

const LM_STUDIO_URL = "http://127.0.0.1:1234/v1/chat/completions";

// Helper for conditional classes
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const SYSTEM_INSTRUCTION = `
[ROLE]
You are the Game Master of a grounded 1950s Noir Life Simulator.

[CORE RULES - MANDATORY]
1. NO OMNISCIENCE: NPCs do NOT know Robert Monaschi. He is a stranger. They only know what he tells them.
2. NARRATIVE MARKERS: EVERY response MUST use these tags for styling:
   [B] -> For background/environmental descriptions.
   [A] -> For NPC actions, movements, or expressions.
   [S] -> For NPC speech/dialogue.
   EXAMPLE: [B] The room is dim. [A] Henrietta sighs. [S] "Help you?"
3. REALISM: Use subtle 1950s social cues. No cartoon villains.
4. LIMIT: Max 2 lines of text total. 
5. NO ACTING FOR USER: Only describe the world and NPCs.
`;

const RoleplayChat = () => {
  // Game State
  const [gameState, setGameState] = useState({
    name: "Robert Monaschi",
    date: new Date("1950-01-01"),
    money: 50,
    influence: 10,
    job: "Copywriter",
    characters: [] // List of met NPCs: {name, description, temperament}
  });

  const [messages, setMessages] = useState([]);
  const [actionInput, setActionInput] = useState('');
  const [speechInput, setSpeechInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCharData, setNewCharData] = useState({ name: '', description: '', temperament: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const messagesEndRef = useRef(null);
  const hasInitialized = useRef(false);

  // Ensure DB & Load
  useEffect(() => {
    if (!fs.existsSync(DB_PATH)) {
      fs.mkdirSync(DB_PATH, { recursive: true });
    }
    initializeGame();
  }, []);

  const initializeGame = async () => {
    // Try load save
    if (fs.existsSync(DB_FILE)) {
      try {
        const data = await fsPromises.readFile(DB_FILE, 'utf-8');
        const save = JSON.parse(data);
        setMessages(save.messages || []);

        // Reconstitute Date object from string
        if (save.gameState && save.gameState.date) {
          save.gameState.date = new Date(save.gameState.date);
        }

        setGameState(prev => ({ ...prev, ...save.gameState }));
        setConnectionStatus('connected');
        return;
      } catch (e) {
        console.error("Save load failed", e);
      }
    }

    // New Game Init
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      startNewGameLine();
    }
  };

  const callLMStudio = async (messages, temperature = 0.9) => {
    // Force system instruction into the first user turn's context for local models
    const processedMessages = [...messages];
    if (processedMessages.length > 0 && processedMessages[0].role === 'user') {
      processedMessages[0].content = `[SYSTEM INSTRUCTION: ${SYSTEM_INSTRUCTION}]\n\nUser Input: ${processedMessages[0].content}`;
    }

    const response = await fetch(LM_STUDIO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          ...processedMessages
        ],
        temperature: temperature,
        max_tokens: -1,
      })
    });
    if (!response.ok) throw new Error(`LM Studio error: ${response.statusText} `);
    const data = await response.json();
    return data.choices[0].message.content;
  };

  const startNewGameLine = async () => {
    setIsLoading(true);
    setConnectionStatus('checking');
    try {
      const text = await callLMStudio([{ role: "user", content: "Start the simulation. Use [B], [A], [S] markers. Describe the lobby and the secretary. Robert is a stranger to her." }]);

      const initialMsg = {
        id: 'init',
        role: 'model',
        text: text,
        timestamp: new Date().toISOString()
      };

      setMessages([initialMsg]);
      saveGame([initialMsg], gameState);
      setConnectionStatus('connected');

      // Extract secretary from initial scene
      extractCharacters(text, [initialMsg], gameState);
    } catch (error) {
      console.error("Init failed:", error);
      setConnectionStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const saveGame = async (msgs, state) => {
    try {
      await fsPromises.writeFile(DB_FILE, JSON.stringify({
        messages: msgs,
        gameState: state
      }, null, 2));
    } catch (err) {
      console.error("Failed to save:", err);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!actionInput.trim() && !speechInput.trim()) || isLoading) return;

    // Build the formatted roleplay turn
    let combinedText = "";
    if (actionInput.trim()) combinedText += `[Action]: ${actionInput.trim()} `;
    if (speechInput.trim()) combinedText += `[Speech]: "${speechInput.trim()}"`;

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      text: combinedText.trim(),
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setActionInput('');
    setSpeechInput('');
    setIsLoading(true);
    saveGame(updatedMessages, gameState);

    try {
      // Build History for LM Studio
      const historyForApi = updatedMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      // Inject Character Context
      const characterContext = gameState.characters.length > 0
        ? "\n[SYSTEM: Known Characters: " + gameState.characters.map(c => `${c.name} (${c.description}, ${c.temperament})`).join(", ") + "]"
        : "";

      // Add context to latest message
      historyForApi[historyForApi.length - 1].content += characterContext;

      const text = await callLMStudio(historyForApi);

      const aiMsg = {
        id: crypto.randomUUID(),
        role: 'model',
        text: text,
        timestamp: new Date().toISOString()
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      saveGame(finalMessages, gameState);

      // 2. Background Character Extraction
      extractCharacters(text, finalMessages, gameState);

    } catch (err) {
      console.error("API Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const extractCharacters = async (latestText, currentMessages, currentState) => {
    try {
      const knownNames = currentState.characters.map(c => c.name).join(", ");
      const extractionPrompt = `
STORY TEXT: "${latestText}"
KNOWN NPCs: [${knownNames}]

TASK: Identify any NEW, NAMED people mentioned. 
- DO NOT extract people already in KNOWN NPCs.
- DO NOT extract pronouns (She, Her, He, Him, They).
- DO NOT extract generic titles (The woman, The man, The secretary, The boss) UNLESS they are given a proper name in this text.
- If a person is given a name (e.g. "Henrietta"), use that as the name.

FORMAT: [{"name": "...", "temperament": "...", "description": "..."}]
TEMPERAMENT: [Narcissistic, Hostile, Gracious, Cruel, Kind, Arrogant, Subservient, Callous, Warm, Cynical]
DESCRIPTION: Literal physical facts only.
ONLY JSON.`;

      const response = await fetch(LM_STUDIO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Output ONLY a raw JSON array. Use double quotes for all keys and string values. No markdown fences." },
            { role: "user", content: extractionPrompt }
          ],
          temperature: 0,
        })
      });
      const data = await response.json();
      let rawContent = data.choices[0].message.content.trim();

      // Fix common LLM JSON errors before parsing
      const sanitizeJSON = (str) => {
        const match = str.match(/\[[\s\S]*\]/);
        if (!match) return "[]";
        let json = match[0];

        // 1. Fix unquoted keys or single-quoted keys
        json = json.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        json = json.replace(/([{,]\s*)'([a-zA-Z0-9_]+)'\s*:/g, '$1"$2":');

        // 2. Fix single-quoted values, but be careful not to break internal single quotes (like contractions)
        // This regex looks for '...' at the end of a colon or before a comma/bracket
        json = json.replace(/:\s*'([\s\S]*?)'(\s*[,}\]])/g, (m, content, suffix) => {
          // Escape any double quotes in the content and swap outer quotes
          return ': "' + content.replace(/"/g, '\\"') + '"' + suffix;
        });

        // 3. Remove trailing commas
        json = json.replace(/,\s*([\]}])/g, '$1');

        return json;
      };

      const sanitized = sanitizeJSON(rawContent);
      const newChars = JSON.parse(sanitized);

      if (Array.isArray(newChars) && newChars.length > 0) {
        setGameState(prev => {
          const forbiddenNames = ['she', 'her', 'he', 'him', 'they', 'them', 'the woman', 'the man', 'the secretary', 'the boss', 'the person', 'someone'];

          const filtered = newChars.filter(nc => {
            if (!nc.name) return false;
            const nameLower = nc.name.toLowerCase().trim();
            // 1. Filter out known pronouns/generics
            if (forbiddenNames.includes(nameLower)) return false;
            // 2. Filter out duplicates
            if (prev.characters.some(pc => pc.name.toLowerCase() === nameLower)) return false;
            return true;
          });

          if (filtered.length === 0) return prev;

          const updated = { ...prev, characters: [...prev.characters, ...filtered] };
          saveGame(currentMessages, updated);
          return updated;
        });
      }
    } catch (e) {
      console.warn("Character extraction parse failure. AI output was likely malformed.", e);
    }
  };

  const handleManualAdd = (e) => {
    e.preventDefault();
    if (!newCharData.name) return;

    setGameState(prev => {
      const updated = {
        ...prev,
        characters: [...prev.characters, newCharData]
      };
      saveGame(messages, updated);
      return updated;
    });
    setIsModalOpen(false);
    setNewCharData({ name: '', description: '', temperament: '' });
  };

  const clearSave = async () => {
    if (!confirm("Restart Career? This deletes current progress.")) return;
    try {
      if (fs.existsSync(DB_FILE)) await fsPromises.unlink(DB_FILE);
      window.location.reload(); // Simple reload to restart state
    } catch (e) { console.error(e) }
  };

  // Narrative Parser
  const parseNarrative = (text) => {
    if (!text) return null;

    // Split by markers [B], [A], [S] but keep them in the results
    const segments = text.split(/(\[B\]|\[A\]|\[S\])/g).filter(Boolean);
    const result = [];

    let currentMarker = null;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i].trim();
      if (seg === '[B]' || seg === '[A]' || seg === '[S]') {
        currentMarker = seg;
      } else if (currentMarker) {
        result.push({ marker: currentMarker, content: seg });
        currentMarker = null; // reset
      } else {
        // No marker found before text, assume background or user text
        result.push({ marker: '[B]', content: seg });
      }
    }

    return result.map((seg, idx) => {
      switch (seg.marker) {
        case '[B]':
          return <p key={idx} className="text-stone-400 font-light italic leading-relaxed mb-3">{seg.content}</p>;
        case '[A]':
          return <p key={idx} className="text-amber-500/80 font-medium tracking-tight mb-2 flex items-center gap-2 italic">
            <span className="w-1 h-3 bg-amber-900 rounded-full inline-block"></span>
            {seg.content}
          </p>;
        case '[S]':
          return <div key={idx} className="bg-black/20 border-l-2 border-amber-600/50 pl-4 py-2 mt-4 mb-2 text-stone-100 font-serif text-xl tracking-wide italic quote-narrative relative">
            <span className="absolute -left-1 top-0 text-amber-600 opacity-20 text-4xl select-none">"</span>
            {seg.content.replace(/^["']|["']$/g, '')}
            <span className="absolute -right-1 bottom-0 text-amber-600 opacity-20 text-4xl select-none rotate-180">"</span>
          </div>;
        default:
          return <p key={idx} className="mb-2">{seg.content}</p>;
      }
    });
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-screen bg-stone-950 text-stone-200 relative pl-12 overflow-hidden selection:bg-amber-900 selection:text-white" style={{ fontFamily: 'Hedvig, sans-serif' }}>
      <Navbar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full w-full relative">

        {/* HUD / Header (1950s Style) */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-900/90 z-10 shadow-md">

          {/* Character Info */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-amber-500 tracking-wide uppercase">
                {gameState.name}
              </h1>
              <div className="flex items-center gap-2 text-stone-400 text-sm">
                <Briefcase size={14} />
                <span>{gameState.job} at McCormick & Jones</span>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-6 bg-black/40 px-4 py-2 rounded-lg border border-stone-800">
            <div className="flex items-center gap-2 text-amber-100" title="Current Date">
              <Calendar size={16} className="text-amber-600" />
              <span>{gameState.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="h-4 w-px bg-stone-700"></div>
            <div className="flex items-center gap-2 text-green-100" title="Cash on Hand">
              <DollarSign size={16} className="text-green-600" />
              <span>${gameState.money}</span>
            </div>
            <div className="h-4 w-px bg-stone-700"></div>
            <div className="flex items-center gap-2 text-purple-100" title="Influence">
              <Activity size={16} className="text-purple-600" />
              <span>{gameState.influence}</span>
            </div>

            {/* Connection Status Dot */}
            <div className={cn(
              "w-2 h-2 rounded-full ml-2",
              connectionStatus === 'checking' && "bg-yellow-500 animate-pulse",
              connectionStatus === 'connected' && "bg-green-500",
              connectionStatus === 'error' && "bg-red-500"
            )} />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-stone-400 hover:text-amber-500 hover:bg-stone-800 rounded transition-all"
              title="Toggle World Directory"
            >
              {isSidebarOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
            </button>
            <button
              onClick={clearSave}
              className="p-2 text-stone-500 hover:text-red-400 hover:bg-stone-800 rounded transition-all"
              title="Restart Career"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden relative">
          {/* World Directory Sidebar */}
          <aside
            className={cn(
              "bg-stone-900 border-r border-stone-800 transition-all duration-300 ease-in-out flex flex-col overflow-hidden",
              isSidebarOpen ? "w-72" : "w-0"
            )}
          >
            <div className="p-4 border-b border-stone-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-amber-500 uppercase tracking-widest text-xs font-bold font-sans">
                <Users size={14} />
                <span>World Directory</span>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="p-1 hover:bg-stone-800 rounded text-stone-500 hover:text-amber-500"
                title="Add Entry"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {gameState.characters.length === 0 ? (
                <div className="text-center p-8 text-stone-600 text-xs italic font-sans">
                  No known contacts. The world is a sea of strangers.
                </div>
              ) : (
                gameState.characters.map((char, i) => (
                  <div key={i} className="p-3 bg-black/30 border border-stone-800 rounded-lg space-y-2 group hover:border-amber-900/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <h3 className="text-amber-600 font-bold text-sm tracking-wide">{char.name}</h3>
                      <Info size={12} className="text-stone-700 group-hover:text-amber-800" />
                    </div>
                    <div className="text-[11px] text-stone-300 leading-relaxed font-sans mt-1">
                      {char.description}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      <span className="text-[9px] uppercase tracking-tighter text-stone-500 font-bold">Temperament:</span>
                      <div className="px-1.5 py-0.5 bg-amber-900/20 text-amber-500 rounded text-[10px] uppercase font-bold tracking-tighter border border-amber-900/30">
                        {char.temperament}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* Narrative Log */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-transparent bg-[#111] bg-opacity-95">
            {messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={cn(
                  "flex flex-col gap-1 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}
              >
                <div className={cn(
                  "px-6 py-4 rounded-lg shadow-lg border w-full",
                  msg.role === 'user'
                    ? "bg-stone-800 text-stone-100 border-stone-700 rounded-br-none max-w-[80%] ml-auto"
                    : "bg-[#1c1c1c] text-stone-300 border-stone-800 rounded-bl-none font-light max-w-full"
                )}>
                  {msg.role === 'user' ? (
                    <div className="flex flex-col gap-2">
                      {(() => {
                        const hasAction = msg.text.includes('[Action]:');
                        const hasSpeech = msg.text.includes('[Speech]:');

                        let actionText = "";
                        let speechText = "";

                        if (hasAction && hasSpeech) {
                          actionText = msg.text.split('[Action]:')[1].split('[Speech]:')[0].trim();
                          speechText = msg.text.split('[Speech]:')[1].trim();
                        } else if (hasAction) {
                          actionText = msg.text.split('[Action]:')[1].trim();
                        } else if (hasSpeech) {
                          speechText = msg.text.split('[Speech]:')[1].trim();
                        } else {
                          speechText = msg.text; // Fallback for raw text
                        }

                        return (
                          <>
                            {actionText && (
                              <div className="flex items-center gap-2 opacity-50 mb-1">
                                <Activity size={12} className="text-stone-400" />
                                <p className="text-sm italic">{actionText}</p>
                              </div>
                            )}
                            {speechText && (
                              <p className="text-xl font-bold tracking-tight text-amber-500 font-serif leading-tight">
                                "{speechText.replace(/^["']|["']$/g, '')}"
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {parseNarrative(msg.text)}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading / Writing Indicator */}
            {isLoading && (
              <div className="max-w-4xl mx-auto w-full flex items-center gap-2 text-amber-700 animate-pulse mt-4">
                <div className="text-sm font-mono tracking-widest uppercase">Typewriter active...</div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Action Input */}
        <div className="p-6 bg-stone-900 border-t border-stone-800 z-20">
          <form
            onSubmit={handleSend}
            className="max-w-4xl mx-auto flex flex-col gap-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-widest text-stone-500 ml-1">Physical Action</label>
                <input
                  value={actionInput}
                  onChange={(e) => setActionInput(e.target.value)}
                  placeholder="e.g. Adjusts tie, walks forward..."
                  className="bg-black/50 border border-stone-700 rounded-md px-4 py-3 text-stone-100 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 placeholder-stone-700 transition-all text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-widest text-stone-500 ml-1">Dialogue</label>
                <input
                  value={speechInput}
                  onChange={(e) => setSpeechInput(e.target.value)}
                  placeholder="e.g. 'Good morning, I'm Robert...'"
                  className="bg-black/50 border border-stone-700 rounded-md px-4 py-3 text-stone-100 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 placeholder-stone-700 transition-all text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={(!actionInput.trim() && !speechInput.trim()) || isLoading}
              className="w-full py-2 bg-amber-700 hover:bg-amber-600 hover:scale-[1.01] active:scale-95 text-stone-900 font-bold rounded-md shadow-lg transition-all disabled:opacity-50 disabled:pointer-events-none uppercase tracking-widest text-sm"
            >
              Commit Turn
            </button>
          </form>
        </div>

      </div>

      {/* Manual Char Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleManualAdd} className="bg-stone-900 border border-stone-800 p-6 rounded-xl w-full max-w-md shadow-2xl space-y-4">
            <h2 className="text-amber-500 text-lg font-bold tracking-widest uppercase mb-4">Add Character</h2>
            <div className="space-y-3">
              <input
                placeholder="Character Name"
                value={newCharData.name}
                onChange={(e) => setNewCharData({ ...newCharData, name: e.target.value })}
                className="w-full bg-black/50 border border-stone-700 p-3 rounded text-white"
                autoFocus
                required
              />
              <input
                placeholder="Description (e.g. Sharp-eyed blonde secretary)"
                value={newCharData.description}
                onChange={(e) => setNewCharData({ ...newCharData, description: e.target.value })}
                className="w-full bg-black/50 border border-stone-700 p-3 rounded text-white"
              />
              <input
                placeholder="Temperament (e.g. Strict)"
                value={newCharData.temperament}
                onChange={(e) => setNewCharData({ ...newCharData, temperament: e.target.value })}
                className="w-full bg-black/50 border border-stone-700 p-3 rounded text-white"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 text-stone-500 hover:text-stone-300 font-bold uppercase text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-amber-700 text-stone-900 rounded font-bold uppercase text-xs hover:bg-amber-600"
              >
                Save NPC
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default RoleplayChat;