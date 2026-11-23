import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from './system-prompt.js';

// Pure functions: plain objects in, string out. No DB, no LLM.

describe('formatProfileContext', () => {
  it.todo('marks current experiences as "[ACTUAL — en paralelo]"');
  it.todo('omits the client when clientPublic = false');
  it.todo('never includes the phone, even if the snapshot had one');
  it.todo('formats dates with month precision');
});

describe('buildSystemPrompt', () => {
  it('contains the fixed rules and then the CV context', () => {
    const prompt = buildSystemPrompt('PERFIL\nDatos de prueba');

    expect(prompt.indexOf('# Rol y alcance')).toBeLessThan(prompt.indexOf('CONTEXTO DEL CV'));
    expect(prompt.endsWith('CONTEXTO DEL CV\nPERFIL\nDatos de prueba')).toBe(true);
  });

  it('mentions JSON and the three output fields (required by Groq JSON mode)', () => {
    const prompt = buildSystemPrompt('PERFIL');

    for (const word of ['JSON', '"reply"', '"substantive"', '"recruiterIntent"']) {
      expect(prompt).toContain(word);
    }
  });

  it('falls back to the built-in CV while the context is empty (until fase 3)', () => {
    const prompt = buildSystemPrompt('  ');

    expect(prompt).toContain('EXPERIENCIA');
    expect(prompt).toContain('Caramel Point');
  });

  it('uses the given context instead of the built-in CV', () => {
    expect(buildSystemPrompt('PERFIL\nDatos de prueba')).not.toContain('Caramel Point');
  });
});
