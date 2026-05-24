let currentDesignerStep = 1;
let userRole = "designer";
const totalSteps = 4;

const els = {
  loading: document.getElementById("loadingState"),
  designerForm: document.getElementById("designerOnboarding"),
  clientForm: document.getElementById("clientOnboarding"),
  steps: [
    document.getElementById("designerStep1"),
    document.getElementById("designerStep2"),
    document.getElementById("designerStep3"),
    document.getElementById("designerStep4"),
  ],
  navs: [
    document.getElementById("dStep1"),
    document.getElementById("dStep2"),
    document.getElementById("dStep3"),
    document.getElementById("dStep4"),
  ]
};

async function initOnboarding() {
  try {
    const data = await TalentThread.requestJson("/api/me", { method: "GET" });
    if (!data.authenticated) {
      window.location.href = "/signup.html";
      return;
    }
    userRole = data.user.role;
    TalentThread.hide(els.loading);
    if (userRole === "designer") {
      TalentThread.show(els.designerForm);
      showStep(currentDesignerStep);
      els.designerForm.addEventListener("input", TalentThread.updateRangeOutputs);
      TalentThread.updateRangeOutputs();
    } else {
      TalentThread.show(els.clientForm);
    }
  } catch (error) {
    window.location.href = "/signup.html";
  }
}

function showStep(step) {
  els.steps.forEach((el, index) => {
    if (index + 1 === step) {
      TalentThread.show(el);
      els.navs[index].classList.add("active");
      els.navs[index].classList.remove("completed");
    } else {
      TalentThread.hide(el);
      els.navs[index].classList.remove("active");
      if (index + 1 < step) {
        els.navs[index].classList.add("completed");
      } else {
        els.navs[index].classList.remove("completed");
      }
    }
  });
}

// Per-step required field keys (validates only what's needed for that step)
const STEP_REQUIRED = {
  1: ["name"],        // name is required in step 1
  2: ["tools"],       // tools required in step 2
  3: [],              // portfolioLink optional (URL type, leave blank allowed)
  4: []
};

function validateCurrentStep() {
  const section = document.getElementById(`designerStep${currentDesignerStep}`);
  if (!section) return true;

  const requiredNames = STEP_REQUIRED[currentDesignerStep] || [];
  for (const name of requiredNames) {
    const field = section.querySelector(`[name="${name}"]`);
    if (!field) continue;
    if (!field.value || !field.value.trim()) {
      field.focus();
      // Show native-style popover if supported, otherwise alert
      if (field.reportValidity) {
        field.setCustomValidity("This field is required.");
        field.reportValidity();
        field.setCustomValidity(""); // reset so future submissions aren't blocked
      }
      return false;
    }
  }
  return true;
}

function nextDesignerStep() {
  if (!validateCurrentStep()) return;

  if (currentDesignerStep < totalSteps) {
    currentDesignerStep++;
    showStep(currentDesignerStep);
  } else {
    finishDesignerOnboarding();
  }
}

function prevDesignerStep() {
  if (currentDesignerStep > 1) {
    currentDesignerStep--;
    showStep(currentDesignerStep);
  }
}

async function finishDesignerOnboarding() {
  const btn = document.getElementById("generateReviewBtn");
  const payload = TalentThread.payloadFromForm(els.designerForm);
  // Get all checkboxes for goals
  payload.goals = Array.from(els.designerForm.querySelectorAll('input[name="goals"]:checked')).map(c => c.value);

  btn.disabled = true;
  btn.textContent = "Analyzing Portfolio...";

  try {
    await TalentThread.requestJson("/api/assessment", {
      body: JSON.stringify(payload),
      method: "POST"
    });
    window.location.href = "/review.html";
  } catch (error) {
    alert(error.message);
    btn.disabled = false;
    btn.textContent = "Analyze Your Portfolio";
  }
}

document.getElementById("clientOnboarding").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const payload = TalentThread.payloadFromForm(form);
  
  const needs = Array.from(form.querySelectorAll('input[name="clientNeeds"]:checked')).map(cb => cb.value);
  payload.clientNeeds = needs;

  if (needs.length === 0) {
    alert("Please select at least one design category.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Saving...";
  try {
    await TalentThread.requestJson("/api/client/onboarding", {
      body: JSON.stringify(payload),
      method: "POST"
    });
    window.location.href = "/marketplace.html";
  } catch (error) {
    alert(error.message);
    btn.disabled = false;
    btn.textContent = "Post Your First Job";
  }
});

document.addEventListener("DOMContentLoaded", initOnboarding);


