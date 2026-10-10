Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '指南', icon: 'ic-book' },
      { pagePath: '/pages/favorite/favorite', text: '收藏', icon: 'ic-star' },
      { pagePath: '/pages/about/about', text: '关于', icon: 'ic-info' }
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
