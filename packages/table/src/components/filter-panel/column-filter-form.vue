<!--
  @component ColumnFilterForm
  @displayName 列筛选表单
  @displayName Column Filter Form
  @description <zh/> 根据列筛选类型（text/number/date/enum）渲染对应的筛选 UI，支持复合条件（And/Or）、枚举搜索过滤、日期范围选择
  @description <en/> Renders filter UI based on column filter type (text/number/date/enum), supports compound conditions (And/Or), enum search filter, date range selection
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="ts" setup>
import type { ShallowRef } from 'vue'
import type { EnumFilterOption } from '../../types/column'
import type { ColumnFilterType, ColumnFilterValue, DateFilterValue, EnumFilterValue, NumberFilterValue, NumberOperator, TextFilterValue, TextOperator } from '../../types/filter'
import { ElCheckbox, ElCheckboxGroup, ElDatePicker, ElInput, ElInputNumber, ElOption, ElRadio, ElRadioGroup, ElSelect, ElSpace } from 'element-plus'
import { cloneDeep } from 'lodash-es'
import { computed, ref, shallowRef, watch } from 'vue'
import { createDefaultFilterValue } from '../../composables/data/use-column-filter'
import { getFilterStrategy } from '../../composables/features/filter-registry'
import { useConditionGroup } from '../../composables/features/use-filter-condition-group'
import { deriveCheckStatus } from '../../utils/checkbox-state'
import FilterActions from './filter-actions.vue'

const props = defineProps<{
  columnKey: string
  filterType: ColumnFilterType
  enumOptions?: EnumFilterOption[] | (() => EnumFilterOption[])
  active: boolean
  t: (key: string) => string
  inline?: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'reset'): void
}>()

/** <zh/> 筛选值（v-model 双向绑定） | <en/> Filter value (v-model two-way binding) */
const modelValue = defineModel<ColumnFilterValue>()

const draft = shallowRef<ColumnFilterValue>(cloneDeep(modelValue.value ?? createDefaultFilterValue(props.filterType)))

/**
 * <zh/> 外部值同步（含清空）——无条件覆盖草稿：父清空为 undefined/null 时回退到
 * <zh/> 当前类型的默认值，避免 `if (filterValue)` 丢弃 falsy 导致草稿残留旧值。
 * <en/> External value sync (including clears) — overwrite the draft unconditionally:
 * <en/> when the parent clears to undefined/null, fall back to the current type's default
 * <en/> instead of dropping the falsy value and leaving a stale draft.
 */
watch(() => modelValue.value, (filterValue) => {
  draft.value = cloneDeep(filterValue ?? createDefaultFilterValue(props.filterType))
})

/**
 * <zh/> 筛选类型切换时重置草稿形状——如列 `text → number`，旧形状确认后会写回脏值。
 * <en/> Reset the draft shape when the filter type changes — e.g. column `text → number`,
 * <en/> otherwise the stale shape would be written back as a dirty value on confirm.
 */
watch(() => props.filterType, (filterType) => {
  draft.value = createDefaultFilterValue(filterType)
})

function handleConfirm() {
  modelValue.value = cloneDeep(draft.value)
  emit('confirm')
}

function handleReset() {
  draft.value = createDefaultFilterValue(props.filterType)
  modelValue.value = cloneDeep(draft.value)
  emit('reset')
}

const textOperators = computed(() => [
  { label: props.t('table.filter.contains') || 'Contains', value: 'contains' as const },
  { label: props.t('table.filter.notContains') || 'Does not contain', value: 'notContains' as const },
  { label: props.t('table.filter.equals') || 'Equals', value: 'equals' as const },
  { label: props.t('table.filter.notEquals') || 'Does not equal', value: 'notEquals' as const },
  { label: props.t('table.filter.beginsWith') || 'Begins with', value: 'beginsWith' as const },
  { label: props.t('table.filter.endsWith') || 'Ends with', value: 'endsWith' as const },
  { label: props.t('table.filter.blank') || 'Blank', value: 'blank' as const },
  { label: props.t('table.filter.notBlank') || 'Not blank', value: 'notBlank' as const },
])

const {
  needsInput: needsTextInput,
  hasSecondCondition: hasTextSecondCondition,
  setOperator: _setTextOperator,
  setConditionLogic: setTextConditionLogic,
  setSecondOperator: _setTextSecondOperator,
  needsSecondInput: needsTextSecondInput,
} = useConditionGroup<{ operator: TextOperator, value?: string }>(
  draft as ShallowRef<ColumnFilterValue>,
  'text',
  () => ({ operator: 'contains', value: undefined }),
  computed(() => props.filterType),
)

function setTextOperator(op: TextOperator) {
  _setTextOperator(op)
}
function setTextSecondOperator(op: TextOperator) {
  _setTextSecondOperator(op)
}

function updateTextValue(inputValue: string) {
  const textDraft = draft.value as TextFilterValue
  draft.value = { ...textDraft, value: inputValue || undefined }
}

function updateTextSecondValue(inputValue: string) {
  const textDraft = draft.value as TextFilterValue
  if (textDraft.conditions) {
    draft.value = { ...textDraft, conditions: { ...textDraft.conditions, condition: { ...textDraft.conditions.condition, value: inputValue || undefined } } }
  }
}

const numberOperators = computed(() => [
  { label: props.t('table.filter.eq') || '=', value: 'eq' as const },
  { label: props.t('table.filter.neq') || '≠', value: 'neq' as const },
  { label: props.t('table.filter.gt') || '>', value: 'gt' as const },
  { label: props.t('table.filter.gte') || '≥', value: 'gte' as const },
  { label: props.t('table.filter.lt') || '<', value: 'lt' as const },
  { label: props.t('table.filter.lte') || '≤', value: 'lte' as const },
  { label: props.t('table.filter.between') || '~', value: 'between' as const },
  { label: props.t('table.filter.blank') || 'Blank', value: 'blank' as const },
  { label: props.t('table.filter.notBlank') || 'Not blank', value: 'notBlank' as const },
])

const {
  needsInput: needsPrimaryInput,
  hasSecondCondition,
  setOperator: _setNumberOperator,
  setConditionLogic,
  setSecondOperator: _setSecondOperator,
  needsSecondInput,
} = useConditionGroup<{ operator: NumberOperator, value?: number, min?: number, max?: number }>(
  draft as ShallowRef<ColumnFilterValue>,
  'number',
  () => ({ operator: 'eq', value: undefined, min: undefined, max: undefined }),
  computed(() => props.filterType),
)

function setNumberOperator(op: NumberOperator) {
  _setNumberOperator(op)
}
function setSecondOperator(op: NumberOperator) {
  _setSecondOperator(op)
}

function updateNumberValue(inputValue: number | undefined) {
  const numberDraft = draft.value as NumberFilterValue
  draft.value = { ...numberDraft, value: inputValue }
}
function updateNumberMin(inputValue: number | undefined) {
  const numberDraft = draft.value as NumberFilterValue
  draft.value = { ...numberDraft, min: inputValue }
}
function updateNumberMax(inputValue: number | undefined) {
  const numberDraft = draft.value as NumberFilterValue
  draft.value = { ...numberDraft, max: inputValue }
}
function updateSecondNumberValue(inputValue: number | undefined) {
  const numberDraft = draft.value as NumberFilterValue
  if (numberDraft.conditions) {
    draft.value = { ...numberDraft, conditions: { ...numberDraft.conditions, condition: { ...numberDraft.conditions.condition, value: inputValue } } }
  }
}
function updateSecondNumberMin(inputValue: number | undefined) {
  const numberDraft = draft.value as NumberFilterValue
  if (numberDraft.conditions) {
    draft.value = { ...numberDraft, conditions: { ...numberDraft.conditions, condition: { ...numberDraft.conditions.condition, min: inputValue } } }
  }
}
function updateSecondNumberMax(inputValue: number | undefined) {
  const numberDraft = draft.value as NumberFilterValue
  if (numberDraft.conditions) {
    draft.value = { ...numberDraft, conditions: { ...numberDraft.conditions, condition: { ...numberDraft.conditions.condition, max: inputValue } } }
  }
}

const dateOperators = computed(() => [
  // <zh/> 相对快捷项置前——零输入即可命中高频时间窗
  // <en/> Relative quick ops first — zero-input access to high-frequency time windows
  { label: props.t('table.filter.today') || 'Today', value: 'today' as const },
  { label: props.t('table.filter.thisWeek') || 'This week', value: 'thisWeek' as const },
  { label: props.t('table.filter.thisMonth') || 'This month', value: 'thisMonth' as const },
  { label: props.t('table.filter.before') || 'Before', value: 'before' as const },
  { label: props.t('table.filter.after') || 'After', value: 'after' as const },
  { label: props.t('table.filter.between') || '~', value: 'between' as const },
])

function setDateOperator(operator: DateFilterValue['operator']) {
  const dateDraft = draft.value as DateFilterValue
  draft.value = { ...dateDraft, operator, value: undefined, startDate: undefined, endDate: undefined }
}

function handleDateChange(dateValue: string | Date | undefined) {
  const dateDraft = draft.value as DateFilterValue
  if (!dateValue) {
    draft.value = { ...dateDraft, value: undefined }
    return
  }
  const isoDateString = typeof dateValue === 'string' ? dateValue : `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`
  draft.value = { ...dateDraft, value: isoDateString }
}

function handleDateRangeChange(rangeValue: [string | Date, string | Date] | undefined) {
  const dateDraft = draft.value as DateFilterValue
  if (!rangeValue) {
    draft.value = { ...dateDraft, startDate: undefined, endDate: undefined }
    return
  }
  const toDateString = (v: string | Date) => typeof v === 'string' ? v : `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  draft.value = {
    ...dateDraft,
    startDate: rangeValue[0] ? toDateString(rangeValue[0]) : undefined,
    endDate: rangeValue[1] ? toDateString(rangeValue[1]) : undefined,
  }
}

const dateRangeValue = computed<string[] | undefined>(() => {
  const dateDraft = draft.value as DateFilterValue
  if (dateDraft.startDate && dateDraft.endDate)
    return [dateDraft.startDate, dateDraft.endDate]
  return undefined
})

const enumSearchKeyword = ref('')

const resolvedEnumOptions = computed<EnumFilterOption[]>(() => {
  if (props.filterType !== 'enum')
    return []
  if (typeof props.enumOptions === 'function')
    return props.enumOptions()
  return props.enumOptions ?? []
})

const filteredEnumOptions = computed(() => {
  if (!enumSearchKeyword.value)
    return resolvedEnumOptions.value
  const keyword = enumSearchKeyword.value.toLowerCase()
  return resolvedEnumOptions.value.filter(opt =>
    String(opt.label).toLowerCase().includes(keyword)
    || String(opt.value).toLowerCase().includes(keyword),
  )
})

const allFilteredValues = computed(() => filteredEnumOptions.value.map(opt => opt.value))

const selectedSet = computed(() => new Set((draft.value as EnumFilterValue).selected))

const checkStatus = computed(() => {
  const total = allFilteredValues.value.length
  const selectedCount = allFilteredValues.value.filter(v => selectedSet.value.has(v)).length
  return deriveCheckStatus(selectedCount, total)
})
const isAllSelected = computed(() => checkStatus.value.isAllSelected)
const isIndeterminate = computed(() => checkStatus.value.isIndeterminate)

function handleSelectAll(checkboxValue: string | number | boolean) {
  const isChecked = checkboxValue === true
  const currentSelected = [...(draft.value as EnumFilterValue).selected]
  if (isChecked) {
    for (const filterValue of allFilteredValues.value) {
      if (!selectedSet.value.has(filterValue))
        currentSelected.push(filterValue)
    }
  }
  else {
    const filteredSet = new Set(allFilteredValues.value)
    const remaining = currentSelected.filter(filterValue => !filteredSet.has(filterValue))
    draft.value = { type: 'enum', selected: remaining }
    return
  }
  draft.value = { type: 'enum', selected: currentSelected }
}

function setEnumSelected(selected: (string | number)[]) {
  draft.value = { type: 'enum', selected }
}

watch(() => props.active, (active) => {
  if (active && props.filterType === 'enum') {
    enumSearchKeyword.value = ''
    const enumDraft = draft.value as EnumFilterValue
    if (enumDraft.selected.length === 0 && resolvedEnumOptions.value.length > 0) {
      draft.value = { type: 'enum', selected: resolvedEnumOptions.value.map(opt => opt.value) }
    }
  }
}, { immediate: true })

const textDraft = computed(() => draft.value as TextFilterValue)
const numberDraft = computed(() => draft.value as NumberFilterValue)
const dateDraft = computed(() => draft.value as DateFilterValue)
const enumDraft = computed(() => draft.value as EnumFilterValue)

const textConditions = computed(() => textDraft.value.conditions)
const numberConditions = computed(() => numberDraft.value.conditions)

// ── ElSelect @change 适配层：将联合类型安全转型后委托给内部 setter ──────────
/** <zh/> 文本操作符选择变更 | <en/> Text operator select change */
function handleTextOperatorChange(val: string | number | boolean | undefined): void {
  setTextOperator(val as TextOperator)
}

/** <zh/> 文本条件逻辑选择变更 | <en/> Text condition logic select change */
function handleTextLogicChange(val: string | number | boolean | undefined): void {
  setTextConditionLogic(val as 'and' | 'or')
}

/** <zh/> 文本第二操作符选择变更 | <en/> Text second operator select change */
function handleTextSecondOperatorChange(val: string | number | boolean | undefined): void {
  setTextSecondOperator(val as TextOperator)
}

/** <zh/> 数字操作符选择变更 | <en/> Number operator select change */
function handleNumberOperatorChange(val: string | number | boolean | undefined): void {
  setNumberOperator(val as NumberOperator)
}

/** <zh/> 数字条件逻辑选择变更 | <en/> Number condition logic select change */
function handleNumberLogicChange(val: string | number | boolean | undefined): void {
  setConditionLogic(val as 'and' | 'or')
}

/** <zh/> 数字第二操作符选择变更 | <en/> Number second operator select change */
function handleNumberSecondOperatorChange(val: string | number | boolean | undefined): void {
  setSecondOperator(val as NumberOperator)
}

/** <zh/> 日期操作符选择变更 | <en/> Date operator select change */
function handleDateOperatorChange(val: string | number | boolean | undefined): void {
  setDateOperator(val as DateFilterValue['operator'])
}

/**
 * <zh/> 自定义筛选类型的面板 UI——从策略注册表解析 filterPanelComponent。
 * <zh/> 内置四种类型命中硬编码模板分支，不会走到此处；仅自定义类型消费此能力。
 * <zh/> 组件契约：props { value, columnKey }，emit 'update:value' 回写草稿值；
 * <zh/> 确认/重置仍由本组件统一处理（draft/modelValue），自定义 UI 无需感知。
 * <en/> Custom filter type panel UI — resolves filterPanelComponent from the strategy registry.
 * <en/> The four builtin types hit hardcoded template branches and never reach here; only custom types consume this.
 * <en/> Component contract: props { value, columnKey }, emit 'update:value' to write back draft;
 * <en/> confirm/reset remain centralized here (draft/modelValue) — custom UIs need no awareness.
 */
const customPanelStrategy = computed(() => {
  const strategy = getFilterStrategy(props.filterType)
  return strategy?.filterPanelComponent ? strategy : undefined
})
</script>

<template>
  <div
    v-if="filterType === 'text'"
    class="adv-table-filter-panel"
  >
    <ElSelect
      :model-value="textDraft.operator"
      size="small"
      :teleported="false"
      @change="handleTextOperatorChange"
    >
      <ElOption
        v-for="operatorOption in textOperators"
        :key="operatorOption.value"
        :label="operatorOption.label"
        :value="operatorOption.value"
      />
    </ElSelect>
    <ElInput
      v-if="needsTextInput"
      :model-value="textDraft.value"
      :placeholder="t('table.filter.textPlaceholder') || 'Value...'"
      clearable
      size="small"
      @update:model-value="updateTextValue"
    />

    <template v-if="hasTextSecondCondition && textConditions">
      <ElRadioGroup
        :model-value="textConditions.logic"
        size="small"
        class="adv-table-filter-panel__logic"
        @change="handleTextLogicChange"
      >
        <ElRadio value="and">
          {{ t('table.filter.and') || 'And' }}
        </ElRadio>
        <ElRadio value="or">
          {{ t('table.filter.or') || 'Or' }}
        </ElRadio>
      </ElRadioGroup>
      <ElSelect
        :model-value="textConditions.condition.operator"
        size="small"
        :teleported="false"
        @change="handleTextSecondOperatorChange"
      >
        <ElOption
          v-for="operatorOption in textOperators"
          :key="operatorOption.value"
          :label="operatorOption.label"
          :value="operatorOption.value"
        />
      </ElSelect>
      <ElInput
        v-if="needsTextSecondInput"
        :model-value="textConditions.condition.value"
        :placeholder="t('table.filter.textPlaceholder') || 'Value...'"
        clearable
        size="small"
        @update:model-value="updateTextSecondValue"
      />
    </template>

    <FilterActions
      :t="t"
      @reset="handleReset"
      @confirm="handleConfirm"
    />
  </div>

  <div
    v-else-if="filterType === 'number'"
    class="adv-table-filter-panel"
  >
    <ElSelect
      :model-value="numberDraft.operator"
      size="small"
      :teleported="false"
      @change="handleNumberOperatorChange"
    >
      <ElOption
        v-for="operatorOption in numberOperators"
        :key="operatorOption.value"
        :label="operatorOption.label"
        :value="operatorOption.value"
      />
    </ElSelect>
    <div
      v-if="needsPrimaryInput"
      class="adv-table-filter-panel__number-inputs"
    >
      <template v-if="numberDraft.operator === 'between'">
        <ElInputNumber
          :model-value="numberDraft.min"
          :placeholder="t('table.filter.min') || 'Min'"
          size="small"
          controls-position="right"
          @update:model-value="updateNumberMin"
        />
        <span class="adv-table-filter-panel__separator">—</span>
        <ElInputNumber
          :model-value="numberDraft.max"
          :placeholder="t('table.filter.max') || 'Max'"
          size="small"
          controls-position="right"
          @update:model-value="updateNumberMax"
        />
      </template>
      <template v-else>
        <ElInputNumber
          :model-value="numberDraft.value"
          size="small"
          controls-position="right"
          @update:model-value="updateNumberValue"
        />
      </template>
    </div>

    <template v-if="hasSecondCondition && numberConditions">
      <ElRadioGroup
        :model-value="numberConditions.logic"
        size="small"
        class="adv-table-filter-panel__logic"
        @change="handleNumberLogicChange"
      >
        <ElRadio value="and">
          {{ t('table.filter.and') || 'And' }}
        </ElRadio>
        <ElRadio value="or">
          {{ t('table.filter.or') || 'Or' }}
        </ElRadio>
      </ElRadioGroup>
      <ElSelect
        :model-value="numberConditions.condition.operator"
        size="small"
        :teleported="false"
        @change="handleNumberSecondOperatorChange"
      >
        <ElOption
          v-for="operatorOption in numberOperators"
          :key="operatorOption.value"
          :label="operatorOption.label"
          :value="operatorOption.value"
        />
      </ElSelect>
      <div
        v-if="needsSecondInput"
        class="adv-table-filter-panel__number-inputs"
      >
        <template v-if="numberConditions.condition.operator === 'between'">
          <ElInputNumber
            :model-value="numberConditions.condition.min"
            :placeholder="t('table.filter.min') || 'Min'"
            size="small"
            controls-position="right"
            @update:model-value="updateSecondNumberMin"
          />
          <span class="adv-table-filter-panel__separator">—</span>
          <ElInputNumber
            :model-value="numberConditions.condition.max"
            :placeholder="t('table.filter.max') || 'Max'"
            size="small"
            controls-position="right"
            @update:model-value="updateSecondNumberMax"
          />
        </template>
        <template v-else>
          <ElInputNumber
            :model-value="numberConditions.condition.value"
            size="small"
            controls-position="right"
            @update:model-value="updateSecondNumberValue"
          />
        </template>
      </div>
    </template>

    <FilterActions
      :t="t"
      @reset="handleReset"
      @confirm="handleConfirm"
    />
  </div>

  <div
    v-else-if="filterType === 'date'"
    class="adv-table-filter-panel"
  >
    <ElSelect
      :model-value="dateDraft.operator"
      size="small"
      :teleported="false"
      @change="handleDateOperatorChange"
    >
      <ElOption
        v-for="operatorOption in dateOperators"
        :key="operatorOption.value"
        :label="operatorOption.label"
        :value="operatorOption.value"
      />
    </ElSelect>
    <div class="adv-table-filter-panel__date-inputs">
      <template v-if="dateDraft.operator === 'between'">
        <ElDatePicker
          type="daterange"
          :model-value="dateRangeValue"
          size="small"
          range-separator="—"
          :start-placeholder="t('table.filter.startDate') || 'Start date'"
          :end-placeholder="t('table.filter.endDate') || 'End date'"
          :teleported="false"
          value-format="YYYY-MM-DD"
          class="adv-table-filter-panel__date-picker"
          @update:model-value="handleDateRangeChange"
        />
      </template>
      <template v-else>
        <ElDatePicker
          :model-value="dateDraft.value"
          size="small"
          :placeholder="dateDraft.operator === 'before'
            ? (t('table.filter.beforePlaceholder') || 'Before date')
            : (t('table.filter.afterPlaceholder') || 'After date')"
          :teleported="false"
          value-format="YYYY-MM-DD"
          class="adv-table-filter-panel__date-picker"
          @update:model-value="handleDateChange"
        />
      </template>
    </div>
    <FilterActions
      :t="t"
      @reset="handleReset"
      @confirm="handleConfirm"
    />
  </div>

  <div
    v-else-if="filterType === 'enum'"
    class="adv-table-filter-panel"
  >
    <ElInput
      v-model="enumSearchKeyword"
      :placeholder="t('table.filter.filterPlaceholder') || 'Search options...'"
      clearable
      size="small"
      class="adv-table-filter-panel__enum-search"
    />
    <ElCheckbox
      :model-value="isAllSelected"
      :indeterminate="isIndeterminate"
      size="small"
      class="adv-table-filter-panel__select-all"
      @change="handleSelectAll"
    >
      {{ t('table.filter.selectAll') || 'Select all' }}
    </ElCheckbox>
    <ElCheckboxGroup
      :model-value="enumDraft.selected"
      @update:model-value="setEnumSelected"
    >
      <ElSpace
        v-if="filteredEnumOptions.length > 0"
        direction="vertical"
        :size="4"
        alignment="start"
      >
        <ElCheckbox
          v-for="opt in filteredEnumOptions"
          :key="String(opt.value)"
          :value="opt.value"
          :label="opt.label"
          size="small"
        />
      </ElSpace>
      <div
        v-else
        class="adv-table-filter-panel__no-matches"
      >
        {{ t('table.filter.noMatches') || 'No matches.' }}
      </div>
    </ElCheckboxGroup>
    <FilterActions
      :t="t"
      @reset="handleReset"
      @confirm="handleConfirm"
    />
  </div>
  <!-- <zh/> 自定义筛选类型面板 UI——必须消费 FilterStrategy.filterPanelComponent，否则自定义类型在面板中无 UI
       <en/> Custom filter type panel UI — must consume FilterStrategy.filterPanelComponent, otherwise custom types have no UI in the panel -->
  <component
    :is="customPanelStrategy!.filterPanelComponent"
    v-else-if="customPanelStrategy"
    :value="draft"
    :column-key="columnKey"
    @update:value="(v: any) => (draft = v)"
  />
</template>
