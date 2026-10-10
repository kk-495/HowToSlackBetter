// 阅读历史:最近看过的条目(本地存储,最多 30 条)。
const store = require('./storage.js')

const KEY = 'recent_v1'
const MAX = 30

function read() {
  const v = store.read(KEY, [])
  return Array.isArray(v) ? v.slice() : []
}

function write(list) {
  store.write(KEY, list.slice(0, MAX))
}

// 记一次阅读。参数 key 用于测试注入确定性(默认 Date.now)。
function markRead(id, key) {
  if (!id) return read()
  const list = read()
  // 已经在最前面了就不必再写一次 storage —— 详情页来回翻是很高频的动作
  if (list.length && list[0].id === id) return list
  const rest = list.filter(function (x) { return x.id !== id })
  rest.unshift({ id: id, at: key || Date.now() })
  write(rest)
  return rest
}

function list() {
  return read()
}

function clear() {
  write([])
}

// 把 id 列表映射成条目(顺序保持,缺失的 id 跳过)。先建索引,避免逐条全表扫。
function entries(flatten) {
  const index = {}
  flatten.forEach(function (e) { index[e.item.id] = e })
  return read().map(function (r) {
    return index[r.id]
  }).filter(function (x) { return !!x })
}

// ---- 已读标记 ----
// 「最近在看」只留 30 条,不够给列表做已读标记,所以单独存一个 id 集合。
// 只在遇到**新** id 时才写 storage(上限 200 个),不会拖慢详情页。
const KEY_READ = 'read_ids_v1'
const READ_MAX = 200  // 上限 ≥ 全库条目数(90 条)即不会真的触发;留余量防未来数据增长

function readIdMap() {
  const raw = store.read(KEY_READ, '')
  if (!raw) return {}
  const m = {}
  String(raw).split(',').forEach(function (x) { if (x) m[x] = 1 })
  return m
}

function markReadId(id) {
  if (!id) return
  const m = readIdMap()
  if (m[id]) return
  m[id] = 1
  store.write(KEY_READ, Object.keys(m).slice(-READ_MAX).join(','))
}

function isRead(id) {
  return !!readIdMap()[id]
}

module.exports = {
  markRead: markRead,
  markReadId: markReadId,
  readIdMap: readIdMap,
  isRead: isRead,
  list: list,
  clear: clear,
  entries: entries
}
