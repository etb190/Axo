import { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "./Navbar";

const fs = window.require('fs').promises;
const path = window.require('path');

const EXERCISES = [
    {
        id: 0, cat: "BREATHING", title: "DIAPHRAGMATIC BREATHING",
        instruction: "The foundation of a deep voice. Inhale deeply so your stomach expands while shoulders remain completely still. Place one hand on your chest, one on your belly — only the lower hand should rise.",
        badges: [], timerMin: 5,
        type: "breathingGuide", // animated inhale/exhale guide
    },
    {
        id: 1, cat: "BREATHING", title: "5-20-10 BREATHING ROUTINE",
        instruction: "Breathe in for exactly 5 seconds, hold for 20 seconds, exhale in a steady stream for 10 seconds. Repeat 10 times, three times daily for 21 days.",
        badges: ["21-DAY PROGRAM", "3×/DAY"],
        type: "phaseReps", // phase timer × reps × sets
        phases: [{ name: "INHALE", secs: 5 }, { name: "HOLD", secs: 20 }, { name: "EXHALE", secs: 10 }],
        sets: 3, reps: 10,
    },
    {
        id: 2, cat: "BREATHING", title: "SHARP EXHALATIONS",
        instruction: "Blow out sharply 30 times in rapid succession. This strengthens the abdominal muscles and the diaphragm. Keep each exhalation short and explosive — like fogging a mirror.",
        badges: ["30 REPS", "CORE"],
        type: "repCounter", // just dots, tap each exhalation
        reps: 30,
    },
    {
        id: 3, cat: "BREATHING", title: "NASAL BREATHING",
        instruction: "Always breathe through the nose, never the mouth. Mouth-breathing signals a stressed physiology and constricts the throat. Hold nasal-only breathing for 5 minutes with full awareness.",
        badges: ["HABIT", "5 MIN"],
        type: "mindfulTimer", // timer + awareness checkpoints
        timerMin: 5,
    },
    {
        id: 4, cat: "HUMMING", title: "CHEST VIBRATION HUM",
        instruction: "Make a \"Hmmmmm\" sound with closed lips. Focus all awareness on feeling vibration in your chest, not your throat. Place your hand flat on your sternum to feel the resonance.",
        badges: ["5 MIN", "2×/DAY"],
        type: "setTimer", // timer per set, set counter
        timerMin: 5, sets: 2,
    },
    {
        id: 5, cat: "HUMMING", title: "LOW PITCH CHANTING",
        instruction: "Stand upright — do not sit. Hum or chant at the absolute lowest pitch you can sustain. Keep your spine straight and chin level. The standing position is non-negotiable.",
        badges: ["STAND UP", "10 MIN"],
        type: "standingTimer", // timer + posture reminders
        timerMin: 10,
    },
    {
        id: 6, cat: "HUMMING", title: "MORNING HUM",
        instruction: "Perform deep hums first thing in the morning, before speaking to anyone. Morning muscles are naturally relaxed, giving you access to your lowest registers.",
        badges: ["MORNING"],
        type: "morningTimer", // timer + morning context
        timerMin: 3,
    },
    {
        id: 7, cat: "HUMMING", title: "HEAD RAISING HUM",
        instruction: "Take a deep diaphragm breath and begin humming. While sustaining the hum, slowly raise your head from chin-to-chest upward. Stretches and strengthens vocal cords under load.",
        badges: ["STRETCH", "STRENGTH"],
        type: "setReps", // rep dots reset per set, set tracker
        sets: 3, reps: 10,
    },
    {
        id: 8, cat: "POSTURE & NECK", title: "EDGE-OF-BED HEAD TILTS",
        instruction: "Lie on your back at the edge of a bed, head and shoulders hanging off. 15–20 reps tilting head up/down, then side to side. 3 total sets, 3–4 times per week.",
        badges: ["3–4×/WEEK", "3 SETS"],
        type: "setReps",
        sets: 3, reps: 20,
    },
    {
        id: 9, cat: "POSTURE & NECK", title: "NECK CRUNCHES",
        instruction: "Lie on a bench and slowly nod your head from horizontal to vertical while tucking your chin in. Full control — no momentum. 3 sets of 20 reps every other day.",
        badges: ["EVERY OTHER DAY", "3×20"],
        type: "setReps",
        sets: 3, reps: 20,
    },
    {
        id: 10, cat: "POSTURE & NECK", title: "ANTERIOR NECK EXTENSIONS",
        instruction: "Stretch the front of the neck to relieve tightness in the anterior chain. Tilt your head back slowly, opening the throat. Tension here directly constricts vocal range.",
        badges: ["STRETCH"],
        type: "setReps",
        sets: 3, reps: 10,
    },
    {
        id: 11, cat: "POSTURE & NECK", title: "LEVATOR SCAPULAE STRETCH",
        instruction: "Hold the back of a chair with one hand. Guide a 45° downward neck stretch with the other. Targets the levator scapulae — when tight, it compresses the vocal mechanism. Hold each side.",
        badges: ["MOBILITY", "BILATERAL"],
        type: "bilateral", // left/right side timer
        timerMin: 2, sides: ["LEFT SIDE", "RIGHT SIDE"],
    },
    {
        id: 12, cat: "THROAT", title: "THE YAWN-SIGH METHOD",
        instruction: "Yawn deeply to fully relax the throat muscles, then exhale with a slow audible sigh. The yawn mechanically opens the throat wider than any exercise. 40 yawns per day for three months.",
        badges: ["40×/DAY", "3 MONTHS"],
        type: "repCounter",
        reps: 40,
    },
    {
        id: 13, cat: "THROAT", title: "THE GROWL",
        instruction: "Practice the rattling/growling sound from clearing your throat. Start at your natural pitch, then gradually shift lower with each rep. Keep it intentional — not harsh.",
        badges: ["PITCH WORK"],
        type: "pitchReps", // rep dots with descending pitch level indicator per set
        sets: 3, reps: 10,
    },
    {
        id: 14, cat: "THROAT", title: "INVISIBLE STRAW",
        instruction: "Close your mouth and suck on an invisible straw for 5 seconds, then release. Strengthens the ring of muscle groups in and around the throat that support vocal depth.",
        badges: ["5 SEC HOLDS"],
        type: "phaseReps",
        phases: [{ name: "SUCK", secs: 5 }, { name: "RELEASE", secs: 3 }],
        sets: 3, reps: 10,
    },
    {
        id: 15, cat: "THROAT", title: "ASPIRATION PRACTICE",
        instruction: "Practice speaking in a breathier, aspirated tone — as if speaking through a slow sigh. This trains conscious control over airflow and vocal fold tension, enabling deeper tones.",
        badges: ["TECHNIQUE"],
        type: "mindfulTimer",
        timerMin: 3,
    },
    {
        id: 16, cat: "PITCH & DICTION", title: "PROGRESSIVE PITCH LOWERING",
        instruction: "Read 2–3 paragraphs aloud at your natural voice. Restart, dropping your pitch by one tone each time until you reach your absolute floor. Do not strain.",
        badges: ["READING", "GRADUAL"],
        type: "pitchLowering", // round tracker + timer
        timerMin: 10, rounds: 6,
    },
];

const CATEGORIES = [...new Set(EXERCISES.map((e) => e.cat))];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=Crimson+Pro:ital,wght@0,300;1,300&display=swap');

  .vf-root-wrapper {
    position: fixed;
    inset: 0;
    background: #1a1814;
    display: flex;
  }

  .vf-root {
    box-sizing: border-box;
    --bg: #1a1814;
    --surface: #211f1b;
    --surface2: #282420;
    --border: #2e2b27;
    --border2: #343028;
    --text: #e8e0d4;
    --muted: #8a8178;
    --dim: #4a4540;
    --copper: #c87941;
    --copper2: #d48a52;
    --copper3: #e09a62;
    --amber: #e0a030;
    --success: #4a9a6a;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    margin-left: 3rem;
    width: calc(100% - 3rem);
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .vf-root *, .vf-root *::before, .vf-root *::after {
    box-sizing: border-box;
  }

  .vf-layout {
    display: grid;
    grid-template-columns: clamp(140px, 22%, 220px) 1fr;
    flex: 1;
    height: 100%;
    border: 1px solid var(--border2);
    overflow: hidden;
    max-width: 100%;
  }

  @media (max-width: 520px) {
    .vf-layout { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  }

  /* ── SIDEBAR ── */
  .vf-sidebar {
    background: var(--surface);
    border-right: 1px solid var(--border2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
    min-width: 0;
  }

  @media (max-width: 520px) {
    .vf-sidebar { border-right: none; border-bottom: 1px solid var(--border2); height: auto; max-height: 35vh; }
  }

  .vf-logo { padding: 12px 14px 10px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .vf-logo-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(14px, 2vw, 18px); letter-spacing: .1em; color: var(--copper3); line-height: 1; }
  .vf-logo-sub { font-size: 7px; letter-spacing: .2em; color: var(--muted); text-transform: uppercase; margin-top: 2px; }

  .vf-nav-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; }
  .vf-nav-scroll::-webkit-scrollbar { width: 2px; }
  .vf-nav-scroll::-webkit-scrollbar-track { background: transparent; }
  .vf-nav-scroll::-webkit-scrollbar-thumb { background: var(--dim); }

  .vf-cat-header { padding: 8px 14px 4px; font-size: 7px; letter-spacing: .18em; color: var(--muted); text-transform: uppercase; border-bottom: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; z-index: 1; }

  .vf-nav-item { display: flex; align-items: center; gap: 7px; padding: 7px 14px; cursor: pointer; border-bottom: 1px solid var(--border); transition: background .1s; position: relative; }
  .vf-nav-item:hover { background: var(--surface2); }
  .vf-nav-item.active { background: rgba(200,121,65,.07); }
  .vf-nav-item.active::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: var(--copper); }

  .vf-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--dim); flex-shrink: 0; transition: background .15s; }
  .vf-nav-item.active .vf-dot { background: var(--copper); }
  .vf-nav-item.done .vf-dot { background: var(--success); }

  .vf-nav-label { font-size: 8.5px; color: var(--muted); line-height: 1.25; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vf-nav-item.active .vf-nav-label { color: var(--text); }

  .vf-progress-wrap { flex-shrink: 0; padding: 10px 14px; border-top: 1px solid var(--border); }
  .vf-prog-label { font-size: 7px; letter-spacing: .13em; color: var(--muted); text-transform: uppercase; display: flex; justify-content: space-between; margin-bottom: 5px; }
  .vf-prog-track { height: 2px; background: var(--dim); }
  .vf-prog-fill { height: 100%; background: var(--copper); transition: width .4s; }

  /* ── MAIN ── */
  .vf-main { display: flex; flex-direction: column; background: var(--bg); height: 100%; overflow: hidden; overflow-x: hidden; min-width: 0; min-height: 0; }

  .vf-waveform { height: 26px; flex-shrink: 0; display: flex; align-items: center; gap: 2px; padding: 0 18px; border-bottom: 1px solid var(--border); }
  .vf-wave-bar { width: 2px; background: var(--dim); border-radius: 1px; transition: height .09s, background .09s; }
  .vf-wave-bar.active { background: var(--copper); }

  .vf-header { flex-shrink: 0; padding: 10px 18px 8px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: flex-start; }
  .vf-ex-cat { font-size: 7px; letter-spacing: .18em; color: var(--copper); text-transform: uppercase; margin-bottom: 2px; }
  .vf-ex-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(18px, 3vw, 28px); letter-spacing: .04em; line-height: 1; color: var(--text); }
  .vf-ex-num { font-size: 7px; color: var(--muted); margin-top: 3px; letter-spacing: .12em; }

  .vf-badges { display: flex; gap: 4px; flex-wrap: wrap; max-width: 130px; justify-content: flex-end; align-items: flex-start; }
  .vf-badge { font-size: 7px; padding: 2px 5px; border: 1px solid var(--copper); color: var(--copper); letter-spacing: .08em; white-space: nowrap; line-height: 1.4; }

  .vf-body { flex: 1; padding: 10px 18px 6px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; overflow-x: hidden; min-width: 0; max-width: 100%; }
  .vf-body::-webkit-scrollbar { width: 2px; }
  .vf-body::-webkit-scrollbar-track { background: transparent; }
  .vf-body::-webkit-scrollbar-thumb { background: var(--dim); }

  .vf-instruction { background: var(--surface); border: 1px solid var(--border); padding: 10px 12px; font-family: 'Crimson Pro', serif; font-size: clamp(11px, 1.5vw, 13.5px); font-weight: 300; color: var(--muted); line-height: 1.65; flex-shrink: 0; }

  /* ── STATS ROW (replaces generic timer grid) ── */
  .vf-stats-row { display: flex; gap: 1px; background: var(--border); flex-shrink: 0; }
  .vf-stat-box { background: var(--surface); padding: 8px 10px; display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; }
  .vf-stat-label { font-size: 7px; letter-spacing: .15em; color: var(--muted); text-transform: uppercase; }
  .vf-stat-value { font-family: 'Bebas Neue', sans-serif; font-size: clamp(20px, 3.5vw, 32px); color: var(--text); letter-spacing: .04em; line-height: 1; transition: color .3s; }
  .vf-stat-value.running { color: var(--amber); }
  .vf-stat-value.success { color: var(--success); }
  .vf-stat-unit { font-size: 7px; color: var(--dim); letter-spacing: .08em; }

  /* ── PHASE DISPLAY ── */
  .vf-phase-display { background: var(--surface); border: 1px solid var(--border2); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .vf-phase-meta { font-size: 7px; color: var(--muted); letter-spacing: .13em; margin-bottom: 2px; }
  .vf-phase-name { font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: var(--copper2); line-height: 1; }
  .vf-phase-countdown { font-family: 'Bebas Neue', sans-serif; font-size: clamp(28px, 5vw, 48px); color: var(--text); line-height: 1; }

  /* ── REP DOTS ── */
  .vf-reps-section { display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
  .vf-reps-label { font-size: 7px; letter-spacing: .15em; color: var(--muted); text-transform: uppercase; }
  .vf-reps-dots { display: flex; flex-wrap: wrap; gap: 4px; }
  .vf-rep-dot { width: 14px; height: 14px; border: 1px solid var(--dim); cursor: pointer; transition: all .1s; position: relative; background: transparent; flex-shrink: 0; }
  .vf-rep-dot:hover { border-color: var(--copper); }
  .vf-rep-dot.done { background: var(--copper); border-color: var(--copper); }
  .vf-rep-dot.done::after { content: ''; position: absolute; inset: 3px; border-bottom: 1.5px solid #000; border-right: 1.5px solid #000; transform: rotate(45deg) translate(-1px, -1px); }

  /* ── SET TRACKER ── */
  .vf-set-tracker { display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
  .vf-set-label { font-size: 7px; letter-spacing: .15em; color: var(--muted); text-transform: uppercase; }
  .vf-set-dots { display: flex; gap: 6px; }
  .vf-set-dot { width: 20px; height: 20px; border: 1px solid var(--dim); display: flex; align-items: center; justify-content: center; font-size: 7px; color: var(--dim); cursor: default; }
  .vf-set-dot.active { border-color: var(--amber); color: var(--amber); }
  .vf-set-dot.complete { background: var(--success); border-color: var(--success); color: #000; }

  /* ── BREATHING GUIDE ── */
  .vf-breath-guide { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 10px 0; flex-shrink: 0; }
  .vf-breath-ring { width: 80px; height: 80px; border-radius: 50%; border: 2px solid var(--dim); display: flex; align-items: center; justify-content: center; transition: transform 3s ease-in-out, border-color .5s; position: relative; }
  .vf-breath-ring.inhale { transform: scale(1.35); border-color: var(--copper); }
  .vf-breath-ring.exhale { transform: scale(0.85); border-color: var(--muted); }
  .vf-breath-ring-inner { width: 40px; height: 40px; border-radius: 50%; background: rgba(200,121,65,.12); transition: transform 3s ease-in-out; }
  .vf-breath-ring.inhale .vf-breath-ring-inner { transform: scale(1.4); }
  .vf-breath-ring.exhale .vf-breath-ring-inner { transform: scale(0.7); }
  .vf-breath-cue { font-size: 8px; letter-spacing: .2em; color: var(--copper); text-transform: uppercase; }

  /* ── POSTURE REMINDER ── */
  .vf-posture-reminder { background: rgba(200,121,65,.06); border: 1px solid var(--border2); border-left: 2px solid var(--copper); padding: 8px 12px; font-size: 8px; letter-spacing: .1em; color: var(--copper2); text-transform: uppercase; flex-shrink: 0; }

  /* ── BILATERAL SIDES ── */
  .vf-bilateral { display: flex; gap: 6px; flex-shrink: 0; }
  .vf-side-box { flex: 1; background: var(--surface); border: 1px solid var(--border); padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; transition: border-color .15s; }
  .vf-side-box.active { border-color: var(--amber); }
  .vf-side-box.done-side { border-color: var(--success); }
  .vf-side-name { font-size: 8px; letter-spacing: .15em; color: var(--muted); }
  .vf-side-box.active .vf-side-name { color: var(--amber); }
  .vf-side-box.done-side .vf-side-name { color: var(--success); }
  .vf-side-timer { font-family: 'Bebas Neue', sans-serif; font-size: 26px; color: var(--text); line-height: 1; }

  /* ── PITCH INDICATOR ── */
  .vf-pitch-bar { display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
  .vf-pitch-label { font-size: 7px; letter-spacing: .15em; color: var(--muted); text-transform: uppercase; }
  .vf-pitch-track { height: 6px; background: var(--dim); position: relative; }
  .vf-pitch-fill { height: 100%; background: linear-gradient(to right, var(--success), var(--copper), var(--amber)); transition: width .4s; }
  .vf-pitch-desc { font-size: 8px; color: var(--copper2); letter-spacing: .1em; }

  /* ── PITCH LOWERING ROUNDS ── */
  .vf-rounds { display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
  .vf-rounds-label { font-size: 7px; letter-spacing: .15em; color: var(--muted); text-transform: uppercase; }
  .vf-rounds-row { display: flex; gap: 4px; }
  .vf-round-chip { padding: 4px 8px; border: 1px solid var(--dim); font-size: 7px; letter-spacing: .1em; color: var(--dim); cursor: pointer; transition: all .15s; }
  .vf-round-chip.active { border-color: var(--amber); color: var(--amber); }
  .vf-round-chip.done-round { background: var(--success); border-color: var(--success); color: #000; }

  /* ── MINDFUL CHECKPOINTS ── */
  .vf-checkpoints { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
  .vf-checkpoint-label { font-size: 7px; letter-spacing: .15em; color: var(--muted); text-transform: uppercase; }
  .vf-checkpoint-item { display: flex; align-items: center; gap: 8px; padding: 5px 8px; background: var(--surface); border: 1px solid var(--border); cursor: pointer; transition: border-color .1s; }
  .vf-checkpoint-item.checked { border-color: var(--success); }
  .vf-checkpoint-box { width: 10px; height: 10px; border: 1px solid var(--dim); flex-shrink: 0; position: relative; }
  .vf-checkpoint-item.checked .vf-checkpoint-box { background: var(--success); border-color: var(--success); }
  .vf-checkpoint-text { font-size: 8px; color: var(--muted); letter-spacing: .08em; }
  .vf-checkpoint-item.checked .vf-checkpoint-text { color: var(--text); }

  /* ── COMPLETE BANNER ── */
  .vf-complete-banner { background: rgba(74,154,106,.07); border: 1px solid var(--success); padding: 8px 12px; display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--text); flex-shrink: 0; }
  .vf-complete-icon { font-size: 12px; color: var(--success); }
  .vf-complete-text strong { color: var(--success); font-family: 'DM Mono', monospace; }

  /* ── BUTTONS ── */
  .vf-btn { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; padding: 6px 12px; border: 1px solid var(--border2); background: transparent; color: var(--muted); cursor: pointer; transition: all .1s; line-height: 1; }
  .vf-btn:hover { border-color: var(--copper); color: var(--copper); }
  .vf-btn:disabled { opacity: .3; cursor: default; }
  .vf-btn:disabled:hover { border-color: var(--border2); color: var(--muted); }
  .vf-btn.primary { background: var(--copper); border-color: var(--copper); color: #000; font-weight: 500; }
  .vf-btn.primary:hover { background: var(--copper3); border-color: var(--copper3); }
  .vf-btn.danger { border-color: #8a3a3a; color: #c55; }
  .vf-btn.danger:hover { border-color: #c44; color: #f55; }
  .vf-btn.success-btn { border-color: var(--success); color: var(--success); }
`;

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function Waveform({ active }) {
    const [heights, setHeights] = useState(Array(52).fill(3));
    useEffect(() => {
        if (!active) { setHeights(Array(52).fill(3)); return; }
        const id = setInterval(() => {
            setHeights(Array(52).fill(0).map(() => Math.random() * 18 + 3));
        }, 110);
        return () => clearInterval(id);
    }, [active]);
    return (
        <div className="vf-waveform">
            {heights.map((h, i) => (
                <div key={i} className={`vf-wave-bar${h > 13 ? " active" : ""}`} style={{ height: h + "px" }} />
            ))}
        </div>
    );
}

function SetDots({ total, current }) {
    return (
        <div className="vf-set-tracker">
            <div className="vf-set-label">SETS — {current}/{total}</div>
            <div className="vf-set-dots">
                {Array(total).fill(0).map((_, i) => (
                    <div
                        key={i}
                        className={`vf-set-dot${i === current && current < total ? " active" : ""}${i < current ? " complete" : ""}`}
                    >
                        {i < current ? "✓" : i + 1}
                    </div>
                ))}
            </div>
        </div>
    );
}

function RepDots({ total, done, onToggle, label }) {
    return (
        <div className="vf-reps-section">
            <div className="vf-reps-label">{label || "REP TRACKING"} — {done}/{total}</div>
            <div className="vf-reps-dots">
                {Array(total).fill(0).map((_, i) => (
                    <div key={i} className={`vf-rep-dot${i < done ? " done" : ""}`} onClick={() => onToggle(i)} />
                ))}
            </div>
        </div>
    );
}

function PhaseDisplay({ phase, countdown, phaseIdx, totalPhases }) {
    return (
        <div className="vf-phase-display">
            <div>
                <div className="vf-phase-meta">PHASE {phaseIdx + 1} OF {totalPhases}</div>
                <div className="vf-phase-name">{phase.name}</div>
            </div>
            <div className="vf-phase-countdown">{countdown}</div>
        </div>
    );
}

function StatRow({ stats }) {
    // stats: [{ label, value, unit, running }]
    return (
        <div className="vf-stats-row">
            {stats.map((s, i) => (
                <div key={i} className="vf-stat-box">
                    <div className="vf-stat-label">{s.label}</div>
                    <div className={`vf-stat-value${s.running ? " running" : ""}${s.success ? " success" : ""}`}>{s.value}</div>
                    <div className="vf-stat-unit">{s.unit}</div>
                </div>
            ))}
        </div>
    );
}

function fmtTime(s) {
    if (s == null || s === 0) return "0:00";
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${sec < 10 ? "0" + sec : sec}`;
}

// ─── EXERCISE-SPECIFIC DISPLAYS ──────────────────────────────────────────────

/** ID 0, 3 – Pure timer with animated breathing ring */
function BreathingGuideDisplay({ timerRemaining, timerRunning, timerMin, started }) {
    const [breathPhase, setBreathPhase] = useState("idle"); // idle | inhale | exhale
    useEffect(() => {
        if (!timerRunning) { setBreathPhase("idle"); return; }
        let phase = "inhale";
        setBreathPhase(phase);
        const id = setInterval(() => {
            phase = phase === "inhale" ? "exhale" : "inhale";
            setBreathPhase(phase);
        }, 4000);
        return () => clearInterval(id);
    }, [timerRunning]);

    const totalSecs = timerMin * 60;
    const elapsed = totalSecs - timerRemaining;
    const pct = totalSecs > 0 ? Math.min(100, (elapsed / totalSecs) * 100) : 0;

    return (
        <>
            <StatRow stats={[
                { label: timerRunning ? "REMAINING" : "DURATION", value: timerRunning ? fmtTime(timerRemaining) : timerMin + "m", unit: "TIMER", running: timerRunning },
            ]} />
            {started && (
                <div className="vf-breath-guide">
                    <div className={`vf-breath-ring ${breathPhase}`}>
                        <div className="vf-breath-ring-inner" />
                    </div>
                    <div className="vf-breath-cue">
                        {breathPhase === "inhale" ? "↑ INHALE" : breathPhase === "exhale" ? "↓ EXHALE" : "—"}
                    </div>
                </div>
            )}
            {timerRunning && (
                <StatRow stats={[
                    { label: "ELAPSED", value: fmtTime(elapsed), unit: "TIME" },
                    { label: "PROGRESS", value: Math.round(pct) + "%", unit: "COMPLETE", running: timerRunning },
                ]} />
            )}
        </>
    );
}

/** ID 1, 14 – Phase timer × reps × sets */
function PhaseRepsDisplay({ ex, phaseActive, phaseIdx, phaseTimer, repsDone, setsDone, timerRunning }) {
    return (
        <>
            <StatRow stats={[
                { label: "SET", value: setsDone + 1 > ex.sets ? ex.sets : setsDone + 1, unit: `OF ${ex.sets}` },
                { label: "CYCLE", value: repsDone, unit: `OF ${ex.reps}` },
            ]} />
            {phaseActive && ex.phases && (
                <PhaseDisplay
                    phase={ex.phases[phaseIdx]}
                    countdown={phaseTimer}
                    phaseIdx={phaseIdx}
                    totalPhases={ex.phases.length}
                />
            )}
            <SetDots total={ex.sets} current={setsDone} />
        </>
    );
}

/** ID 2, 12 – Simple rep counter (no sets, no timer) */
function RepCounterDisplay({ ex, repsDone, onToggle }) {
    return (
        <>
            <StatRow stats={[
                { label: "COMPLETED", value: repsDone, unit: `OF ${ex.reps}` },
                { label: "REMAINING", value: ex.reps - repsDone, unit: "REPS", success: repsDone >= ex.reps },
            ]} />
            <RepDots total={ex.reps} done={repsDone} onToggle={onToggle} />
        </>
    );
}

/** ID 3, 15 – Mindful timer with awareness checkpoints */
function MindfulTimerDisplay({ timerRemaining, timerRunning, timerMin, checksDone, onCheck }) {
    const checkpoints = timerMin === 5
        ? ["SHOULDERS RELAXED & STILL", "BREATHING THROUGH NOSE ONLY", "JAW COMPLETELY UNCLENCHED", "THROAT OPEN & RELAXED"]
        : ["BREATH FLOWING NATURALLY", "TONE SOFT & ASPIRATED", "CONSCIOUS OF AIRFLOW"];
    const totalSecs = timerMin * 60;
    const elapsed = totalSecs - timerRemaining;
    return (
        <>
            <StatRow stats={[
                { label: timerRunning ? "REMAINING" : "DURATION", value: timerRunning ? fmtTime(timerRemaining) : timerMin + "m", unit: "TIMER", running: timerRunning },
                { label: "ELAPSED", value: timerRunning ? fmtTime(elapsed) : "—", unit: "TIME" },
            ]} />
            <div className="vf-checkpoints">
                <div className="vf-checkpoint-label">AWARENESS CHECKLIST</div>
                {checkpoints.map((c, i) => (
                    <div
                        key={i}
                        className={`vf-checkpoint-item${checksDone.has(i) ? " checked" : ""}`}
                        onClick={() => onCheck(i)}
                    >
                        <div className="vf-checkpoint-box" />
                        <div className="vf-checkpoint-text">{c}</div>
                    </div>
                ))}
            </div>
        </>
    );
}

/** ID 4 – Set-based timer (timer resets per set) */
function SetTimerDisplay({ ex, timerRemaining, timerRunning, setsDone }) {
    return (
        <>
            <StatRow stats={[
                { label: timerRunning ? "REMAINING" : "DURATION", value: timerRunning ? fmtTime(timerRemaining) : ex.timerMin + "m", unit: "THIS SET", running: timerRunning },
                { label: "SET", value: setsDone + 1 > ex.sets ? ex.sets : setsDone + 1, unit: `OF ${ex.sets}` },
            ]} />
            <SetDots total={ex.sets} current={setsDone} />
        </>
    );
}

/** ID 5 – Standing timer with posture reminder */
function StandingTimerDisplay({ timerRemaining, timerRunning, timerMin }) {
    const totalSecs = timerMin * 60;
    const elapsed = totalSecs - timerRemaining;
    return (
        <>
            <div className="vf-posture-reminder">▲ STAND UPRIGHT — SPINE STRAIGHT — CHIN LEVEL</div>
            <StatRow stats={[
                { label: timerRunning ? "REMAINING" : "DURATION", value: timerRunning ? fmtTime(timerRemaining) : timerMin + "m", unit: "TIMER", running: timerRunning },
                { label: "ELAPSED", value: timerRunning ? fmtTime(elapsed) : "—", unit: "TIME" },
            ]} />
        </>
    );
}

/** ID 6 – Morning timer with morning context */
function MorningTimerDisplay({ timerRemaining, timerRunning, timerMin }) {
    const now = new Date();
    const hour = now.getHours();
    const isEvening = hour >= 12;
    return (
        <>
            {isEvening && (
                <div className="vf-posture-reminder">⚠ BEST PERFORMED IN THE MORNING BEFORE SPEAKING</div>
            )}
            <StatRow stats={[
                { label: timerRunning ? "REMAINING" : "DURATION", value: timerRunning ? fmtTime(timerRemaining) : timerMin + "m", unit: "TIMER", running: timerRunning },
            ]} />
        </>
    );
}

/** ID 7, 8, 9, 10 – Set × Reps with dot reset per set */
function SetRepsDisplay({ ex, repsDone, setsDone, onToggle, onCompleteSet }) {
    const allRepsThisSet = repsDone >= ex.reps;
    return (
        <>
            <StatRow stats={[
                { label: "SET", value: setsDone + 1 > ex.sets ? ex.sets : setsDone + 1, unit: `OF ${ex.sets}` },
                { label: "REPS", value: repsDone, unit: `OF ${ex.reps}`, running: repsDone > 0 && !allRepsThisSet },
            ]} />
            <RepDots total={ex.reps} done={repsDone} onToggle={onToggle} label={`SET ${Math.min(setsDone + 1, ex.sets)} REPS`} />
            {allRepsThisSet && setsDone + 1 < ex.sets && (
                <button className="vf-btn primary" style={{ alignSelf: "flex-start" }} onClick={onCompleteSet}>
                    NEXT SET →
                </button>
            )}
            <SetDots total={ex.sets} current={setsDone} />
        </>
    );
}

/** ID 11 – Bilateral timer (left/right side) */
function BilateralDisplay({ ex, timerRemaining, timerRunning, activeSide, sidesDone, onStartSide }) {
    const fmtSide = (s) => {
        if (sidesDone.has(s)) return "✓";
        if (timerRunning && activeSide === s) return fmtTime(timerRemaining);
        return ex.timerMin + "m";
    };
    return (
        <>
            <StatRow stats={[
                { label: timerRunning ? "REMAINING" : "HOLD EACH SIDE", value: timerRunning ? fmtTime(timerRemaining) : ex.timerMin + "m", unit: "TIMER", running: timerRunning },
                { label: "SIDES DONE", value: sidesDone.size, unit: "OF 2", success: sidesDone.size === 2 },
            ]} />
            <div className="vf-bilateral">
                {ex.sides.map((side, i) => (
                    <div
                        key={i}
                        className={`vf-side-box${timerRunning && activeSide === i ? " active" : ""}${sidesDone.has(i) ? " done-side" : ""}`}
                        onClick={() => !sidesDone.has(i) && !timerRunning && onStartSide(i)}
                    >
                        <div className="vf-side-name">{side}</div>
                        <div className="vf-side-timer">{fmtSide(i)}</div>
                        {!sidesDone.has(i) && !timerRunning && <div style={{ fontSize: "7px", color: "var(--dim)" }}>TAP TO START</div>}
                    </div>
                ))}
            </div>
        </>
    );
}

/** ID 13 – Growl reps with descending pitch indicator per set */
function PitchRepsDisplay({ ex, repsDone, setsDone, onToggle, onCompleteSet }) {
    const allRepsThisSet = repsDone >= ex.reps;
    // Pitch level: starts at 100%, drops 15% per set so user goes lower each set
    const pitchPct = Math.max(10, 100 - setsDone * 20);
    const pitchLabels = ["NATURAL PITCH", "ONE TONE DOWN", "TWO TONES DOWN", "DEEP CHEST ONLY"];
    return (
        <>
            <StatRow stats={[
                { label: "SET", value: setsDone + 1 > ex.sets ? ex.sets : setsDone + 1, unit: `OF ${ex.sets}` },
                { label: "REPS", value: repsDone, unit: `OF ${ex.reps}` },
            ]} />
            <div className="vf-pitch-bar">
                <div className="vf-pitch-label">TARGET PITCH LEVEL</div>
                <div className="vf-pitch-track"><div className="vf-pitch-fill" style={{ width: pitchPct + "%" }} /></div>
                <div className="vf-pitch-desc">{pitchLabels[Math.min(setsDone, pitchLabels.length - 1)]}</div>
            </div>
            <RepDots total={ex.reps} done={repsDone} onToggle={onToggle} label={`SET ${Math.min(setsDone + 1, ex.sets)} GROWLS`} />
            {allRepsThisSet && setsDone + 1 < ex.sets && (
                <button className="vf-btn primary" style={{ alignSelf: "flex-start" }} onClick={onCompleteSet}>
                    NEXT SET — GO LOWER →
                </button>
            )}
            <SetDots total={ex.sets} current={setsDone} />
        </>
    );
}

/** ID 16 – Progressive pitch lowering: rounds + timer */
function PitchLoweringDisplay({ ex, timerRemaining, timerRunning, currentRound, roundsDone, onCompleteRound }) {
    const pitchDescriptions = [
        "NATURAL PITCH — read comfortably",
        "TONE 1 DOWN — slightly lower",
        "TONE 2 DOWN — chest is engaged",
        "TONE 3 DOWN — deep resonance",
        "TONE 4 DOWN — near your floor",
        "ABSOLUTE FLOOR — do not strain",
    ];
    return (
        <>
            <StatRow stats={[
                { label: timerRunning ? "REMAINING" : "DURATION", value: timerRunning ? fmtTime(timerRemaining) : ex.timerMin + "m", unit: "TIMER", running: timerRunning },
                { label: "ROUND", value: currentRound + 1, unit: `OF ${ex.rounds}` },
            ]} />
            <div className="vf-rounds">
                <div className="vf-rounds-label">PITCH ROUNDS</div>
                <div className="vf-rounds-row">
                    {Array(ex.rounds).fill(0).map((_, i) => (
                        <div
                            key={i}
                            className={`vf-round-chip${i === currentRound ? " active" : ""}${i < currentRound ? " done-round" : ""}`}
                        >
                            {i < currentRound ? "✓" : `R${i + 1}`}
                        </div>
                    ))}
                </div>
                <div className="vf-pitch-desc" style={{ marginTop: "4px" }}>
                    {pitchDescriptions[Math.min(currentRound, pitchDescriptions.length - 1)]}
                </div>
            </div>
            {currentRound < ex.rounds - 1 && (
                <button className="vf-btn" style={{ alignSelf: "flex-start", borderColor: "var(--copper2)", color: "var(--copper2)" }} onClick={onCompleteRound}>
                    NEXT ROUND — GO LOWER →
                </button>
            )}
        </>
    );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function VoiceTraining() {
    const [current, setCurrent] = useState(0);
    const [done, setDone] = useState(new Set());
    const [started, setStarted] = useState(false);
    const [complete, setComplete] = useState(false);
    const [waveActive, setWaveActive] = useState(false);

    // Generic rep/set state (reused per type)
    const [repsDone, setRepsDone] = useState(0);
    const [setsDone, setSetsDone] = useState(0);

    // Timer state
    const [timerRemaining, setTimerRemaining] = useState(0);
    const [timerRunning, setTimerRunning] = useState(false);

    // Phase state (for phaseReps type)
    const [phaseIdx, setPhaseIdx] = useState(0);
    const [phaseTimer, setPhaseTimer] = useState(0);
    const [phaseActive, setPhaseActive] = useState(false);

    // Bilateral state (ID 11)
    const [activeSide, setActiveSide] = useState(null);
    const [sidesDone, setSidesDone] = useState(new Set());

    // Mindful checkpoints (ID 3, 15)
    const [checksDone, setChecksDone] = useState(new Set());

    // Pitch lowering round (ID 16)
    const [currentRound, setCurrentRound] = useState(0);

    const intervalRef = useRef(null);
    const ex = EXERCISES[current];

    // Load progress
    useEffect(() => {
        const loadProgress = async () => {
            try {
                const BASE_DB = 'C:\\Users\\PC\\Desktop\\database';
                const DB_DIR = path.join(BASE_DB, 'SkillsTraining');
                const PROGRESS_FILE = path.join(DB_DIR, 'progress.json');
                await fs.mkdir(DB_DIR, { recursive: true });
                const data = await fs.readFile(PROGRESS_FILE, 'utf8');
                const parsed = JSON.parse(data);
                if (parsed && Array.isArray(parsed.done)) setDone(new Set(parsed.done));
            } catch (err) {
                console.log("No previous progress found.");
            }
        };
        loadProgress();
    }, []);

    const saveProgress = async (newDone) => {
        try {
            const BASE_DB = 'C:\\Users\\PC\\Desktop\\database';
            const DB_DIR = path.join(BASE_DB, 'SkillsTraining');
            const PROGRESS_FILE = path.join(DB_DIR, 'progress.json');
            await fs.mkdir(DB_DIR, { recursive: true });
            await fs.writeFile(PROGRESS_FILE, JSON.stringify({ done: Array.from(newDone) }, null, 2));
        } catch (err) {
            console.error("Error saving progress:", err);
        }
    };

    // Inject styles
    useEffect(() => {
        if (!document.getElementById("vf-styles")) {
            const style = document.createElement("style");
            style.id = "vf-styles";
            style.textContent = css;
            document.head.appendChild(style);
        }
    }, []);

    // Full reset on exercise change
    useEffect(() => {
        clearInterval(intervalRef.current);
        setStarted(false); setComplete(false);
        setRepsDone(0); setSetsDone(0);
        setTimerRemaining(0); setTimerRunning(false);
        setPhaseIdx(0); setPhaseTimer(0); setPhaseActive(false);
        setWaveActive(false);
        setActiveSide(null); setSidesDone(new Set());
        setChecksDone(new Set());
        setCurrentRound(0);
    }, [current]);

    const finish = useCallback(() => {
        clearInterval(intervalRef.current);
        setComplete(true);
        setTimerRunning(false);
        setPhaseActive(false);
        setWaveActive(false);
    }, []);

    // Main countdown timer
    useEffect(() => {
        if (!timerRunning) return;
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            setTimerRemaining((t) => {
                if (t <= 1) { clearInterval(intervalRef.current); return 0; }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(intervalRef.current);
    }, [timerRunning]);

    // Watch timerRemaining reaching 0 for timer-based exercises
    useEffect(() => {
        if (!timerRunning) return;
        if (timerRemaining <= 0) {
            setTimerRunning(false);
            // bilateral: mark active side done
            if (ex.type === "bilateral" && activeSide !== null) {
                setSidesDone((prev) => {
                    const next = new Set([...prev, activeSide]);
                    if (next.size >= 2) finish();
                    return next;
                });
                setActiveSide(null);
            } else if (ex.type === "setTimer") {
                const nextSet = setsDone + 1;
                if (nextSet >= ex.sets) {
                    finish();
                } else {
                    setSetsDone(nextSet);
                    // reset timer for next set automatically
                }
            } else {
                finish();
            }
        }
    }, [timerRemaining, timerRunning]); // eslint-disable-line

    // Phase timer (phaseReps)
    useEffect(() => {
        if (!phaseActive) return;
        clearInterval(intervalRef.current);
        const phases = ex.phases;
        let localPhase = phaseIdx;
        let localTimer = phaseTimer;
        let localReps = repsDone;
        let localSets = setsDone;

        intervalRef.current = setInterval(() => {
            localTimer -= 1;
            setPhaseTimer(localTimer);
            if (localTimer <= 0) {
                const nextPhase = (localPhase + 1) % phases.length;
                if (nextPhase === 0) {
                    // completed one full cycle
                    localReps += 1;
                    setRepsDone(localReps);
                    if (ex.reps && localReps >= ex.reps) {
                        // set complete
                        localSets += 1;
                        setSetsDone(localSets);
                        localReps = 0;
                        setRepsDone(0);
                        if (localSets >= ex.sets) {
                            clearInterval(intervalRef.current);
                            finish();
                            return;
                        }
                    }
                }
                localPhase = nextPhase;
                setPhaseIdx(localPhase);
                localTimer = phases[localPhase].secs;
                setPhaseTimer(localTimer);
            }
        }, 1000);
        return () => clearInterval(intervalRef.current);
    }, [phaseActive]); // eslint-disable-line

    const startExercise = () => {
        setStarted(true);
        setWaveActive(true);
        const t = ex.type;
        if (t === "phaseReps") {
            setPhaseIdx(0); setPhaseTimer(ex.phases[0].secs); setPhaseActive(true);
        } else if (["breathingGuide", "mindfulTimer", "standingTimer", "morningTimer", "setTimer", "pitchLowering"].includes(t)) {
            setTimerRemaining(ex.timerMin * 60); setTimerRunning(true);
        }
        // repCounter, setReps, bilateral, pitchReps: manual — started/waveActive set above
    };

    // setTimer (ID 4 – Chest Vibration Hum): auto-restart timer for next set after 1.5s pause
    useEffect(() => {
        if (ex.type !== "setTimer") return;
        if (!started || complete || timerRunning) return;
        if (timerRemaining === 0 && setsDone > 0 && setsDone < ex.sets) {
            const id = setTimeout(() => {
                setTimerRemaining(ex.timerMin * 60);
                setTimerRunning(true);
            }, 1500);
            return () => clearTimeout(id);
        }
    }, [setsDone, timerRunning]); // eslint-disable-line

    const toggleRep = (i) => {
        const newDone = i < repsDone ? i : i + 1;
        setRepsDone(newDone);
        const t = ex.type;
        if (t === "repCounter") {
            if (ex.reps && newDone >= ex.reps) finish();
        } else if (t === "setReps" || t === "pitchReps") {
            // If last rep of last set completed, finish immediately
            if (ex.reps && newDone >= ex.reps && setsDone + 1 >= ex.sets) finish();
        }
    };

    const handleCompleteSet = () => {
        const nextSet = setsDone + 1;
        if (nextSet >= ex.sets) {
            finish();
        } else {
            setSetsDone(nextSet);
            setRepsDone(0);
        }
    };

    const handleCompleteRound = () => {
        const next = currentRound + 1;
        if (next >= ex.rounds) {
            finish();
        } else {
            setCurrentRound(next);
        }
    };

    const handleStartSide = (sideIdx) => {
        setActiveSide(sideIdx);
        setTimerRemaining(ex.timerMin * 60);
        setTimerRunning(true);
    };

    const handleCheck = (i) => {
        setChecksDone((prev) => {
            const next = new Set(prev);
            next.has(i) ? next.delete(i) : next.add(i);
            return next;
        });
    };

    const markDone = () => {
        setDone((prev) => { const next = new Set([...prev, ex.id]); saveProgress(next); return next; });
    };

    const nextExercise = () => {
        setDone((prev) => { const next = new Set([...prev, ex.id]); saveProgress(next); return next; });
        if (current < EXERCISES.length - 1) setCurrent(current + 1);
    };

    const resetExercise = () => {
        clearInterval(intervalRef.current);
        setStarted(false); setComplete(false);
        setRepsDone(0); setSetsDone(0);
        setTimerRemaining(0); setTimerRunning(false);
        setPhaseIdx(0); setPhaseTimer(0); setPhaseActive(false);
        setWaveActive(false);
        setActiveSide(null); setSidesDone(new Set());
        setChecksDone(new Set());
        setCurrentRound(0);
    };

    const pct = Math.round((done.size / EXERCISES.length) * 100);

    // Render the right exercise display
    const renderExerciseDisplay = () => {
        const t = ex.type;
        if (t === "breathingGuide") return (
            <BreathingGuideDisplay timerRemaining={timerRemaining} timerRunning={timerRunning} timerMin={ex.timerMin} started={started} />
        );
        if (t === "phaseReps") return (
            <PhaseRepsDisplay ex={ex} phaseActive={phaseActive} phaseIdx={phaseIdx} phaseTimer={phaseTimer} repsDone={repsDone} setsDone={setsDone} timerRunning={timerRunning} />
        );
        if (t === "repCounter") return (
            <RepCounterDisplay ex={ex} repsDone={repsDone} onToggle={toggleRep} />
        );
        if (t === "mindfulTimer") return (
            <MindfulTimerDisplay timerRemaining={timerRemaining} timerRunning={timerRunning} timerMin={ex.timerMin} checksDone={checksDone} onCheck={handleCheck} />
        );
        if (t === "setTimer") return (
            <SetTimerDisplay ex={ex} timerRemaining={timerRemaining} timerRunning={timerRunning} setsDone={setsDone} />
        );
        if (t === "standingTimer") return (
            <StandingTimerDisplay timerRemaining={timerRemaining} timerRunning={timerRunning} timerMin={ex.timerMin} />
        );
        if (t === "morningTimer") return (
            <MorningTimerDisplay timerRemaining={timerRemaining} timerRunning={timerRunning} timerMin={ex.timerMin} />
        );
        if (t === "setReps") return (
            <SetRepsDisplay ex={ex} repsDone={repsDone} setsDone={setsDone} onToggle={toggleRep} onCompleteSet={handleCompleteSet} />
        );
        if (t === "bilateral") return (
            <BilateralDisplay ex={ex} timerRemaining={timerRemaining} timerRunning={timerRunning} activeSide={activeSide} sidesDone={sidesDone} onStartSide={handleStartSide} />
        );
        if (t === "pitchReps") return (
            <PitchRepsDisplay ex={ex} repsDone={repsDone} setsDone={setsDone} onToggle={toggleRep} onCompleteSet={handleCompleteSet} />
        );
        if (t === "pitchLowering") return (
            <PitchLoweringDisplay ex={ex} timerRemaining={timerRemaining} timerRunning={timerRunning} currentRound={currentRound} roundsDone={currentRound} onCompleteRound={handleCompleteRound} />
        );
        return null;
    };

    // Show START button only for exercises that need it
    const needsStartButton = ["breathingGuide", "phaseReps", "mindfulTimer", "setTimer", "standingTimer", "morningTimer", "pitchLowering"].includes(ex.type);
    // For bilateral: start is per-side, no global start
    // For repCounter, setReps, pitchReps: no start needed (manual tap)
    const showBilateralNoStart = ex.type === "bilateral";
    const showManualStart = ["repCounter", "setReps", "pitchReps"].includes(ex.type);

    return (
        <>
            <Navbar />
            <div className="vf-root-wrapper">
                <div className="vf-root">
                    <div className="vf-layout">

                        {/* ── SIDEBAR ── */}
                        <aside className="vf-sidebar">
                            <div className="vf-logo">
                                <div className="vf-logo-title">VOICE FORGE</div>
                                <div className="vf-logo-sub">Deep Voice Training</div>
                            </div>

                            <div className="vf-nav-scroll">
                                {CATEGORIES.map((cat) => (
                                    <div key={cat}>
                                        <div className="vf-cat-header">{cat}</div>
                                        {EXERCISES.filter((e) => e.cat === cat).map((e) => (
                                            <div
                                                key={e.id}
                                                className={`vf-nav-item${e.id === current ? " active" : ""}${done.has(e.id) ? " done" : ""}`}
                                                onClick={() => setCurrent(e.id)}
                                            >
                                                <div className="vf-dot" />
                                                <div className="vf-nav-label">{e.title}</div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            <div className="vf-progress-wrap">
                                <div className="vf-prog-label">
                                    <span>PROGRESS</span>
                                    <span>{pct}%</span>
                                </div>
                                <div className="vf-prog-track">
                                    <div className="vf-prog-fill" style={{ width: pct + "%" }} />
                                </div>
                            </div>
                        </aside>

                        {/* ── MAIN ── */}
                        <main className="vf-main">
                            <Waveform active={waveActive} />

                            <div className="vf-header">
                                <div>
                                    <div className="vf-ex-cat">{ex.cat}</div>
                                    <div className="vf-ex-title">{ex.title}</div>
                                    <div className="vf-ex-num">
                                        EXERCISE {String(current + 1).padStart(2, "0")} / {EXERCISES.length}
                                    </div>
                                </div>
                                <div className="vf-badges">
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        {ex.badges.map((b) => (
                                            <div key={b} className="vf-badge">{b}</div>
                                        ))}
                                        {/* Action buttons */}
                                        {!started && (needsStartButton || showManualStart || showBilateralNoStart) && (
                                            <button
                                                className="vf-btn primary"
                                                onClick={startExercise}
                                                style={{ padding: '8px 24px', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.1em' }}
                                            >
                                                ▶ START
                                            </button>
                                        )}
                                        {started && !complete && (
                                            <button
                                                className="vf-btn danger"
                                                onClick={resetExercise}
                                                style={{ padding: '8px 24px', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.1em' }}
                                            >
                                                ■ STOP
                                            </button>
                                        )}
                                        {complete && (
                                            <>
                                                <button
                                                    className="vf-btn success-btn"
                                                    style={{ padding: '8px 24px', fontSize: '14px', fontWeight: 'bold' }}
                                                    onClick={markDone}
                                                >
                                                    ✓ DONE
                                                </button>
                                                {current < EXERCISES.length - 1 && (
                                                    <button
                                                        className="vf-btn primary"
                                                        onClick={nextExercise}
                                                        style={{ padding: '8px 24px', fontSize: '14px', fontWeight: 'bold' }}
                                                    >
                                                        NEXT →
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="vf-body" style={{ paddingBottom: '80px' }}>
                                <div className="vf-instruction">{ex.instruction}</div>

                                {started && renderExerciseDisplay()}

                                {complete && (
                                    <div className="vf-complete-banner">
                                        <span className="vf-complete-icon">✓</span>
                                        <div className="vf-complete-text">
                                            <strong>EXERCISE COMPLETE</strong> — Mark done and move to the next.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        </>
    );
}