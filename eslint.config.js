import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'public/vendor/', 'tmp/', 'playwright-report/', 'test-results/'] },
  ...tseslint.configs.recommended,
);
