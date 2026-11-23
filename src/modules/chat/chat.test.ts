import { describe, it } from 'vitest';

// POST /chat end to end with app.inject() + MockAgent for the LLM (test/helpers/mock-llm.ts).

describe('POST /chat — contract', () => {
  it.todo('400 when message is empty or longer than CHAT_MAX_MESSAGE_CHARS');
  it.todo('400 when visitorId is not a UUID');
  it.todo('without visitorId → generates one and returns it');
  it.todo('unknown conversationId → creates a new conversation, never 404');
  it.todo('response never includes fields outside ChatResponseSchema');
});

describe('POST /chat — failover', () => {
  it.todo('groq 429 → gemini answers, provider = gemini');
  it.todo('groq timeout → gemini answers');
  it.todo('both fail → 200 with reason LLM_UNAVAILABLE, showCta true, provider null');
  it.todo('without GEMINI_API_KEY only groq is tried');
});

describe('POST /chat — LLM output', () => {
  it.todo('valid JSON → persists substantive and recruiterIntent from the model');
  it.todo('invalid JSON → raw text as reply, substantive = true, recruiterIntent = false');
});

describe('POST /chat — funnel', () => {
  it.todo('at QUERY_LIMIT → fixed reply without calling the LLM');
  it.todo('contact.phone is null without a lead and the profile phone with one');
  it.todo('lead captured and at the limit → LEAD_CAPTURED_REPLY, showCta false');
  it.todo('stores ipHash, never the ip in clear');
  it.todo('rate limit: 11th request in a minute → 429');
});
