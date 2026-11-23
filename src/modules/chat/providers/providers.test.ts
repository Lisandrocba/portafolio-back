import { describe, it } from 'vitest';

// Use test/helpers/mock-llm.ts (installMockLlm, groqBody, geminiBody). No test hits a real API.

describe('groq.provider', () => {
  it.todo('sends system + messages, model and response_format json_object');
  it.todo('sends the key as Bearer authorization and never in the URL');
  it.todo('maps choices[0].message.content and usage.total_tokens to LlmResult');
  it.todo('rejects with rate_limit on 429');
  it.todo('rejects with server on 5xx');
  it.todo('rejects with client on 401/400 (bad key or model)');
  it.todo('rejects with timeout when the response takes longer than timeoutMs');
  it.todo('rejects with network when fetch fails');
  it.todo('rejects with bad_response when the body has no content');
});

describe('gemini.provider', () => {
  it.todo('sends the key in x-goog-api-key, never as ?key= in the query string');
  it.todo('maps assistant → model role and sends systemInstruction separately');
  it.todo('asks for responseMimeType application/json');
  it.todo('maps candidates[0].content.parts[0].text and usageMetadata.totalTokenCount');
  it.todo('rejects with bad_response when there are no candidates (safety block)');
  it.todo('maps 429 / 5xx / timeout / network like groq');
});
