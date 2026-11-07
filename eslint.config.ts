import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/', 'coverage/', 'src/generated/']),

  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Fastify handlers are idiomatically async (return value = payload), with or without await.
      '@typescript-eslint/require-await': 'off',
      // verbatimModuleSyntax requires type-only imports to be marked as such.
      '@typescript-eslint/consistent-type-imports': 'error',
      // Unused args prefixed with _ are intentional (e.g. Fastify hooks signatures).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Last: turns off every stylistic rule that Prettier owns.
  prettier,
);
