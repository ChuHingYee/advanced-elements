/**
 * <zh/> 排序 Worker 的 Blob URL 兜底构造。
 *
 * <zh/> 在严格 CSP（`worker-src 'none'`、MV3 service worker 环境）下，`new Worker(new URL(...))` 会被拦截。
 * <zh/> 此函数将排序 Worker 所需的纯函数代码以字符串方式内联打包，通过 Blob URL 创建 Worker。
 * <zh/> 与 `src/utils/sort-comparator.ts` 保持逻辑等价：仅包含纯数据比较与索引排序，无外部依赖。
 *
 * <en/> Blob URL fallback construction for the sort Worker.
 *
 * <en/> Under strict CSP (`worker-src 'none'`, MV3 service worker context), `new Worker(new URL(...))` is rejected.
 * <en/> This function inlines the pure-function code required by the sort Worker as a string and creates the Worker via a Blob URL.
 * <en/> Logically equivalent to `src/utils/sort-comparator.ts`: contains only pure-data comparison and index sorting, with no external dependencies.
 */

/**
 * <zh/> 内联的排序代码（与 `src/utils/sort-comparator.ts` 保持逻辑等价）。
 * <zh/> 严格 CSP 下无法使用 `new URL('./sort-comparator.ts', import.meta.url)`，因此将 `compareSortValues` 内联。
 * <zh/> 导出仅供测试使用：worker-comparator-parity 契约测试对本源码串求值，
 * <zh/> 与主线程 `compareSortValues` 做排序结果等价性断言，防止两份比较器漂移。
 *
 * <en/> Inlined sort code (logically equivalent to `src/utils/sort-comparator.ts`).
 * <en/> `new URL('./sort-comparator.ts', import.meta.url)` is unavailable under strict CSP, so `compareSortValues` is inlined.
 * <en/> Exported for testing only: the worker-comparator-parity contract test evaluates this source string
 * <en/> and asserts ordering equivalence against the main-thread `compareSortValues`, guarding against drift.
 */
export const SORT_WORKER_INLINE_SOURCE = `
// Inlined compareSortValues (mirror of src/utils/sort-comparator.ts)
var __sortCollator = null;
var __collatorResolved = false;
function getCollator() {
  if (__collatorResolved)
    return __sortCollator;
  try {
    __sortCollator = (typeof Intl !== 'undefined' && typeof Intl.Collator === 'function')
      ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'variant' })
      : null;
  } catch (e) {
    __sortCollator = null;
  }
  __collatorResolved = true;
  return __sortCollator;
}
function compareSortValues(valueA, valueB, multiplier) {
  if (valueA == null && valueB == null)
    return 0;
  if (valueA == null)
    return 1;
  if (valueB == null)
    return -1;
  if (valueA instanceof Date && valueB instanceof Date) {
    var dateResult = (valueA.getTime() - valueB.getTime()) * multiplier;
    if (!isNaN(dateResult) && dateResult !== 0)
      return dateResult;
    return 0;
  }
  if (typeof valueA === 'number' && typeof valueB === 'number') {
    var result = (valueA - valueB) * multiplier;
    if (isNaN(result))
      return 0;
    if (result !== 0)
      return result;
  }
  else {
    var collator = getCollator();
    if (collator) {
      var collated = collator.compare(String(valueA), String(valueB)) * multiplier;
      if (collated !== 0)
        return collated;
    } else {
      var strA = String(valueA);
      var strB = String(valueB);
      var strResult = strA < strB ? -1 * multiplier : strA > strB ? 1 * multiplier : 0;
      if (strResult !== 0)
        return strResult;
    }
  }
  return 0;
}

function sortInWorker(msg) {
  const { entries, totalRows, requestId } = msg;
  const indices = Array.from({ length: totalRows }, function (_, i) { return i; });
  const activeEntries = entries.filter(function (e) { return !e.hasCustomSortMethod; });
  if (activeEntries.length === 0) {
    return { sortedIndices: indices, requestId: requestId };
  }
  indices.sort(function (indexA, indexB) {
    for (const entry of activeEntries) {
      var valueA, valueB;
      valueA = entry.keys ? entry.keys[indexA] : undefined;
      valueB = entry.keys ? entry.keys[indexB] : undefined;
      const result = compareSortValues(valueA, valueB, entry.multiplier);
      if (result !== 0)
        return result;
    }
    return 0;
  });
  return { sortedIndices: indices, requestId: requestId };
}

globalThis.onmessage = function (e) {
  const result = sortInWorker(e.data);
  globalThis.postMessage(result);
};
`

/**
 * <zh/> 通过 Blob URL 创建排序 Worker，作为 module Worker 构造失败时的兜底实现。
 *
 * <zh/> 实现细节：
 * <zh/> - 将排序 Worker 源码以字符串方式内联，避免运行时再加载 `sort-comparator.ts`
 * <zh/> - 通过 `Blob` + `URL.createObjectURL` 构造 `blob:` URL
 * <zh/> - 使用 classic worker（不指定 `{ type: 'module' }`），兼容性更广
 *
 * <en/> Creates the sort Worker via a Blob URL as a fallback when module Worker construction fails.
 *
 * <en/> Implementation notes:
 * <en/> - Sort Worker source is inlined as a string to avoid loading `sort-comparator.ts` at runtime
 * <en/> - Constructs a `blob:` URL via `Blob` + `URL.createObjectURL`
 * <en/> - Uses a classic worker (no `{ type: 'module' }`) for broader compatibility
 *
 * @returns <zh/> 通过 Blob URL 构造的 Worker 实例 | <en/> Worker instance constructed via Blob URL
 * @throws <zh/> 浏览器不支持 Worker / Blob / URL.createObjectURL 时抛出 | <en/> Throws when Worker / Blob / URL.createObjectURL is unsupported
 */
export function createSortWorkerFromBlob(): Worker {
  if (typeof Worker === 'undefined') {
    throw new TypeError('Sort worker Blob fallback unavailable: Worker constructor is not defined.')
  }
  if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new TypeError('Sort worker Blob fallback unavailable: Blob/URL.createObjectURL is not supported.')
  }

  const blob = new Blob([SORT_WORKER_INLINE_SOURCE], { type: 'application/javascript' })
  const blobUrl = URL.createObjectURL(blob)
  try {
    // classic worker — 兼容性更广，不依赖 ES module 支持
    // classic worker — broader compatibility, does not require ES module support
    return new Worker(blobUrl)
  }
  finally {
    // 立即释放 blobURL 引用，Worker 已加载后无需保留
    // Release blobURL reference immediately; no longer needed after Worker is loaded
    URL.revokeObjectURL(blobUrl)
  }
}
