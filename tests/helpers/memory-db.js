export function memoryDb(initial = []) {
  const records = new Map(initial)
  const snapshot = ref => ({ exists: records.has(ref.path), id: ref.id, ref, data: () => records.has(ref.path) ? { ...records.get(ref.path) } : undefined })
  const document = path => {
    const ref = { path, id: path.split('/').pop(), collection: name => collection(path + '/' + name) }
    ref.get = async () => snapshot(ref)
    ref.set = async value => records.set(path, value)
    ref.update = async value => records.set(path, { ...records.get(path), ...value })
    ref.delete = async () => records.delete(path)
    return ref
  }
  const collection = (path, filters = [], limit = Infinity) => ({
    doc: id => document(path + '/' + id),
    where: (field, operator, value) => { if (operator !== '==') throw new Error('Unsupported query'); return collection(path, [...filters, [field, value]], limit) },
    limit: value => collection(path, filters, value),
    get: async () => ({ docs: [...records.keys()].filter(key => key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/')).filter(key => filters.every(([field, value]) => records.get(key)[field] === value)).slice(0, limit).map(key => snapshot(document(key))) }),
  })
  let queue = Promise.resolve()
  const db = { collection, runTransaction: fn => {
    const result = queue.then(async () => {
      const writes = []
      const value = await fn({ get: async ref => ref.path ? snapshot(ref) : ref.get(), set: (ref, data) => writes.push(() => records.set(ref.path, data)), update: (ref, data) => writes.push(() => records.set(ref.path, { ...records.get(ref.path), ...data })), delete: ref => writes.push(() => records.delete(ref.path)) })
      writes.forEach(write => write())
      return value
    })
    queue = result.catch(() => {})
    return result
  } }
  return { db, records }
}
