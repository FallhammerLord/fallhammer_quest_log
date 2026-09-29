import js from '@eslint/js';
import globals from 'globals';

export default [
   js.configs.recommended,
   { rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
   {
      files: ['src/**/*.js'],
      languageOptions: {
         ecmaVersion: 'latest',
         sourceType: 'module',
         globals: {
            ...globals.browser,
            foundry: 'readonly',
            game: 'readonly',
            ui: 'readonly',
            Hooks: 'readonly',
            CONFIG: 'readonly',
            CONST: 'readonly',
            Folder: 'readonly',
            JournalEntry: 'readonly',
            JournalEntryPage: 'readonly',
            fromUuid: 'readonly',
            fromUuidSync: 'readonly',
            ChatMessage: 'readonly'
         }
      }
   },
   {
      files: ['tools/**/*.mjs'],
      languageOptions: { globals: globals.node }
   }
];
