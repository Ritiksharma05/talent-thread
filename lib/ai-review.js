const { DIMENSION_ORDER, safeText } = require("./assessment");

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_REVIEW_MODEL = process.env.OPENAI_REVIEW_MODEL || "gpt-5.4";

const agentIds = ["portfolio_agent", "hiring_agent", "freelance_agent"];

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overallScore: { type: "number" },
    confidence: { type: "number" },
    summary: { type: "string" },
    coachNote: { type: "string" },
    scoreSignals: {
      type: "array",
      minItems: 3,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          detail: { type: "string" },
          title: { type: "string" },
          tone: {
            type: "string",
            enum: ["positive", "warning", "neutral"]
          }
        },
        required: ["title", "detail", "tone"]
      }
    },
    dimensions: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: {
            type: "string",
            enum: DIMENSION_ORDER
          },
          narrative: { type: "string" },
          score: { type: "number" }
        },
        required: ["key", "score", "narrative"]
      }
    },
    strengths: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: {
            type: "string",
            enum: DIMENSION_ORDER
          },
          label: { type: "string" },
          narrative: { type: "string" },
          score: { type: "number" }
        },
        required: ["key", "label", "score", "narrative"]
      }
    },
    weaknesses: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: {
            type: "string",
            enum: DIMENSION_ORDER
          },
          label: { type: "string" },
          narrative: { type: "string" },
          score: { type: "number" }
        },
        required: ["key", "label", "score", "narrative"]
      }
    },
    agents: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          focus: { type: "string" },
          id: {
            type: "string",
            enum: agentIds
          },
          score: { type: "number" },
          signals: {
            type: "array",
            minItems: 2,
            maxItems: 3,
            items: { type: "string" }
          },
          summary: { type: "string" },
          title: { type: "string" },
          verdict: { type: "string" }
        },
        required: ["id", "title", "focus", "score", "verdict", "summary", "signals"]
      }
    }
  },
  required: [
    "overallScore",
    "confidence",
    "summary",
    "coachNote",
    "scoreSignals",
    "dimensions",
    "strengths",
    "weaknesses",
    "agents"
  ]
};

function isAiReviewConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readMatch(source, pattern) {
  const match = String(source || "").match(pattern);
  return match ? safeText(match[1]) : "";
}

async function fetchPortfolioEvidence(portfolioLink) {
  if (!portfolioLink) {
    return {
      host: "",
      preview: "",
      snippet: "",
      source: "intake_only",
      status: "intake_only"
    };
  }

  let url;
  try {
    url = new URL(portfolioLink);
  } catch (error) {
    return {
      host: "",
      preview: "",
      snippet: "",
      source: "portfolio_link",
      status: "invalid_link"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "TalentThreadReviewBot/1.0"
      },
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        host: url.host,
        preview: `Portfolio returned ${response.status}`,
        snippet: "",
        source: "portfolio_link",
        status: "limited"
      };
    }

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    const title = readMatch(raw, /<title[^>]*>([\s\S]*?)<\/title>/i)
      || readMatch(raw, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      || readMatch(raw, /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
    const description = readMatch(raw, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || readMatch(raw, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const textSnippet = stripHtml(raw).slice(0, contentType.includes("text/html") ? 2200 : 1200);

    return {
      contentType,
      description,
      host: url.host,
      preview: safeText(title || description, url.host),
      snippet: textSnippet,
      source: "portfolio_link",
      status: textSnippet ? "captured" : "limited",
      title,
      url: portfolioLink
    };
  } catch (error) {
    return {
      host: url.host,
      preview: safeText(error.message, "Could not fetch portfolio evidence"),
      snippet: "",
      source: "portfolio_link",
      status: "limited"
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractStructuredText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const message = Array.isArray(payload.output)
    ? payload.output.find((item) => item.type === "message")
    : null;
  const content = Array.isArray(message?.content)
    ? message.content.find((item) => item.type === "output_text" || item.type === "text")
    : null;

  if (content?.text) {
    return content.text;
  }

  throw new Error("AI review returned no structured text output.");
}

async function requestStructuredReview(intake, previousEntry, evidence) {
  const payload = {
    intake: {
      challengePreference: intake.challengePreference,
      communication: intake.communication,
      discipline: intake.discipline,
      experience: intake.experience,
      freelanceReadiness: intake.freelanceReadiness,
      goals: intake.goals,
      name: intake.name,
      notes: intake.notes,
      portfolioLink: intake.portfolioLink,
      portfolioStorytelling: intake.portfolioStorytelling,
      problemSolving: intake.problemSolving,
      projectCount: intake.projectCount,
      toolFluency: intake.toolFluency,
      tools: intake.tools,
      visualCraft: intake.visualCraft
    },
    previousReview: previousEntry || null,
    portfolioEvidence: evidence
  };

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_REVIEW_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You are an AI review orchestrator for an early-career designer platform.",
                "Simulate three specialist reviewer agents:",
                "1. portfolio_agent: evaluates portfolio quality, storytelling, and visual craft.",
                "2. hiring_agent: evaluates problem solving, communication, and hireability.",
                "3. freelance_agent: evaluates client trust, packaging, and freelance readiness.",
                "Use the intake and any captured portfolio evidence.",
                "Do not generate a roadmap.",
                "Return a strict JSON object only.",
                "Scores must be 0-100.",
                "Be critical, concrete, and internally consistent."
              ].join(" ")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(payload)
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "designer_review_report",
          strict: true,
          schema: reviewSchema
        }
      }
    })
  });

  const raw = await response.text();
  let data = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new Error("OpenAI review returned invalid JSON.");
    }
  }

  if (!response.ok) {
    const apiMessage = data.error?.message || data.error || "OpenAI review request failed.";
    const error = new Error(apiMessage);
    error.statusCode = response.status;
    throw error;
  }

  return JSON.parse(extractStructuredText(data));
}

async function generateAiReview(intake, previousEntry) {
  if (!isAiReviewConfigured()) {
    const error = new Error("AI review is not configured. Set OPENAI_API_KEY before generating reports.");
    error.statusCode = 503;
    throw error;
  }

  const evidence = await fetchPortfolioEvidence(intake.portfolioLink);
  const analysis = await requestStructuredReview(intake, previousEntry, evidence);

  return {
    analysis,
    evidence
  };
}

module.exports = {
  generateAiReview,
  isAiReviewConfigured
};
