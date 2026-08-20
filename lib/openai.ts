import OpenAI from "openai";

let openAIClient: OpenAI | undefined;

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  if (!openAIClient) {
    openAIClient = new OpenAI({ apiKey });
  }

  return openAIClient;
}

export function getProductAnalysisModel() {
  return process.env.OPENAI_ANALYSIS_MODEL?.trim() || "gpt-4.1-mini";
}

export function getStrategyModel() {
  return process.env.OPENAI_STRATEGY_MODEL?.trim() || "gpt-5.6-terra";
}

export function getPagePlannerModel() {
  return process.env.OPENAI_PAGE_PLANNER_MODEL?.trim() || "gpt-5.6-terra";
}

export function getEditorCopilotModel() {
  return process.env.OPENAI_EDITOR_MODEL?.trim() || "gpt-5.6-terra";
}

export function getImageGenerationModel() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
}

export function getMarketResearchModel() {
  return process.env.OPENAI_MARKET_RESEARCH_MODEL?.trim() || "gpt-5.6-luna";
}
