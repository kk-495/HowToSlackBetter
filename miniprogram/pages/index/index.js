const guide = require('../../utils/guide.js')
const fav = require('../../utils/favorite.js')
const recent = require('../../utils/recent.js')
const searchHistory = require('../../utils/search-history.js')
const share = require('../../utils/share.js')
const notice = require('../../utils/notice.js')
const HOT_WORDS = require('../../utils/hot-words.js')
const topics = require('../../utils/topics.js')

// 模块级标记:同一次小程序生命周期(冷启动)内只弹一次,
// 从详情页返回首页不会重复弹。想让它在每次前台唤醒时也弹,把这里改成 false 即可。
let noticeShown = false

const LIMIT = 100          // 搜索结果最多取 100 条
const PAGE = 20            // 每次渲染 20 条,触底再追加
const DEBOUNCE = 160       // 输入防抖
const SETTLE = 1200        // 停止输入多久后把这次搜索记进历史
const BLUR_DELAY = 400     // 失焦后延迟收面板,留出点击胶囊的时间(低端安卓 blur→tap 可能超过 260ms)
const TOP_THRESHOLD = 600  // 滚过这个距离才显示"回到顶部"
const TAB_INDEX = 0        // 本页在 tabBar 中的位置

function toRow(h, q, readMap) {
  return {
    id: h.entry.item.id,
    titleSeg: guide.highlight(h.entry.item.title, q),
    section: h.entry.section,
    level: h.entry.item.level,
    tier: h.entry.item.tier,
    plain: h.entry.item.plain,
    // 护城河是 1713 条来源,却只藏在详情页第 4 屏 —— 列表层就要看得见
    sourceCount: (h.entry.item.source || []).length,
    read: !!(readMap && readMap[h.entry.item.id])
  }
}

// 章节号补成两位,列表里对齐才看得出「编辑体」的秩序
function sectionRows() {
  return guide.sectionTitles().map(function (s) {
    return { id: s.id, title: s.title, count: s.count, no: String(s.id).padStart(2, '0') }
  })
}

Page({
  data: {
    query: '',
    filter: 'all',
    resultCount: 0,
    results: [],
    sections: [],
    daily: null,
    dailyMore: [],
    todayKey: '',
    todayLabel: '',
    favCount: 0,
    total: 0,
    sourceCount: 0,
    mode: 'home', // home | search | empty
    picksPreview: [],
    recent: [],
    history: [],
    hotWords: HOT_WORDS,
    // 按主题 / 按人生阶段找:34 章的标题是书的语言,这两排标签是用户的语言
    topicList: topics.TOPICS,
    stageList: topics.STAGES,
    searchFocused: false,
    showTop: false,
    noticeShow: false,
    notice: notice
  },

  onLoad() {
    this._timer = null
    this._settleTimer = null
    this._blurTimer = null
    this._hits = []   // 完整命中集(最多 LIMIT 条),不进 data,避免 setData 传大数组
    this._q = ''
    share.enableShare()
    const key = guide.dateKey()
    const triple = guide.dailyTriple(key)
    // 幕二只放前 3 条「新手必看」,其余交给精选页,首页不当瀑布流
    const picks = guide.easyPicks(10)
    this.setData({
      total: guide.itemCount(),
      sourceCount: guide.meta.linkCount || 0,
      sections: sectionRows(),
      todayKey: key,
      todayLabel: guide.dateLabel(key),
      daily: triple[0],
      dailyMore: triple.slice(1).map(function (e) {
        return { id: e.item.id, title: e.item.title, section: e.section, level: e.item.level }
      }),
      picksPreview: picks.slice(0, 3).map(function (e, i) {
        return {
          id: e.item.id,
          no: String(i + 1).padStart(2, '0'),
          title: e.item.title,
          section: e.section,
          level: e.item.level,
          sourceCount: (e.item.source || []).length
        }
      }),
      history: searchHistory.list()
    })
  },

  onShow() {
    this.syncTabBar()
    this.refreshRecent()
    this.refreshFavCount()
    this.maybeShowNotice()
  },

  // 收藏数:给用户一个"我攒了东西"的回访理由(首页「收藏夹 N」)
  refreshFavCount() {
    const n = fav.listFavorites().length
    if (n !== this.data.favCount) this.setData({ favCount: n })
  },

  onHide() {
    this.clearTimers()
  },

  onUnload() {
    this.clearTimers()
  },

  clearTimers() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null }
    if (this._settleTimer) { clearTimeout(this._settleTimer); this._settleTimer = null }
    if (this._blurTimer) { clearTimeout(this._blurTimer); this._blurTimer = null }
  },

  // 自定义 tabBar 不会自动同步激活态,每个 tab 页都要在 onShow 里推一次
  syncTabBar() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: TAB_INDEX })
    }
  },

  // ---- 分享 ----

  onShareAppMessage(e) {
    // 今日一条卡片上的分享按钮:直接分享那一条
    if (e && e.from === 'button') {
      const ds = (e.target && e.target.dataset) || {}
      if (ds.share === 'daily' && this.data.daily) {
        const it = this.data.daily.item
        return {
          title: it.title + ' · 人生指南',
          path: '/pages/detail/detail?id=' + encodeURIComponent(it.id)
        }
      }
    }
    const q = this.data.query.trim()
    if (q && this.data.mode === 'search') {
      return {
        title: '「' + q + '」在《人生指南》里有 ' + this.data.resultCount + ' 条',
        path: '/pages/index/index'
      }
    }
    return {
      title: '高性价比人生指南:' + guide.itemCount() + ' 条,按性价比排好',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return { title: '高性价比人生指南:' + guide.itemCount() + ' 条实用建议' }
  },

  // 今日一条卡片上的分享按钮要吃掉 tap,别让它冒泡到卡片去跳详情
  noop() {},

  refreshRecent() {
    this.setData({
      recent: recent.entries(guide.allItems()).slice(0, 6).map(function (e) {
        return { id: e.item.id, title: e.item.title, section: e.section }
      })
    })
  },

  // ---- 启动弹窗 ----

  maybeShowNotice() {
    if (noticeShown) return
    if (!notice.enabled || !notice.image) return
    noticeShown = true
    this.setData({ noticeShow: true })
  },

  onCloseNotice() {
    this.setData({ noticeShow: false })
  },

  // ---- 搜索框 ----

  onFocus() {
    if (this._blurTimer) { clearTimeout(this._blurTimer); this._blurTimer = null }
    this.setData({ searchFocused: true })
  },

  onBlur() {
    if (this._blurTimer) clearTimeout(this._blurTimer)
    this._blurTimer = setTimeout(() => {
      this._blurTimer = null
      this.setData({ searchFocused: false })
    }, BLUR_DELAY)
  },

  onQuery(e) {
    this.setData({ query: e.detail.value })
    if (this._timer) clearTimeout(this._timer)
    this._timer = setTimeout(() => this.runSearch(), DEBOUNCE)
    // 停止输入一段时间后,把这次搜索记进历史(只记搜到东西的)
    if (this._settleTimer) clearTimeout(this._settleTimer)
    this._settleTimer = setTimeout(() => this.commitHistory(), SETTLE)
  },

  onConfirm() {
    this.clearTimers()
    this.runSearch()
    this.commitHistory()
  },

  onClear() {
    this.clearTimers()
    this.setData({ query: '', filter: 'all', searchFocused: false }, () => this.runSearch())
  },

  onFilter(e) {
    const f = e.currentTarget.dataset.f
    this.setData({ filter: this.data.filter === f ? 'all' : f }, () => this.runSearch())
  },

  // ---- 搜索历史 / 热词 ----

  commitHistory() {
    const q = this.data.query.trim()
    if (!q || this.data.mode !== 'search') return
    this.setData({ history: searchHistory.push(q) })
  },

  applyWord(w) {
    if (!w) return
    this.clearTimers()
    this.setData({ query: w, searchFocused: false }, () => {
      this.runSearch()
      this.commitHistory()
    })
  },

  onTapHistory(e) {
    this.applyWord(e.currentTarget.dataset.w)
  },

  onTapHot(e) {
    this.applyWord(e.currentTarget.dataset.w)
  },

  onRemoveHistory(e) {
    const w = e.currentTarget.dataset.w
    this.setData({ history: searchHistory.remove(w) })
  },

  onClearHistory() {
    wx.showModal({
      title: '清空搜索历史?',
      content: '只清空本机的搜索记录,不影响收藏',
      confirmText: '清空',
      success: (res) => {
        if (res.confirm) this.setData({ history: searchHistory.clear() })
      }
    })
  },

  // ---- 搜索 ----

  runSearch() {
    const q = this.data.query.trim()
    if (!q && this.data.filter === 'all') {
      this._hits = []
      this._q = ''
      this.setData({ results: [], resultCount: 0, mode: 'home' })
      return
    }
    const hits = guide.search(q, this.data.filter)
    this._hits = hits.slice(0, LIMIT)
    // 命中超过 400 条基本等于「没筛」——搜「的」会命中全书 675 条,提醒用户换词
    const tooBroad = hits.length > 400
    this._q = q
    // 已读集合在循环外只算一次。
    // 原来写在 .map() 回调里 = 每渲染一行就同步读一次 storage:20 行纯 JS 1.23ms,
    // 真机 storage 0.5–3ms/次时是 6.3–55.3ms,而循环外算一次只要 0.061ms(约 22 倍浪费)。
    const readMap = recent.readIdMap()
    this.setData({
      results: this._hits.slice(0, PAGE).map(function (h) { return toRow(h, q, readMap) }),
      resultCount: hits.length,
      tooBroad: tooBroad,
      mode: hits.length ? 'search' : 'empty'
    })
  },

  // 触底再渲染下一批,别一次性把 100 条全塞进 setData
  onReachBottom() {
    if (this.data.mode !== 'search') return
    const loaded = this.data.results.length
    if (loaded >= this._hits.length) return
    const q = this._q
    const add = this._hits.slice(loaded, loaded + PAGE)
    const readMap = recent.readIdMap()  // 同样提到循环外,每批只读一次
    this.setData({
      results: this.data.results.concat(add.map(function (h) { return toRow(h, q, readMap) }))
    })
  },

  onPageScroll(e) {
    const show = e.scrollTop > TOP_THRESHOLD
    if (show !== this.data.showTop) this.setData({ showTop: show })
  },

  backToTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
  },

  onAnother() {
    const cur = this.data.daily ? this.data.daily.item.id : ''
    this.setData({ daily: guide.randomEntry(cur) })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(id) })
  },

  goSection(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/section/section?id=' + encodeURIComponent(id) })
  },

  // 收藏页是 tabBar 页,必须用 switchTab,不能 navigateTo
  goFav() {
    wx.switchTab({ url: '/pages/favorite/favorite' })
  },

  // 新手必看 Top 10(用成本标签算出来的入门清单)。
  //「发现」是 tabBar 页,必须用 switchTab,不能 navigateTo
  goPicks() {
    wx.switchTab({ url: '/pages/picks/picks' })
  },

  // 按主题 / 人生阶段找
  goTopic(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/topic/topic?id=' + encodeURIComponent(id) })
  }
})
