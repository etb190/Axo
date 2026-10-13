// AppClock — corrects the wall-clock time the app displays.
//
// WHY THIS EXISTS
// Every clock in the app used to call `new Date()` directly, which always
// follows the timezone reported by the operating system. If Windows is set to
// the wrong zone (e.g. a UTC+2 European zone while you actually live at GMT+1),
// or if the timezone changed while Axo was already running (Electron/Chromium
// only reads the OS timezone once at launch), every clock in the app shows a
// time that is off by an hour.
//
// HOW IT'S FIXED
// A single shared clock with selectable modes (persisted in localStorage,
// default = auto):
//   1. auto              — DEFAULT. If the OS reports Africa/Casablanca, the
//                          displayed time is corrected to Morocco's REAL
//                          current legal time using rules bundled here (see
//                          CASABLANCA_* below), because Windows tz data and
//                          Electron's bundled ICU can BOTH be stale. For any
//                          other OS zone, behave exactly like `system`.
//   2. system            — behave exactly like before (zero shift)
//   3. zone:<IANA zone>  — lock the displayed time to a real timezone
//                          (e.g. Etc/GMT). The offset vs. the OS clock is
//                          recomputed every 30s, so DST is handled.
//   4. offset:<minutes>  — raw manual shift (e.g. -60 = one hour back).
//
// The shift is applied by returning a shifted `Date` object, so ALL existing
// local-time formatting code (`getHours()`, `toLocaleTimeString()`, ...)
// displays the corrected time without any rewrite.

import { useEffect, useState } from 'react';

const LS_KEY = 'axo_clock_mode_v1';
const RESYNC_INTERVAL_MS = 30000; // re-derive zone offset every 30s (DST-safe)

// Modes offered in the UI (Home header clock popover).
//
// NOTE — Morocco changed its legal time on 20 September 2026: after eight
// years on permanent GMT+1, the country returned to GMT (UTC+0). Windows
// machines that missed the tz update (and Electron runtimes built before the
// change) still report GMT+1, which makes every clock in the app appear
// exactly ONE HOUR AHEAD. `auto` is the default so the fix works with zero
// user action. The fixed Etc/GMT zones below never carry DST or Ramadan
// rules, so they are immune to that class of stale-data bug.
export const CLOCK_MODES = [
  { id: 'auto', label: 'Auto (recommended)', hint: "Corrects stale Casablanca tz data automatically — Morocco's real time" },
  { id: 'system', label: 'System (raw Windows clock)', hint: 'Follow the OS clock as-is, no correction' },
  { id: 'zone:Etc/GMT', label: 'GMT+0 — fixed', hint: "Morocco's official time since 20 Sep 2026" },
  { id: 'zone:Etc/GMT-1', label: 'GMT+1 — fixed', hint: 'Old Moroccan time (before Sep 2026)' },
  { id: 'offset:-60', label: 'Shift back 1 hour', hint: 'Nudge system time −60 min' },
  { id: 'offset:60', label: 'Shift forward 1 hour', hint: 'Nudge system time +60 min' },
  { id: 'zone:Europe/London', label: 'United Kingdom', hint: 'Europe/London' },
];

// ---------------------------------------------------------------------------
// BUNDLED, AUTHORITATIVE AFRICA/CASABLANCA RULE
// ---------------------------------------------------------------------------
// We deliberately do NOT ask Intl/ICU for the Casablanca offset: both Windows
// tz data and Electron's bundled ICU can be months out of date, which is the
// entire bug this module exists to fix. Instead the legal rules are hardcoded:
//
//   * before 20 Sep 2026  → permanent GMT+1 (rule in force 2018–2026)
//   * from 20 Sep 2026    → permanent GMT+0
//   * during Ramadan      → clocks move forward to GMT+1, then back to GMT+0
//
// Ramadan windows below are astronomical estimates (±1 day, start/end at
// UTC-day granularity) computed from the tabular Islamic calendar:
//   1448 AH: 8 Feb 2027 → 9 Mar 2027
//   1449 AH: 29 Jan 2028 → 27 Feb 2028
//   1450 AH: 18 Jan 2029 → 15 Feb 2029
//   1451 AH: 7 Jan 2030 → 4 Feb 2030
// If one drifts by a day, the manual GMT+1/GMT+0 buttons in the popover cover it.
const CASABLANCA_CUTOVER_UTC = Date.UTC(2026, 8, 20); // 20 Sep 2026 00:00 UTC
const CASABLANCA_RAMADAN_WINDOWS_UTC = [
  [Date.UTC(2027, 1, 8), Date.UTC(2027, 2, 10)],
  [Date.UTC(2028, 0, 29), Date.UTC(2028, 1, 28)],
  [Date.UTC(2029, 0, 18), Date.UTC(2029, 1, 16)],
  [Date.UTC(2030, 0, 7), Date.UTC(2030, 1, 5)],
];

// Minutes east of UTC that Casablanca legally has at instant `t` (epoch ms).
function authoritativeCasablancaOffsetMinutes(t) {
  if (t < CASABLANCA_CUTOVER_UTC) return 60; // old permanent GMT+1
  for (const [start, end] of CASABLANCA_RAMADAN_WINDOWS_UTC) {
    if (t >= start && t < end) return 60; // Ramadan: clocks forward to GMT+1
  }
  return 0; // current permanent GMT+0
}

// The OS-reported IANA zone (cached — Chromium reads it once at launch anyway).
let osZoneCache = null;
export function getOsTimeZone() {
  if (osZoneCache === null) {
    try {
      osZoneCache = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      osZoneCache = null;
    }
  }
  return osZoneCache;
}

let listeners = new Set();

export function getClockMode() {
  try {
    return localStorage.getItem(LS_KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

export function setClockMode(mode) {
  try {
    localStorage.setItem(LS_KEY, mode);
  } catch { /* storage unavailable — keep in-memory behaviour only */ }
  shiftCache = { mode: null, ms: 0, at: 0 }; // apply the new mode immediately
  listeners.forEach((fn) => {
    try { fn(mode); } catch { /* listener errors must never break the clock */ }
  });
}

export function onClockModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Intl formatters are expensive to construct — cache one per zone.
const dtfCache = new Map();
function getZoneFormatter(tz) {
  if (!dtfCache.has(tz)) {
    dtfCache.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }));
  }
  return dtfCache.get(tz);
}

// Minutes east of UTC for `date` rendered in `tz` (e.g. GMT+1 -> 60)
function getZoneOffsetMinutes(date, tz) {
  try {
    const parts = {};
    getZoneFormatter(tz).formatToParts(date).forEach((p) => { parts[p.type] = p.value; });
    const asUTC = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24, // some ICU versions return "24" for midnight
      Number(parts.minute),
      Number(parts.second)
    );
    return Math.round((asUTC - date.getTime()) / 60000);
  } catch {
    return null; // unknown zone — fall back to system
  }
}

let shiftCache = { mode: null, ms: 0, at: 0 };

// Milliseconds to add to a real instant so its LOCAL getters show the chosen
// mode's wall-clock time. Cached briefly so 1-second ticks stay cheap.
export function getShiftMs(now = new Date()) {
  const mode = getClockMode();
  if (mode === 'system' || !mode) return 0;
  if (shiftCache.mode === mode && Date.now() - shiftCache.at < RESYNC_INTERVAL_MS) {
    return shiftCache.ms;
  }

  let ms = 0;
  if (mode.startsWith('zone:')) {
    const tz = mode.slice(5);
    const targetOffset = getZoneOffsetMinutes(now, tz);
    const osOffset = -now.getTimezoneOffset(); // minutes east of UTC (OS zone)
    if (targetOffset !== null) ms = (targetOffset - osOffset) * 60000;
  } else if (mode.startsWith('offset:')) {
    const minutes = Number(mode.slice(7));
    if (Number.isFinite(minutes)) ms = minutes * 60000;
  } else if (mode === 'auto') {
    // Only intervene where the staleness bug is known to bite.
    const osZone = getOsTimeZone();
    if (osZone && osZone.toLowerCase() === 'africa/casablanca') {
      const targetOffset = authoritativeCasablancaOffsetMinutes(now.getTime());
      const osOffset = -now.getTimezoneOffset(); // minutes east of UTC (OS zone)
      ms = (targetOffset - osOffset) * 60000;
    }
  }

  shiftCache = { mode, ms, at: Date.now() };
  return ms;
}

// The corrected "now" — use this wherever the app displays the current time.
export function getNow() {
  return new Date(Date.now() + getShiftMs());
}

// Re-express an existing timestamp (epoch / ISO string / Date) in app time so
// historical entries render on the same clock as "now".
export function toAppTime(date) {
  if (!date) return date;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return d;
  return new Date(d.getTime() + getShiftMs(d));
}

// Diagnostic snapshot for the Home clock popover status line.
export function getClockStatus(now = new Date()) {
  const mode = getClockMode();
  const osZone = getOsTimeZone();
  const osOffsetMinutes = -now.getTimezoneOffset();
  const shiftMinutes = Math.round(getShiftMs(now) / 60000);

  let targetLabel = null;
  if (mode === 'auto' && osZone && osZone.toLowerCase() === 'africa/casablanca') {
    targetLabel = authoritativeCasablancaOffsetMinutes(now.getTime()) === 0
      ? 'GMT+0 (Morocco · current)'
      : 'GMT+1 (Morocco · Ramadan)';
  }

  return { mode, osZone, osOffsetMinutes, shiftMinutes, targetLabel };
}

// React hook for components that tick (clocks, planners, trackers).
export function useAppNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => getNow());
  const [mode, setMode] = useState(() => getClockMode());

  useEffect(() => {
    const timer = setInterval(() => setNow(getNow()), intervalMs);
    const unsubscribe = onClockModeChange((m) => {
      setMode(m);
      setNow(getNow());
    });
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [intervalMs]);

  return now;
}
