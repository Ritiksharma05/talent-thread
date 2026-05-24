/* ==============================================================
   Talent Thread — AI Portfolio Analysis Dashboard Logic
   Auto-loads demo data on page load; replaces with real user data
   if the user is a logged-in designer with an existing review.
   Uses platform design tokens and accent colour (#2563eb).
   ============================================================== */

// ──────────────────────────────────────────────────────────────
// Dimension display metadata — colours from platform palette
// ──────────────────────────────────────────────────────────────
const DIM_DISPLAY = {
  visualDesign:          { icon: "👁",  label: "Visual Appeal",    color: "#2563eb" },
  problemSolving:        { icon: "🚀", label: "Skill",             color: "#0ea5e9" },
  portfolioStorytelling: { icon: "📚", label: "Depth",             color: "#f97316" },
  toolFluency:           { icon: "📊", label: "Market Fit",        color: "#d97706" },
  communication:         { icon: "💬", label: "Storytelling",      color: "#dc2626" },
  freelanceReadiness:    { icon: "🛡",  label: "Consistency",      color: "#059669" }
};

// Top-20% benchmark scores per dimension (0-100)
const BENCHMARKS = {
  visualDesign: 88, problemSolving: 90, portfolioStorytelling: 85,
  toolFluency: 88,  communication: 82,  freelanceReadiness: 80
};

// Platform-aligned timeline step colours
const TIMELINE_COLORS = ["#2563eb", "#0ea5e9", "#d97706", "#059669"];

// ──────────────────────────────────────────────────────────────
// DOM refs
// ──────────────────────────────────────────────────────────────
const reviewEl = {
  authGate:          document.querySelector("#authGate"),
  emptyState:        document.querySelector("#emptyState"),
  demoBanner:        document.querySelector("#demoBanner"),
  demoBannerDismiss: document.querySelector("#demoBannerDismiss"),
  reviewContent:     document.querySelector("#reviewContent"),
  dashEvalDate:      document.querySelector("#dashEvalDate"),
  scoreRingWrap:     document.querySelector("#scoreRingWrap"),
  topPercentBadge:   document.querySelector("#topPercentBadge"),
  topPercentNote:    document.querySelector("#topPercentNote"),
  personaCard:       document.querySelector("#personaCard"),
  dimScoreRow:       document.querySelector("#dimScoreRow"),
  radarChartWrap:    document.querySelector("#radarChartWrap"),
  breakdownList:     document.querySelector("#breakdownList"),
  strengthsWrap:     document.querySelector("#strengthsWrap"),
  weaknessesWrap:    document.querySelector("#weaknessesWrap"),
  gapTableWrap:      document.querySelector("#gapTableWrap"),
  projectListWrap:   document.querySelector("#projectListWrap"),
  growthTimelineWrap:document.querySelector("#growthTimelineWrap"),
  growthTipText:     document.querySelector("#growthTipText"),
  historyList:       document.querySelector("#historyList"),
  exportReportBtn:   document.querySelector("#exportReportBtn")
};

// ──────────────────────────────────────────────────────────────
// 1. Score Ring (SVG circular progress)
// ──────────────────────────────────────────────────────────────
function buildScoreRing(score) {
  const r = 68, cx = 88, cy = 88;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  return /* html */`
    <svg viewBox="0 0 176 176" width="158" height="158" class="rv-score-ring-svg" aria-label="Score: ${score} out of 100">
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2563eb"/>
          <stop offset="100%" stop-color="#1d4ed8"/>
        </linearGradient>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f0f2f5" stroke-width="13"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#ringGrad)" stroke-width="13"
        stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
        stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
      <text x="${cx}" y="${cx - 9}" text-anchor="middle"
        font-family="Inter,sans-serif" font-size="42" font-weight="800" fill="#111827">${score}</text>
      <text x="${cx}" y="${cx + 16}" text-anchor="middle"
        font-family="Inter,sans-serif" font-size="14" font-weight="500" fill="#9ca3af">/100</text>
    </svg>`;
}

// ──────────────────────────────────────────────────────────────
// 2. Top Percentile
// ──────────────────────────────────────────────────────────────
function topPercent(score) {
  if (score >= 90) return { label: "Top 10% ↑", note: "You are performing better than 90% of designers in our database." };
  if (score >= 80) return { label: "Top 20% ↑", note: "You are performing better than 80% of designers in our database." };
  if (score >= 70) return { label: "Top 30% ↑", note: "You are performing better than 70% of designers in our database." };
  if (score >= 60) return { label: "Top 40% ↑", note: "You are performing better than 60% of designers in our database." };
  if (score >= 50) return { label: "Top 50%",   note: "You are in the middle range of designers in our database." };
  return { label: "Building up", note: "Focus on the improvement areas below to move up the rankings." };
}

// ──────────────────────────────────────────────────────────────
// 3. Persona Card
// ──────────────────────────────────────────────────────────────
function personaFromAssessment(assessment) {
  const dims = Array.isArray(assessment.dimensions) ? assessment.dimensions : [];
  const topDim = dims.reduce((b, d) => d.score > (b ? b.score : 0) ? d : b, null);
  const key = topDim ? topDim.key : (assessment.band === "Market-ready" ? "problemSolving" : "visualDesign");
  const map = {
    visualDesign:          { name: "Visual Designer",     icon: "🎨", desc: "Strong visual sense and craft. Push further with deeper case study narratives and UX rationale." },
    problemSolving:        { name: "Product Thinker",     icon: "🧠", desc: "Strong product-reasoning signal. Push further with richer portfolio storytelling and measurable outcomes." },
    portfolioStorytelling: { name: "Design Storyteller",  icon: "📖", desc: "Case studies show narrative ability. Strengthen visual craft consistency to reach top tier." },
    toolFluency:           { name: "Technical Designer",  icon: "⚡", desc: "Highly proficient in tools and execution. Develop deeper problem-framing and case study evidence." },
    communication:         { name: "Design Communicator", icon: "💬", desc: "Articulate design decisions clearly. Strengthen visual quality and depth of individual project outcomes." },
    freelanceReadiness:    { name: "Freelance-Ready",     icon: "💼", desc: "Strong business acumen and delivery confidence. Keep developing portfolio depth for higher-value clients." }
  };
  return map[key] || map.visualDesign;
}

function buildPersonaCard(assessment) {
  const persona = personaFromAssessment(assessment);
  const confidence = assessment.confidence || 0;
  const e = TalentThread.escapeHtml;
  return /* html */`
    <p class="rv-card-eyebrow">YOUR PERSONA <span class="rv-info-btn" title="Derived from your top scoring dimension">ⓘ</span></p>
    <div class="rv-persona-inner">
      <div class="rv-persona-icon-wrap" aria-hidden="true">${e(persona.icon)}</div>
      <h2 class="rv-persona-name">${e(persona.name)}</h2>
      <p class="rv-persona-desc">${e(persona.desc)}</p>
      <div class="rv-confidence-row">
        <span class="rv-confidence-label">Confidence Score</span>
        <span class="rv-info-btn" title="AI confidence based on portfolio evidence quality">ⓘ</span>
        <span class="rv-confidence-value">${e(String(confidence))}%</span>
      </div>
    </div>
    <div class="rv-persona-bg" aria-hidden="true">${e(persona.icon)}</div>`;
}

// ──────────────────────────────────────────────────────────────
// 4. Dimension Score Cards
// ──────────────────────────────────────────────────────────────
function buildDimScoreCards(dimensions) {
  const e = TalentThread.escapeHtml;
  return dimensions.map(dim => {
    const meta = DIM_DISPLAY[dim.key] || { icon: "📌", label: dim.label, color: "#6b7280" };
    const score10 = (dim.score / 10).toFixed(1);
    return /* html */`
      <div class="rv-dim-card" title="${e(dim.narrative)}" aria-label="${e(meta.label)}: ${score10} out of 10">
        <div class="rv-dim-card-icon" aria-hidden="true">${e(meta.icon)}</div>
        <div class="rv-dim-card-label">${e(meta.label)}</div>
        <div class="rv-dim-card-score">${score10}<span>/10</span></div>
        <div class="rv-dim-bar">
          <div class="rv-dim-bar-fill" style="width:${dim.score}%; background:${e(meta.color)};"></div>
        </div>
      </div>`;
  }).join("");
}

// ──────────────────────────────────────────────────────────────
// 5. Radar / Spider Chart
// ──────────────────────────────────────────────────────────────
function buildRadarChart(dimensions) {
  const cx = 130, cy = 130, maxR = 105, size = 260;
  const n = dimensions.length;
  const angles = dimensions.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI / n));
  const accentColor = "#2563eb", accentFill = "rgba(37,99,235,0.10)";
  const gridColor = "#e5e7eb", labelColor = "#6b7280";

  const pt = (f, i) => ({ x: cx + f * maxR * Math.cos(angles[i]), y: cy + f * maxR * Math.sin(angles[i]) });
  const gridPoly = f => `<polygon points="${dimensions.map((_, i) => { const p = pt(f, i); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ")}" fill="none" stroke="${gridColor}" stroke-width="1"/>`;
  const axisLine = i => { const p = pt(1, i); return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="${gridColor}" stroke-width="1"/>`; };

  const dataPts = dimensions.map((dim, i) => { const p = pt(dim.score / 100, i); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ");
  const dataDots = dimensions.map((dim, i) => {
    const p = pt(dim.score / 100, i);
    const meta = DIM_DISPLAY[dim.key] || {};
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="${meta.color || accentColor}" stroke="white" stroke-width="2"/>`;
  }).join("");

  const labels = dimensions.map((dim, i) => {
    const a = angles[i], lr = maxR + 22;
    const lx = cx + lr * Math.cos(a), ly = cy + lr * Math.sin(a);
    const ta = Math.cos(a) < -0.2 ? "end" : Math.cos(a) > 0.2 ? "start" : "middle";
    const short = DIM_DISPLAY[dim.key]?.label || dim.label;
    return `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${ta}" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="${labelColor}">${TalentThread.escapeHtml(short)}</text>`;
  }).join("");

  return /* html */`
    <svg viewBox="0 0 ${size} ${size}" class="rv-radar-svg" width="218" height="218" aria-label="Radar chart">
      ${[.2,.4,.6,.8,1].map(gridPoly).join("")}
      ${dimensions.map((_, i) => axisLine(i)).join("")}
      <polygon points="${dataPts}" fill="${accentFill}" stroke="${accentColor}" stroke-width="2.5" stroke-linejoin="round"/>
      ${dataDots}
      ${labels}
    </svg>`;
}

// ──────────────────────────────────────────────────────────────
// 6. Breakdown List
// ──────────────────────────────────────────────────────────────
function buildBreakdownList(dimensions) {
  const e = TalentThread.escapeHtml;
  const header = `<div class="rv-breakdown-header"><span class="rv-breakdown-col">PARAMETER</span><span class="rv-breakdown-col">SCORE</span></div>`;
  const rows = dimensions.map(dim => {
    const meta = DIM_DISPLAY[dim.key] || { color: "#6b7280", label: dim.label };
    return /* html */`
      <div class="rv-breakdown-item">
        <span class="rv-breakdown-dot" style="background:${e(meta.color)};"></span>
        <span class="rv-breakdown-name">${e(dim.label)}</span>
        <span class="rv-breakdown-score">${(dim.score / 10).toFixed(1)}/10</span>
      </div>`;
  }).join("");
  return header + rows;
}

// ──────────────────────────────────────────────────────────────
// 7. Strengths & Weaknesses chips
// ──────────────────────────────────────────────────────────────
function buildStrengthsBlock(strengths) {
  const e = TalentThread.escapeHtml;
  return /* html */`
    <p class="rv-sw-section-label s-label">Strengths</p>
    <div class="rv-tags-row">${strengths.map(s => `<span class="rv-tag s-tag"><span class="rv-tag-icon" aria-hidden="true">✓</span>${e(s.label)}</span>`).join("")}</div>`;
}

function buildWeaknessesBlock(weaknesses) {
  const e = TalentThread.escapeHtml;
  return /* html */`
    <p class="rv-sw-section-label w-label">Areas to Improve</p>
    <div class="rv-tags-row">${weaknesses.map(w => `<span class="rv-tag w-tag"><span class="rv-tag-icon" aria-hidden="true">⚠</span>${e(w.label)}</span>`).join("")}</div>`;
}

// ──────────────────────────────────────────────────────────────
// 8. Gap Analysis Table
// ──────────────────────────────────────────────────────────────
function buildGapTable(dimensions) {
  const e = TalentThread.escapeHtml;
  const ranked = [...dimensions]
    .map(dim => ({ ...dim, bench: BENCHMARKS[dim.key] || 75, gap: dim.score - (BENCHMARKS[dim.key] || 75) }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 4);

  const header = `
    <div class="rv-gap-header-row">
      <span class="rv-gap-col-hdr">PARAMETER</span>
      <span class="rv-gap-col-hdr">YOUR SCORE</span>
      <span class="rv-gap-col-hdr">TOP 20%</span>
      <span class="rv-gap-col-hdr">GAP</span>
    </div>`;

  const rows = ranked.map(dim => {
    const meta = DIM_DISPLAY[dim.key] || {};
    const gapStr = (dim.gap >= 0 ? "+" : "") + dim.gap.toFixed(0);
    return /* html */`
      <div class="rv-gap-row">
        <span class="rv-gap-param">${e(dim.label)}</span>
        <div class="rv-gap-bar-cell">
          <div class="rv-gap-mini-bar">
            <div class="rv-gap-mini-fill" style="width:${dim.score}%; background:${e(meta.color || "#2563eb")};"></div>
          </div>
          <span class="rv-gap-val">${dim.score}</span>
        </div>
        <div class="rv-gap-bar-cell">
          <div class="rv-gap-mini-bar">
            <div class="rv-gap-mini-fill" style="width:${dim.bench}%; background:#059669;"></div>
          </div>
          <span class="rv-gap-val">${dim.bench}</span>
        </div>
        <span class="rv-gap-delta ${dim.gap >= 0 ? "pos" : "neg"}">${e(gapStr)}</span>
      </div>`;
  }).join("");

  return header + rows + `<a href="/skill-lab.html" class="rv-bench-link">View Detailed Benchmark →</a>`;
}

// ──────────────────────────────────────────────────────────────
// 9. Project Breakdown (from agents)
// ──────────────────────────────────────────────────────────────
function buildProjectList(agents) {
  if (!agents || !agents.length) return `<p style="color:var(--ink-muted);font-size:var(--text-sm);">No breakdown available.</p>`;
  const e = TalentThread.escapeHtml;
  const sorted = [...agents].sort((a, b) => b.score - a.score);
  const hi = sorted[0].score, lo = sorted[sorted.length - 1].score;
  const thumbs = ["🎨", "📱", "💼", "✏️", "🖥️"];
  return sorted.map((agent, i) => {
    const score10 = (agent.score / 10).toFixed(1);
    const isBest = agent.score === hi;
    const isLow = agent.score === lo && agent.score < 75;
    const tag = isBest
      ? `<span class="rv-project-tag best">✓ Best</span>`
      : isLow
        ? `<span class="rv-project-tag consider">⚠ Needs Work</span>`
        : `<span class="rv-project-tag neutral">${e(agent.focus || "")}</span>`;
    return /* html */`
      <div class="rv-project-item">
        <div class="rv-project-thumb" aria-hidden="true">${thumbs[i % thumbs.length]}</div>
        <div class="rv-project-info">
          <p class="rv-project-name">${e(agent.title)}</p>${tag}
        </div>
        <div class="rv-project-score">${score10}<span class="rv-project-score-denom">/10</span></div>
      </div>`;
  }).join("");
}

// ──────────────────────────────────────────────────────────────
// 10. Growth Timeline
// ──────────────────────────────────────────────────────────────
function buildGrowthTimeline(roadmap) {
  if (!Array.isArray(roadmap) || !roadmap.length) return "";
  const e = TalentThread.escapeHtml;
  const stepColors = ["#2563eb", "#0ea5e9", "#d97706", "#059669"];
  const dotIcons   = ["📚", "✏️", "📊", "🚀"];
  return roadmap.map((step, i) => /* html */`
    <div class="rv-timeline-step">
      <div class="rv-timeline-dot" style="background:${e(stepColors[i % 4])};" aria-hidden="true">${dotIcons[i % 4]}</div>
      <p class="rv-timeline-phase" style="color:${e(stepColors[i % 4])};">${e(step.phase)}</p>
      <p class="rv-timeline-title">${e(step.title)}</p>
      <p class="rv-timeline-detail">${e(step.detail)}</p>
    </div>`).join("");
}

// ──────────────────────────────────────────────────────────────
// 11. Assessment History
// ──────────────────────────────────────────────────────────────
function buildHistoryGrid(history) {
  if (!history || !history.length) return `<p style="color:var(--ink-muted);font-size:var(--text-sm);">No previous assessments yet.</p>`;
  const e = TalentThread.escapeHtml;
  return [...history].reverse().map((item, i) => {
    const d = new Date(item.createdAt);
    const label = Number.isNaN(d.getTime()) ? "Saved review"
      : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return /* html */`
      <div class="rv-history-item ${i === 0 ? "current" : ""}">
        <p class="rv-history-date">${e(label)}</p>
        <p class="rv-history-score">${e(String(item.overallScore))}</p>
        <p class="rv-history-band">${e(item.band)} band</p>
      </div>`;
  }).join("");
}

// ──────────────────────────────────────────────────────────────
// 12. Main Render — populate all dashboard sections
// ──────────────────────────────────────────────────────────────
function renderDashboard(state) {
  const a = state.assessment;
  const dims   = Array.isArray(a.dimensions) ? a.dimensions : [];
  const str    = Array.isArray(a.strengths)  ? a.strengths  : [];
  const weak   = Array.isArray(a.weaknesses) ? a.weaknesses : [];
  const agents = Array.isArray(a.agents)     ? a.agents     : [];
  const roadmap= Array.isArray(a.roadmap)    ? a.roadmap    : [];
  const history= Array.isArray(state.history)? state.history: [];

  const score = a.overallScore || 0;
  const pct   = topPercent(score);

  // Eval date
  if (reviewEl.dashEvalDate) {
    const d = new Date(a.createdAt || Date.now());
    reviewEl.dashEvalDate.textContent = Number.isNaN(d.getTime()) ? ""
      : `Evaluated on ${d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} • ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  }

  if (reviewEl.scoreRingWrap)    reviewEl.scoreRingWrap.innerHTML   = buildScoreRing(score);
  if (reviewEl.topPercentBadge)  reviewEl.topPercentBadge.innerHTML = TalentThread.escapeHtml(pct.label);
  if (reviewEl.topPercentNote)   reviewEl.topPercentNote.textContent = pct.note;
  if (reviewEl.personaCard)      reviewEl.personaCard.innerHTML      = buildPersonaCard(a);
  if (reviewEl.dimScoreRow)      reviewEl.dimScoreRow.innerHTML      = dims.length ? buildDimScoreCards(dims) : "";
  if (reviewEl.radarChartWrap)   reviewEl.radarChartWrap.innerHTML   = dims.length ? buildRadarChart(dims)   : "";
  if (reviewEl.breakdownList)    reviewEl.breakdownList.innerHTML    = dims.length ? buildBreakdownList(dims) : "";
  if (reviewEl.strengthsWrap)    reviewEl.strengthsWrap.innerHTML    = str.length  ? buildStrengthsBlock(str)  : "";
  if (reviewEl.weaknessesWrap)   reviewEl.weaknessesWrap.innerHTML   = weak.length ? buildWeaknessesBlock(weak): "";
  if (reviewEl.gapTableWrap)     reviewEl.gapTableWrap.innerHTML     = dims.length ? buildGapTable(dims)     : "";
  if (reviewEl.projectListWrap)  reviewEl.projectListWrap.innerHTML  = buildProjectList(agents);
  if (reviewEl.growthTimelineWrap) reviewEl.growthTimelineWrap.innerHTML = buildGrowthTimeline(roadmap);
  if (reviewEl.growthTipText) {
    reviewEl.growthTipText.textContent = weak[0]
      ? `✨ Tip: Improving your ${weak[0].label.toLowerCase()} score by 15 points could move you to the next band.`
      : "✨ Tip: Consistently improving your weak areas can increase your score by 15–25 points!";
  }
  if (reviewEl.historyList) reviewEl.historyList.innerHTML = buildHistoryGrid(history);
}

// ──────────────────────────────────────────────────────────────
// State helpers
// ──────────────────────────────────────────────────────────────
function showDashboard(state, isDemo = false) {
  TalentThread.hide(reviewEl.authGate);
  TalentThread.hide(reviewEl.emptyState);
  TalentThread.show(reviewEl.reviewContent);

  // Show or hide demo banner
  if (isDemo) {
    TalentThread.show(reviewEl.demoBanner);
  } else {
    TalentThread.hide(reviewEl.demoBanner);
  }

  renderDashboard(state);
}

function showEmpty() {
  TalentThread.hide(reviewEl.authGate);
  TalentThread.hide(reviewEl.demoBanner);
  TalentThread.hide(reviewEl.reviewContent);
  TalentThread.show(reviewEl.emptyState);
}

function showRoleError(error) {
  TalentThread.hide(reviewEl.emptyState);
  TalentThread.hide(reviewEl.reviewContent);
  TalentThread.hide(reviewEl.demoBanner);
  TalentThread.renderAuthGate(
    reviewEl.authGate,
    "Designer access only",
    "Switch to a designer account to view portfolio assessments.",
    "/"
  );
}

// ──────────────────────────────────────────────────────────────
// Data loaders
// ──────────────────────────────────────────────────────────────
async function loadDemoData() {
  try {
    const state = await TalentThread.requestJson("/api/demo-review", { method: "GET" });
    showDashboard(state, true /* isDemo */);
  } catch (err) {
    console.error("Demo load error:", err.message);
  }
}

async function tryLoadRealData() {
  try {
    const state = await TalentThread.requestJson("/api/designer/state", { method: "GET" });
    if (state?.assessment) {
      // Has real data — replace demo with real data, hide demo banner
      showDashboard(state, false /* isDemo */);
    } else {
      // Logged in designer but no review yet
      showEmpty();
    }
  } catch (err) {
    if (err.statusCode === 403) {
      showRoleError(err);
    }
    // 401 = not logged in, do nothing — keep demo data showing
  }
}

// ──────────────────────────────────────────────────────────────
// Bootstrap — always show demo first, then upgrade if logged in
// ──────────────────────────────────────────────────────────────
async function bootstrap() {
  // Step 1: Load demo instantly so users always see a dashboard
  await loadDemoData();

  // Step 2: Try to load real user data — replaces demo if available
  await tryLoadRealData();
}

// ──────────────────────────────────────────────────────────────
// Event Listeners
// ──────────────────────────────────────────────────────────────
if (reviewEl.demoBannerDismiss) {
  reviewEl.demoBannerDismiss.addEventListener("click", () => {
    TalentThread.hide(reviewEl.demoBanner);
  });
}

if (reviewEl.exportReportBtn) {
  reviewEl.exportReportBtn.addEventListener("click", () => window.print());
}

document.addEventListener("DOMContentLoaded", bootstrap);

