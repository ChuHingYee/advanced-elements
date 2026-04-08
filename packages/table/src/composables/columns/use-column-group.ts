import type { ComputedRef, Ref } from 'vue'
import type { ProcessedColumn } from '../../types/column'
import type { ColumnConfig, ColumnGroupApi, ColumnGroupConfig } from '../../types/config'
import { nanoid } from 'nanoid'
import { computed, shallowRef, watch } from 'vue'
import { buildStructureSignature, cloneColumnTree, removeColumnByKey, replaceColumnByKey } from '../../utils/column-group-helpers'
import { findColumnByKey } from '../../utils/column-tree'
import { devWarn } from '../../utils/dev-warn'
import { isGroupColumn } from '../../utils/shared'

/**
 * <zh/> 列组管理配置默认值
 * <en/> Column group configuration defaults
 */
const DEFAULT_COLUMN_GROUP: Required<Omit<ColumnGroupConfig, 'lockGroupMembership'>> & { lockGroupMembership: Set<string> } = {
  enabled: false,
  sidePanelPosition: 'right',
  sidePanelDefaultOpen: false,
  sidePanelDestroyOnClose: true,
  maxDepth: 3,
  allowCreateGroup: true,
  allowRename: true,
  allowDeleteGroup: true,
  lockGroupMembership: new Set<string>(),
}

export interface UseColumnGroupOptions<T = any> {
  /** 合并后的列配置（来自 useTableConfig.mergedColumnConfig） */
  mergedColumnConfig: ComputedRef<ColumnConfig<T>>
  /** 当前列树（来自 useColumns.localColumns） */
  localColumns: Ref<ProcessedColumn[]>
  /** 提交列变更（来自 useColumns.setColumns） */
  setColumns: (cols: ProcessedColumn[]) => void
}

/**
 * 列组管理 Composable
 *
 * 管理列组结构的编辑状态（结构克隆副本）、分组 CRUD 操作、
 * 与 localColumns 的双向同步（apply/reset），以及面板可见性。
 *
 * - configTree 使用 shallowRef 避免深响应式劫持
 * - isDirty 通过结构签名对比判断，不依赖引用相等
 * - 所有修改操作均为不可变更新，保证 shallowRef 触发渲染；
 *   这也是"编辑不穿透 localColumns"的真正保证（克隆仅隔离结构与 `children`，嵌套字段仍共享引用，
 *   详见 cloneColumnTree 的共享边界说明）
 */
export function useColumnGroup<T = any>(options: UseColumnGroupOptions<T>): ColumnGroupApi {
  const { mergedColumnConfig, localColumns, setColumns } = options

  /** <zh/> 合并后的配置项（含默认值） | <en/> Merged options (with defaults applied) */
  const resolvedOptions = computed(() => {
    const columnGroup = mergedColumnConfig.value.columnGroup
    return {
      enabled: columnGroup?.enabled ?? DEFAULT_COLUMN_GROUP.enabled,
      sidePanelPosition: columnGroup?.sidePanelPosition ?? DEFAULT_COLUMN_GROUP.sidePanelPosition,
      sidePanelDefaultOpen: columnGroup?.sidePanelDefaultOpen ?? DEFAULT_COLUMN_GROUP.sidePanelDefaultOpen,
      sidePanelDestroyOnClose: columnGroup?.sidePanelDestroyOnClose ?? DEFAULT_COLUMN_GROUP.sidePanelDestroyOnClose,
      maxDepth: columnGroup?.maxDepth ?? DEFAULT_COLUMN_GROUP.maxDepth,
      allowCreateGroup: columnGroup?.allowCreateGroup ?? DEFAULT_COLUMN_GROUP.allowCreateGroup,
      allowRename: columnGroup?.allowRename ?? DEFAULT_COLUMN_GROUP.allowRename,
      allowDeleteGroup: columnGroup?.allowDeleteGroup ?? DEFAULT_COLUMN_GROUP.allowDeleteGroup,
      lockGroupMembership: new Set(columnGroup?.lockGroupMembership ?? []),
    }
  })

  /** <zh/> 面板位置 | <en/> Panel position */
  const panelPosition = computed(() => resolvedOptions.value.sidePanelPosition)

  /** 编辑中的列树副本（shallowRef 避免深响应式） */
  const configTree = shallowRef<ProcessedColumn[]>(cloneColumnTree(localColumns.value))

  /**
   * <zh/> 会话基线——`configTree` 上次从 `localColumns` 播种时的**外部结构签名**。
   * <zh/> 与 `originalSignature`（实时值）配对使用：两者不一致即表示"脏编辑期间外部列结构已变化"，
   * <zh/> 此时应用面板会以面板的旧结构**静默覆盖**外部更新（lost update）。
   * <en/> Session baseline — the **external structure signature** at the time `configTree` was last seeded
   * <en/> from `localColumns`. Paired with `originalSignature` (live value): a mismatch means "the external
   * <en/> column structure changed while edits were dirty", in which case applying the panel would silently
   * <en/> overwrite the external update (lost update).
   */
  let baselineSignature = buildStructureSignature(localColumns.value)

  /** 原始列树结构签名（用于 isDirty 判断） */
  const originalSignature = computed(() => buildStructureSignature(localColumns.value))

  /** <zh/> 当前编辑树结构签名 | <en/> Current editing tree structure signature */
  const currentSignature = computed(() => buildStructureSignature(configTree.value))

  /** <zh/> 是否存在未提交的变更 | <en/> Whether uncommitted changes exist */
  const isDirty = computed(() => currentSignature.value !== originalSignature.value)

  /**
   * <zh/> 从 `localColumns` 重新播种编辑副本——**同时刷新会话基线**，避免基线漂移导致误报。
   * <zh/> 收敛为单一入口，防止后续新增播种点时漏刷基线（3 处调用：外部变更 / 重置 / 重开面板）。
   * <en/> Re-seed the editing copy from `localColumns` — and refresh the session baseline so it cannot drift
   * <en/> (which would cause false positives). A single entry point prevents future seeding sites from
   * <en/> forgetting the baseline (3 call sites: external change / reset / panel reopen).
   */
  function reseedConfigTree(cols: ProcessedColumn[]): void {
    configTree.value = cloneColumnTree(cols)
    baselineSignature = buildStructureSignature(cols)
  }

  /** 当 localColumns 外部变更时（如 prop 更新），重新初始化编辑副本 */
  watch(localColumns, (newCols) => {
    if (!isDirty.value) {
      reseedConfigTree(newCols)
    }
  })

  /**
   * <zh/> 默认分组名称序号（仅用于展示名，可重复；分组 key 必须用 UUID，与命名解耦）。
   * <en/> Display-name sequence for default group names (display only, duplicates harmless;
   * <en/> group keys must use UUIDs, decoupled from naming).
   */
  let groupNameCounter = 0

  /**
   * 创建分组列并插入到指定父级下
   * @param parentKey - 父级 key，null 表示根级
   * @param index - 插入位置索引
   * @param groupName - 分组名称，不传则自动生成
   * @returns 新创建的分组列 key
   */
  function createGroup(parentKey: string | null, index: number, groupName?: string): string {
    // <zh/> key 生成与命名解耦：每次创建一律用 nanoid，保证全局唯一；
    // <zh/> 传名创建不再复用计数器，连续传名不再 key 重复。
    // <en/> Key generation is decoupled from naming: every creation mints a nanoid, guaranteeing
    // <en/> global uniqueness; consecutive named creations never collide.
    const name = groupName ?? `Group ${++groupNameCounter}`
    const key = `__header_group_${nanoid()}`

    const newGroup: ProcessedColumn = {
      key,
      label: name,
      hidden: false,
      children: [],
      __isGroup: true,
    }

    if (parentKey === null) {
      const newTree = [...configTree.value]
      newTree.splice(index, 0, newGroup)
      configTree.value = newTree
    }
    else {
      configTree.value = replaceColumnByKey(configTree.value, parentKey, (parent) => {
        const children = [...(parent.children ?? [])]
        children.splice(index, 0, newGroup)
        return { ...parent, children }
      })
    }

    return key
  }

  /**
   * <zh/> 删除空分组列
   * @param groupKey - <zh/> 要删除的分组 key | <en/> group key to delete
   * <zh/> 仅允许删除 children 为空的分组
   * <en/> Remove empty group column
   * <en/> Only allows deleting groups with empty children
   */
  function deleteGroup(groupKey: string): void {
    const group = findColumnByKey(configTree.value, groupKey)
    if (!group)
      return
    if (isGroupColumn(group) && group.children && group.children.length > 0)
      return

    configTree.value = removeColumnByKey(configTree.value, groupKey)
  }

  /**
   * <zh/> 重命名分组列
   * @param groupKey - <zh/> 分组 key | <en/> group key
   * @param newName - <zh/> 新名称 | <en/> new name
   * <en/> Rename group column
   */
  function renameGroup(groupKey: string, newName: string): void {
    if (!newName.trim())
      return
    configTree.value = replaceColumnByKey(configTree.value, groupKey, (col) => {
      return { ...col, label: newName }
    })
  }

  /**
   * <zh/> 拖拽后原子性更新指定父级的子列表
   * @param parentKey - <zh/> 父级 key，null 表示根级 | <en/> parent key, null for root level
   * @param newChildren - <zh/> 新的子列数组 | <en/> new children column array
   * <en/> Atomically update children list of specified parent after drag
   */
  function updateList(parentKey: string | null, newChildren: ProcessedColumn[]): void {
    if (parentKey === null) {
      configTree.value = newChildren
      return
    }

    configTree.value = replaceColumnByKey(configTree.value, parentKey, (parent) => {
      return { ...parent, children: newChildren }
    })
  }

  /**
   * <zh/> 提交编辑结果到表格 localColumns | <en/> Commit edit results to table localColumns
   *
   * @remarks
   * <zh/> **丢失更新防护（检测级）**：脏编辑期间外部列结构若已变化（`baselineSignature` 与实时
   * <zh/> `originalSignature` 不一致），直接应用会以面板的旧结构**静默覆盖**外部更新。
   * <zh/> 此处在 dev 期给出提示、**不阻断**：应用是用户的明确意图，而"阻断"需改动 `ColumnGroupApi`
   * <zh/> 对外契约（返回冲突/布尔），属独立的产品决策——故先以零契约成本补齐可诊断性。
   * <en/> **Lost-update guard (detection level)**: if the external column structure changed while edits were
   * <en/> dirty (`baselineSignature` differs from the live `originalSignature`), applying would silently
   * <en/> overwrite the external update with the panel's stale structure. This warns in dev and does **not**
   * <en/> block: applying is the user's explicit intent, and blocking would change the public `ColumnGroupApi`
   * <en/> contract (returning a conflict/boolean) — a separate product decision. This closes the
   * <en/> diagnosability gap at zero contract cost.
   */
  function applyConfig(): void {
    if (isDirty.value && baselineSignature !== originalSignature.value) {
      devWarn(
        '[AdvTable] Applying column-group edits while the external column structure has changed — '
        + 'the external change will be overwritten. Reset the panel to pick up the new columns first, '
        + 'or apply deliberately if overwriting is intended.',
      )
    }
    setColumns(configTree.value)
  }

  /**
   * <zh/> 放弃编辑并从 localColumns 重新初始化 | <en/> Cancel edit and re-initialize from localColumns
   */
  function resetConfig(): void {
    reseedConfigTree(localColumns.value)
  }

  const api: ColumnGroupApi = {
    configTree,
    isDirty,
    panelPosition,
    options: resolvedOptions,
    createGroup,
    deleteGroup,
    renameGroup,
    updateList,
    applyConfig,
    resetConfig,
  }

  return api
}
