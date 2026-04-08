import { version as packageVersion } from '../../package.json'

/**
 * <zh/> 组件对外暴露的版本号语义化类型，作为 `ADV_TABLE_VERSION` 的文档型别名。
 * <zh/> 实际取值由 package.json 的 version 字段在打包期注入，故此处仅约束为 string。
 * <en/> Semantic version type exposed by the component, serves as a documentation alias for `ADV_TABLE_VERSION`.
 * <en/> Actual value is injected from package.json's version field at build time, so it's only constrained to string here.
 */
export type TableVersion = string

/**
 * <zh/> 运行时版本常量，供 `defineExpose` 暴露实例版本。
 * <zh/> 具名导入 version 字段，打包器仅内联该字符串，不会引入整个 package.json。
 * <en/> Runtime version constant, exposed via `defineExpose` for instance version.
 * <en/> Named-imports the version field so bundlers inline only that string, not the whole package.json.
 */
export const ADV_TABLE_VERSION = packageVersion
