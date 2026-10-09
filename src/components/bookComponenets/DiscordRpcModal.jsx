import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import CloseIcon from '../../assets/icons/close.svg';
import CheckIcon from '../../assets/icons/check.svg';

const { ipcRenderer } = window.require('electron');

const DiscordRpcModal = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState({
    isConnected: false,
    isConnecting: false,
    clientId: '',
    currentActivity: null,
  });
  const [clientIdInput, setClientIdInput] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await ipcRenderer.invoke('discord-rpc-get-status');
      if (res) {
        setStatus(res);
        if (!clientIdInput && res.clientId) {
          setClientIdInput(res.clientId);
        }
      }
    } catch (err) {
      console.error('Failed to get Discord RPC status:', err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchStatus();

    const onStatusUpdate = (event, updatedStatus) => {
      setStatus((prev) => ({ ...prev, ...updatedStatus }));
    };

    const onReadingUpdate = (event, readingData) => {
      fetchStatus();
    };

    const onReadingCleared = () => {
      fetchStatus();
    };

    ipcRenderer.on('discord-rpc-status-update', onStatusUpdate);
    ipcRenderer.on('discord-rpc-reading-update', onReadingUpdate);
    ipcRenderer.on('discord-rpc-reading-cleared', onReadingCleared);

    const interval = setInterval(fetchStatus, 3000);

    return () => {
      clearInterval(interval);
      ipcRenderer.removeListener('discord-rpc-status-update', onStatusUpdate);
      ipcRenderer.removeListener('discord-rpc-reading-update', onReadingUpdate);
      ipcRenderer.removeListener('discord-rpc-reading-cleared', onReadingCleared);
    };
  }, [isOpen]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await ipcRenderer.invoke('discord-rpc-save-config', {
        clientId: clientIdInput.trim(),
        enabled,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      fetchStatus();
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestPresence = async () => {
    try {
      await ipcRenderer.invoke('discord-rpc-test-activity', {
        bookTitle: 'Atomic Habits',
        pdfName: 'atomic-habits-james-clear.pdf',
        currentPage: 24,
        totalPages: 320,
      });
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 3000);
      fetchStatus();
    } catch (err) {
      console.error('Failed to send test activity:', err);
    }
  };

  const handleClearPresence = async () => {
    try {
      await ipcRenderer.invoke('discord-rpc-clear-activity');
      fetchStatus();
    } catch (err) {
      console.error('Failed to clear activity:', err);
    }
  };

  if (!isOpen) return null;

  const active = status.currentActivity;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl bg-[#0e0e11] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center text-[#5865F2]">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 127.14 96.36">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Discord Rich Presence
              </h3>
              <p className="text-xs text-zinc-400">PDF Summarizer & Axo Live Status</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                status.isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : status.isConnecting
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  status.isConnected
                    ? 'bg-emerald-400 animate-pulse'
                    : status.isConnecting
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-zinc-500'
                }`}
              />
              {status.isConnected
                ? 'Discord Connected'
                : status.isConnecting
                ? 'Connecting...'
                : 'Discord Closed'}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <img src={CloseIcon} alt="Close" className="w-5 h-5 invert" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {status.lastError && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-200 text-xs">
              <span className="text-base leading-none">⚠️</span>
              <div className="space-y-1">
                <span className="font-bold block text-amber-100">
                  {status.lastError.includes('Invalid Client ID')
                    ? 'Discord Application ID Required'
                    : `Discord Error: ${status.lastError}`}
                </span>
                <p className="text-amber-200/80 text-[11px] leading-relaxed">
                  Discord requires your application's unique Client ID. Enter your Discord Application ID below to display rich presence on your profile.
                </p>
              </div>
            </div>
          )}

          {/* Live Rich Presence Card Preview */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Discord Profile Preview
            </label>
            <div className="bg-[#1e1f22] border border-white/10 rounded-xl p-4 relative overflow-hidden shadow-inner">
              <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl shadow-lg border border-white/20">
                    📖
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#1e1f22] flex items-center justify-center text-[10px] text-white font-bold">
                    ✓
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-0.5">
                    PLAYING A GAME
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    PDF Summarizer
                  </div>

                  <div className="text-xs font-semibold text-zinc-200 mt-1 truncate">
                    {active?.details || (
                      <span className="text-zinc-500 italic">No book actively open in browser</span>
                    )}
                  </div>

                  <div className="text-xs text-zinc-400 truncate">
                    {active?.state || (
                      <span className="text-zinc-600">Waiting for PDF Summarizer signal...</span>
                    )}
                  </div>

                  {active?.timestamps?.start && (
                    <div className="text-[11px] text-zinc-400 mt-1 font-mono">
                      Started: {new Date(active.timestamps.start * 1000).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>

              {active && (
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-emerald-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Broadcasting live from PDF Summarizer extension
                  </span>
                  <button
                    onClick={handleClearPresence}
                    className="text-zinc-400 hover:text-rose-400 text-xs transition-colors underline cursor-pointer"
                  >
                    Clear Presence
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Configuration Form */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Discord Application Client ID
                </label>
                <button
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  className="text-xs text-[#5865F2] hover:underline cursor-pointer"
                >
                  {showGuide ? 'Hide Instructions' : 'How do I get my own?'}
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  placeholder="e.g. 1348943183577714708"
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2] transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold tracking-wide transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savedSuccess ? (
                    <>
                      <img src={CheckIcon} alt="Saved" className="w-4 h-4 invert" />
                      Saved!
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                The name of your Discord Application determines the header title displayed in your Discord profile.
              </p>
            </div>

            {/* Quick guide collapsible */}
            {showGuide && (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs text-zinc-300 animate-in fade-in duration-150">
                <div className="font-bold text-white text-xs">How to customize your Discord presence name:</div>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400 pl-1">
                  <li>
                    Visit{' '}
                    <span className="text-[#5865F2] font-mono select-all">
                      discord.com/developers/applications
                    </span>
                  </li>
                  <li>Click <strong className="text-white">"New Application"</strong> in top right.</li>
                  <li>Enter the name you want to show (e.g. <em className="text-white">PDF Summarizer</em> or <em className="text-white">Reading</em>).</li>
                  <li>Copy the <strong className="text-white">Application ID</strong> from the General Information page and paste it above!</li>
                </ol>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-white/10">
              <div className="text-xs text-zinc-500">
                Local Bridge: <code className="text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded">127.0.0.1:38120</code>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestPresence}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
                >
                  {testSuccess ? '✓ Test Sent to Discord!' : 'Send Test Activity'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DiscordRpcModal;
