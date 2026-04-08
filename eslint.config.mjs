import antfu from '@antfu/eslint-config'

export default antfu(
  {
    vue: true,
    typescript: true,
    rules: {
      'vue/no-unused-refs': 'off',
      'no-misleading-character-class': 'off',
      'regexp/no-unused-capturing-group': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'vue/max-attributes-per-line': [
        'warn',
        {
          singleline: 1,
          multiline: 1,
        },
      ],
    },
  },
  {
    ignores: ['**/*.md', '**/*.d.ts', 'docs/.vitepress/**', '**/dist/**', '**/.turbo/**', '**/coverage/**'],
  },
  // <zh/> pnpm 命名 catalog 例外：@types/node 双大版本共存是刻意的（根脚本跑 Node 22 类型，play 配 @tsconfig/node24），
  // <zh/> antfu 默认 `name-only` 会误报，改用 allow 白名单放行，其余包仍走去重检查
  // <en/> Intentional @types/node dual-major split (root scripts on Node 22 types, play on @tsconfig/node24);
  // <en/> allow-list it since antfu's default `name-only` duplicate check would false-positive, other packages stay checked
  {
    files: ['pnpm-workspace.yaml'],
    rules: {
      'pnpm/yaml-no-duplicate-catalog-item': ['error', { allow: ['@types/node'] }],
    },
  },
  // 通用表格层禁直接网络/全局状态依赖（数据经 request.source 回调注入；状态经 props/provide 传递）
  // <en/> Generic table layer: no direct network/global-state deps (data via request.source, state via props/provide)
  {
    files: ['packages/table/src/**/*.{ts,vue,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'axios', message: '[table] 通用层禁直接依赖 axios：数据经 request.source 回调注入。' },
          { name: 'pinia', message: '[table] 通用层禁直接依赖 pinia：状态经 props/provide 传递。' },
          { name: 'vuex', message: '[table] 通用层禁直接依赖 vuex：状态经 props/provide 传递。' },
        ],
        // <zh/> paths 只拦精确包名，子路径（如 pinia/dist/*）须由 patterns 补齐
        // <en/> paths only matches exact package names; subpaths (e.g. pinia/dist/*) need patterns
        patterns: [
          { group: ['axios/*'], message: '[table] 通用层禁直接依赖 axios 子路径：数据经 request.source 回调注入。' },
          { group: ['pinia/*'], message: '[table] 通用层禁直接依赖 pinia 子路径：状态经 props/provide 传递。' },
          { group: ['vuex/*'], message: '[table] 通用层禁直接依赖 vuex 子路径：状态经 props/provide 传递。' },
        ],
      }],
      'no-restricted-globals': ['error', {
        name: 'fetch',
        message: '[table] 通用层禁直接 fetch：数据经 request.source 回调注入。',
      }],
      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.name=\'fetch\']',
        message: '[table] 通用层禁直接 fetch：数据经 request.source 回调注入。',
      }, {
        // <zh/> window.fetch / globalThis.fetch 走成员调用，上条 callee.name 拦不住
        // <en/> window.fetch / globalThis.fetch are member calls the callee.name selector above cannot catch
        selector: 'CallExpression[callee.object.name=\'window\'][callee.property.name=\'fetch\']',
        message: '[table] 通用层禁直接 window.fetch：数据经 request.source 回调注入。',
      }, {
        selector: 'CallExpression[callee.object.name=\'globalThis\'][callee.property.name=\'fetch\']',
        message: '[table] 通用层禁直接 globalThis.fetch：数据经 request.source 回调注入。',
      }, {
        selector: 'CallExpression[callee.name=\'useStore\']',
        message: '[table] 通用层禁直接 useStore：状态经 props/provide 传递。',
      }],
    },
  },
)
