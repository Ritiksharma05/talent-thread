/* ============================================================
   Profile Dashboard JS — new two-column layout (no tabs)
   ============================================================ */

// ── Element refs ──────────────────────────────────────────
const profileElements = {
  authGate:                document.querySelector("#authGate"),
  clientApplicantCount:    document.querySelector("#clientApplicantCount"),
  clientContractBoard:     document.querySelector("#clientContractBoard"),
  clientEmail:             document.querySelector("#clientEmail"),
  clientName:              document.querySelector("#clientName"),
  clientNotifications:     document.querySelector("#clientNotifications"),
  clientProfile:           document.querySelector("#clientProfile"),
  clientProjectBoard:      document.querySelector("#clientProjectBoard"),
  clientProjectCount:      document.querySelector("#clientProjectCount"),
  designerApplicationCount: document.querySelector("#designerApplicationCount"),
  designerApplications:    document.querySelector("#designerApplications"),
  designerBand:            document.querySelector("#designerBand"),
  designerBandBadge:       document.querySelector("#designerBandBadge"),
  designerContracts:       document.querySelector("#designerContracts"),
  designerFullName:        document.querySelector("#designerFullName"),
  designerHeadline:        document.querySelector("#designerHeadline"),
  designerHistory:         document.querySelector("#designerHistory"),
  designerMeta:            document.querySelector("#designerMeta"),
  designerNotifications:   document.querySelector("#designerNotifications"),
  designerProfile:         document.querySelector("#designerProfile"),
  designerProfileFallback: document.querySelector("#designerProfileFallback"),
  designerProfileImage:    document.querySelector("#designerProfileImage"),
  designerSavedCount:      document.querySelector("#designerSavedCount"),
  designerSavedProjects:   document.querySelector("#designerSavedProjects"),
  designerScore:           document.querySelector("#designerScore"),
  designerLevel:           document.querySelector("#designerLevel"),
  designerTools:           document.querySelector("#designerTools"),
  designerAbout:           document.querySelector("#designerAbout"),
  portfolioButton:         document.querySelector("#portfolioButton"),
  publicProfileButton:     document.querySelector("#publicProfileButton"),
  saveToast:               document.querySelector("#saveToast")
};

function renderNotificationList(notifications, emptyMessage) {
  if (!notifications?.length) {
    return `<div class="pd-empty-inline">${TalentThread.escapeHtml(emptyMessage)}</div>`;
  }

  return notifications.slice(0, 5).map((item) => `
    <article class="simple-card">
      <strong>${TalentThread.escapeHtml(item.title || "Notification")}</strong>
      <p>${TalentThread.escapeHtml(item.body || "")}</p>
      <p class="metric-label">${new Date(item.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
    </article>
  `).join("");
}

function renderContractList(contracts, emptyMessage) {
  if (!contracts?.length) {
    return `<div class="pd-empty-inline">${TalentThread.escapeHtml(emptyMessage)}</div>`;
  }

  return contracts.slice(0, 4).map((contract) => `
    <article class="simple-card">
      <div class="challenge-meta">
        <div>
          <p class="metric-label">${TalentThread.escapeHtml(contract.status)}</p>
          <h4>${TalentThread.escapeHtml(contract.title || contract.project?.title || "Contract")}</h4>
        </div>
        <span class="score-pill">Rs ${TalentThread.escapeHtml(contract.paymentSummary?.totalValue || 0)}</span>
      </div>
      <p>${TalentThread.escapeHtml(contract.scope || contract.project?.summary || "")}</p>
      <p class="metric-label">${TalentThread.escapeHtml((contract.milestones || []).length)} milestone(s)</p>
    </article>
  `).join("");
}


// ── Toast ──────────────────────────────────────────────────
function showSaveToast(message) {
  if (!profileElements.saveToast || !message) return;
  profileElements.saveToast.textContent = message;
  profileElements.saveToast.classList.remove("hidden");
  profileElements.saveToast.classList.add("toast-visible");
  window.setTimeout(() => {
    profileElements.saveToast.classList.remove("toast-visible");
    profileElements.saveToast.classList.add("hidden");
  }, 2400);
}

// ── Helpers ────────────────────────────────────────────────
function initialsFromName(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "TT";
}

function renderProfileImage(profile) {
  // Enforce professional placeholder if no specific image is set.
  profileElements.designerProfileImage.src = profile.profileImage || "/assets/images/avatar_designer.png";
  profileElements.designerProfileImage.classList.remove("hidden");
  if (profileElements.designerProfileFallback) {
    profileElements.designerProfileFallback.classList.add("hidden");
  }
}

// ── Auth gate ──────────────────────────────────────────────
function renderUnauthorized() {
  TalentThread.hide(profileElements.clientProfile);
  TalentThread.hide(profileElements.designerProfile);
  TalentThread.show(profileElements.authGate);
}


// ── Client board ───────────────────────────────────────────
function renderClientProjectBoard(projects) {
  if (!projects.length) {
    return TalentThread.emptyCard("No projects yet", "Post a project from Marketplace to start building your hiring profile.");
  }
  return projects.map(project => `
    <article class="project-card project-board-card">
      <div class="challenge-meta">
        <div>
          <p class="metric-label">${TalentThread.escapeHtml(project.status)}</p>
          <h4>${TalentThread.escapeHtml(project.title)}</h4>
        </div>
        <span class="score-pill">${TalentThread.escapeHtml(project.budget)}</span>
      </div>
      <p>${TalentThread.escapeHtml(project.summary)}</p>
      <div class="chip-row">
        ${TalentThread.chip(project.discipline)}
        ${TalentThread.chip(project.mode)}
        ${TalentThread.chip(project.duration)}
      </div>
      <div class="applicant-stack">
        ${(project.applicants || []).length
          ? project.applicants.map(app => TalentThread.applicationCard(app)).join("")
          : TalentThread.emptyCard("No applicants yet", "Applicants will appear once designers start applying.")
        }
      </div>
    </article>
  `).join("");
}

// ── Designer Profile ───────────────────────────────────────
function renderDesignerState(state) {
  const savedProjects = (state.projects || []).filter(p => p.saved);
  const profile    = state.profile || {};
  const assessment = state.assessment || {};
  const progress   = state.progress || {};
  const challenges = state.challenges || [];

  TalentThread.hide(profileElements.authGate);
  TalentThread.hide(profileElements.clientProfile);
  TalentThread.show(profileElements.designerProfile);

  // ── Sidebar ──
  const score = assessment.overallScore || 0;
  const band  = assessment.band || "Not reviewed";

  if (profileElements.designerScore) profileElements.designerScore.textContent = score;
  if (profileElements.designerBand)  profileElements.designerBand.textContent  = band;
  if (profileElements.designerBandBadge) profileElements.designerBandBadge.textContent = band;
  if (profileElements.designerLevel) profileElements.designerLevel.textContent = progress.level || 1;
  if (profileElements.designerSavedCount) profileElements.designerSavedCount.textContent = savedProjects.length;
  if (profileElements.designerApplicationCount) profileElements.designerApplicationCount.textContent = (state.applications || []).length;

  if (profileElements.designerFullName)  profileElements.designerFullName.textContent  = profile.fullName || profile.name || "Designer";
  if (profileElements.designerHeadline)  profileElements.designerHeadline.textContent  = profile.headline || profile.name || "Design professional";
  if (profileElements.designerAbout)     profileElements.designerAbout.textContent     = profile.about || "Add a short introduction to your profile.";

  if (profileElements.designerMeta) {
    profileElements.designerMeta.innerHTML = [
      TalentThread.chip(profile.city || "India"),
      TalentThread.chip(profile.availability || "Open to freelance"),
      TalentThread.chip(profile.preferredRate || "Rate pending", "accent-chip")
    ].join("");
    // Map styles to pd-chip
    profileElements.designerMeta.querySelectorAll('.chip').forEach(c => {
      c.className = c.className.replace('chip', 'pd-chip');
    });
    profileElements.designerMeta.querySelectorAll('.accent-chip').forEach(c => {
      c.classList.add('pd-chip');
    });
  }

  if (profileElements.designerTools) {
    const tools = (profile.tools || []);
    profileElements.designerTools.innerHTML = tools.length
      ? tools.map(t => `<span class="pd-chip">${TalentThread.escapeHtml(t)}</span>`).join("")
      : `<span class="pd-chip">Tools pending</span>`;
  }

  renderProfileImage(profile);

  if (profileElements.portfolioButton) {
    profileElements.portfolioButton.href        = profile.portfolioLink || "/";
    profileElements.portfolioButton.textContent = profile.portfolioLink ? "Open Portfolio ↗" : "Add Portfolio Link";
  }
  if (profileElements.publicProfileButton && state.user?.username) {
    profileElements.publicProfileButton.href = `/designers/${state.user.username}`;
  }

  // ── AI Score Card ──
  const scoreEmpty = document.getElementById("pdScoreEmpty");
  const scoreCard  = document.getElementById("pdScoreCard");
  const ringArc    = document.getElementById("pdRingArc");
  const ringNum    = document.getElementById("pdRingNum");

  if (score > 0 && scoreCard) {
    if (scoreEmpty) scoreEmpty.classList.add("hidden");
    scoreCard.classList.remove("hidden");
    // Animate ring
    if (ringArc && ringNum) {
      const circumference = 289;
      const target = score;
      const duration = 1200;
      const start = performance.now();
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        ringNum.textContent = Math.round(ease * target);
        ringArc.style.strokeDashoffset = circumference - (ease * target / 100 * circumference);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    // Dimension bars (top 3)
    const dims = Array.isArray(assessment.dimensions) ? assessment.dimensions.slice(0, 3) : [];
    const barsEl = document.getElementById("pdDimensionBars");
    if (barsEl) {
      barsEl.innerHTML = dims.length
        ? dims.map(d => `
          <div class="pd-dim-item">
            <div class="pd-dim-label">
              <span>${TalentThread.escapeHtml(d.name || d.label || 'Dimension')}</span>
              <span class="pd-dim-score">${d.score || 0}/10</span>
            </div>
            <div class="pd-dim-track"><div class="pd-dim-fill" style="width:${(d.score || 0) * 10}%"></div></div>
          </div>`).join("")
        : `<p style="font-size:0.875rem;color:var(--ink-muted);">Run your first review to see dimension scores.</p>`;
    }
  }

  // ── Growth Lab ──
  const xpFill  = document.getElementById("pdXpFill");
  const xpLevel = document.getElementById("pdXpLevel");
  const xpNum   = document.getElementById("pdXpNum");
  const xpNextLevel = 100; // XP per level (simplified)
  const xpCurrent   = progress.xp || 0;
  const xpPct = Math.min((xpCurrent % xpNextLevel) / xpNextLevel * 100, 100);
  if (xpFill)  xpFill.style.width  = `${xpPct}%`;
  if (xpLevel) xpLevel.textContent = `Level ${progress.level || 1}`;
  if (xpNum)   xpNum.textContent   = `${xpCurrent} XP`;

  const challengesEl = document.getElementById("pdChallenges");
  if (challengesEl) {
    const active = challenges.filter(c => c.status !== "completed").slice(0, 3);
    challengesEl.innerHTML = active.length
      ? active.map(c => `
          <div class="pd-challenge-card">
            <div class="pd-challenge-dot ${c.status === 'done' ? 'done' : c.status === 'locked' ? 'locked' : ''}"></div>
            <span class="pd-challenge-title">${TalentThread.escapeHtml(c.title || 'Challenge')}</span>
            <span class="pd-challenge-xp">+${c.xp || 0} XP</span>
          </div>`).join("")
      : `<div class="pd-challenge-empty">No active challenges. <a href="/skill-lab.html">Visit Skill Lab →</a></div>`;
  }

  const badgesEl = document.getElementById("pdBadgesRow");
  if (badgesEl) {
    const badges = progress.badges || [];
    badgesEl.innerHTML = badges.length
      ? badges.map(b => `<div class="pd-badge-item">🏆 ${TalentThread.escapeHtml(b.name || b)}</div>`).join("")
      : `<div style="font-size:0.8rem;color:var(--ink-muted);">Complete challenges to earn badges.</div>`;
  }

  // ── Applications ──
  if (profileElements.designerApplications) {
    profileElements.designerApplications.innerHTML = (state.applications || []).length
      ? state.applications.slice(0, 3).map(a => TalentThread.applicationCard(a)).join("")
      : `<div class="pd-empty-inline">No applications yet. Browse gigs to apply.</div>`;
  }

  // ── Saved projects ──
  if (profileElements.designerSavedProjects) {
    profileElements.designerSavedProjects.innerHTML = savedProjects.length
      ? savedProjects.slice(0, 3).map(p => TalentThread.projectCard(p, { showSave: true })).join("")
      : `<div class="pd-empty-inline">Bookmark projects from Marketplace to see them here.</div>`;
  }

  if (profileElements.designerContracts) {
    profileElements.designerContracts.innerHTML = renderContractList(
      state.contracts || [],
      "Contracts you win in the marketplace will appear here."
    );
  }

  if (profileElements.designerNotifications) {
    profileElements.designerNotifications.innerHTML = renderNotificationList(
      state.notifications || [],
      "Activity alerts and payment updates will show up here."
    );
  }

  // ── History ──
  if (profileElements.designerHistory) {
    const history = [...(state.history || [])].reverse();
    profileElements.designerHistory.innerHTML = history.length
      ? history.map(h => `
          <div class="pd-history-entry">
            <div class="pd-history-date">${h.date ? new Date(h.date).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : '—'}</div>
            <div class="pd-history-score">${h.overallScore || 0}</div>
            <div class="pd-history-band">${TalentThread.escapeHtml(h.band || '—')}</div>
          </div>`).join("")
      : `<div class="pd-empty-inline">Run your first review to start tracking progress.</div>`;
  }

  // cache for any event handlers
  window._designerState = state;
}


// ── Client Profile tab ─────────────────────────────────────
function renderClientState(state) {
  const applicantCount = (state.projects || []).reduce((sum, p) => sum + (p.applicants || []).length, 0);

  TalentThread.hide(profileElements.authGate);
  TalentThread.hide(profileElements.designerProfile);
  TalentThread.show(profileElements.clientProfile);

  profileElements.clientProjectCount.textContent  = (state.projects || []).length;
  profileElements.clientApplicantCount.textContent = applicantCount;
  profileElements.clientName.textContent           = state.user?.name || "Client profile";
  profileElements.clientEmail.textContent          = state.user?.email || "";
  profileElements.clientProjectBoard.innerHTML     = renderClientProjectBoard(state.projects || []);
  if (profileElements.clientContractBoard) {
    profileElements.clientContractBoard.innerHTML = renderContractList(
      state.contracts || [],
      "Contracts created from hired applications will appear here."
    );
  }
  if (profileElements.clientNotifications) {
    profileElements.clientNotifications.innerHTML = renderNotificationList(
      state.notifications || [],
      "Hiring activity and payment updates will show up here."
    );
  }
}

// ── Review Tab (embedded) ──────────────────────────────────
function renderReviewEmpty() {
  const empty   = document.getElementById("reviewEmptyState");
  const content = document.getElementById("reviewContent");
  if (empty)   empty.classList.remove("hidden");
  if (content) content.classList.add("hidden");
}

function renderReviewData(state) {
  const empty   = document.getElementById("reviewEmptyState");
  const content = document.getElementById("reviewContent");

  if (!state?.assessment || !state?.progress || !state?.profile) {
    renderReviewEmpty();
    return;
  }

  if (empty)   empty.classList.add("hidden");
  if (content) content.classList.remove("hidden");

  const dimensions = Array.isArray(state.assessment.dimensions)   ? state.assessment.dimensions   : [];
  const signals    = Array.isArray(state.assessment.scoreSignals) ? state.assessment.scoreSignals : [];
  const strengths  = Array.isArray(state.assessment.strengths)    ? state.assessment.strengths    : [];
  const weaknesses = Array.isArray(state.assessment.weaknesses)   ? state.assessment.weaknesses   : [];
  const agents     = Array.isArray(state.assessment.agents)       ? state.assessment.agents       : [];
  const history    = Array.isArray(state.history)                 ? [...state.history].reverse()  : [];

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  set("overallScore",    state.assessment.overallScore);
  set("overallBand",     state.assessment.band);
  set("confidenceValue", `${state.assessment.confidence || 0}%`);
  set("confidenceNote",  state.assessment.evidence?.status === "captured" ? "live portfolio evidence" : "limited external evidence");
  set("levelValue",      state.progress.level);
  set("xpValue",         `${state.progress.xp} XP`);
  set("summaryTitle",    `${state.profile.name}'s assessment summary`);
  set("summaryText",     state.assessment.summary);
  set("coachNote",       state.assessment.coachNote);

  setHtml("visualReport",   TalentThread.overallGraphicCard(state.assessment));
  setHtml("agentGrid",      agents.length     ? agents.map(TalentThread.agentPanelCard).join("")                 : TalentThread.emptyCard("No agent findings yet", "The specialist breakdown appears after a successful AI review."));
  setHtml("dimensionsGrid", dimensions.length ? dimensions.map(TalentThread.dimensionCard).join("")              : TalentThread.emptyCard("No dimensions yet", "Generate or refresh the review to populate the score breakdown."));
  setHtml("rationaleList",  signals.length    ? signals.map(TalentThread.signalCard).join("")                    : TalentThread.emptyCard("No score drivers yet", "Run a review to generate score signals."));
  setHtml("trendSummary",   state.assessment.trend
    ? TalentThread.signalCard({ detail: state.assessment.trend.summary, title: state.assessment.trend.label, tone: state.assessment.trend.direction === "up" ? "positive" : state.assessment.trend.direction === "down" ? "warning" : "neutral" })
    : TalentThread.emptyCard("No trend yet", "Your first saved review becomes the benchmark for the next one."));
  setHtml("historyList",    history.length    ? history.map(TalentThread.historyCard).join("")                   : TalentThread.emptyCard("No review history yet", "Complete your first assessment to start tracking progress."));
  setHtml("strengthList",   strengths.length  ? strengths.map(TalentThread.insightCard).join("")                 : TalentThread.emptyCard("No strengths yet", "Strongest signals appear after a successful review."));
  setHtml("weaknessList",   weaknesses.length ? weaknesses.map(TalentThread.insightCard).join("")               : TalentThread.emptyCard("No focus gaps yet", "Next improvement areas appear after a successful review."));
}

async function loadReviewTab() {
  // Use cached state if already loaded
  if (window._designerState) {
    renderReviewData(window._designerState);
    return;
  }
  try {
    const state = await TalentThread.requestJson("/api/designer/state", { method: "GET" });
    renderReviewData(state);
  } catch (err) {
    renderReviewEmpty();
  }
}

async function loadDemoReport() {
  const btn = document.getElementById("reviewDemoButton");
  if (btn) { btn.disabled = true; btn.textContent = "Loading..."; }
  try {
    const state = await TalentThread.requestJson("/api/demo-review", { method: "GET" });
    renderReviewData(state);
    window._reviewLoaded = true;
  } catch (err) {
    console.error(err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Load Demo Report"; }
  }
}

document.getElementById("reviewDemoButton")?.addEventListener("click", loadDemoReport);

// ── Growth Lab Tab (embedded) ──────────────────────────────
function renderGrowthEmpty(message) {
  const empty   = document.getElementById("growthEmptyState");
  const content = document.getElementById("growthContent");
  if (empty)   empty.classList.remove("hidden");
  if (content) content.classList.add("hidden");
}

function renderGrowthData(state) {
  const empty   = document.getElementById("growthEmptyState");
  const content = document.getElementById("growthContent");

  if (!state?.assessment || !state?.progress || !state?.profile) {
    renderGrowthEmpty();
    return;
  }

  if (empty)   empty.classList.add("hidden");
  if (content) content.classList.remove("hidden");

  const set    = (id, val)  => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML  = html; };

  set("growthOverallScore",   state.assessment.overallScore);
  set("growthOverallBand",    state.assessment.band);
  set("growthLevelValue",     state.progress.level);
  set("growthXpValue",        `${state.progress.xp} XP`);
  set("growthCompletedCount", state.progress.completedCount);
  set("growthSummaryTitle",   `${state.profile.name}'s progression path`);
  set("growthSummaryText",    state.assessment.summary);
  set("growthCoachNote",      state.progress.marketplaceUnlocked
    ? "Marketplace access is unlocked! Keep shipping proof so your applications stay competitive."
    : state.assessment.coachNote);

  setHtml("challengeBoard", state.challenges?.length
    ? state.challenges.map(TalentThread.challengeCard).join("")
    : TalentThread.emptyCard("No missions yet", "Run a review to generate your challenge track."));
  setHtml("badgeBoard",     state.progress.badges?.length
    ? state.progress.badges.map(TalentThread.badgeCard).join("")
    : TalentThread.emptyCard("No badges yet", "Badges appear as you complete challenges."));
  setHtml("roadmapList",    state.assessment.roadmap?.length
    ? state.assessment.roadmap.map(TalentThread.roadmapCard).join("")
    : TalentThread.emptyCard("No roadmap yet", "Your roadmap is generated from your review results."));

  // Store for challenge completion events
  window._growthState = state;
}

async function loadGrowthTab() {
  if (window._designerState) {
    renderGrowthData(window._designerState);
    return;
  }
  try {
    const state = await TalentThread.requestJson("/api/designer/state", { method: "GET" });
    renderGrowthData(state);
  } catch (err) {
    renderGrowthEmpty(err.message);
  }
}

// Challenge complete handler (delegated on the growth tab pane)
document.getElementById("pane-growth")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-complete-id]");
  if (!button) return;

  button.disabled     = true;
  button.textContent  = "Updating...";

  try {
    const challengeId = button.getAttribute("data-complete-id");
    const state = await TalentThread.requestJson(`/api/challenges/${challengeId}/complete`, { method: "POST" });
    renderGrowthData(state);
    window._designerState = state; // update cache
  } catch (err) {
    button.textContent = "Error";
    setTimeout(() => { button.disabled = false; button.textContent = "Mark Complete"; }, 1500);
  }
});

// ── Main profile load ──────────────────────────────────────
async function loadProfileState() {
  try {
    const saveMessage = window.sessionStorage.getItem("profileSaveSuccess");
    if (saveMessage) {
      window.sessionStorage.removeItem("profileSaveSuccess");
      showSaveToast(saveMessage);
    }

    const session = await TalentThread.requestJson("/api/me", { method: "GET" });
    if (!session.authenticated || !session.user) {
      renderUnauthorized();
      return;
    }

    if (session.user.role === "designer") {
      window.location.href = "/dashboard";
      return;
    }

    if (session.user.role === "admin") {
      window.location.href = "/admin";
      return;
    }

    const state = await TalentThread.requestJson("/api/marketplace/state", { method: "GET" });
    renderClientState(state);
  } catch (error) {
    if (error.statusCode === 401) {
      import("./src/firebase.js").then(({ auth }) => {
        import("https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js").then(({ onAuthStateChanged }) => {
          onAuthStateChanged(auth, (user) => {
            if (user) {
              window.location.href = "/dashboard";
            } else {
              renderUnauthorized();
            }
          });
        });
      });
      return;
    }
    console.error(error.message);
    import("./src/firebase.js").then(({ auth }) => {
      import("https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js").then(({ onAuthStateChanged }) => {
        onAuthStateChanged(auth, (user) => {
          if (user) {
            window.location.href = "/dashboard";
          } else {
            renderUnauthorized();
          }
        });
      });
    });
  }
}


// ── Saved projects click handler ───────────────────────────
profileElements.designerSavedProjects?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-project]");
  if (!button) return;

  button.disabled = true;
  try {
    const projectId = button.getAttribute("data-save-project");
    const state = await TalentThread.requestJson(`/api/projects/${projectId}/save`, { method: "POST" });
    window._designerState = state;
    renderDesignerState(state);
    profileElements.statusMessage.textContent = "Saved projects updated.";
  } catch (error) {
    if (profileElements.statusMessage) profileElements.statusMessage.textContent = error.message;
  }
});

loadProfileState();


