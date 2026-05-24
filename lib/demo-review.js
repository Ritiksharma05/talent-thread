const {
  buildAssessmentArtifactsFromAnalysis,
  intakeForClient,
  profileDefaultsFromIntake,
  sanitizeIntake
} = require("./assessment");

function buildDemoReviewState() {
  const intake = sanitizeIntake({
    challengePreference: "client_simulation",
    communication: 7,
    discipline: "uiux",
    experience: "graduate",
    freelanceReadiness: 6,
    goals: ["portfolio", "freelance", "interviews"],
    name: "Aarohi Mehta",
    notes: "Looking for product design roles and selective freelance opportunities in fintech and consumer apps.",
    portfolioLink: "https://www.behance.net/aarohimehta",
    portfolioStorytelling: 6,
    problemSolving: 8,
    projectCount: 5,
    toolFluency: 8,
    tools: "Figma, FigJam, Notion, Illustrator",
    visualCraft: 7
  });

  const previousEntry = {
    band: "Emerging",
    createdAt: "2026-02-11T10:15:00.000Z",
    overallScore: 70
  };

  const analysis = {
    agents: [
      {
        focus: "Portfolio quality",
        id: "portfolio_agent",
        score: 78,
        signals: ["Clear UI systems", "Better case-study depth needed", "Strong visual consistency"],
        summary: "The portfolio looks polished and coherent, but some case studies still skip the decision-making narrative that hiring teams expect.",
        title: "Portfolio Agent",
        verdict: "Strong craft, moderate proof"
      },
      {
        focus: "Hiring readiness",
        id: "hiring_agent",
        score: 84,
        signals: ["Strong product thinking", "Convincing problem framing", "Presentation can be tighter"],
        summary: "Problem solving is interview-viable. The candidate reads as employable if the portfolio explains impact and trade-offs more directly.",
        title: "Hiring Agent",
        verdict: "Interview-ready signal"
      },
      {
        focus: "Freelance readiness",
        id: "freelance_agent",
        score: 73,
        signals: ["Good delivery confidence", "Client-facing packaging is emerging", "Needs clearer scope framing"],
        summary: "The work quality is high enough for selective freelance projects, but pricing and scope communication need to become more explicit.",
        title: "Freelance Agent",
        verdict: "Selective freelance fit"
      }
    ],
    coachNote: "The strongest signal is structured problem solving. The next score jump will come from showing clearer rationale, outcomes, and client-facing framing inside the portfolio.",
    confidence: 88,
    dimensions: [
      {
        key: "visualDesign",
        narrative: "Visual hierarchy, spacing, and UI consistency are strong enough to create immediate credibility.",
        score: 79
      },
      {
        key: "problemSolving",
        narrative: "The work shows clear product reasoning and solid prioritization of user flows.",
        score: 86
      },
      {
        key: "portfolioStorytelling",
        narrative: "Case studies show promise, but some project narratives still skip constraints, decisions, and outcomes.",
        score: 68
      },
      {
        key: "toolFluency",
        narrative: "Tool usage appears efficient and production-oriented, especially for UI systems and flow articulation.",
        score: 82
      },
      {
        key: "communication",
        narrative: "Communication is good, though written rationale can be sharper and more outcome-oriented.",
        score: 74
      },
      {
        key: "freelanceReadiness",
        narrative: "The portfolio suggests execution ability, but client trust signals and packaging can be stronger.",
        score: 72
      }
    ],
    overallScore: 77,
    scoreSignals: [
      {
        detail: "The portfolio shows repeatable design systems and solid execution quality across multiple screens.",
        title: "Strong visual systems",
        tone: "positive"
      },
      {
        detail: "Problem framing and task prioritization are visible enough to support hiring confidence.",
        title: "Convincing product thinking",
        tone: "positive"
      },
      {
        detail: "Several case studies still need stronger narrative depth around process, trade-offs, and outcomes.",
        title: "Storytelling is the main drag",
        tone: "warning"
      },
      {
        detail: "Freelance readiness is credible, but the work would benefit from clearer client-facing packaging and scope logic.",
        title: "Freelance fit is emerging",
        tone: "neutral"
      }
    ],
    strengths: [
      {
        key: "problemSolving",
        label: "Problem Solving",
        narrative: "Best signal in the report. The work reads like product design rather than surface decoration.",
        score: 86
      },
      {
        key: "toolFluency",
        label: "Tool Fluency",
        narrative: "Execution feels efficient, structured, and reliable for collaborative product work.",
        score: 82
      },
      {
        key: "visualDesign",
        label: "Visual Craft",
        narrative: "Strong polish and consistency make the portfolio feel more mature than the experience level suggests.",
        score: 79
      }
    ],
    summary: "Aarohi presents as an early-career UI/UX designer with real product-thinking signal and polished execution. The portfolio is close to client-ready, but it still needs deeper storytelling to convert strong work into stronger proof.",
    weaknesses: [
      {
        key: "portfolioStorytelling",
        label: "Portfolio Storytelling",
        narrative: "This is the biggest blocker. Some projects show what was made but not enough of why it was made that way.",
        score: 68
      },
      {
        key: "freelanceReadiness",
        label: "Freelance Readiness",
        narrative: "Good execution signal, but the portfolio does not yet fully package trust, process, and scope for clients.",
        score: 72
      },
      {
        key: "communication",
        label: "Communication",
        narrative: "Communication is solid, but sharper writing and more explicit decision rationale would improve persuasion.",
        score: 74
      }
    ]
  };

  const evidence = {
    host: "www.behance.net",
    preview: "Aarohi Mehta | Product and UI case studies",
    source: "portfolio_link",
    status: "captured"
  };

  const artifacts = buildAssessmentArtifactsFromAnalysis(intake, analysis, previousEntry, evidence);
  const profileDefaults = profileDefaultsFromIntake(intake);

  return {
    applications: [],
    assessment: artifacts.assessment,
    challenges: artifacts.challenges,
    history: [
      previousEntry,
      {
        band: artifacts.assessment.band,
        createdAt: artifacts.assessment.createdAt,
        overallScore: artifacts.assessment.overallScore
      }
    ],
    intake: intakeForClient(intake),
    profile: {
      ...profileDefaults,
      availability: "Available this month",
      bio: "UI/UX designer focused on turning product reasoning into polished, portfolio-ready work for startups and early teams.",
      city: "Bengaluru, India",
      headline: "UI/UX designer building thoughtful, product-led interfaces",
      preferredRate: "INR 1,800/hr",
      role: "designer",
      userId: 0
    },
    progress: artifacts.progress,
    projects: [],
    user: {
      email: "demo@talentthread.in",
      id: 0,
      name: intake.name,
      role: "designer"
    }
  };
}

module.exports = {
  buildDemoReviewState
};
