/**
 * <zh/> 文档 demo 的全局组件名派生规则——`table/basic.vue` → `DemoTableBasic`
 * <zh/> 容器插件（构建期产出标签名）与主题（运行期注册组件）共用本函数，两侧口径必须一致
 * <en/> Global component-name derivation for doc demos — `table/basic.vue` → `DemoTableBasic`.
 * <en/> Shared by the container plugin (emits the tag at build time) and the theme (registers the
 * <en/> component at runtime); both sides must agree.
 * @param id <zh/> demo 标识：容器内写的 `table/basic.vue`，或 `import.meta.glob` 产出的 `/examples/table/basic.vue` | <en/> Demo id: `table/basic.vue` as written in the container, or a glob key like `/examples/table/basic.vue`
 * @returns <zh/> 形如 `DemoTableBasic` 的全局组件名 | <en/> Global component name such as `DemoTableBasic`
 */
export function demoComponentName(id) {
  const relative = String(id).replace(/^.*\/examples\//, '').replace(/\.vue$/, '')
  const pascal = relative
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('')
  return `Demo${pascal}`
}