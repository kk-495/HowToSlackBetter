// 本地存储的统一封装。
// 有 wx 环境时读写 Storage;没有时(tests/harness.js 打桩)退化为共享内存对象,
// 让收藏 / 阅读历史 / 搜索历史 / 阅读设置 走同一套读写逻辑,都能在 node 下测。
// 注意:内存兜底是所有模块共用的一份,key 必须全局唯一。

const memory = {}

function hasWx() {
  return typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function'
}

function read(key, fallback) {
  if (hasWx()) {
    const v = wx.getStorageSync(key)
    return v === '' || v === undefined || v === null ? fallback : v
  }
  return memory[key] === undefined ? fallback : memory[key]
}

function write(key, value) {
  if (hasWx()) wx.setStorageSync(key, value)
  else memory[key] = value
}

module.exports = {
  read: read,
  write: write
}
