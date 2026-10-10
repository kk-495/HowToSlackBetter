App({
  onLaunch() {
    // 预热索引:内容拆成了 34 个数据模块,这里提前 require 一次,
    // 首页 onLoad 时就不必再等首次解析(模块有缓存,后续所有页面共用同一份)。
    require('./utils/guide.js')
  }
})
