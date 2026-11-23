import { describe, it } from 'vitest';

// Pure functions: plain objects in, string out. No DB, no LLM.

describe('formatProfileContext', () => {
  it.todo('marks current experiences as "[ACTUAL — en paralelo]"');
  it.todo('omits the client when clientPublic = false');
  it.todo('never includes the phone, even if the snapshot had one');
  it.todo('formats dates with month precision');
});

describe('buildSystemPrompt', () => {
  it.todo('contains the fixed rules and then the CV context');
  it.todo('mentions JSON and the three output fields (required by Groq JSON mode)');
});
