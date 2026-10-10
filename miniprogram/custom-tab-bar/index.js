Component({
  data: {
    selected: 0,
    // 必须与 app.json 的 tabBar.list 逐项一致(顺序也要一致),
    // 页面 onShow 是按下标推 selected 的,两边对不上高亮就会"乱跳"。
    list: [
      { pagePath: '/pages/index/index', text: '指南', icon: 'ic-book' },
      { pagePath: '/pages/picks/picks', text: '发现', icon: 'ic-compass' },
      { pagePath: '/pages/favorite/favorite', text: '我的', icon: 'ic-user' }
    ]
  },

  methods: {
    onTap(e) {
      const i = Number(e.currentTarget.dataset.index)
      const item = this.data.list[i]
      if (!item || i === this.data.selected) return
      this.setData({ selected: i })
      wx.switchTab({ url: item.pagePath })
    }
  }
})
