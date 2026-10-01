// ESLint flat config dùng chung cho backend/ và frontend/ (chạy từ trong từng thư mục: `npm run lint`,
// tức `eslint -c ../eslint.config.mjs .`). Toolchain cài ở package.json GỐC vì typescript-eslint cần
// TypeScript JS API (typescript@5.x) còn backend/frontend dùng TypeScript 7 native (không có JS API).
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/src/generated/**', 'data/**', 'public/**', '*.config.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Tên bắt đầu bằng _ là cố ý bỏ qua.
      // Nợ có sẵn từ trước khi có ESLint: hạ xuống warn để CI không đỏ; sửa dần rồi nâng lại thành error.
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-control-regex': 'warn',
      'no-irregular-whitespace': 'warn',
      'no-useless-escape': 'warn',
      'prefer-const': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Quy tắc mới của eslint-plugin-react-hooks v6+ (React Compiler): code hiện tại vi phạm nhiều chỗ -> warn.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
);
