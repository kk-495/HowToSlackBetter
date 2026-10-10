// 打开转发入口。
// 必须在每个页面的 onLoad 里调一次:只定义 onShareAppMessage 时,右上角"···"里
// 不一定出现"分享到朋友圈";显式调用 showShareMenu 才能把两个入口都放出来。
// 朋友圈(shareTimeline)目前仅安卓可用,这里一并声明,不支持时会自动忽略。

function enableShare() {
  if (typeof wx === 'undefined' || !wx || typeof wx.showShareMenu !== 'function') return
  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  })
}

module.exports = {
  enableShare: enableShare
}
