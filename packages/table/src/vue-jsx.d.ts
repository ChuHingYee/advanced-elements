/**
 * <zh/> 注册 Vue 全局 JSX 命名空间——Vue 3.5 起不再默认注册，包内 .tsx 须显式引入 `vue/jsx`，否则全包 TSX 报 TS7026（JSX.IntrinsicElements 缺失）。
 * <en/> Register Vue's global JSX namespace — no longer auto-registered since Vue 3.5; in-package .tsx files need an explicit `vue/jsx` import, otherwise every TSX file fails with TS7026 (missing JSX.IntrinsicElements).
 */
import 'vue/jsx'
