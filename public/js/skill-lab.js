/**
 * Talent Thread — Skill Lab JS (skill-lab.js)
 * Renamed from growth.js. Adds task/design submission feature.
 */

const slEl = {
  authGate:       document.querySelector('#authGate'),
  badgeBoard:     document.querySelector('#badgeBoard'),
  challengeBoard: document.querySelector('#challengeBoard'),
  coachNote:      document.querySelector('#coachNote'),
  completedCount: document.querySelector('#completedCount'),
  emptyState:     document.querySelector('#emptyState'),
  growthContent:  document.querySelector('#growthContent'),
  levelValue:     document.querySelector('#levelValue'),
  overallBand:    document.querySelector('#overallBand'),
  overallScore:   document.querySelector('#overallScore'),
  roadmapList:    document.querySelector('#roadmapList'),
  statusMessage:  document.querySelector('#statusMessage'),
  summaryText:    document.querySelector('#summaryText'),
  summaryTitle:   document.querySelector('#summaryTitle'),
  xpValue:        document.querySelector('#xpValue'),
  // Progress band
  slLevelCircle:  document.querySelector('#slLevelCircle'),
  slLevelLabel:   document.querySelector('#slLevelLabel'),
  slBandLabel:    document.querySelector('#slBandLabel'),
  slXpFill:       document.querySelector('#slXpFill'),
  slXpLabel:      document.querySelector('#slXpLabel'),
  slCompletedPill:document.querySelector('#slCompletedPill'),
  slActivePill:   document.querySelector('#slActivePill'),
  slScorePill:    document.querySelector('#slScorePill'),
  // Submit form
  slSubmitForm:      document.querySelector('#slSubmitForm'),
  slSubmitChallenge: document.querySelector('#slSubmitChallenge'),
  slSubmitLink:      document.querySelector('#slSubmitLink'),
  slSubmitNotes:     document.querySelector('#slSubmitNotes'),
  slSubmitBtn:       document.querySelector('#slSubmitBtn'),
  slSubmitError:     document.querySelector('#slSubmitError'),
  slSubmitSuccess:   document.querySelector('#slSubmitSuccess'),
};

let currentState = null; // cache for re-render after submit

/* ── Tab switching ─────────────────────────── */
document.querySelectorAll('[data-sl-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-sl-tab]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sl-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    const target = btn.dataset.slTab;
    const panel = document.getElementById(
      target === 'challenges' ? 'slPanelChallenges' :
      target === 'submit'     ? 'slPanelSubmit' :
      'slPanelHistory'
    );
    if (panel) panel.classList.remove('hidden');
  });
});

/* ── Mobile nav toggle ─────────────────────── */
const mobileBtn = document.getElementById('mobileMenuBtn');
const mainNav   = document.getElementById('mainNav');
if (mobileBtn && mainNav) {
  mobileBtn.addEventListener('click', () => mainNav.classList.toggle('mobile-open'));
}

/* ── Header scroll shadow ──────────────────── */
const siteHeader = document.getElementById('siteHeader');
window.addEventListener('scroll', () => {
  if (siteHeader) siteHeader.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

/* ── Render functions ──────────────────────── */
function renderUnauthorized(error) {
  TalentThread.hide(slEl.emptyState);
  TalentThread.hide(slEl.growthContent);
  TalentThread.show(slEl.authGate);
}

function renderEmpty(message) {
  TalentThread.hide(slEl.growthContent);
  TalentThread.show(slEl.emptyState);
  if (slEl.statusMessage) slEl.statusMessage.textContent = message || 'Run a portfolio review first so the Skill Lab can generate missions.';
}

function buildChallengeCard(challenge) {
  const isActive    = challenge.status === 'active';
  const isCompleted = challenge.status === 'completed';
  const isLocked    = challenge.status === 'locked';
  const diffLabel = challenge.difficulty || (challenge.rewardXp < 100 ? 'Beginner' : 'Intermediate');
  const diffClass = diffLabel === 'Beginner' ? 'beginner' : 'intermediate';
  const e = TalentThread.escapeHtml;

  return `
    <article class="sl-challenge-card ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}">
      <div class="sl-challenge-top">
        <div>
          <p class="sl-challenge-stage">${e(challenge.stage || 'Challenge')}</p>
          <h3 class="sl-challenge-title">${e(challenge.title)}</h3>
        </div>
        <span class="sl-challenge-status-pill ${e(challenge.status)}">${e(challenge.status)}</span>
      </div>
      <p class="sl-challenge-brief">${e(challenge.brief)}</p>
      <div class="sl-challenge-deliverable">
        <strong>Deliverable:</strong> ${e(challenge.deliverable)}
      </div>
      <div class="sl-challenge-meta">
        <span class="sl-challenge-type ${diffClass}">${e(diffLabel)}</span>
        <span class="sl-challenge-diff">${e(challenge.type)}</span>
        <span class="sl-challenge-time">⏱ ${e(challenge.estimatedTime)}</span>
        <span class="sl-xp-reward">+${e(String(challenge.rewardXp))} XP</span>
      </div>
      <div class="sl-challenge-footer">
        ${isCompleted ? '<span style="font-size:0.8125rem;color:var(--success);font-weight:700;">✓ Completed</span>' : ''}
        ${isLocked    ? '<span style="font-size:0.8125rem;color:var(--ink-muted);">🔒 Locked</span>' : ''}
        ${isActive ? `
          <button class="sl-submit-btn" style="width:auto;padding:0.45rem 1rem;font-size:0.8125rem;" data-complete-id="${e(challenge.id)}" type="button">Mark Complete</button>
          <button onclick="switchToSubmit('${e(challenge.id)}')" type="button" style="font-size:0.8125rem;font-weight:600;color:var(--cta);background:var(--cta-soft);border:1px solid rgba(var(--cta-rgb),0.2);border-radius:0.375rem;padding:0.45rem 1rem;cursor:pointer;">Submit Work →</button>
        ` : ''}
      </div>
    </article>
  `;
}

function buildBadgeCard(badge) {
  const e = TalentThread.escapeHtml;
  return `
    <div class="sl-badge-item">
      <div class="sl-badge-icon">🏅</div>
      <div class="sl-badge-name">${e(badge.name)}</div>
      <div class="sl-badge-desc">${e(badge.detail || '')}</div>
    </div>
  `;
}

function buildRoadmapItem(item) {
  const e = TalentThread.escapeHtml;
  return `
    <div class="sl-roadmap-item">
      <div class="sl-roadmap-dot"></div>
      <div>
        <p class="sl-roadmap-phase">${e(item.phase)}</p>
        <p class="sl-roadmap-title">${e(item.title)}</p>
        <p class="sl-roadmap-detail">${e(item.detail || '')}</p>
      </div>
    </div>
  `;
}

function updateProgressBand(state) {
  const progress   = state.progress || {};
  const assessment = state.assessment || {};
  const level      = progress.level || 1;
  const xp         = progress.xp || 0;
  const xpNext     = level * 200;
  const pct        = Math.min(100, Math.round((xp / xpNext) * 100));
  const completed  = progress.completedCount || 0;
  const active     = (state.challenges || []).filter(c => c.status === 'active').length;

  if (slEl.slLevelCircle)   slEl.slLevelCircle.textContent = level;
  if (slEl.slLevelLabel)    slEl.slLevelLabel.textContent  = `Level ${level}`;
  if (slEl.slBandLabel)     slEl.slBandLabel.textContent   = assessment.band || 'Foundation';
  if (slEl.slXpFill)        slEl.slXpFill.style.width      = `${pct}%`;
  if (slEl.slXpLabel)       slEl.slXpLabel.textContent     = `${xp} / ${xpNext} XP`;
  if (slEl.slCompletedPill) slEl.slCompletedPill.textContent = `${completed} Done`;
  if (slEl.slActivePill)    slEl.slActivePill.textContent   = `${active} Active`;
  if (slEl.slScorePill)     slEl.slScorePill.textContent    = `Score: ${assessment.overallScore || '—'}`;
}

function populateSubmitSelect(challenges) {
  if (!slEl.slSubmitChallenge) return;
  const active = challenges.filter(c => c.status === 'active');
  slEl.slSubmitChallenge.innerHTML = '<option value="">Choose an active challenge…</option>' +
    active.map(c => `<option value="${TalentThread.escapeHtml(c.id)}">${TalentThread.escapeHtml(c.title)}</option>`).join('');
}

function renderSkillLabState(state) {
  currentState = state;
  TalentThread.hide(slEl.authGate);

  if (!state?.assessment || !state?.progress || !state?.profile) {
    renderEmpty('No review found yet. Visit AI Analysis to create your challenge track first.');
    return;
  }

  TalentThread.hide(slEl.emptyState);
  TalentThread.show(slEl.growthContent);

  // Sidebar metrics
  if (slEl.overallScore) slEl.overallScore.textContent = state.assessment.overallScore;
  if (slEl.overallBand)  slEl.overallBand.textContent  = state.assessment.band;
  if (slEl.levelValue)   slEl.levelValue.textContent   = state.progress.level;
  if (slEl.xpValue)      slEl.xpValue.textContent      = `${state.progress.xp} XP`;
  if (slEl.completedCount) slEl.completedCount.textContent = state.progress.completedCount;

  // Summary card
  if (slEl.summaryTitle) slEl.summaryTitle.textContent = `${state.profile.name}'s progression`;
  if (slEl.summaryText)  slEl.summaryText.textContent  = state.assessment.summary;
  if (slEl.coachNote)    slEl.coachNote.textContent    = state.progress.marketplaceUnlocked
    ? '🏆 Marketplace access is unlocked! Keep building proof so your applications stay competitive.'
    : state.assessment.coachNote;

  // Progress band
  updateProgressBand(state);

  // Challenge board
  if (slEl.challengeBoard) {
    slEl.challengeBoard.innerHTML = state.challenges.length
      ? state.challenges.map(buildChallengeCard).join('')
      : '<div class="sl-empty-state" style="border-style:dashed;"><p>No challenges yet. Your AI analysis will generate these.</p></div>';
  }

  // Badge board
  if (slEl.badgeBoard) {
    slEl.badgeBoard.innerHTML = state.progress.badges?.length
      ? `<div class="sl-badge-grid">${state.progress.badges.map(buildBadgeCard).join('')}</div>`
      : '<p style="color:var(--ink-muted);font-size:0.875rem;">No badges yet — complete challenges to earn them.</p>';
  }

  // Roadmap
  if (slEl.roadmapList) {
    slEl.roadmapList.innerHTML = (state.assessment.roadmap || []).map(buildRoadmapItem).join('') ||
      '<p style="color:var(--ink-muted);font-size:0.875rem;">Roadmap will appear after your first review.</p>';
  }

  // Submit challenge select
  populateSubmitSelect(state.challenges || []);

  // Marketplace unlock status
  const mpMsg = document.getElementById('slMarketplaceMsg');
  const mpBtn = document.getElementById('slMarketplaceBtn');
  if (mpMsg) mpMsg.textContent = state.progress.marketplaceUnlocked
    ? '✅ You\'ve unlocked Marketplace access. Start applying to real gigs!'
    : `Complete ${Math.max(0, 3 - (state.progress.completedCount || 0))} more challenge(s) to unlock Marketplace access.`;
}

/* ── Switch to submit tab with pre-selected challenge ── */
window.switchToSubmit = function(challengeId) {
  document.querySelectorAll('[data-sl-tab]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sl-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('tabSubmit')?.classList.add('active');
  document.getElementById('slPanelSubmit')?.classList.remove('hidden');
  if (slEl.slSubmitChallenge) slEl.slSubmitChallenge.value = challengeId;
};

/* ── Mark complete via challengeBoard click ────────── */
slEl.challengeBoard?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-complete-id]');
  if (!button) return;

  button.disabled = true;
  button.textContent = 'Saving…';

  try {
    const challengeId = button.getAttribute('data-complete-id');
    const state = await TalentThread.requestJson(`/api/challenges/${challengeId}/complete`, { method: 'POST' });
    renderSkillLabState(state);
  } catch (error) {
    if (error.statusCode === 401 || error.statusCode === 403) { renderUnauthorized(error); return; }
    button.disabled = false;
    button.textContent = 'Mark Complete';
  }
});

/* ── Submit Work form ──────────────────────── */
slEl.slSubmitForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (slEl.slSubmitError)   slEl.slSubmitError.classList.add('hidden');
  if (slEl.slSubmitSuccess) slEl.slSubmitSuccess.classList.add('hidden');

  const challengeId = slEl.slSubmitChallenge?.value;
  const link        = slEl.slSubmitLink?.value?.trim();
  const notes       = slEl.slSubmitNotes?.value?.trim();

  // Validate
  if (!challengeId) {
    if (slEl.slSubmitError) { slEl.slSubmitError.textContent = 'Please select a challenge.'; slEl.slSubmitError.classList.remove('hidden'); }
    return;
  }
  if (!link) {
    if (slEl.slSubmitError) { slEl.slSubmitError.textContent = 'Please enter a work link.'; slEl.slSubmitError.classList.remove('hidden'); }
    return;
  }
  try { new URL(link); } catch {
    if (slEl.slSubmitError) { slEl.slSubmitError.textContent = 'Please enter a valid URL (e.g. https://figma.com/…)'; slEl.slSubmitError.classList.remove('hidden'); }
    return;
  }

  if (slEl.slSubmitBtn) { slEl.slSubmitBtn.disabled = true; slEl.slSubmitBtn.textContent = 'Submitting…'; }

  try {
    // Call the complete endpoint (same as mark complete, with submission metadata)
    const state = await TalentThread.requestJson(`/api/challenges/${challengeId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ submissionLink: link, notes })
    });
    renderSkillLabState(state);
    if (slEl.slSubmitSuccess) slEl.slSubmitSuccess.classList.remove('hidden');
    // Reset form
    slEl.slSubmitLink.value  = '';
    slEl.slSubmitNotes.value = '';
    slEl.slSubmitChallenge.value = '';
  } catch (error) {
    if (error.statusCode === 401 || error.statusCode === 403) { renderUnauthorized(error); }
    else if (slEl.slSubmitError) {
      slEl.slSubmitError.textContent = error.message || 'Submission failed. Please try again.';
      slEl.slSubmitError.classList.remove('hidden');
    }
  } finally {
    if (slEl.slSubmitBtn) { slEl.slSubmitBtn.disabled = false; slEl.slSubmitBtn.textContent = 'Submit Work & Earn XP →'; }
  }
});

/* ── Load state ────────────────────────────── */
async function loadSkillLabState() {
  try {
    const state = await TalentThread.requestJson('/api/designer/state', { method: 'GET' });
    renderSkillLabState(state);
  } catch (error) {
    if (error.statusCode === 401 || error.statusCode === 403) { renderUnauthorized(error); return; }
    renderEmpty(error.message);
  }
}

loadSkillLabState();


