const fav = require('../../utils/favorite.js')
const recent = require('../../utils/recent.js')
const guide = require('../../utils/guide.js')
const settings = require('../../utils/settings.js')
const share = require('../../utils/share.js')

// 从 URL 里取出域名,给来源列表做短标识(完整链接太长,列表里放不下)
function hostOf(u) {
  const m = /^https?:\/\/([^/]+)/.exec(String(u || ''))
  return m ? m[1] : ''
}

// 跨章节相关推荐:复用 utils/topics.js 的标签算出同类条目(零新数据,见 guide.related)
function relatedRows(id) {
  return guide.related(id, 4).map(function (e) {
    return {
      id: e.item.id,
      title: e.item.title,
      section: e.section,
      level: e.item.level,
      sourceCount: (e.item.source || []).length
    }
  })
}

Page({
  data: {
    id: '',
    title: '',
    section: '',
    sectionId: '',
    level: '',
    levelNote: '',
    tier: '',
    // 上游的六个字段,原样保留结构,不再压成一段
    cost: '',      // 要花什么
    plain: '',     // 说人话
    benefit: '',   // 能得什么
    note: '',      // 要注意什么
    costChips: [], // 成本标签拆成的胶囊:钱=0 / 时间=少 / …
    source: [],    // [{t: 出处, u: 链接, host: 域名}]
    faved: false,
    notFound: false,
    neighbor: null,
    // 跨章节「看更多同类」:被分享进来的人只有章节内导航,这是唯一出口
    related: [],
    // 长条目的浮动操作条(正文最长 1809 字,滚到底部才看到操作按钮太累)
    showBar: false,
    // 流量主开通后把广告位 id 填在这里(形如 'adunit-xxxxxxxx'),页面才会渲染 <ad>;
    // 留空则完全不产生广告 DOM,避免"未开通却展示广告位"的审核风险
    adUnitId: '',
    // 正文字号档位:0 小(30rpx) / 1 标准(32rpx) / 2 大(38rpx),持久化在本地
    fontScale: settings.DEFAULT_FONT_SCALE
  },

  onLoad(query) {
    share.enableShare()
    this._over = false          // 是否已滚过一屏(浮动操作条的触发条件)
    this._actionsVisible = true // 初始认为底部操作条还没滚出视野
    this._hasIO = false
    this.setData({ fontScale: settings.get().fontScale })
    const id = decodeURIComponent((query && query.id) || '')
    const entry = guide.findItem(id)
    if (!entry) {
      this.setData({ notFound: true, id: id })
      return
    }
    recent.markRead(id)
    // 已读集合不在这里写 —— 它最多 675 个 id(约 3.4KB),同步写 storage 会挡在首屏渲染前面,
    // 表现就是"点了一条要等一下才跳过来"。挪到 onReady(首屏渲染之后)再写。
    const item = entry.item
    wx.setNavigationBarTitle({ title: item.title })
    const nb = guide.neighbor(id) || {}
    this.setData({
      id: id,
      title: item.title,
      section: entry.section,
      sectionId: nb.sectionId || entry.sectionId || '',
      level: item.level,
      levelNote: item.levelNote || '',
      tier: item.tier,
      cost: item.cost,
      plain: item.plain,
      benefit: item.benefit,
      note: item.note,
      costChips: String(item.costTag || '').split(/\s+/).filter(Boolean),
      source: (item.source || []).map(function (s) {
        return { t: s.t, u: s.u, host: hostOf(s.u) }
      }),
      faved: fav.isFavorite(id),
      related: relatedRows(id),
      // nb.index 已是 1 基(章节内第几条),不要再 +1
      neighbor: {
        prev: nb.prev || null,
        next: nb.next || null,
        index: nb.index || 0,
        total: nb.total || 0,
        section: nb.section || entry.section
      }
    })
  },

  onReady() {
    // 已读集合挪到这里写:首屏已经渲染完了,写 storage 不再挡渲染。
    // 只在遇到新 id 时才真正落盘(recent.markReadId 内部判断),所以一辈子最多写 675 次。
    if (this.data.id) recent.markReadId(this.data.id)

    // 底部那排操作按钮要滚过整个正文才看得到(正文中位 418 字、最长 1809 字)。
    // 这里监听它是否进入视口:还没进入(也就是用户还在正文里滚)时浮一条操作条出来。
    // 不支持 IntersectionObserver 的基础库会退化成「只按滚动距离判断」。
    if (this.data.notFound || typeof wx.createIntersectionObserver !== 'function') return
    try {
      this._io = wx.createIntersectionObserver(this)
      this._io.relativeToViewport().observe('.actions', (res) => {
        this._actionsVisible = res.intersectionRatio > 0
        this.syncBar()
      })
      this._hasIO = true
    } catch (e) {
      this._hasIO = false
    }
  },

  onPageScroll(e) {
    // onPageScroll 每帧都会跨线程回调一次,所以这里只做一次比较:
    // 状态没变就直接返回,不做任何其它工作
    const over = e.scrollTop > 400
    if (over === this._over) return
    this._over = over
    this.syncBar()
  },

  syncBar() {
    const want = this._over && !(this._hasIO && this._actionsVisible)
    if (want !== this.data.showBar) this.setData({ showBar: want })
  },

  onUnload() {
    if (this._io) { this._io.disconnect(); this._io = null }
  },

  onToggleFav() {
    if (!this.data.id) return
    const on = fav.toggleFavorite(this.data.id)
    this.setData({ faved: on })
    wx.showToast({ title: on ? '已收藏' : '已取消收藏', icon: 'none' })
  },

  // 复制全文(标题 + 说人话 + 要花什么 + 能得什么 + 要注意什么 + 来源)
  onCopy() {
    if (!this.data.plain && !this.data.benefit) return
    const lines = [this.data.title]
    if (this.data.plain) lines.push('', '说人话：' + this.data.plain)
    if (this.data.cost) lines.push('', '要花什么：' + this.data.cost)
    if (this.data.benefit) lines.push('', '能得什么：' + this.data.benefit)
    if (this.data.note) lines.push('', '要注意什么：' + this.data.note)
    if (this.data.source.length) {
      lines.push('', '来源：')
      this.data.source.forEach(function (s) {
        lines.push('- ' + s.t + (s.u ? ' ' + s.u : ''))
      })
    }
    wx.setClipboardData({ data: lines.join('\n') })
  },

  // 单条来源:点一下复制链接。
  //
  // ⚠️ 为什么不做成"直接跳转":微信官方 web-view 文档写明
  //    「承载网页的容器……个人类型的小程序暂不支持使用」。
  //    个人主体小程序无法在小程序内打开任何第三方网页;即使换成企业主体,
  //    web-view 也要求域名在自有「业务域名」白名单里(最多 200 个,且要上传校验文件),
  //    而全书的 1713 条来源横跨几百个政府/学术站点,一个都不归我们所有。
  //    → 复制链接到浏览器打开,是唯一可行且合规的方式。
  onCopyLink(e) {
    const u = e.currentTarget.dataset.u
    if (!u) {
      wx.showToast({ title: '这条来源没有附链接', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: u,
      success() {
        // setClipboardData 自带一个「内容已复制」的 toast,先关掉再显示我们自己的
        wx.hideToast()
        wx.showToast({ title: '链接已复制,去浏览器打开', icon: 'none', duration: 2200 })
      }
    })
  },

  // 一次复制本条的全部来源,方便整段贴到别处核对
  onCopyAllSource() {
    if (!this.data.source.length) return
    const lines = [this.data.title + ' — 来源']
    this.data.source.forEach(function (s, i) {
      lines.push((i + 1) + '. ' + s.t + (s.u ? ' ' + s.u : ''))
    })
    wx.setClipboardData({
      data: lines.join('\n'),
      success() {
        wx.hideToast()
        wx.showToast({ title: '已复制全部 ' + lines.length - 1 + ' 条来源', icon: 'none', duration: 2000 })
      }
    })
  },

  // 三档字号,选完立刻生效并记到本地
  onSetFont(e) {
    const n = Number(e.currentTarget.dataset.n)
    if (n === this.data.fontScale) return
    settings.setFontScale(n)
    this.setData({ fontScale: settings.get().fontScale })
  },

  goNeighbor(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.redirectTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(id) })
  },

  // 相关推荐是跨章节的,用 redirectTo 免得用户连点十几条把页面栈撑满
  goRelated(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.redirectTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(id) })
  },

  // 「本章目录」。
  //
  // ⚠️ 以前一律 navigateTo 压新页,与章节页的 goDetail 构成 section ↔ detail 循环:
  //    section → detail → 本章目录 → section → detail → …
  //    4 轮往返就撞上 10 层页面栈上限,此后 navigateTo **静默失败**
  //    —— 用户看到按钮变色了却没跳转,比「点了没反应」更隐蔽。
  // 修法:上一页本来就是同一个章节时,直接 navigateBack,根本不产生新页。
  goSection() {
    if (!this.data.sectionId) return
    const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : []
    const prev = pages.length > 1 ? pages[pages.length - 2] : null
    if (prev && prev.route === 'pages/section/section' && prev.data &&
      Number(prev.data.sectionId) === Number(this.data.sectionId)) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: '/pages/section/section?id=' + encodeURIComponent(this.data.sectionId) })
  },

  // 从分享链接打开一条已失效的内容时,这是唯一的出口
  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 分享文案优先用「说人话」——标题是书的语言,说人话才是能转给家人的那句
  shareTitle() {
    const p = String(this.data.plain || '').trim()
    const t = p && p.length <= 44 ? p : this.data.title
    return t + ' · 人生指南'
  },

  onShareAppMessage() {
    return {
      title: this.shareTitle(),
      path: '/pages/detail/detail?id=' + encodeURIComponent(this.data.id)
    }
  },

  onShareTimeline() {
    return {
      title: this.shareTitle(),
      query: 'id=' + encodeURIComponent(this.data.id)
    }
  }
})
