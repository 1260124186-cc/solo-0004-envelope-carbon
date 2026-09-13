// jsdom 不实现 Web Locks API，这里提供最小的同名互斥量：
// 同名锁严格串行，持锁期间完成“读取-核对修订标识-写入”，与生产语义一致。
class LockManagerPolyfill {
  private queues = new Map<string, Array<() => void>>()

  request(
    name: string,
    callback: (lock: { name: string; mode: 'exclusive' }) => unknown,
  ): Promise<unknown> {
    const queue = this.queues.get(name) ?? []
    this.queues.set(name, queue)
    return new Promise((resolve, reject) => {
      const finish = () => {
        queue.shift()
        queue[0]?.()
      }
      const run = () => {
        // 同步抛出与异步拒绝都必须释放锁，否则同名锁队列会永久阻塞
        try {
          Promise.resolve(callback({ name, mode: 'exclusive' })).then(
            (value) => {
              finish()
              resolve(value)
            },
            (cause) => {
              finish()
              reject(cause)
            },
          )
        } catch (cause) {
          finish()
          reject(cause)
        }
      }
      queue.push(run)
      if (queue.length === 1) run()
    })
  }
}

if (!('locks' in navigator)) {
  Object.defineProperty(navigator, 'locks', {
    value: new LockManagerPolyfill(),
    configurable: true,
  })
}

if (!('randomUUID' in crypto)) {
  Object.defineProperty(crypto, 'randomUUID', {
    value: () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const value = Math.floor(Math.random() * 16)
        return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16)
      }),
  })
}
