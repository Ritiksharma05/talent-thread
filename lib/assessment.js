const DISCIPLINE_LABELS = {
  brand: "Brand Design",
  graphic: "Graphic Design",
  motion: "Motion Design",
  product: "Product Design",
  uiux: "UI/UX Design"
};

const EXPERIENCE_LABELS = {
  early_career: "1-2 years experience",
  graduate: "Fresh graduate",
  self_taught: "Self-taught beginner",
  student: "Design student"
};

const GOAL_LABELS = {
  confidence: "Build confidence",
  freelance: "Become freelance-ready",
  interviews: "Become interview-ready",
  portfolio: "Sharpen portfolio"
};

const PREFERENCE_META = {
  client_simulation: {
    lead: "Treat this brief like a paying client asked for fast, polished thinking.",
    label: "Client Simulation",
    time: "5-7 hours"
  },
  level_mission: {
    lead: "Complete this mission to unlock the next level in your learning track.",
    label: "Level Mission",
    time: "3-4 hours"
  },
  timed_sprint: {
    lead: "Time-box this challenge and ship a sharp draft instead of waiting for perfect.",
    label: "Timed Sprint",
    time: "90 minutes"
  },
  weekly_project: {
    lead: "Use this as your structured weekly project and document your process clearly.",
    label: "Weekly Project",
    time: "4-6 hours"
  }
};

const DIMENSION_META = {
  communication: {
    impact: "Explain design choices clearly to clients, hiring teams, and collaborators.",
    label: "Communication"
  },
  freelanceReadiness: {
    impact: "Package work with scope, pricing, revision logic, and client confidence.",
    label: "Freelance Readiness"
  },
  portfolioStorytelling: {
    impact: "Turn raw project work into case studies that show process and outcomes.",
    label: "Portfolio Storytelling"
  },
  problemSolving: {
    impact: "Show how you define problems, weigh trade-offs, and make strong decisions.",
    label: "Problem Solving"
  },
  toolFluency: {
    impact: "Use your core tools quickly enough to turn ideas into polished execution.",
    label: "Tool Fluency"
  },
  visualDesign: {
    impact: "Improve hierarchy, craft, consistency, and visual clarity in your output.",
    label: "Visual Craft"
  }
};

const DIMENSION_ORDER = [
  "visualDesign",
  "problemSolving",
  "portfolioStorytelling",
  "toolFluency",
  "communication",
  "freelanceReadiness"
];

const DISCIPLINE_CONTEXT = {
  brand: {
    artifact: "brand system",
    capstone: "Launch a mini brand identity and publish it as a polished case study.",
    scenario: "a cafe rebrand for Gen Z customers",
    deliverable: "moodboard, logo directions, palette, typography, and brand mockups"
  },
  graphic: {
    artifact: "campaign kit",
    capstone: "Design a launch-ready campaign pack and present it as portfolio-ready work.",
    scenario: "an eco-friendly beverage launch",
    deliverable: "one poster, three social creatives, and a design rationale"
  },
  motion: {
    artifact: "motion storyboard",
    capstone: "Create a short motion piece and package it like a studio-ready presentation.",
    scenario: "a 15-second teaser for a productivity app",
    deliverable: "storyboard, styleframes, timing notes, and a motion rationale"
  },
  product: {
    artifact: "feature concept",
    capstone: "Ship a product concept case study with user logic and business thinking.",
    scenario: "a B2B workflow dashboard",
    deliverable: "user flow, key screens, interaction notes, and outcome metrics"
  },
  uiux: {
    artifact: "mobile flow",
    capstone: "Publish a polished end-to-end case study for a product problem worth hiring on.",
    scenario: "a fintech onboarding flow",
    deliverable: "user flow, wireframes, final screens, and a case study summary"
  }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function average(values) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (!safeValues.length) {
    return 0;
  }
  return safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
}

function safeText(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function safeNumber(value, min = 0, max = 100, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clamp(parsed, min, max);
}

function parseGoals(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .map((item) => safeText(item))
      .filter((item) => Object.prototype.hasOwnProperty.call(GOAL_LABELS, item))
  )];
}

function parseTools(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => safeText(item)).filter(Boolean))];
  }

  return [...new Set(
    String(value || "")
      .split(/,|\n/)
      .map((item) => safeText(item))
      .filter(Boolean)
  )];
}

function sanitizeIntake(payload = {}) {
  const discipline = Object.prototype.hasOwnProperty.call(DISCIPLINE_LABELS, payload.discipline)
    ? payload.discipline
    : "uiux";
  const experience = Object.prototype.hasOwnProperty.call(EXPERIENCE_LABELS, payload.experience)
    ? payload.experience
    : "graduate";
  const challengePreference = Object.prototype.hasOwnProperty.call(PREFERENCE_META, payload.challengePreference)
    ? payload.challengePreference
    : "weekly_project";

  return {
    challengePreference,
    communication: safeNumber(payload.communication, 1, 10, 5),
    discipline,
    experience,
    freelanceReadiness: safeNumber(payload.freelanceReadiness, 1, 10, 4),
    goals: parseGoals(payload.goals),
    name: safeText(payload.name, "Designer"),
    notes: safeText(payload.notes),
    portfolioLink: safeText(payload.portfolioLink),
    portfolioStorytelling: safeNumber(payload.portfolioStorytelling, 1, 10, 5),
    problemSolving: safeNumber(payload.problemSolving, 1, 10, 5),
    projectCount: safeNumber(payload.projectCount, 0, 20, 2),
    toolFluency: safeNumber(payload.toolFluency, 1, 10, 5),
    tools: parseTools(payload.tools),
    visualCraft: safeNumber(payload.visualCraft, 1, 10, 5)
  };
}

function intakeForClient(intake) {
  return {
    ...intake,
    tools: intake.tools.join(", ")
  };
}

function profileDefaultsFromIntake(intake) {
  return {
    availability: "Open to freelance",
    about: `${intake.name} is building confidence through practical design work and active portfolio improvement.`,
    bio: `${intake.name} is an early-career ${DISCIPLINE_LABELS[intake.discipline].toLowerCase()} designer focused on ${intake.goals.length ? intake.goals.map((goal) => GOAL_LABELS[goal].toLowerCase()).join(", ") : "career growth"}.`,
    challengePreference: intake.challengePreference,
    city: "India",
    discipline: intake.discipline,
    experience: intake.experience,
    fullName: intake.name,
    goals: intake.goals,
    headline: `${DISCIPLINE_LABELS[intake.discipline]} designer building toward client-ready work`,
    name: intake.name,
    notes: intake.notes,
    portfolioLink: intake.portfolioLink,
    preferredRate: {
      brand: "INR 1,500/hr",
      graphic: "INR 1,200/hr",
      motion: "INR 1,800/hr",
      product: "INR 2,000/hr",
      uiux: "INR 1,800/hr"
    }[intake.discipline],
    profileImage: "",
    projectsInfo: `${intake.projectCount} project${intake.projectCount === 1 ? "" : "s"} completed`,
    projectCount: intake.projectCount,
    tools: intake.tools
  };
}

function buildDimensions(intake) {
  const experienceBoost = {
    early_career: 7,
    graduate: 4,
    self_taught: 3,
    student: 1
  }[intake.experience];

  const disciplineBoost = {
    brand: { communication: 4, portfolioStorytelling: 0, problemSolving: 0, toolFluency: 0, visualDesign: 5 },
    graphic: { communication: 0, portfolioStorytelling: 4, problemSolving: 0, toolFluency: 0, visualDesign: 6 },
    motion: { communication: 0, portfolioStorytelling: 0, problemSolving: 0, toolFluency: 6, visualDesign: 4 },
    product: { communication: 4, portfolioStorytelling: 0, problemSolving: 7, toolFluency: 0, visualDesign: 0 },
    uiux: { communication: 0, portfolioStorytelling: 0, problemSolving: 6, toolFluency: 4, visualDesign: 0 }
  }[intake.discipline];

  const portfolioBonus = intake.portfolioLink ? 9 : 0;
  const toolBonus = clamp(intake.tools.length * 4, 0, 16);
  const projectBonus = clamp(intake.projectCount * 2.5, 0, 18);
  const freelanceGoalBonus = intake.goals.includes("freelance") ? 8 : 0;

  return [
    {
      key: "visualDesign",
      label: DIMENSION_META.visualDesign.label,
      narrative: DIMENSION_META.visualDesign.impact,
      score: clamp(Math.round(intake.visualCraft * 8 + projectBonus + disciplineBoost.visualDesign + experienceBoost), 32, 96)
    },
    {
      key: "problemSolving",
      label: DIMENSION_META.problemSolving.label,
      narrative: DIMENSION_META.problemSolving.impact,
      score: clamp(Math.round(intake.problemSolving * 8.2 + projectBonus + disciplineBoost.problemSolving + experienceBoost), 32, 96)
    },
    {
      key: "portfolioStorytelling",
      label: DIMENSION_META.portfolioStorytelling.label,
      narrative: DIMENSION_META.portfolioStorytelling.impact,
      score: clamp(Math.round(intake.portfolioStorytelling * 8 + projectBonus * 0.8 + portfolioBonus + disciplineBoost.portfolioStorytelling + experienceBoost / 2), 28, 96)
    },
    {
      key: "toolFluency",
      label: DIMENSION_META.toolFluency.label,
      narrative: DIMENSION_META.toolFluency.impact,
      score: clamp(Math.round(intake.toolFluency * 7.9 + toolBonus + projectBonus * 0.6 + disciplineBoost.toolFluency + experienceBoost), 30, 96)
    },
    {
      key: "communication",
      label: DIMENSION_META.communication.label,
      narrative: DIMENSION_META.communication.impact,
      score: clamp(Math.round(intake.communication * 8 + portfolioBonus / 2 + disciplineBoost.communication + experienceBoost / 2), 34, 96)
    },
    {
      key: "freelanceReadiness",
      label: DIMENSION_META.freelanceReadiness.label,
      narrative: DIMENSION_META.freelanceReadiness.impact,
      score: clamp(Math.round(intake.freelanceReadiness * 7.4 + intake.communication * 2 + freelanceGoalBonus + (intake.projectCount >= 3 ? 6 : 0)), 26, 96)
    }
  ];
}

function getBand(score) {
  if (score >= 82) return "Market-ready";
  if (score >= 70) return "Client-ready";
  if (score >= 56) return "Emerging";
  return "Foundation";
}

function buildSummary(intake, strengths, weaknesses, overallScore) {
  const strongArea = strengths[0]?.label || "craft";
  const growthArea = weaknesses[0]?.label || "portfolio storytelling";
  return `${intake.name} shows ${getBand(overallScore).toLowerCase()} potential in ${DISCIPLINE_LABELS[intake.discipline]}, with the strongest signal in ${strongArea}. The biggest lift now is ${growthArea}, which should become the first focus for the next 30 days.`;
}

function buildAssessmentSignals(intake, assessment) {
  const strongest = assessment.strengths[0];
  const weakest = assessment.weaknesses[0];
  const projectLabel = intake.projectCount === 1 ? "project" : "projects";

  return [
    {
      detail: intake.portfolioLink
        ? "A live portfolio link gives this review stronger context for case-study clarity and work quality."
        : "This review is leaning more heavily on your intake answers because no portfolio link was attached yet.",
      title: intake.portfolioLink ? "Portfolio evidence was included" : "Portfolio evidence is still missing",
      tone: intake.portfolioLink ? "positive" : "warning"
    },
    {
      detail:
        intake.projectCount >= 4
          ? `You reported ${intake.projectCount} finished ${projectLabel}, which helps the rubric reward repetition and shipped work.`
          : `You reported ${intake.projectCount} finished ${projectLabel}. More complete case studies would make readiness easier to prove.`,
      title: intake.projectCount >= 4 ? "Project volume supports the score" : "Limited project depth is holding the score back",
      tone: intake.projectCount >= 4 ? "positive" : "warning"
    },
    {
      detail: `${strongest.label} scored ${strongest.score}/100, making it the clearest proof-point in your current profile.`,
      title: `Strongest signal: ${strongest.label}`,
      tone: strongest.score >= 74 ? "positive" : "neutral"
    },
    {
      detail: `${weakest.label} scored ${weakest.score}/100, so the roadmap and challenge track start there first.`,
      title: `Primary gap: ${weakest.label}`,
      tone: weakest.score <= 60 ? "warning" : "neutral"
    }
  ];
}

function buildAssessmentTrend(previousEntry, assessment) {
  if (!previousEntry) {
    return {
      delta: 0,
      direction: "new",
      label: "First saved review",
      summary: "This is your baseline review. Re-run the assessment after your next roadmap cycle to measure real movement."
    };
  }

  const previousScore = safeNumber(previousEntry.overallScore, 0, 100, assessment.overallScore);
  const delta = assessment.overallScore - previousScore;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const previousDate = new Date(previousEntry.createdAt);
  const previousLabel = Number.isNaN(previousDate.getTime())
    ? "your last saved review"
    : `your ${previousDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} review`;
  const bandChanged = previousEntry.band && previousEntry.band !== assessment.band;

  let label = `No score change vs ${previousLabel}`;
  let summary = `Your score stayed at ${assessment.overallScore}. Focus on the weakest dimension before checking in again.`;

  if (direction === "up") {
    label = `Up ${delta} point${delta === 1 ? "" : "s"} vs ${previousLabel}`;
    summary = bandChanged
      ? `You improved from ${previousEntry.band} to ${assessment.band}. Keep reinforcing the behaviours behind that jump.`
      : `Your score increased from ${previousScore} to ${assessment.overallScore}. That suggests your recent work is becoming more balanced.`;
  }

  if (direction === "down") {
    label = `Down ${Math.abs(delta)} point${Math.abs(delta) === 1 ? "" : "s"} vs ${previousLabel}`;
    summary = bandChanged
      ? `Your band moved from ${previousEntry.band} to ${assessment.band}. Revisit the weakest evidence areas before the next check-in.`
      : `Your score slipped from ${previousScore} to ${assessment.overallScore}. That usually means the current portfolio proof is not yet consistent.`;
  }

  return { delta, direction, label, summary };
}

function roadmapForWeakness(weakness, index, intake) {
  const context = DISCIPLINE_CONTEXT[intake.discipline];
  const phases = ["Weeks 1-2", "Weeks 3-4", "Weeks 5-6"];
  const copy = {
    communication: {
      detail: `Practice presenting your ${context.artifact} with a clear problem, design rationale, and concise trade-off story.`,
      title: "Sharpen how you explain your work"
    },
    freelanceReadiness: {
      detail: "Turn one project into a client-ready offer with scope, pricing guardrails, revision limits, and delivery timelines.",
      title: "Package yourself like a trusted freelancer"
    },
    portfolioStorytelling: {
      detail: "Rewrite one existing project as a stronger case study with context, process, outcomes, and lessons learned.",
      title: "Improve case study clarity"
    },
    problemSolving: {
      detail: "Use structured briefs so your work shows clear decisions, constraints, and measurable outcomes instead of surface polish alone.",
      title: "Strengthen decision-making"
    },
    toolFluency: {
      detail: "Rebuild one project with a tighter workflow in your main tools so execution speed matches your ideas.",
      title: "Increase execution speed"
    },
    visualDesign: {
      detail: "Focus on hierarchy, spacing, type, alignment, and consistency so each project looks intentionally crafted.",
      title: "Raise visual polish"
    }
  };

  return {
    detail: copy[weakness.key].detail,
    phase: phases[index] || "Next phase",
    title: copy[weakness.key].title
  };
}

function buildRoadmap(intake, weaknesses) {
  const items = weaknesses.slice(0, 3).map((weakness, index) => roadmapForWeakness(weakness, index, intake));
  items.push({
    detail: "Once these steps feel stable, re-run the assessment and compare your new score before unlocking stronger marketplace opportunities.",
    phase: "Checkpoint",
    title: "Re-assess and unlock the next track"
  });
  return items;
}

function challengeBlueprint(weaknessKey, intake) {
  const context = DISCIPLINE_CONTEXT[intake.discipline];
  const blueprints = {
    communication: {
      brief: `Build a short presentation that walks through your ${context.artifact} and justifies your choices to a founder or hiring team.`,
      deliverable: "five slides plus a two-minute recorded walkthrough",
      focus: "clarity, confidence, and stakeholder storytelling",
      title: "Pitch Your Design Decisions"
    },
    freelanceReadiness: {
      brief: `Write a freelance proposal for ${context.scenario} that covers scope, pricing logic, revisions, and delivery milestones.`,
      deliverable: "proposal doc, project timeline, and pricing rationale",
      focus: "client trust, pricing structure, and delivery confidence",
      title: "Package a Client Offer"
    },
    portfolioStorytelling: {
      brief: "Turn one of your projects into a sharper case study with stronger narrative flow, clearer decisions, and outcomes that matter.",
      deliverable: "rewritten case study outline and updated portfolio visuals",
      focus: "case study structure and portfolio readability",
      title: "Rewrite One Case Study"
    },
    problemSolving: {
      brief: `Solve ${context.scenario} by defining the user problem, constraints, and at least two possible solution directions before choosing one.`,
      deliverable: context.deliverable,
      focus: "structured thinking and trade-off logic",
      title: "Solve a Real Brief"
    },
    toolFluency: {
      brief: `Rebuild a focused slice of your ${context.artifact} in your primary tool stack using components, repeatable systems, and clean file structure.`,
      deliverable: "working source file plus a short workflow note",
      focus: "speed, repeatability, and tool confidence",
      title: "Rebuild With Better Systems"
    },
    visualDesign: {
      brief: `Recraft your ${context.artifact} for ${context.scenario} with stronger hierarchy, spacing, typography, and visual consistency.`,
      deliverable: context.deliverable,
      focus: "craft quality and first-impression polish",
      title: "Polish the Core Output"
    }
  };

  return blueprints[weaknessKey];
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function createChallenge(weakness, intake, index, challengeSeed) {
  const preference = PREFERENCE_META[intake.challengePreference];
  const base = challengeBlueprint(weakness.key, intake);
  return {
    brief: `${preference.lead} ${base.brief}`,
    category: weakness.label,
    deliverable: base.deliverable,
    estimatedTime: preference.time,
    focus: base.focus,
    id: `${challengeSeed}-${slug(weakness.key)}-${index + 1}`,
    rewardXp: 70 + index * 20,
    stage: `Level ${index + 1}`,
    status: index < 2 ? "active" : "locked",
    title: base.title,
    type: preference.label
  };
}

function createCapstone(intake, strongest, challengeSeed) {
  const preference = PREFERENCE_META[intake.challengePreference];
  const context = DISCIPLINE_CONTEXT[intake.discipline];

  return {
    brief: `${preference.lead} ${context.capstone}`,
    category: strongest.label,
    deliverable: `publish-ready portfolio update for ${context.scenario}`,
    estimatedTime: "1 focused week",
    focus: "portfolio quality, confidence, and proof of growth",
    id: `${challengeSeed}-capstone`,
    rewardXp: 150,
    stage: "Capstone",
    status: "locked",
    title: "Launch the Next-Level Portfolio Piece",
    type: preference.label
  };
}

function finalizeProgress({ assessment, challenges, progress }) {
  const completedCount = challenges.filter((challenge) => challenge.status === "completed").length;
  const level = Math.max(1, Math.floor(progress.xp / 120) + 1);
  const nextLevelAt = level * 120;
  const badges = [...progress.badges];

  if (completedCount >= 1 && !badges.some((badge) => badge.id === "first-challenge")) {
    badges.push({
      detail: "Finished the first guided challenge and built momentum.",
      id: "first-challenge",
      name: "Sprint Finisher"
    });
  }

  if (completedCount >= 2 && !badges.some((badge) => badge.id === "two-completions")) {
    badges.push({
      detail: "Completed two challenges and proved consistent practice.",
      id: "two-completions",
      name: "Level Builder"
    });
  }

  if (assessment.overallScore >= 75 && !badges.some((badge) => badge.id === "client-ready")) {
    badges.push({
      detail: "Crossed the score threshold for client-facing work.",
      id: "client-ready",
      name: "Client-Ready Signal"
    });
  }

  const marketplaceUnlocked = level >= 3 && assessment.overallScore >= 72;
  if (marketplaceUnlocked && !badges.some((badge) => badge.id === "marketplace-ready")) {
    badges.push({
      detail: "Unlocked marketplace access through score and level progress.",
      id: "marketplace-ready",
      name: "Marketplace Access"
    });
  }

  return {
    badges,
    completedCount,
    level,
    marketplaceUnlocked,
    nextLevelAt,
    xp: progress.xp
  };
}

function buildProgress(assessment, challenges) {
  const xp = assessment.overallScore >= 72 ? 70 : 40;
  return finalizeProgress({
    assessment,
    challenges,
    progress: {
      badges: [
        {
          detail: "Completed the first AI-powered portfolio review.",
          id: "first-assessment",
          name: "Portfolio Pulse"
        }
      ],
      xp
    }
  });
}

function buildAssessmentArtifacts(intake, previousEntry = null) {
  const dimensions = buildDimensions(intake);
  const overallScore = Math.round(average(dimensions.map((dimension) => dimension.score)));
  const strengths = [...dimensions].sort((left, right) => right.score - left.score).slice(0, 3);
  const weaknesses = [...dimensions].sort((left, right) => left.score - right.score).slice(0, 3);
  const createdAt = new Date().toISOString();
  const assessment = {
    band: getBand(overallScore),
    coachNote: `Focus your next month on ${weaknesses[0].label.toLowerCase()} first, then show that progress in public through a stronger portfolio story.`,
    createdAt,
    dimensions,
    overallScore,
    roadmap: buildRoadmap(intake, weaknesses),
    scoreSignals: [],
    strengths,
    summary: buildSummary(intake, strengths, weaknesses, overallScore),
    trend: null,
    weaknesses
  };
  assessment.scoreSignals = buildAssessmentSignals(intake, assessment);
  assessment.trend = buildAssessmentTrend(previousEntry, assessment);

  const challengeSeed = Date.now();
  const challenges = weaknesses.map((weakness, index) => createChallenge(weakness, intake, index, challengeSeed));
  challenges.push(createCapstone(intake, strengths[0], challengeSeed));

  return {
    assessment,
    challenges,
    progress: buildProgress(assessment, challenges)
  };
}

function buildFallbackSignalsFromDimensions(dimensions, strengths, weaknesses, evidence = {}) {
  const strongest = strengths[0];
  const weakest = weaknesses[0];

  return [
    {
      detail: evidence.status === "captured"
        ? `The analysis used live portfolio evidence from ${evidence.host || "the supplied link"} in addition to the intake form.`
        : "The analysis relied mostly on the intake form because portfolio evidence could not be fetched reliably.",
      title: evidence.status === "captured" ? "Portfolio evidence was analyzed" : "Portfolio evidence was limited",
      tone: evidence.status === "captured" ? "positive" : "warning"
    },
    {
      detail: `${strongest.label} is currently the clearest hiring signal at ${strongest.score}/100.`,
      title: `Strongest signal: ${strongest.label}`,
      tone: strongest.score >= 75 ? "positive" : "neutral"
    },
    {
      detail: `${weakest.label} is the biggest current risk at ${weakest.score}/100.`,
      title: `Primary risk: ${weakest.label}`,
      tone: weakest.score <= 60 ? "warning" : "neutral"
    },
    {
      detail: `The dimension spread runs from ${weakest.score} to ${strongest.score}, showing how consistent the portfolio proof is right now.`,
      title: "Score spread across dimensions",
      tone: strongest.score - weakest.score >= 20 ? "warning" : "positive"
    }
  ];
}

function normalizeInsightList(items, fallbackDimensions, direction = "strength") {
  if (Array.isArray(items) && items.length) {
    return items.slice(0, 3).map((item, index) => {
      const fallback = fallbackDimensions[index] || fallbackDimensions[0];
      return {
        key: safeText(item.key, fallback?.key),
        label: safeText(item.label, fallback?.label || "Assessment signal"),
        narrative: safeText(item.narrative, fallback?.narrative || ""),
        score: safeNumber(item.score, 0, 100, fallback?.score || 50)
      };
    });
  }

  return fallbackDimensions.slice(0, 3).map((item) => ({
    key: item.key,
    label: item.label,
    narrative: item.narrative,
    score: item.score
  }));
}

function normalizeAgentPanels(rawAgents, strengths, weaknesses) {
  const meta = {
    freelance_agent: {
      focus: "Freelance readiness",
      title: "Freelance Agent"
    },
    hiring_agent: {
      focus: "Hiring readiness",
      title: "Hiring Agent"
    },
    portfolio_agent: {
      focus: "Portfolio quality",
      title: "Portfolio Agent"
    }
  };

  if (Array.isArray(rawAgents) && rawAgents.length) {
    return rawAgents.slice(0, 3).map((agent, index) => {
      const fallbackId = ["portfolio_agent", "hiring_agent", "freelance_agent"][index];
      const config = meta[safeText(agent.id, fallbackId)] || meta[fallbackId];
      return {
        focus: safeText(agent.focus, config.focus),
        id: safeText(agent.id, fallbackId),
        score: safeNumber(agent.score, 0, 100, index === 0 ? strengths[0]?.score : weaknesses[0]?.score || 60),
        signals: Array.isArray(agent.signals)
          ? agent.signals.slice(0, 3).map((item) => safeText(item)).filter(Boolean)
          : [],
        summary: safeText(agent.summary, ""),
        title: safeText(agent.title, config.title),
        verdict: safeText(agent.verdict, "")
      };
    });
  }

  return [
    {
      focus: "Portfolio quality",
      id: "portfolio_agent",
      score: strengths[0]?.score || 60,
      signals: [strengths[0]?.label || "Visual craft", strengths[1]?.label || "Portfolio storytelling"].filter(Boolean),
      summary: "The portfolio has enough signal to evaluate structure and craft, but still needs stronger proof in weaker areas.",
      title: "Portfolio Agent",
      verdict: "Evidence captured"
    },
    {
      focus: "Hiring readiness",
      id: "hiring_agent",
      score: average([strengths[0]?.score || 60, weaknesses[0]?.score || 55]),
      signals: [strengths[0]?.label || "Problem solving", weaknesses[0]?.label || "Communication"].filter(Boolean),
      summary: "The hiring view is driven by how clearly the work proves decisions, outcomes, and communication.",
      title: "Hiring Agent",
      verdict: "Needs sharper proof"
    },
    {
      focus: "Freelance readiness",
      id: "freelance_agent",
      score: weaknesses[0]?.score || 52,
      signals: [weaknesses[0]?.label || "Freelance readiness", weaknesses[1]?.label || "Communication"].filter(Boolean),
      summary: "The freelance view is most sensitive to clarity, confidence, and client-facing packaging.",
      title: "Freelance Agent",
      verdict: "Early signal"
    }
  ];
}

function buildAssessmentArtifactsFromAnalysis(intake, rawAnalysis = {}, previousEntry = null, evidence = {}) {
  const rawDimensions = new Map(
    Array.isArray(rawAnalysis.dimensions)
      ? rawAnalysis.dimensions.map((item) => [safeText(item.key), item])
      : []
  );

  const dimensions = DIMENSION_ORDER.map((key) => {
    const raw = rawDimensions.get(key) || {};
    return {
      key,
      label: DIMENSION_META[key].label,
      narrative: safeText(raw.narrative, DIMENSION_META[key].impact),
      score: safeNumber(raw.score, 0, 100, 50)
    };
  });

  const sortedDescending = [...dimensions].sort((left, right) => right.score - left.score);
  const sortedAscending = [...dimensions].sort((left, right) => left.score - right.score);
  const strengths = normalizeInsightList(rawAnalysis.strengths, sortedDescending, "strength");
  const weaknesses = normalizeInsightList(rawAnalysis.weaknesses, sortedAscending, "weakness");
  const overallScore = safeNumber(rawAnalysis.overallScore, 0, 100, Math.round(average(dimensions.map((item) => item.score))));
  const createdAt = new Date().toISOString();
  const summary = safeText(
    rawAnalysis.summary,
    `${intake.name}'s portfolio shows the most convincing evidence in ${strengths[0]?.label || "core craft"}, while ${weaknesses[0]?.label || "portfolio clarity"} remains the biggest blocker.`
  );

  const assessment = {
    agents: [],
    band: getBand(overallScore),
    confidence: safeNumber(rawAnalysis.confidence, 0, 100, evidence.status === "captured" ? 82 : 64),
    coachNote: safeText(
      rawAnalysis.coachNote,
      `The strongest signal is ${strengths[0]?.label || "core craft"}, but ${weaknesses[0]?.label || "consistency"} is still the main reason the score is not higher.`
    ),
    createdAt,
    dimensions,
    evidence: {
      host: safeText(evidence.host),
      preview: safeText(evidence.preview),
      source: safeText(evidence.source, intake.portfolioLink ? "portfolio_link" : "intake_only"),
      status: safeText(evidence.status, intake.portfolioLink ? "limited" : "intake_only")
    },
    overallScore,
    roadmap: buildRoadmap(intake, weaknesses),
    scoreSignals: Array.isArray(rawAnalysis.scoreSignals) && rawAnalysis.scoreSignals.length
      ? rawAnalysis.scoreSignals.slice(0, 4).map((item) => ({
        detail: safeText(item.detail),
        title: safeText(item.title, "Analysis signal"),
        tone: safeText(item.tone, "neutral")
      }))
      : buildFallbackSignalsFromDimensions(dimensions, strengths, weaknesses, evidence),
    strengths,
    summary,
    trend: null,
    weaknesses
  };

  assessment.agents = normalizeAgentPanels(rawAnalysis.agents, strengths, weaknesses);
  assessment.trend = buildAssessmentTrend(previousEntry, assessment);

  const challengeSeed = Date.now();
  const challenges = weaknesses.map((weakness, index) => createChallenge(weakness, intake, index, challengeSeed));
  challenges.push(createCapstone(intake, strengths[0], challengeSeed));

  return {
    assessment,
    challenges,
    progress: buildProgress(assessment, challenges)
  };
}

function completeChallenge(reviewState, challengeId) {
  const challenges = Array.isArray(reviewState.challenges) ? [...reviewState.challenges] : [];
  const progress = reviewState.progress ? { ...reviewState.progress, badges: [...(reviewState.progress.badges || [])] } : null;

  if (!progress || !reviewState.assessment) {
    const error = new Error("Run an assessment before completing challenges.");
    error.statusCode = 400;
    throw error;
  }

  const challenge = challenges.find((item) => item.id === challengeId);
  if (!challenge) {
    const error = new Error("Challenge not found.");
    error.statusCode = 404;
    throw error;
  }

  if (challenge.status === "locked") {
    const error = new Error("This challenge is still locked.");
    error.statusCode = 409;
    throw error;
  }

  if (challenge.status === "completed") {
    return {
      challenges,
      progress: finalizeProgress({ assessment: reviewState.assessment, challenges, progress })
    };
  }

  challenge.status = "completed";
  challenge.completedAt = new Date().toISOString();
  progress.xp += challenge.rewardXp;
  const nextLocked = challenges.find((item) => item.status === "locked");
  if (nextLocked) {
    nextLocked.status = "active";
  }

  return {
    challenges,
    progress: finalizeProgress({ assessment: reviewState.assessment, challenges, progress })
  };
}

function historyEntryFromAssessment(assessment) {
  return {
    band: assessment.band,
    createdAt: assessment.createdAt,
    overallScore: assessment.overallScore
  };
}

module.exports = {
  DISCIPLINE_LABELS,
  DIMENSION_META,
  DIMENSION_ORDER,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  buildAssessmentArtifacts,
  buildAssessmentArtifactsFromAnalysis,
  completeChallenge,
  getBand,
  historyEntryFromAssessment,
  intakeForClient,
  profileDefaultsFromIntake,
  sanitizeIntake,
  safeText
};
