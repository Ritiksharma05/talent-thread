/* ================================================================
   Talent Thread — Global Utility Namespace
   Defines window.TalentThread with shared helpers used by
   review.js and other platform page scripts.
   ================================================================ */

(function () {
  "use strict";

  // ── HTML escaping ──────────────────────────────────────────────
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ── DOM show / hide helpers ────────────────────────────────────
  function show(el) {
    if (!el) return;
    el.classList.remove("hidden");
  }

  function hide(el) {
    if (!el) return;
    el.classList.add("hidden");
  }

  // ── Fetch wrapper (returns parsed JSON, throws on error) ───────
  async function requestJson(url, options = {}) {
    const defaults = {
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    };
    const res = await fetch(url, { ...defaults, ...options });

    let data;
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }

    if (!res.ok) {
      const err = new Error(
        (data && data.error) || `HTTP ${res.status}`
      );
      err.statusCode = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // ── Auth Gate renderer ─────────────────────────────────────────
  function renderAuthGate(el, title, message, redirectHref) {
    if (!el) return;
    el.innerHTML = `
      <div class="empty-state-icon" aria-hidden="true">🔒</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="hero-actions" style="justify-content:center;margin-top:1rem;">
        <a class="button primary" href="${escapeHtml(redirectHref || "/")}">Go Back</a>
      </div>`;
    show(el);
  }

  // ── Expose on window ───────────────────────────────────────────
  window.TalentThread = {
    escapeHtml,
    hide,
    renderAuthGate,
    requestJson,
    show,
  };
})();
