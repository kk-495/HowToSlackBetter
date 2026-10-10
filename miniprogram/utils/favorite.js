// 收藏的本地存储封装(收藏只存在用户手机里,不上传)。
const store = require('./storage.js')

const KEY_FAVORITES = 'favorites_v1'

function listFavorites() {
  const v = store.read(KEY_FAVORITES, [])
  return Array.isArray(v) ? v.slice() : []
}

function saveFavorites(list) {
  store.write(KEY_FAVORITES, Array.isArray(list) ? list.slice() : [])
}

function isFavorite(id) {
  return listFavorites().indexOf(id) !== -1
}

function toggleFavorite(id) {
  const list = listFavorites()
  const i = list.indexOf(id)
  if (i !== -1) {
    list.splice(i, 1)
    saveFavorites(list)
    return false
  }
  list.push(id)
  saveFavorites(list)
  return true
}

// 把收藏的 id 还原成条目(顺序 = 收藏顺序,最早收藏的在最前)。
// 先建一次索引,避免对每个 id 都全表扫一遍。
function favoriteEntries(flatten) {
  const index = {}
  flatten.forEach(function (e) { index[e.item.id] = e })
  return listFavorites().map(function (id) {
    return index[id]
  }).filter(function (x) { return !!x })
}

module.exports = {
  listFavorites: listFavorites,
  saveFavorites: saveFavorites,
  isFavorite: isFavorite,
  toggleFavorite: toggleFavorite,
  favoriteEntries: favoriteEntries
}
