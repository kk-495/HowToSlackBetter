// 搜索历史:本地最多 8 条,最近搜的排最前,重复词只留最新一次。
const store = require('./storage.js')

const KEY = 'search_history_v1'
const MAX = 8

function list() {
  const v = store.read(KEY, [])
  if (!Array.isArray(v)) return []
  return v.filter(function (x) {
    return typeof x === 'string' && x.length > 0
  }).slice(0, MAX)
}

// 记一次搜索。返回写入后的完整历史。
function push(word) {
  const w = String(word === undefined || word === null ? '' : word).trim()
  if (!w) return list()
  const next = [w].concat(list().filter(function (x) { return x !== w })).slice(0, MAX)
  store.write(KEY, next)
  return next
}

// 删掉一条。返回删除后的完整历史。
function remove(word) {
  const next = list().filter(function (x) { return x !== word })
  store.write(KEY, next)
  return next
}

function clear() {
  store.write(KEY, [])
  return []
}

module.exports = {
  KEY: KEY,
  MAX: MAX,
  list: list,
  push: push,
  remove: remove,
  clear: clear
}
