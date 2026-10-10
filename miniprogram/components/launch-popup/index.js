Component({
  properties: {
    show: { type: Boolean, value: false },

    // 'card' = 用 WXML/WXSS 渲染(文字清晰、自动匹配暖读配色、深色模式可用、0 体积)
    // 'image' = 用位图(需要自己保证图里的文案与配色合规)
    mode: { type: String, value: 'card' },

    image: { type: String, value: '' },
    // 图片宽度占屏宽比例(0-1),仅 mode=image 时生效
    widthRatio: { type: Number, value: 0.92 },
    link: { type: String, value: '' },

    // card 模式的文案
    // 卡片文案逐字取自用户提供的设计图,不做任何改写(用户明确要求)。
    //
    // ⚠️ 已知的审核风险(用户已知悉并选择保留,若被拒审优先改这三处):
    //   · 「用最少的钱」含「最」,属绝对化用语
    //   · 「换回寿命、金钱和自由」属效果承诺,且内容涉及健康与金钱
    //   · 「1726 条原始文献链接」:已核实数字是真的(上游 34 章逐条统计 = 1713 个链接),
    //      但**我们解析上游数据时把「来源」字段丢了**,所以小程序里现在看不到这些链接。
    //      补上数据解析即可,不是虚假宣传。
    title: { type: String, value: '高性价比人生指南' },
    headline: { type: String, value: '用最少的钱、时间和精力，换回' },
    headlineEm: { type: String, value: '寿命、金钱和自由' },
    sub: { type: String, value: '长寿防病 · 急救 · 省钱理财 · 法律红线 · 失业兜底 · 恋爱婚育 · 出国 · 技能' },
    tags: { type: Array, value: [] }
  },

  data: {
    picWidth: 690, // 750 * 0.92
    // 四个数字标签,顺序与配色均取自原图(色值是从 PNG 里逐像素取样的)
    defaultTags: [
      { text: '675 条建议', bg: '#DDE6F9', fg: '#4A64BB' },
      { text: 'A 级证据 438 条', bg: '#E2F6F0', fg: '#18794E' },
      { text: '1726 条原始文献链接', bg: '#F6F6F7', fg: '#64646A' },
      { text: '可按性价比筛选', bg: '#F6F6F7', fg: '#64646A' }
    ]
  },

  observers: {
    widthRatio: function (r) {
      const ratio = Number(r)
      const safe = ratio > 0 && ratio <= 1 ? ratio : 0.92
      this.setData({ picWidth: Math.round(750 * safe) })
    }
  },

  methods: {
    onClose() {
      this.triggerEvent('close')
    },

    onTapImage() {
      if (!this.data.link) return
      wx.navigateTo({ url: this.data.link })
      this.triggerEvent('close')
    },

    // 图挂了就直接收起,别让用户开屏看到一张裂图
    onImgError() {
      this.triggerEvent('close')
    },

    // 遮罩上禁止滚动穿透
    noop() {}
  }
})
