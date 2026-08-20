import "server-only";

import Anthropic from "@anthropic-ai/sdk";

let anthropicClient: Anthropic | undefined;

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey });
  }

  return anthropicClient;
}

export function getAnthropicPagePlannerModel() {
  return (
    process.env.ANTHROPIC_PAGE_PLANNER_MODEL?.trim() || "claude-sonnet-5"
  );
}

export function getAnthropicDesignModel() {
  return (
    process.env.ANTHROPIC_DESIGN_MODEL?.trim() ||
    getAnthropicPagePlannerModel()
  );
}
