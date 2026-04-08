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
  // <zh/> 分层边界（COMPLEXITY-PLAN M2）：utils/types 是运行时叶子——禁止运行时上行引用
  // <zh/> composables/components；`import type` 编译期擦除放行（与 injection-keys.ts 头注释声明的
  // <zh/> 反向 type-only 豁免同理）。components→composables 是架构常态（39 个合法消费点），不设限。
  // <en/> Layer boundaries (COMPLEXITY-PLAN M2): utils/types are runtime leaves — runtime upward
  // <en/> imports of composables/components are banned; `import type` erases at compile time and
  // <en/> stays allowed (same type-only exemption as documented in injection-keys.ts, in reverse).
  // <en/> components→composables is the architecture norm (39 legitimate consumers), unrestricted.
  {
    files: ['packages/table/src/utils/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['../composables', '../composables/**', '../components', '../components/**'],
          message: '[table] utils 是运行时叶子：禁止运行时 import composables/components（import type 放行；类型需求放 types/ 或就地声明）。',
          allowTypeImports: true,
        }],
      }],
    },
  },
  {
    files: ['packages/table/src/types/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['../composables', '../composables/**', '../components', '../components/**'],
          message: '[table] types 只允许编译期依赖：禁止运行时 import composables/components（import type 放行，见 injection-keys.ts 头注释）。',
          allowTypeImports: true,
        }],
      }],
    },
  },
  // <zh/> play section 体积门禁（COMPLEXITY-PLAN 战线二终态）：单 section ≤400 行，防止巨石回填。
  // <zh/> SurfaceSection（API 全覆盖页）是刻意的单页速查手册，文件头豁免声明。
  // <en/> play section size gate (COMPLEXITY-Plan battle line 2 terminal state): one section ≤400 lines,
  // <en/> keeping the monolith from growing back. SurfaceSection (the API full-coverage page) is a
  // <en/> deliberate single-page cheat sheet and carries a header exemption.
  {
    files: ['play/src/views/table-demo/sections/**/*.vue'],
    rules: {
      // <zh/> antfu v9 起 vue 插件以 @ 别名注册（vue/max-lines 已自插件移除） | <en/> the vue plugin is aliased to @ under antfu v9 (vue/max-lines was dropped from the plugin)
      '@/max-lines': ['error', { max: 400 }],
    },
  },
  // <zh/> 唯一豁免：11.1 API 表面全覆盖页是刻意的单页速查手册（46 Props/5 v-model/53 Events/12 Slots/全量 Expose 逐项最小示例），拆分反而破坏速查价值 | <en/> Sole exemption: the 11.1 API full-coverage page is a deliberate single-page cheat sheet (per-item minimal examples for 46 props / 5 v-models / 53 events / 12 slots / every expose); splitting it would destroy its lookup value
  {
    files: ['play/src/views/table-demo/sections/api/SurfaceSection.vue'],
    rules: {
      '@/max-lines': 'off',
    },
  },
)
