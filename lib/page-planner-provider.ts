import {
  getAnthropicPagePlannerModel,
  isAnthropicConfigured,
} from "@/lib/anthropic";
import {
  getPagePlannerModel as getOpenAIPagePlannerModel,
  isOpenAIConfigured,
} from "@/lib/openai";

export type PagePlannerProvider = "anthropic" | "openai";

export function getPagePlannerProvider(): PagePlannerProvider {
  const configuredProvider = process.env.PAGE_PLANNER_PROVIDER
    ?.trim()
    .toLocaleLowerCase();

  if (configuredProvider === "anthropic" || configuredProvider === "openai") {
    return configuredProvider;
  }

  return isAnthropicConfigured() ? "anthropic" : "openai";
}

export function isPagePlannerConfigured() {
  return getPagePlannerProvider() === "anthropic"
    ? isAnthropicConfigured()
    : isOpenAIConfigured();
}

export function getConfiguredPagePlannerModel() {
  return getPagePlannerProvider() === "anthropic"
    ? getAnthropicPagePlannerModel()
    : getOpenAIPagePlannerModel();
}

export function getPagePlannerProviderLabel() {
  return getPagePlannerProvider() === "anthropic" ? "Claude" : "OpenAI";
}
