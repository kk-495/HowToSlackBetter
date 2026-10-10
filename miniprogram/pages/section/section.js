const guide = require('../../utils/guide.js')
const recent = require('../../utils/recent.js')
const share = require('../../utils/share.js')

const PAGE = 20            // 每次渲染 20 条,触底再追加
const TOP_THRESHOLD = 600  // 滚过这个距离才显示"回到顶部"

function toRow(e, readMap) {
  return {
    id: e.item.id,
    title: e.item.title,
    level: e.item.level,
    tier: e.item.tier,
    plain: e.item.plain,
    // 护城河是 1713 条来源,却只藏在详情页第 4 屏 —— 列表层就要看得见
    sourceCount: (e.item.source || []).length,
    read: !!(readMap && readMap[e.item.id])
  }
}

Page({
  data: {
    sectionId: '',
    title: '',
    items: [],
    total: 0,
    showTop: false
  },

  onLoad(query) {
    share.enableShare()
    this._all = []
    const id = parseInt(query && query.id, 10)
    const meta = guide.sectionTitles().filter(function (s) { return s.id === id })[0]
    if (!meta) {
      wx.showToast({ title: '章节不存在', icon: 'none' })
      setTimeout(function () {
        // 可能是从分享链接直接进来的,页面栈里没有上一页 —— 那就退回首页,别把用户留在空白页
        if (getCurrentPages().length > 1) wx.navigateBack()
        else wx.switchTab({ url: '/pages/index/index' })
      }, 800)
      return
    }
    wx.setNavigationBarTitle({ title: meta.title })
    // 已读集合只读一次,不要放进 .map() 回调(每行一次同步 storage = 每行一次 IO)
    const readMap = recent.readIdMap()
    this._all = guide.itemsOfSection(id).map(function (e) { return toRow(e, readMap) })
    this.setData({
      sectionId: id,
      title: meta.title,
      total: this._all.length,
      items: this._all.slice(0, PAGE)
    })
  },

  // 触底再渲染下一批,章节最多 46 条,不必一次全塞进去
  onReachBottom() {
    const loaded = this.data.items.length
    if (loaded >= this._all.length) return
    this.setData({ items: this._all.slice(0, loaded + PAGE) })
  },

  onPageScroll(e) {
    const show = e.scrollTop > TOP_THRESHOLD
    if (show !== this.data.showTop) this.setData({ showTop: show })
  },

  backToTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
  },

  onShareAppMessage() {
    return {
      title: this.data.title + ' · ' + this.data.total + ' 条 · 人生指南',
      path: '/pages/section/section?id=' + encodeURIComponent(this.data.sectionId)
    }
  },

  onShareTimeline() {
    return {
      title: this.data.title + ' · 人生指南',
      query: 'id=' + encodeURIComponent(this.data.sectionId)
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(id) })
  }
})
