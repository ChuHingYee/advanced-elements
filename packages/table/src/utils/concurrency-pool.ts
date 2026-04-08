/**
 * @file concurrency-pool.ts
 * @description
 * <zh/> 轻量并发池——限制同时执行的异步任务数量，按序消费队列。
 * <zh/> 用于 expandAll 等批量懒加载场景，防止对后端的"雷群"冲击。
 *
 * <en/> Lightweight concurrency pool — bounds concurrently running async tasks,
 * <en/> consuming the queue in order. Used by batch lazy-loading paths (expandAll)
 * <en/> to prevent thundering-herd bursts against the backend.
 */

export interface ConcurrencyPoolOptions {
  /** <zh/> 最大并发数，默认 4 | <en/> Max concurrent tasks, defaults to 4 */
  limit?: number
}

/**
 * <zh/> 创建并发池。返回的 runAll 接收任务工厂列表，按 limit 并发执行，
 * <zh/> 任一任务 reject 不中断其他任务（错误经 onError 上报，Promise 永不 reject）。
 *
 * <en/> Creates a pool. The returned runAll takes task factories and runs them with at most
 * <en/> `limit` concurrent tasks; a rejecting task does NOT abort others (errors are reported
 * <en/> via onError, so the returned promise never rejects).
 */
export function createConcurrencyPool(options: ConcurrencyPoolOptions = {}) {
  const limit = Math.max(1, options.limit ?? 4)

  async function runAll<T>(
    tasks: Array<() => Promise<T>>,
    onError?: (error: unknown, index: number) => void,
  ): Promise<void> {
    const queue = [...tasks]
    let cursor = 0

    async function worker(): Promise<void> {
      while (cursor < queue.length) {
        const index = cursor++
        try {
          await queue[index]()
        }
        catch (error) {
          onError?.(error, index)
        }
      }
    }

    const workers: Promise<void>[] = []
    const workerCount = Math.min(limit, queue.length)
    for (let i = 0; i < workerCount; i++)
      workers.push(worker())
    await Promise.all(workers)
  }

  return { runAll }
}
