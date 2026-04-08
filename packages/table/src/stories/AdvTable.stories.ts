/**
 * <zh/> AdvTable Storybook — 双引擎、斑马纹、固定列、虚拟滚动基线
 * <en/> AdvTable Storybook — dual-engine, stripe, fixed, virtual baseline
 *
 * @remarks
 * <zh/> 供 `pnpm storybook` 预览，需 `storybook` 已装；当前为占位，导出 CSF 3.0 结构
 * <en/> For `pnpm storybook` preview, requires storybook installed; placeholder CSF 3.0 structure
 */
// eslint-disable-next-line ts/ban-ts-comment -- storybook types optional, not in devDeps
// @ts-ignore -- storybook types optional
import type { Meta, StoryObj } from '@storybook/vue3'
import AdvTable from '../AdvTable.vue'

const meta: Meta<typeof AdvTable> = {
  title: 'Data Display/AdvTable',
  component: AdvTable,
  tags: ['autodocs'],
  argTypes: {
    mode: { control: 'select', options: ['default', 'virtual'] },
    stripe: { control: 'boolean' },
    height: { control: 'number' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const VirtualStripe: Story = {
  args: {
    mode: 'virtual',
    stripe: true,
    height: 400,
    columns: [{ key: 'name', prop: 'name', label: 'Name', width: 100 }],
    data: Array.from({ length: 100 }, (_, i) => ({ id: String(i), name: `N${i}` })),
  } as any,
}

export const DefaultFixed: Story = {
  args: {
    mode: 'default',
    columns: [
      { key: 'a', prop: 'a', label: 'A', width: 100, fixed: 'left' },
      { key: 'b', prop: 'b', label: 'B', width: 400 },
    ],
    data: [{ a: '1', b: '2' }],
  } as any,
}

export const Empty: Story = {
  args: {
    mode: 'virtual',
    height: 300,
    columns: [{ key: 'a', prop: 'a', label: 'A', width: 100 }],
    data: [],
  } as any,
}

export const FullPipeline: Story = {
  args: {
    mode: 'virtual',
    height: 500,
    stripe: true,
    pagination: { enabled: true, pageSize: 20 },
    columns: [
      { key: 'name', prop: 'name', label: 'Name', width: 120, sortable: true, filter: { type: 'text' } },
      { key: 'age', prop: 'age', label: 'Age', width: 80, sortable: true },
      { key: 'dept', prop: 'dept', label: 'Dept', width: 100 },
    ],
    data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i), name: `N${i % 10}`, age: 20 + (i % 30), dept: i % 2 === 0 ? 'eng' : 'hr' })),
    treeConfig: { children: 'children' },
    // <zh/> rowKey 属于 rowConfig 层（见 RowConfig.rowKey），顶层传参会被当作 attrs 丢弃
    // <en/> rowKey lives under rowConfig (see RowConfig.rowKey); a top-level key would be dropped as attrs
    rowConfig: { rowKey: 'id' },
  } as any,
}
