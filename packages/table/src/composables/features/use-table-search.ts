import type { ComponentPublicInstance, ComputedRef, Ref, ShallowRef } from 'vue'
import type { FormField } from '../../components/search/types'
import type { AdvColumn, ProcessedColumn } from '../../types'
import type { SearchConfig } from '../../types/config'
import type { Translator } from '../../types/translator'
import { computed, ref, shallowRef, watch } from 'vue'
import { traverseLeafColumns } from '../../utils/column-tree'
import { columnsToSearchFields } from '../../utils/create-search-fields'

/**
 * <zh/> useTableSearch 配置选项
 * <en/> useTableSearch configuration options
 *
 * @remarks
 * <zh/> 表格搜索 Composable 的配置参数，涵盖搜索字段自动生成、默认值、搜索提交与重置回调
 * <en/> Configuration parameters for the table search composable, covering search field auto-generation, default values, search submit and reset callbacks
 */
export interface UseTableSearchOptions<T = any> {
  /** <zh/> 已处理的列（localColumns），用于自动生成搜索字段 | <en/> Processed columns (localColumns), used for auto-generating search fields */
  columns: () => ProcessedColumn[]
  /** <zh/> 原始列（props.columns），用于应用列的 search.transform | <en/> Raw columns (props.columns), used for applying column's search.transform */
  rawColumns: () => AdvColumn<T>[]
  /** <zh/> 来自 props.search 的搜索配置 | <en/> Search config from props.search */
  searchConfig: () => SearchConfig | undefined
  /** <zh/> 搜索表单字段的默认值 | <en/> Default values for search form fields */
  defaultValues: () => Record<string, any> | undefined
  /** <zh/> 是否通过配置显式启用搜索 | <en/> Whether search is explicitly enabled via config */
  searchEnabled: () => boolean | undefined
  /** 是否有任一列的 search 配置为 true */
  hasColumnSearch: () => boolean
  /** <zh/> i18n 翻译函数 | <en/> i18n translation function */
  translation: Translator
  /** 用户提交搜索时调用（参数已完成 transform） */
  onSearch: (params: Record<string, any>) => void
  /** <zh/> 用户重置表单时调用 | <en/> Called when the user resets the form */
  onReset: (params: Record<string, any>) => void
  /**
   * 外部 searchParams ref — 提供时，useTableSearch 写入此 ref 而非自建，
   * 消除调用方的前向声明模式。
   *
   * External searchParams ref — when provided, useTableSearch writes into this ref
   * instead of creating its own, eliminating the need for forward-declaration patterns
   * in the caller.
   */
  searchParamsRef?: ShallowRef<Record<string, any>>
}

/**
 * <zh/> useTableSearch 返回值
 *
 * 提供搜索表单的模板引用、搜索参数、搜索字段列表以及搜索提交/重置操作方法。
 * <en/> useTableSearch return value
 * <en/> Provides search form template ref, search params, search field list, and search submit/reset methods.
 */
export interface UseTableSearchReturn {
  /** <zh/> <TableSearch> 组件的模板引用 | <en/> Template ref of <TableSearch> component */
  tableSearchRef: Ref<ComponentPublicInstance | null>
  /** <zh/> 搜索表单参数（响应式对象，用于 v-model 绑定） | <en/> Search form params (reactive object, for v-model binding) */
  searchParams: ShallowRef<Record<string, any>>
  /** <zh/> 是否应渲染搜索区域 | <en/> Whether to render the search area */
  hasSearch: ComputedRef<boolean>
  /** <zh/> 合并后的搜索字段列表（自动生成 + 自定义） | <en/> Merged search field list (auto-generated + custom) */
  mergedSearchFields: ComputedRef<FormField[]>
  /** <zh/> 处理搜索提交 — 应用列 transform、重置到第 1 页 | <en/> Handle search submit — apply column transform, reset to page 1 */
  handleSearch: (params: Record<string, any>) => void
  /** <zh/> 获取当前搜索表单值 | <en/> Get current search form values */
  getQueryFormModel: () => Record<string, any>
  /** <zh/> 设置搜索表单值，可选是否触发搜索 | <en/> Set search form values, optionally trigger search */
  setQueryFormModel: (values: Record<string, any>, triggerSearch?: boolean) => void
  /** <zh/> 重置搜索表单为默认值 | <en/> Reset search form to default values */
  handleReset: () => void
}

/**
 * 表格搜索 Composable
 *
 * 管理搜索表单的字段生成、参数双向绑定、搜索提交与重置。
 * 自动从列配置生成搜索字段，支持通过 searchConfig 自定义字段覆盖与扩展。
 * 提交搜索时逐一应用列级 search.transform，转换后的参数通过 onSearch 回调解发。
 *
 * Table search composable.
 * Manages search form field generation, two-way parameter binding, submit and reset.
 * Auto-generates search fields from column config, with support for custom field overrides
 * via searchConfig. Applies column-level search.transform on submit before emitting onSearch.
 *
 * @param options - 配置选项
 * @returns 搜索表单引用、参数、字段列表及操作方法
 */
export function useTableSearch<T = any>(
  options: UseTableSearchOptions<T>,
): UseTableSearchReturn {
  const {
    columns: columnsProp,
    rawColumns,
    searchConfig,
    defaultValues,
    searchEnabled,
    hasColumnSearch,
    translation: t,
    onSearch,
    onReset,
  } = options

  const tableSearchRef = ref<ComponentPublicInstance | null>(null)

  const searchParams = options.searchParamsRef ?? shallowRef<Record<string, any>>({})

  /**
   * <zh/> defaultValues 语义：首次应用整包为初始值；后续变化仅补齐用户未提供的键，
   * <zh/> 绝不覆盖用户已填值（旧行为每次 watch 都整包替换，异步更新 defaultValues 会冲掉用户输入）。
   * <en/> defaultValues semantics: the first application seeds the whole object; later changes
   * <en/> only fill keys the user hasn't set, never overwriting user input (the old watch
   * <en/> replaced the object wholesale, so async defaultValues updates clobbered the form).
   */
  let defaultValuesApplied = false
  watch(
    () => defaultValues(),
    (vals) => {
      if (!vals || Object.keys(vals).length === 0)
        return
      if (!defaultValuesApplied) {
        searchParams.value = { ...vals }
        defaultValuesApplied = true
        return
      }
      const missing: Record<string, any> = {}
      for (const [k, v] of Object.entries(vals)) {
        if (searchParams.value[k] === undefined)
          missing[k] = v
      }
      if (Object.keys(missing).length > 0)
        searchParams.value = { ...missing, ...searchParams.value }
    },
    { immediate: true },
  )

  const resolvedSearchEnabled = computed(
    () => searchEnabled() ?? hasColumnSearch(),
  )

  const searchFields = computed<FormField[]>(() => {
    if (!resolvedSearchEnabled.value)
      return []
    return columnsToSearchFields((columnsProp() ?? []), t)
  })

  const mergedSearchFields = computed(() => {
    const autoFields = searchFields.value
    const customFields = searchConfig()?.fields ?? []

    if (customFields.length === 0)
      return autoFields

    const customMap = new Map(customFields.map(f => [f.prop, f]))

    const merged: FormField[] = []

    autoFields.forEach((autoField: FormField) => {
      const customField = customMap.get(autoField.prop)
      if (customField) {
        customMap.delete(autoField.prop)
        merged.push({
          ...autoField,
          ...customField,
          componentProps: { ...autoField.componentProps, ...customField.componentProps },
          itemProps: { ...autoField.itemProps, ...customField.itemProps },
        })
      }
      else {
        merged.push(autoField)
      }
    })

    customMap.forEach((cf) => {
      merged.push(cf)
    })

    return merged.sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
  })

  // 列级 search.defaultValue → 合并到 searchParams（优先级低于 search.defaultValues） | Column-level search.defaultValue → merge into searchParams (lower priority than search.defaultValues)
  watch(
    mergedSearchFields,
    (fields) => {
      if (fields.length === 0)
        return
      const fieldDefaults: Record<string, any> = {}
      for (const field of fields) {
        if (field.defaultValue !== undefined && searchParams.value[field.prop] === undefined) {
          fieldDefaults[field.prop] = field.defaultValue
        }
      }
      if (Object.keys(fieldDefaults).length > 0) {
        searchParams.value = { ...fieldDefaults, ...searchParams.value }
      }
    },
    { immediate: true },
  )

  const hasSearch = computed(() => {
    return resolvedSearchEnabled.value && mergedSearchFields.value.length > 0
  })

  function handleSearch(params: Record<string, any>) {
    const transformed = { ...params }
    const cols = rawColumns()
    if (cols?.length) {
      traverseLeafColumns(cols, (col) => {
        const colSearch = col.search
        if (colSearch && typeof colSearch === 'object' && colSearch.transform) {
          const prop = col.prop as string | undefined
          if (prop && prop in transformed && transformed[prop] !== undefined && transformed[prop] !== '') {
            transformed[prop] = colSearch.transform(transformed[prop])
          }
        }
      })
    }
    searchParams.value = transformed
    onSearch(transformed)
  }

  function getQueryFormModel(): Record<string, any> {
    return { ...searchParams.value }
  }

  function setQueryFormModel(values: Record<string, any>, triggerSearch = false) {
    searchParams.value = { ...values }
    if (triggerSearch) {
      handleSearch(searchParams.value)
    }
  }

  function handleReset() {
    // <zh/> 与初始化同口径：defaultValues 整包 + 列级 field.defaultValue 低优补缺。
    // <en/> Same caliber as init: defaultValues as the whole base, column-level field.defaultValue
    // <en/> fills the gaps at lower priority.
    const reset: Record<string, any> = { ...(defaultValues() ?? {}) }
    for (const field of mergedSearchFields.value) {
      if (field.defaultValue !== undefined && reset[field.prop] === undefined)
        reset[field.prop] = field.defaultValue
    }
    searchParams.value = reset
    onReset(searchParams.value)
  }

  return {
    tableSearchRef,
    searchParams,
    hasSearch,
    mergedSearchFields,
    handleSearch,
    getQueryFormModel,
    setQueryFormModel,
    handleReset,
  }
}
