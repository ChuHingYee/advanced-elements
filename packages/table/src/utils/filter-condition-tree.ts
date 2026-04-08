/**
 * @file filter-condition-tree.ts
 * @description
 * <zh/> 过滤条件树求值器——将"多条件 AND/OR 组合"从两槽硬编码提升为任意深度的树结构。
 *
 * <zh/> 设计要点：
 * <zh/> 1. 纯函数、零依赖 Vue——叶子以 thunk（` => boolean`）形式注入，使本模块不感知
 * <zh/>    列模型 / 策略注册表，可独立测试与复用；
 * <zh/> 2. 求值短路：AND 首个 false 即返回；OR 首个 true 即返回；
 * <zh/> 3. 空组语义：无子节点视为"未启用"，恒真（交由调用方 isActive 决定是否进入求值）。
 *
 * <en/> Filter condition-tree evaluator — lifts multi-condition AND/OR composition from the
 * <en/> hard-coded two-slot model to an arbitrarily deep tree.
 *
 * <en/> Design notes:
 * <en/> 1. Pure function, zero Vue deps — leaves are injected as thunks (` => boolean`) so this
 * <en/>    module knows nothing about column models or strategy registries; independently testable.
 * <en/> 2. Short-circuit evaluation: AND returns on first false; OR on first true.
 * <en/> 3. Empty-group semantics: no children means "not engaged", always true (callers decide
 * <en/>    engagement via their own isActive).
 */

/** <zh/> 组内逻辑 | <en/> group logic */
export type ConditionLogic = 'and' | 'or'

/**
 * <zh/> 条件树节点——分组节点（递归）或叶子节点（thunk 判定）
 * <en/> Condition tree node — either a group (recursive) or a leaf (thunk predicate)
 */
export type ConditionTreeNode
  = | { kind: 'group', logic: ConditionLogic, children: ConditionTreeNode[] }
    | { kind: 'leaf', test: () => boolean }

/**
 * <zh/> 求值条件树（短路）。
 * <zh/> 叶子抛错视为不命中（返回 false）——单坏行只排除自身，不拖垮整表求值。
 * <en/> Evaluate a condition tree (short-circuiting).
 * <en/> A throwing leaf counts as a miss (false) — one bad row excludes only itself instead of crashing the whole evaluation.
 */
export function evaluateConditionTree(node: ConditionTreeNode): boolean {
  if (node.kind === 'leaf') {
    try {
      return node.test()
    }
    catch {
      return false
    }
  }

  if (node.children.length === 0)
    return true

  if (node.logic === 'and') {
    for (const child of node.children) {
      if (!evaluateConditionTree(child))
        return false
    }
    return true
  }

  for (const child of node.children) {
    if (evaluateConditionTree(child))
      return true
  }
  return false
}

/**
 * <zh/> 由「列过滤值 + 单值判定函数」构建叶子节点——供策略层把 ColumnFilterValue 的
 * <zh/> conditions 数组装配为可求值树。
 * <en/> Build a leaf from "a column filter value plus its single-value matcher" — lets the
 * <en/> strategy layer assemble a ColumnFilterValue's conditions array into an evaluable tree.
 */
export function conditionLeaf(test: () => boolean): ConditionTreeNode {
  return { kind: 'leaf', test }
}

/**
 * <zh/> 构建分组节点 | <en/> Build a group node
 */
export function conditionGroup(logic: ConditionLogic, children: ConditionTreeNode[]): ConditionTreeNode {
  return { kind: 'group', logic, children }
}
