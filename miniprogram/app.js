App({
  onLaunch() {
    // 预热索引:内容拆成了 22 个数据模块,这里提前 require 一次,
    // 首页 onLoad 时就不必再等首次解析(模块有缓存,后续所有页面共用同一份)。
    require('./utils/guide.js')

    // 版本更新:冷启动时微信自动下载新包,这里在「下载完成」时提示一次重启生效。
    // 不强制重启 —— 用户可能正在看一半,让 ta 自己选。
    if (wx.getUpdateManager) {
      const um = wx.getUpdateManager()
      um.onUpdateReady(function () {
        wx.showModal({
          title: '更新提示',
          content: '新版本已经准备好,重启小程序即可生效',
          confirmText: '重启',
          cancelText: '稍后',
          success: function (res) {
            if (res.confirm) um.applyUpdate()
          }
        })
      })
    }
  }
})
