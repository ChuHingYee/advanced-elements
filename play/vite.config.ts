import { dirname, resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { AdvancedElementsResolver } from '@advanced-elements/resolvers'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'

const playDir = dirname(fileURLToPath(import.meta.url))
/** <zh/> 包源码目录（dev 别名用，绕过 dist 直连 src） | <en/> Package source dir (for dev aliases that bypass dist and link src directly) */
const pkgSrc = (name: string) => resolve(playDir, '../packages', name, 'src')

// https://vite.dev/config/
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // <zh/> vite 8.2 的 SassPreprocessorOptions 类型仍未收录 `api`（silenceDeprecations 经 sass 基类选项已覆盖）；指令必须紧贴 api 行，中间不可再加注释行，否则 TS2578。
        // <en/> vite 8.2's SassPreprocessorOptions types still lack `api` (silenceDeprecations is covered by sass base options); the directive must hug the api line with no comment lines between, or TS2578.
        // @ts-expect-error vite8 SassPreprocessorOptions lacks `api`
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    Components({
      resolvers: [AdvancedElementsResolver()],
    }),
  ],
  resolve: {
    alias: [
      // <zh/> dev 直连源码：play 仅调试用，裸导入指向各包 src/index.ts，改组件源码即 HMR，无需等 dist 构建；
      // <zh/> 精确锚定（^…$），子路径（如 table/style/index.scss）仍走各包 exports（本来就指向 src）。
      // <zh/> 发版正确性不依赖这里，由 pnpm build:all + release-verify 覆盖。
      // <en/> Dev links sources directly: play is debug-only, bare imports point at each package's
      // <en/> src/index.ts so editing component sources hot-reloads without waiting for dist builds;
      // <en/> exact anchors (^…$) leave subpaths (e.g. table/style/index.scss) to each package's
      // <en/> exports (which already point at src). Release correctness never depends on this —
      // <en/> pnpm build:all + release-verify cover that.
      { find: /^@advanced-elements\/table$/, replacement: resolve(pkgSrc('table'), 'index.ts') },
      { find: /^@advanced-elements\/config-provider$/, replacement: resolve(pkgSrc('config-provider'), 'index.ts') },
      { find: /^@advanced-elements\/elements$/, replacement: resolve(pkgSrc('elements'), 'index.ts') },
      // <zh/> auto-import 注入的样式副作用：table 的 bare style 入口在 exports 里指向 dist，
      // <zh/> dev 下重定向到源码 scss，保持与 exports["./style/index.scss"]（同样指 src）一致。
      // <en/> Style side effects injected by auto-import: table's bare style entries point at
      // <en/> dist in exports, so redirect them to source scss in dev, consistent with
      // <en/> exports["./style/index.scss"] (which also points at src).
      { find: /^@advanced-elements\/table\/style$/, replacement: resolve(pkgSrc('table'), 'style/index.scss') },
      // <zh/> 同上：TableDemo.vue 显式引用的 scss 子路径在 exports 里同样指向 dist（构建时复制的同内容副本），dev 下直连源码
      // <en/> Same as above: the scss subpath explicitly imported by TableDemo.vue also points at dist in exports (an identical copy made at build time); link source directly in dev
      { find: /^@advanced-elements\/table\/style\/index\.scss$/, replacement: resolve(pkgSrc('table'), 'style/index.scss') },
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
})
