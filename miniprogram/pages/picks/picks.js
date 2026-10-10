const guide = require('../../utils/guide.js')
const share = require('../../utils/share.js')

const N = 10
const TAB_INDEX = 1 // 本页在 tabBar 中的位置(指南 / 发现 / 我的)

// 分享文案优先用「说人话」——标题是书的语言,说人话才是能传给家人的那句
function plainOf(row, fallback) {
  const p = String((row && row.plain) || '').trim()
  if (!p) return fallback
  return p.length > 44 ? fallback : p
}

Page({
  data: { list: [], total: 0, n: N, dailyMore: [] },

  onLoad() {
    share.enableShare()
    const triple = guide.dailyTriple(guide.dateKey())
    this.setData({
      total: guide.easyPickCount(),
      list: guide.easyPicks(N).map(function (e, i) {
        return {
          id: e.item.id,
          no: String(i + 1).padStart(2, '0'),
          title: e.item.title,
          plain: e.item.plain,
          section: e.section,
          level: e.item.level,
          costTag: e.item.costTag,
          sourceCount: (e.item.source || []).length
        }
      }),
      dailyMore: triple.map(function (e) {
        return { id: e.item.id, title: e.item.title, section: e.section, level: e.item.level }
      })
    })
  },

  onShow() {
    this.syncTabBar()
  },

  // 自定义 tabBar 不会自动同步激活态,每个 tab 页都要在 onShow 里推一次
  syncTabBar() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: TAB_INDEX })
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(id) })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    const top = this.data.list[0]
    return {
      title: plainOf(top, top && top.title ? top.title : '新手必看 Top 10') + ' · 人生指南',
      path: '/pages/picks/picks'
    }
  },

  onShareTimeline() {
    const top = this.data.list[0]
    return { title: plainOf(top, '新手必看 Top 10') + ' · 人生指南' }
  }
})
