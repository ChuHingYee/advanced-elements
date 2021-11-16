module.exports = {
  env: {
    browser: true,
    es2020: true,
    node: true,
    'jest/globals': true,
  },
  extends: ['eslint:recommended', 'plugin:vue/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
      tsx: true,
    },
  },
  plugins: ['vue', 'jest'],
  rules: {},
}
