const growthElements = {
  authGate: document.querySelector("#authGate"),
  badgeBoard: document.querySelector("#badgeBoard"),
  challengeBoard: document.querySelector("#challengeBoard"),
  coachNote: document.querySelector("#coachNote"),
  completedCount: document.querySelector("#completedCount"),
  emptyState: document.querySelector("#emptyState"),
  growthContent: document.querySelector("#growthContent"),
  levelValue: document.querySelector("#levelValue"),
  overallBand: document.querySelector("#overallBand"),
  overallScore: document.querySelector("#overallScore"),
  roadmapList: document.querySelector("#roadmapList"),
  statusMessage: document.querySelector("#statusMessage"),
  summaryText: document.querySelector("#summaryText"),
  summaryTitle: document.querySelector("#summaryTitle"),
  xpValue: document.querySelector("#xpValue")
};

function renderUnauthorized(error) {
  TalentThread.hide(growthElements.emptyState);
  TalentThread.hide(growthElements.growthContent);
  growthElements.statusMessage.textContent = error.statusCode === 403
    ? "This page is only available to designer accounts."
    : "Log in with a designer account to open the Growth Lab.";
  TalentThread.renderAuthGate(
    growthElements.authGate,
    error.statusCode === 403 ? "Designer access only" : "Designer login required",
    error.statusCode === 403
      ? "Switch to a designer account to access missions, XP, and badges."
      : "Create or log in to a designer account before using the Growth Lab.",
    "/"
  );
}

function renderGrowthEmpty(message) {
  TalentThread.hide(growthElements.growthContent);
  TalentThread.show(growthElements.emptyState);
  growthElements.statusMessage.textContent = message || "Run a portfolio review first so the Growth Lab can generate missions.";
}

function renderGrowthState(state) {
  TalentThread.hide(growthElements.authGate);

  if (!state?.assessment || !state?.progress || !state?.profile) {
    renderGrowthEmpty("No review found yet. Visit Review to create the challenge track first.");
    return;
  }

  TalentThread.hide(growthElements.emptyState);
  TalentThread.show(growthElements.growthContent);
  growthElements.statusMessage.textContent = `${state.profile.name} has ${state.challenges.filter((item) => item.status === "active").length} active mission(s) right now.`;
  growthElements.overallScore.textContent = state.assessment.overallScore;
  growthElements.overallBand.textContent = state.assessment.band;
  growthElements.levelValue.textContent = state.progress.level;
  growthElements.xpValue.textContent = `${state.progress.xp} XP`;
  growthElements.completedCount.textContent = state.progress.completedCount;
  growthElements.summaryTitle.textContent = `${state.profile.name}'s progression path`;
  growthElements.summaryText.textContent = state.assessment.summary;
  growthElements.coachNote.textContent = state.progress.marketplaceUnlocked
    ? "Marketplace access is unlocked. Keep shipping proof so your applications stay competitive."
    : state.assessment.coachNote;
  growthElements.challengeBoard.innerHTML = state.challenges.length
    ? state.challenges.map(TalentThread.challengeCard).join("")
    : TalentThread.emptyCard("No missions yet", "Run a review to generate your challenge track.");
  growthElements.badgeBoard.innerHTML = state.progress.badges.length
    ? state.progress.badges.map(TalentThread.badgeCard).join("")
    : TalentThread.emptyCard("No badges yet", "Badges appear as you complete challenges.");
  growthElements.roadmapList.innerHTML = state.assessment.roadmap.map(TalentThread.roadmapCard).join("");
}

async function loadGrowthState() {
  try {
    const state = await TalentThread.requestJson("/api/designer/state", { method: "GET" });
    renderGrowthState(state);
  } catch (error) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      renderUnauthorized(error);
      return;
    }

    renderGrowthEmpty(error.message);
  }
}

growthElements.challengeBoard.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-complete-id]");
  if (!button) {
    return;
  }

  button.disabled = true;
  button.textContent = "Updating...";

  try {
    const challengeId = button.getAttribute("data-complete-id");
    const state = await TalentThread.requestJson(`/api/challenges/${challengeId}/complete`, {
      method: "POST"
    });
    renderGrowthState(state);
    growthElements.statusMessage.textContent = "Challenge progress saved.";
  } catch (error) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      renderUnauthorized(error);
      return;
    }

    growthElements.statusMessage.textContent = error.message;
  }
});

loadGrowthState();


