import { Routes, Route, useNavigate } from "react-router-dom";
import SkillsTraining from "./VoiceTraining";
import Navbar from "./Navbar";

/* ─────────────────────────────────────────────
   SKILL CARDS DATA
   Each card maps to a child route.
───────────────────────────────────────────── */
const SKILLS = [
  {
    id: "voice-forge",
    path: "voice-forge",
    label: "BREATHING",
    title: "VOICE FORGE",
    subtitle: "Deep Voice Training",
    description:
      "Master diaphragmatic breathing, chest resonance, and progressive pitch lowering through 17 structured exercises designed to unlock your lowest registers.",
    stats: [
      { value: "17", label: "EXERCISES" },
      { value: "5", label: "CATEGORIES" },
      { value: "21", label: "DAY PROGRAM" },
    ],
    accent: "#C87941",
    tag: "VOCAL TRAINING",
    icon: "◈",
  },
];

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=Crimson+Pro:ital,wght@0,300;1,300&display=swap');

  .hub-root {
    --bg: #080808;
    --surface: #0f0f0f;
    --surface2: #141414;
    --border: #1e1e1e;
    --border2: #252525;
    --text: #e8e0d4;
    --muted: #5a534a;
    --dim: #2a2420;
    --copper: #C87941;
    --copper2: #a85f28;
    --copper3: #e8934e;
    --success: #4a9b6f;

    box-sizing: border-box;
    font-family: 'DM Mono', monospace;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    width: 100%;
    position: relative;
    overflow-x: hidden;
  }

  .hub-root *, .hub-root *::before, .hub-root *::after {
    box-sizing: border-box;
  }

  /* ── NOISE OVERLAY ── */
  .hub-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
    opacity: 0.4;
  }

  /* ── HEADER ── */
  .hub-header {
    position: relative;
    z-index: 10;
    padding: 48px 64px 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 1px solid var(--border);
    padding-bottom: 28px;
  }

  .hub-brand {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .hub-brand-eyebrow {
    font-size: 8px;
    letter-spacing: 0.3em;
    color: var(--copper);
    text-transform: uppercase;
  }

  .hub-brand-name {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 52px;
    letter-spacing: 0.06em;
    line-height: 1;
    color: var(--text);
  }

  .hub-brand-name span {
    color: var(--copper);
  }

  .hub-brand-sub {
    font-size: 9px;
    letter-spacing: 0.25em;
    color: var(--muted);
    text-transform: uppercase;
    margin-top: 4px;
  }

  .hub-header-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .hub-header-stat {
    font-size: 8px;
    letter-spacing: 0.18em;
    color: var(--muted);
    text-transform: uppercase;
  }

  .hub-header-stat strong {
    color: var(--text);
  }

  /* ── MARQUEE ── */
  .hub-marquee-wrap {
    position: relative;
    z-index: 10;
    border-bottom: 1px solid var(--border);
    overflow: hidden;
    height: 28px;
    display: flex;
    align-items: center;
    background: var(--surface);
  }

  .hub-marquee-track {
    display: flex;
    gap: 0;
    animation: marquee 28s linear infinite;
    white-space: nowrap;
  }

  .hub-marquee-track:hover { animation-play-state: paused; }

  @keyframes marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  .hub-marquee-item {
    font-size: 7.5px;
    letter-spacing: 0.22em;
    color: var(--muted);
    text-transform: uppercase;
    padding: 0 28px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .hub-marquee-item::after {
    content: '◈';
    color: var(--copper2);
    font-size: 6px;
  }

  /* ── GRID ── */
  .hub-body {
    position: relative;
    z-index: 10;
    padding: 52px 64px 80px;
  }

  .hub-section-label {
    font-size: 7px;
    letter-spacing: 0.28em;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 28px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .hub-section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .hub-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1px;
    background: var(--border);
  }

  /* ── CARD ── */
  .hub-card {
    position: relative;
    background: var(--surface);
    padding: 28px 30px 26px;
    cursor: pointer;
    overflow: hidden;
    transition: background 0.15s;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .hub-card::before {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: var(--card-accent, #C87941);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.3s ease;
  }

  .hub-card:hover::before { transform: scaleX(1); }

  .hub-card:hover { background: var(--surface2); }

  /* ── HOVER GLOW ── */
  .hub-card:hover .hub-card-icon { opacity: 0.6; }

  .hub-card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .hub-card-tag {
    font-size: 6.5px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--card-accent, #C87941);
    border: 1px solid var(--card-accent, #C87941);
    padding: 2px 6px;
    line-height: 1.5;
    opacity: 0.75;
  }

  .hub-card-icon {
    font-size: 18px;
    color: var(--card-accent, #C87941);
    opacity: 0.3;
  }

  .hub-card-body { flex: 1; }

  .hub-card-label {
    font-size: 7px;
    letter-spacing: 0.22em;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .hub-card-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 32px;
    letter-spacing: 0.05em;
    line-height: 1;
    color: var(--text);
    margin-bottom: 4px;
  }

  .hub-card-subtitle {
    font-size: 8px;
    letter-spacing: 0.16em;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 14px;
  }

  .hub-card-desc {
    font-family: 'Crimson Pro', serif;
    font-size: 12.5px;
    font-weight: 300;
    line-height: 1.65;
    color: #7a7068;
  }

  .hub-card-stats {
    display: flex;
    gap: 0;
    border-top: 1px solid var(--border);
    padding-top: 14px;
  }

  .hub-card-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-right: 14px;
  }

  .hub-card-stat + .hub-card-stat {
    border-left: 1px solid var(--border);
    padding-left: 14px;
    padding-right: 14px;
  }

  .hub-stat-val {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22px;
    letter-spacing: 0.04em;
    line-height: 1;
    color: var(--text);
  }

  .hub-stat-lbl {
    font-size: 6.5px;
    letter-spacing: 0.18em;
    color: var(--muted);
    text-transform: uppercase;
  }

  .hub-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .hub-card-cta {
    font-size: 7.5px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--card-accent, #C87941);
    display: flex;
    align-items: center;
    gap: 6px;
    transition: gap 0.2s;
  }

  .hub-card:not(.locked):hover .hub-card-cta { gap: 10px; }

  .hub-card-lock {
    font-size: 7.5px;
    letter-spacing: 0.15em;
    color: var(--muted);
    text-transform: uppercase;
  }

  /* ── ENTRY ANIMATION ── */
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .hub-card {
    animation: cardIn 0.4s ease both;
  }

  .hub-card:nth-child(1) { animation-delay: 0.05s; }
  .hub-card:nth-child(2) { animation-delay: 0.12s; }
  .hub-card:nth-child(3) { animation-delay: 0.19s; }
  .hub-card:nth-child(4) { animation-delay: 0.26s; }

  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .hub-header { animation: fadeIn 0.5s ease both; }
  .hub-marquee-wrap { animation: fadeIn 0.5s 0.1s ease both; }
  .hub-body { animation: fadeIn 0.5s 0.15s ease both; }
`;

/* ─────────────────────────────────────────────
   MARQUEE CONTENT
───────────────────────────────────────────── */
const MARQUEE_ITEMS = [
  "DIAPHRAGMATIC BREATHING",
  "CHEST RESONANCE",
  "VOCAL CORD TRAINING",
  "PITCH CONTROL",
  "NECK MOBILITY",
  "PROGRESSIVE OVERLOAD",
  "POSTURE ALIGNMENT",
  "HUMMING PROTOCOLS",
  "BREATH RETENTION",
  "TONAL MASTERY",
];

/* ─────────────────────────────────────────────
   SKILL HUB — CARD GRID
───────────────────────────────────────────── */
function SkillGrid() {
  const navigate = useNavigate();

  return (
    <>
      <Navbar />
      <style>{css}</style>
      <div className="hub-root ml-12">
        <header className="hub-header">
          <div className="hub-brand">
            <div className="hub-brand-eyebrow">PERFORMANCE SYSTEM</div>
            <div className="hub-brand-name">
              SKILLS<span>.</span>HUB
            </div>
            <div className="hub-brand-sub">Structured Training Programs</div>
          </div>
          <div className="hub-header-meta">
            <div className="hub-header-stat"><strong>1</strong> ACTIVE PROGRAM</div>
            <div className="hub-header-stat"><strong>17</strong> TOTAL EXERCISES</div>
            <div className="hub-header-stat"><strong>5</strong> CATEGORIES</div>
          </div>
        </header>

        <div className="hub-marquee-wrap">
          <div className="hub-marquee-track">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
              <div className="hub-marquee-item" key={i}>{item}</div>
            ))}
          </div>
        </div>

        <div className="hub-body">
          <div className="hub-section-label">AVAILABLE PROGRAMS</div>
          <div className="hub-grid">
            {SKILLS.map((skill) => (
              <div
                key={skill.id}
                className="hub-card"
                style={{ "--card-accent": skill.accent }}
                onClick={() => navigate('/Training/' + skill.path)}
              >
                <div className="hub-card-top">
                  <div className="hub-card-tag">{skill.tag}</div>
                  <div className="hub-card-icon">{skill.icon}</div>
                </div>
                <div className="hub-card-body">
                  <div className="hub-card-label">{skill.label}</div>
                  <div className="hub-card-title">{skill.title}</div>
                  <div className="hub-card-subtitle">{skill.subtitle}</div>
                  <div className="hub-card-desc">{skill.description}</div>
                </div>
                <div className="hub-card-stats">
                  {skill.stats.map((s, i) => (
                    <div className="hub-card-stat" key={i}>
                      <div className="hub-stat-val">{s.value}</div>
                      <div className="hub-stat-lbl">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="hub-card-footer">
                  <div className="hub-card-cta">ENTER PROGRAM →</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   MAIN PARENT COMPONENT
   App.jsx: <Route path="/Training/*" element={<SkillsTrainingHub />} />
───────────────────────────────────────────── */
export default function SkillsTrainingHub() {
  return (
    <Routes>
      <Route index element={<SkillGrid />} />
      <Route path="voice-forge" element={<SkillsTraining />} />
    </Routes>
  );
}