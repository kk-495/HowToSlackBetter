const guide = require('../../utils/guide.js')
const share = require('../../utils/share.js')

Page({
  // 标题/授权/来源直接取数据里的 meta,别在页面里再抄一份 —— 抄的那份迟早和数据对不上
  data: { count: 0, sectionCount: 0, meta: guide.meta },

  onLoad() {
    share.enableShare()
    this.setData({
      count: guide.itemCount(),
      sectionCount: guide.sectionTitles().length
    })
  },

  // 关于是低频页,已从 tabBar 降级为「我的」页里的一行,
  // 所以这里不再需要同步 tabBar 激活态。

  onShareAppMessage() {
    return {
      title: '高性价比人生指南:' + guide.itemCount() + ' 条,按性价比排好',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return { title: '高性价比人生指南:' + guide.itemCount() + ' 条实用建议' }
  }
})
