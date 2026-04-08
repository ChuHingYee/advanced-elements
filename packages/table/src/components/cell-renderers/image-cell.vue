<!--
  @component ImageCell
  @displayName 图片单元格
  @displayName Image Cell
  @description <zh/> 基于 ElImage 封装的图片单元格渲染组件，支持图片预览功能
  @description <en/> Image cell renderer based on ElImage, supports image preview
  @category 数据展示 | Data Display
  @extends ElImage
  @since 1.0.0
-->
<script setup lang="ts">
import { ElImage } from 'element-plus'
import { computed } from 'vue'

interface ImageCellProps {
  /** <zh/> 图片地址 | <en/> Image URL */
  src?: string
  /** <zh/> 替代文本 | <en/> Alt text */
  alt?: string
  /** <zh/> 单元格原始数据（value-renderer 标准属性） | <en/> Raw cell data (value-renderer standard prop) */
  cellData: unknown
}

const props = defineProps<ImageCellProps>()

const emit = defineEmits<{
  /** <zh/> 点击事件 | <en/> Click event */
  click: [event: MouseEvent]
}>()

/** <zh/> 预览列表由 src/cellData 派生，computed 缓存以保持引用稳定 | <en/> Preview list derived from src/cellData, cached by computed for stable reference */
const previewList = computed<string[]>(() => {
  const url = props.src ?? (props.cellData as string | undefined)
  return url ? [url] : []
})

/** <zh/> 点击事件转发 | <en/> Click event forwarder */
function handleClick(event: MouseEvent): void {
  emit('click', event)
}
</script>

<template>
  <ElImage
    v-if="src || cellData"
    :src="src ?? (cellData as string)"
    :alt="alt"
    :preview-src-list="previewList"
    :lazy="true"
    class="adv-table__image-cell"
    @click="handleClick"
  />
  <span v-else />
</template>
