const guide = require('../../utils/guide.js')
const fav = require('../../utils/favorite.js')
const share = require('../../utils/share.js')

const TAB_INDEX = 2 // 本页在 tabBar 中的位置(指南 / 发现 / 我的)
const DEBOUNCE = 160

Page({
  data: {
    keyword: '',
    sort: 'recent', // recent(最近收藏) | section(按章节)
    list: [],
    total: 0,
    matched: 0,
    searching: false
  },

  onLoad() {
    this._timer = null
    this._entries = []
    share.enableShare()
  },

  onShow() {
    this.syncTabBar()
    // 收藏可能刚在详情页变过,每次显示都重新读
    this._entries = fav.favoriteEntries(guide.allItems())
    this.applyFilter()
  },

  onHide() {
    if (this._timer) clearTimeout(this._timer)
  },

  onUnload() {
    if (this._timer) clearTimeout(this._timer)
  },

  // 自定义 tabBar 不会自动同步激活态,每个 tab 页都要在 onShow 里推一次
  syncTabBar() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: TAB_INDEX })
    }
  },

  // ---- 搜索与排序 ----

  onKeyword(e) {
    this.setData({ keyword: e.detail.value })
    if (this._timer) clearTimeout(this._timer)
    this._timer = setTimeout(() => this.applyFilter(), DEBOUNCE)
  },

  onClearKeyword() {
    if (this._timer) clearTimeout(this._timer)
    this.setData({ keyword: '' }, () => this.applyFilter())
  },

  onSort(e) {
    const s = e.currentTarget.dataset.s
    if (!s || s === this.data.sort) return
    this.setData({ sort: s }, () => this.applyFilter())
  },

  applyFilter() {
    const kw = String(this.data.keyword || '').trim().toLowerCase()
    let rows = this._entries.slice()

    if (kw) {
      rows = rows.filter(function (e) {
        return guide.searchText(e.item).toLowerCase().indexOf(kw) !== -1
      })
    }

    if (this.data.sort === 'section') {
      rows.sort(function (a, b) {
        if (a.sectionId !== b.sectionId) return a.sectionId - b.sectionId
        return a.item.id < b.item.id ? -1 : 1
      })
    } else {
      rows.reverse() // 最近收藏的排最前
    }

    this.setData({
      // 收藏是用户自己的行为:不再抄 A/B/C 证据徽标(那是模板惯性),
      // 只留标题 + 章节 + 来源数
      list: rows.map(function (e) {
        return {
          id: e.item.id,
          title: e.item.title,
          section: e.section,
          sourceCount: (e.item.source || []).length
        }
      }),
      total: this._entries.length,
      matched: rows.length,
      searching: !!kw
    })
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(e.currentTarget.dataset.id) })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 关于从 tabBar 降级成这里的一行(它是低频页,不该占一个 tab)
  goAbout() {
    wx.navigateTo({ url: '/pages/about/about' })
  },

  // 放大公众号二维码:全屏后长按识别(show-menu-by-longtap),关注公众号发私信
  previewMp() {
    wx.previewImage({ urls: ['/assets/official-mp.png'] })
  },

  // ---- 分享 ----

  onShareAppMessage() {
    if (this.data.total) {
      return {
        title: '我在《高性价比摸鱼指南》收藏了 ' + this.data.total + ' 条实用建议',
        path: '/pages/favorite/favorite'
      }
    }
    return {
      title: '高性价比摸鱼指南:' + guide.itemCount() + ' 条,按性价比排好',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return { title: '我在《高性价比摸鱼指南》收藏了 ' + this.data.total + ' 条建议' }
  }
})
