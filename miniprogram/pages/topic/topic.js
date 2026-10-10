const guide = require('../../utils/guide.js')
const topics = require('../../utils/topics.js')
const share = require('../../utils/share.js')

const PAGE = 20            // 每次渲染 20 条,触底再追加
const TOP_THRESHOLD = 600  // 滚过这个距离才显示"回到顶部"
const PICKS = 5            // 「本主题先看这几条」取前 5 条

// 等级权重用 guide 的唯一一份(摸鱼数据只有 A/B,不给 C 留错觉)

function rowOf(e, no) {
  return {
    id: e.item.id,
    no: no || '',
    title: e.item.title,
    section: e.section,
    level: e.item.level,
    tier: e.item.tier,
    plain: e.item.plain,
    sourceCount: (e.item.source || []).length
  }
}

Page({
  data: {
    tagId: '',
    name: '',
    desc: '',
    count: 0,
    sections: [],
    picks: [],
    items: [],
    showTop: false,
    notFound: false
  },

  onLoad(query) {
    share.enableShare()
    this._all = []
    const id = (query && query.id) || ''
    const tag = topics.findTag(id)
    if (!tag) {
      this.setData({ notFound: true })
      return
    }

    // 主题落地页必须「条目直出」。
    // 旧版点标签看到的是章节书名 —— 那是书的语言,
    // 用户点进来是想直接看内容,不是再解一次码。
    const ids = topics.sectionsOfTag(id)
    const secs = guide.sectionTitles().filter(function (s) {
      return ids.indexOf(s.id) !== -1
    })
    const entries = []
    ids.forEach(function (sid) {
      guide.itemsOfSection(sid).forEach(function (e) { entries.push(e) })
    })

    // 顶部「本主题先看这几条」:同主题里证据等级最高的条目(A>B,再按 id 稳定)
    const easy = entries.slice().sort(function (a, b) {
      const la = guide.LEVEL_WEIGHT[a.item.level]
      const lb = guide.LEVEL_WEIGHT[b.item.level]
      if (la !== lb) return (la === undefined ? 9 : la) - (lb === undefined ? 9 : lb)
      return a.item.id < b.item.id ? -1 : 1
    })

    // 判断标签类型:主题 / 人生阶段 —— 摸鱼指南无阶段标签,恒为主题
    const isStage = topics.STAGES.some(function (s) { return s.id === id })
    const tagType = isStage ? 'stage' : 'topic'
    const tagTypeLabel = isStage ? '人生阶段' : '按主题'

    wx.setNavigationBarTitle({ title: tag.name + ' · 摸鱼指南' })
    this._all = entries.map(function (e) { return rowOf(e) })
    this.setData({
      tagId: id,
      tagType: tagType,
      tagTypeLabel: tagTypeLabel,
      name: tag.name,
      desc: tag.desc,
      count: entries.length,
      sections: secs,
      picks: easy.slice(0, PICKS).map(function (e, i) {
        return rowOf(e, String(i + 1).padStart(2, '0'))
      }),
      items: this._all.slice(0, PAGE)
    })
  },

  // 触底再渲染下一批
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

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(id) })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    return {
      title: this.data.name + ':' + this.data.count + ' 条实用建议 · 摸鱼指南',
      path: '/pages/topic/topic?id=' + encodeURIComponent(this.data.tagId)
    }
  },

  onShareTimeline() {
    return {
      title: this.data.name + ' · 摸鱼指南',
      query: 'id=' + encodeURIComponent(this.data.tagId)
    }
  }
})
