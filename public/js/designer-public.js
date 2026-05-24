const publicProfileRoot = document.querySelector("#designerPublicProfile");

function usernameFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[1] || "";
}

function renderPublicProfile(designer) {
  publicProfileRoot.innerHTML = `
    <div class="challenge-meta">
      <div>
        <p class="metric-label">${TalentThread.escapeHtml(designer.city || "India")}</p>
        <h1 style="margin:0;">${TalentThread.escapeHtml(designer.fullName)}</h1>
        <p>${TalentThread.escapeHtml(designer.headline || "")}</p>
      </div>
      <span class="score-pill">${TalentThread.escapeHtml(designer.score || 0)}/100</span>
    </div>
    <p>${TalentThread.escapeHtml(designer.bio || "")}</p>
    <div class="chip-row" style="margin:1rem 0;">
      ${(designer.skills || []).map((item) => TalentThread.chip(item)).join("")}
      ${(designer.tools || []).map((item) => TalentThread.chip(item, "accent-chip")).join("")}
    </div>
    <div class="overview-grid" style="margin-top:1.5rem;">
      ${(designer.portfolioItems || []).length
        ? designer.portfolioItems.map((item) => `
            <article class="simple-card">
              <strong>${TalentThread.escapeHtml(item.title)}</strong>
              <p>${TalentThread.escapeHtml(item.description || "")}</p>
              <p class="metric-label">${TalentThread.escapeHtml(item.category || "Portfolio item")}</p>
            </article>
          `).join("")
        : TalentThread.emptyCard("Portfolio is being prepared", "No public portfolio items have been added yet.")}
    </div>
  `;
}

(async () => {
  try {
    const username = usernameFromPath();
    const data = await TalentThread.requestJson(`/api/designers/${username}`, { method: "GET" });
    renderPublicProfile(data.designer);
  } catch (error) {
    publicProfileRoot.innerHTML = TalentThread.emptyCard("Designer not found", error.message);
  }
})();
