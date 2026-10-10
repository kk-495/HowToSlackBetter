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

    // card 模式的文案(v3 开篇卡)
    // slogan「少一点无效忙碌,多留时间、精力与边界」逐字取自摸鱼指南(HowToSlackBetter)封面语。
    //
    // ⚠️ 已知的审核风险(若被拒审优先检查):
    //   · 「时间、精力与边界」属收益描述,已避免效果承诺与绝对化用语(旧版「用最少的钱」已移除)
    //   · 数字与 manifest 一致:90 条 / A 级 25 条 / 99 个链接,
    //     均由 tools/parse-rest-book.js 从上游数据实测统计,不是拍出来的。
    title: { type: String, value: '高性价比摸鱼指南' },
    headline: { type: String, value: '少一点无效忙碌，多留' },
    headlineEm: { type: String, value: '时间、精力与边界' },
    sub: { type: String, value: '会议与异步 · 注意力 · 休假边界 · 情绪劳动 · 远程协作 · 工时排班 · 场景话术' },
    tags: { type: Array, value: [] }
  },

  data: {
    picWidth: 690, // 750 * 0.92
    // 数字标签:与 data/sections/index.js 的 manifest 统计保持一致(测试守着)
    defaultTags: [
      { text: '90 条建议', bg: '#DEEAF3', fg: '#1E5A8A' },
      { text: 'A 级证据 25 条', bg: '#DFEBF4', fg: '#1E5A8A' },
      { text: '99 条原始文献链接', bg: '#F6F6F7', fg: '#64646A' },
      { text: '可按证据等级筛选', bg: '#F6F6F7', fg: '#64646A' }
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
