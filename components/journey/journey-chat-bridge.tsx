"use client";

export const JOURNEY_ASK_AI_EVENT = "journey-ask-ai";

export interface JourneyAskAiDetail {
  message: string;
}

export function openAskAi(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<JourneyAskAiDetail>(JOURNEY_ASK_AI_EVENT, {
      detail: { message },
    })
  );
}
