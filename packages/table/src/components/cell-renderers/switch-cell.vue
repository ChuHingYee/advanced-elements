<!--
  @component SwitchCell
  @displayName 开关单元格
  @displayName Switch Cell
  @description <zh/> 基于 ElSwitch 封装的开关单元格渲染组件，支持自定义开关文字描述
  @description <en/> Switch cell renderer based on ElSwitch, supports custom on/off text
  @category 数据展示 | Data Display
  @extends ElSwitch
  @since 1.0.0
-->
<script setup lang="ts">
import { ElSwitch } from 'element-plus'

interface Props {
  /** <zh/> 开关值 | <en/> Switch value */
  value?: boolean | string | number
  /** <zh/> 开关打开时的文字描述 | <en/> Text when switch is on */
  activeText?: string
  /** <zh/> 开关关闭时的文字描述 | <en/> Text when switch is off */
  inactiveText?: string
  /** <zh/> 单元格原始数据，未传 value 时按其真值作为开关值 | <en/> Raw cell data; used as the switch value by truthiness when value is not provided */
  cellData: unknown
}

defineProps<Props>()
</script>

<template>
  <ElSwitch
    :model-value="!!(value ?? !!cellData)"
    :active-text="activeText"
    :inactive-text="inactiveText"
    readonly
  />
</template>
