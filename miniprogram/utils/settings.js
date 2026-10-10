// 阅读设置:正文字号档位。
// 0 = 小(30rpx) / 1 = 标准(32rpx,设计令牌默认) / 2 = 大(38rpx)
// 下限刻意卡在 30rpx —— 设计系统 §7 禁止正文小于 30rpx,即使用户选"小"也不破线。
const store = require('./storage.js')

const KEY = 'settings_v1'
const FONT_SCALES = [30, 32, 38]
const DEFAULT_FONT_SCALE = 1

function normalize(n) {
  const v = Number(n)
  return v === 0 || v === 1 || v === 2 ? v : DEFAULT_FONT_SCALE
}

function get() {
  const raw = store.read(KEY, null)
  const obj = raw && typeof raw === 'object' ? raw : {}
  return { fontScale: normalize(obj.fontScale) }
}

function setFontScale(n) {
  const next = { fontScale: normalize(n) }
  store.write(KEY, next)
  return next
}

module.exports = {
  KEY: KEY,
  FONT_SCALES: FONT_SCALES,
  DEFAULT_FONT_SCALE: DEFAULT_FONT_SCALE,
  get: get,
  setFontScale: setFontScale
}
