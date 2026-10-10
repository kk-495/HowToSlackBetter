// 打桩回归测试:不依赖微信环境,全部逻辑在 node 下跑。
// 运行:node miniprogram/tests/harness.js
const fs = require('fs')
const path = require('path')

const APP = path.join(__dirname, '..')
let pass = 0
let fail = 0
function t(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name) }
  else { fail++; console.log('FAIL ' + name + (extra ? ' -> ' + extra : '')) }
}

// ---- 1. 数据完整性 ----
const SEC_DIR = path.join(APP, 'data', 'sections')
const manifest = require(path.join(SEC_DIR, 'index.js'))
const data = { meta: manifest.meta, sections: manifest.sections.map(function (m) {
  return require(path.join(SEC_DIR, m.file))
}) }
t('manifest.sections 是非空数组', Array.isArray(manifest.sections) && manifest.sections.length > 0, manifest.sections && manifest.sections.length)
t('meta.count 与条目总数一致', data.meta.count === data.sections.reduce((n, s) => n + s.items.length, 0))
t('manifest 引用的文件都存在', manifest.sections.every(function (m) {
  return /^[0-9]+\.js$/.test(m.file) && fs.existsSync(path.join(SEC_DIR, m.file))
}))

const ids = new Set()
let dup = 0
data.sections.forEach(s => s.items.forEach(i => { if (ids.has(i.id)) dup++; ids.add(i.id) }))
t('条目 id 无重复', dup === 0, 'dup=' + dup)
t('id 数量 = count', ids.size === data.meta.count)
// id 稳定化:章号 + 标题哈希(36 进制 6 位)。上游插入新条目时老条目 id 不漂移,收藏/已读不丢
t('id 格式 = 章号-标题哈希', data.sections.every(s => s.items.every(i =>
  new RegExp('^' + s.id + '-[a-z0-9]{6}$').test(i.id))))

// 上游的六个字段(成本/说人话/收益/证据等级/来源/备注)必须完整保留,不再压成一段
const FIELDS = ['id', 'title', 'cost', 'plain', 'benefit', 'level', 'levelNote', 'source', 'note', 'costTag', 'tier']
let missing = 0
data.sections.forEach(s => s.items.forEach(i => FIELDS.forEach(f => { if (i[f] === undefined) missing++ })))
t('条目十一个字段无 undefined', missing === 0, 'missing=' + missing)

t('source 是数组且每项含 t/u', data.sections.every(s => s.items.every(i =>
  Array.isArray(i.source) && i.source.every(x => typeof x.t === 'string' && typeof x.u === 'string'))))
const withSrc = data.sections.reduce((n, s) => n + s.items.filter(i => i.source.length > 0).length, 0)
t('每条建议都有来源', withSrc === data.meta.count, withSrc + '/' + data.meta.count)
const linkCount = data.sections.reduce((n, s) => n + s.items.reduce((m, i) => m + i.source.filter(x => x.u).length, 0), 0)
const entryCount = data.sections.reduce((n, s) => n + s.items.reduce((m, i) => m + i.source.length, 0), 0)
t('来源条目数与 manifest 一致', entryCount === data.meta.sourceCount, entryCount + ' vs ' + data.meta.sourceCount)
t('来源链接数与 manifest 一致', linkCount === data.meta.linkCount, linkCount + ' vs ' + data.meta.linkCount)
t('摸鱼来源全部带链接', linkCount === entryCount && linkCount === 99, linkCount + '/' + entryCount)
t('证据等级批注:摸鱼指南无批注(字段保留为空)',
  data.sections.reduce((n, s) => n + s.items.filter(i => i.levelNote).length, 0) === 0)
t('成本标签可拆成胶囊(摸鱼指南无成本标签,跳过)',
  data.sections.every(s => s.items.every(i =>
    !(typeof i.costTag === 'string' && i.costTag.length) ||
    i.costTag.split(/\s+/).filter(Boolean).length >= 4)))

const LEVELS = {}
const TIERS = {}
data.sections.forEach(s => s.items.forEach(i => { LEVELS[i.level] = (LEVELS[i.level] || 0) + 1; TIERS[i.tier] = (TIERS[i.tier] || 0) + 1 }))
t('level 仅含 A/B(摸鱼指南上游只分两档)', Object.keys(LEVELS).sort().join() === 'A,B', JSON.stringify(LEVELS))
t('tier 仅含 极高/高/一般(空值=摸鱼指南条目,无性价比分级)',
  Object.keys(TIERS).every(k => k === '' || ['极高', '高', '一般'].indexOf(k) !== -1), JSON.stringify(TIERS))

const maxLen = data.sections.reduce((m, s) => s.items.reduce((n, i) => Math.max(n, (i.benefit || '').length + (i.note || '').length), m), 0)
t('单条最长正文 < 20000 字(不炸渲染)', maxLen < 20000, 'maxLen=' + maxLen)

// ---- 2. 单文件体积(过大单文件基础库直接编译丢弃) ----
let maxFile = 0
manifest.sections.forEach(function (m) { maxFile = Math.max(maxFile, fs.statSync(path.join(SEC_DIR, m.file)).size) })
t('单个数据模块 < 200KB', maxFile < 200 * 1024, 'maxFile=' + maxFile)
t('manifest < 50KB', fs.statSync(path.join(SEC_DIR, 'index.js')).size < 50 * 1024)

// ---- 3. 索引与搜索逻辑 ----
const guide = require(path.join(APP, 'utils', 'guide.js'))
t('索引条目数 = count', guide.itemCount() === data.meta.count)
t('sectionTitles 数量 = 节数', guide.sectionTitles().length === data.sections.length)
t('节条目数合计一致', guide.sectionTitles().reduce((n, s) => n + s.count, 0) === data.meta.count)

const first = guide.allItems()[0]
const hit = guide.findItem(first.item.id)
t('findItem 精确命中', !!hit && hit.item.title === first.item.title)
t('findItem 未命中返回 null', guide.findItem('nope-999') === null)

const empty = guide.search('', null)
t('空查询返回全部', empty.length === data.meta.count, empty.length)

const kw = guide.search('会议', null)
t('关键词「会议」有结果', kw.length > 0)
t('关键词结果相关(含关键词)', kw.every(h => {
  const s = guide.searchText(h.entry.item)
  return s.indexOf('会议') !== -1
}))
t('标题命中排在正文命中之前', (() => {
  const titleHit = kw.filter(h => h.field === 'title').length
  const bodyHit = kw.filter(h => h.field === 'body').length
  if (!titleHit || !bodyHit) return true
  const lastTitle = kw.map(h => h.field).lastIndexOf('title')
  const firstBody = kw.map(h => h.field).indexOf('body')
  return lastTitle < firstBody
})())

const noHit = guide.search('绝不可能出现的词xyzzy', null)
t('无命中返回空数组', noHit.length === 0)

const la = guide.search('', 'A')
t('A 级筛选只剩 A', la.length === LEVELS.A && la.every(h => h.entry.item.level === 'A'), la.length + ' vs ' + LEVELS.A)
t('筛选 + 关键词同时生效', guide.search('四天工作周', 'A').every(h => h.entry.item.level === 'A'))

// 搜索热路径优化后的正确性:中文查询不做 toLowerCase,必须与朴素全字段匹配结果一致
;(function () {
  const q = '会议'
  const expect = guide.allItems().filter(function (e) {
    return guide.searchText(e.item).indexOf(q) !== -1
  }).length
  t('中文查询命中数与朴素匹配一致', guide.search(q, null).length === expect, guide.search(q, null).length + ' vs ' + expect)
  const up = guide.search('Eurofound', null)
  const low = guide.search('eurofound', null)
  t('拉丁查询大小写不敏感且结果一致', up.length === low.length && up.length > 0, up.length + ' / ' + low.length)
  t('拉丁查询命中真实正文(Eurofound 出现在工时条目)', low.length > 0 && low.every(function (h) {
    return guide.searchText(h.entry.item).toLowerCase().indexOf('eurofound') !== -1
  }))
  t('空查询在两种分支下都返回全部', guide.search('', null).length === data.meta.count)
})()

// ---- 3b. 关键词高亮切片 ----
;(function () {
  const seg = guide.highlight('系好安全带很关键', '安全带')
  t('高亮切片命中一段', seg.filter(s => s.hit).length === 1 && seg.filter(s => s.hit)[0].text === '安全带')
  t('高亮切片不丢字符', seg.map(s => s.text).join('') === '系好安全带很关键')
  t('空查询不高亮', guide.highlight('abc', '').every(s => !s.hit))
  t('无命中不高亮但保留全文', guide.highlight('abc', 'zzz').length === 1 && guide.highlight('abc', 'zzz')[0].text === 'abc')
  t('大小写不敏感命中', guide.highlight('ABCdef', 'abc').filter(s => s.hit).length === 1)
  const multi = guide.highlight('安全带 安全带', '安全带')
  t('多处命中切多段', multi.filter(s => s.hit).length === 2 && multi.map(s => s.text).join('') === '安全带 安全带')
})()

// ---- 3c. 章节内上一条/下一条(用第 3 章:7 条,足够测首/中/末) ----
;(function () {
  const list = guide.itemsOfSection(3)
  const first = guide.neighbor(list[0].item.id)
  t('首条无上一条', first && first.prev === null)
  t('首条有下一条', first && first.next && first.next.id === list[1].item.id)
  t('首条索引为 1/N', first.index === 1 && first.total === list.length)
  const last = guide.neighbor(list[list.length - 1].item.id)
  t('末条无下一条', last && last.next === null)
  t('末条有上一条', last && last.prev && last.prev.id === list[list.length - 2].item.id)
  t('末条索引为 N/N', last.index === list.length)
  t('未知 id 返回 null', guide.neighbor('nope') === null)
  t('neighbor 带 sectionId 且与章节一致', guide.neighbor(list[0].item.id).sectionId === 3)
  const sec = list[2].item
  const nb = guide.neighbor(sec.id)
  t('邻接条目 id 不重复', nb.prev.id !== nb.next.id && nb.prev.id !== sec.id && nb.next.id !== sec.id)
})()

// ---- 4. 每日一条 ----
const k1 = '2026-10-08'
const k2 = '2026-10-09'
t('dateKey() 无参也能用', /^\d{4}-\d{2}-\d{2}$/.test(guide.dateKey()) && guide.dateKey().indexOf('NaN') === -1, guide.dateKey())
t('dateKey() 与今天一致', guide.dateKey() === guide.dateKey(new Date()))
t('dateKey 传 Date 正确', guide.dateKey(new Date(2026, 9, 8)) === '2026-10-08')
t('dateKey 传字符串正确', guide.dateKey('2026-10-08T23:30:00') === '2026-10-08')
const N = guide.itemCount()
t('同一天索引稳定', guide.dailyIndex(N, k1) === guide.dailyIndex(N, k1))
t('索引在范围内', guide.dailyIndex(N, k1) >= 0 && guide.dailyIndex(N, k1) < N)
t('dailyEntry 返回条目', guide.dailyEntry(k1) && guide.dailyEntry(k1).item.id)
// 单对日期可能撞索引(1/N 概率),相邻 7 天内必有两个不同条目才算"跨天会变"
let entryVaries = false
for (let i = 1; i <= 7 && !entryVaries; i++) {
  const dk = guide.dateKey(new Date(2026, 9, 8 + i))
  if (guide.dailyEntry(k1).item.id !== guide.dailyEntry(dk).item.id) entryVaries = true
}
t('dailyEntry 跨天会变(相邻 7 天内)', entryVaries)
const kCover = new Set()
for (let i = 0; i < 60; i++) {
  const d = new Date(2026, 0, 1 + i)
  kCover.add(guide.dailyIndex(N, guide.dateKey(d)))
}
t('60 天内索引有分散(>30 种)', kCover.size > 30, kCover.size)

// ---- 5. 随机不重复 ----
const cur = guide.allItems()[3].item.id
const rand = guide.randomEntry(cur)
t('随机换一条 != 当天那条', rand && rand.item.id !== cur)
const only = guide.randomEntry(guide.allItems()[0].item.id)
t('只剩一条时也能返回', !!only)

// ---- 6. 收藏 ----
const fav = require(path.join(APP, 'utils', 'favorite.js'))
const realIds = guide.allItems().map(function (e) { return e.item.id })
t('初始无收藏', fav.listFavorites().length === 0)
t('toggle 加入', fav.toggleFavorite(realIds[0]) === true && fav.isFavorite(realIds[0]))
t('toggle 取消', fav.toggleFavorite(realIds[0]) === false && !fav.isFavorite(realIds[0]))
t('收藏可保存与读取', (fav.saveFavorites([realIds[1]]), fav.isFavorite(realIds[1]) && fav.listFavorites().length === 1))
fav.saveFavorites([realIds[0], realIds[1]])
t('收藏条目能取到正文', fav.favoriteEntries(guide.allItems()).length === 2)
fav.saveFavorites([])
t('收藏可清空', fav.listFavorites().length === 0)

// ---- 7. 文件与配置自检 ----
const appJson = JSON.parse(fs.readFileSync(path.join(APP, 'app.json'), 'utf8'))
const files = ['index', 'section', 'detail', 'favorite', 'about']
t('app.json pages 与目录一致', files.every(f => appJson.pages.indexOf('pages/' + f + '/' + f) !== -1))
t('每个页面四个文件齐全', files.every(f => ['js', 'json', 'wxml', 'wxss'].every(e => fs.existsSync(path.join(APP, 'pages', f, f + '.' + e)))))

t('packOptions 排除 tests 与 README', (function () {
  const pc = JSON.parse(fs.readFileSync(path.join(APP, 'project.config.json'), 'utf8'))
  const ig = (pc.packOptions && pc.packOptions.ignore) || []
  return ig.some(x => x.value === 'tests') && ig.some(x => x.value === 'README.md')
})())

const noNet = ['index', 'section', 'detail', 'favorite', 'about'].map(f =>
  fs.readFileSync(path.join(APP, 'pages', f, f + '.js'), 'utf8')
).join('\n') + ['guide', 'favorite', 'recent', 'storage', 'settings', 'search-history', 'share', 'notice', 'hot-words'].map(n =>
  fs.readFileSync(path.join(APP, 'utils', n + '.js'), 'utf8')
).join('\n') + fs.readFileSync(path.join(APP, 'custom-tab-bar', 'index.js'), 'utf8') +
  fs.readFileSync(path.join(APP, 'components', 'launch-popup', 'index.js'), 'utf8')
t('源码无 wx.request', noNet.indexOf('wx.request') === -1)
t('源码无 uploadFile', noNet.indexOf('uploadFile') === -1)
t('源码无 http(s) 外链', /https?:\/\//.test(noNet) === false)
t('源码无登录/getUserProfile', noNet.indexOf('getUserProfile') === -1)

// ---- 8. WXML 标签闭合 ----
;(function checkWxml() {
  const list = []
  ;(function walk(d) {
    fs.readdirSync(d).forEach(n => {
      const p = path.join(d, n)
      if (fs.statSync(p).isDirectory()) return walk(p)
      if (n.endsWith('.wxml')) list.push(p)
    })
  })(path.join(APP, 'pages'))
  let badTags = []
  list.forEach(p => {
    const src = fs.readFileSync(p, 'utf8')
    const re = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g
    const stack = []
    let m
    while ((m = re.exec(src))) {
      const whole = m[0]
      const name = m[1].toLowerCase()
      if (/^<\//.test(whole)) {
        const top = stack.pop()
        if (top !== name) { badTags.push(path.basename(p) + ' 闭合不匹配 ' + name); break }
      } else if (!/\/>\s*$/.test(whole)) {
        stack.push(name)
      }
    }
    if (!badTags.length && stack.length) badTags.push(path.basename(p) + ' 未闭合 ' + stack.join(','))
  })
  t('所有 wxml 标签闭合正确(' + list.length + ' 个)', badTags.length === 0, badTags.join(' | '))
})()

// ---- 6b. 阅读历史 ----
const recent = require(path.join(APP, 'utils', 'recent.js'))
const idA = realIds[0]
const idB = realIds[1]
t('初始无历史', recent.list().length === 0)
recent.markRead(idA, 100)
t('记一条', recent.list().length === 1 && recent.list()[0].id === idA)
recent.markRead(idB, 200)
t('新的排最前', recent.list()[0].id === idB && recent.list()[1].id === idA)
recent.markRead(idA, 300)
t('重复读不叠加且提前', recent.list().length === 2 && recent.list()[0].id === idA)
t('空 id 不记', (recent.markRead('', 400), recent.list().length === 2))
t('历史可映射为条目', recent.entries(guide.allItems()).length === 2)
const many = []
for (let i = 0; i < 40; i++) many.push(realIds[i % realIds.length] + '-' + i)
many.forEach(function (id, k) { recent.markRead(id, k) })
t('历史上限 30 条', recent.list().length === 30, recent.list().length)
recent.clear()
t('历史可清空', recent.list().length === 0)

// ---- 9. 视觉重设计:自定义 tabBar / 深色模式 / 图标 / 断行 ----
;(function () {
  const appJson = JSON.parse(fs.readFileSync(path.join(APP, 'app.json'), 'utf8'))

  // 自定义 tabBar
  t('app.json 配置了自定义 tabBar', !!appJson.tabBar && appJson.tabBar.custom === true)
  const tabs = (appJson.tabBar && appJson.tabBar.list) || []
  t('tabBar 有 3 个 tab', tabs.length === 3, tabs.length)
  t('tabBar 每个 tab 都在 pages 里', tabs.every(x => appJson.pages.indexOf(x.pagePath) !== -1))
  t('tabBar 每个 tab 都有文字', tabs.every(x => !!x.text))
  t('custom-tab-bar 四个文件齐全', ['js', 'json', 'wxml', 'wxss'].every(e =>
    fs.existsSync(path.join(APP, 'custom-tab-bar', 'index.' + e))))
  t('custom-tab-bar 声明为组件', JSON.parse(
    fs.readFileSync(path.join(APP, 'custom-tab-bar', 'index.json'), 'utf8')).component === true)
  // 自定义 tabBar 的列表必须与 app.json 逐项一致(页面按下标推 selected,脱节就乱跳)
  const barSrc = fs.readFileSync(path.join(APP, 'custom-tab-bar', 'index.js'), 'utf8')
  const barPaths = []
  barSrc.replace(/pagePath:\s*'([^']+)'/g, (m, p) => { barPaths.push(p); return m })
  t('custom-tab-bar 列表与 app.json 逐项一致',
    JSON.stringify(barPaths.map(p => p.replace(/^\//, ''))) === JSON.stringify(tabs.map(x => x.pagePath)),
    barPaths.join(','))

  // 深色模式
  t('app.json 开启 darkmode', appJson.darkmode === true)
  t('themeLocation 指向 theme.json', appJson.themeLocation === 'theme.json')
  const theme = JSON.parse(fs.readFileSync(path.join(APP, 'theme.json'), 'utf8'))
  t('theme.json 含 light/dark 两套', !!theme.light && !!theme.dark)
  t('theme.json 两套都给了导航栏底色', !!(theme.light.navBgColor && theme.dark.navBgColor))
  t('导航栏与页面底色走主题变量', /^@/.test(appJson.window.navigationBarBackgroundColor) &&
    /^@/.test(appJson.window.backgroundColor))

  const appWxss = fs.readFileSync(path.join(APP, 'app.wxss'), 'utf8')
  const bgInWxss = (appWxss.match(/--color-bg:\s*([#0-9A-Fa-f]+)/) || [])[1]
  t('页面底色与 app.wxss 令牌一致(修掉旧的不一致)', !!bgInWxss &&
    bgInWxss.toUpperCase() === theme.light.bgColor.toUpperCase(), bgInWxss + ' vs ' + theme.light.bgColor)

  // 收集全部样式 / 模板 / 脚本
  const styleFiles = []
  const tplFiles = []
  const jsFiles = []
  ;(function walk(d) {
    fs.readdirSync(d).forEach(n => {
      const p = path.join(d, n)
      if (fs.statSync(p).isDirectory()) return walk(p)
      if (n.endsWith('.wxss')) styleFiles.push(p)
      else if (n.endsWith('.wxml')) tplFiles.push(p)
      else if (n.endsWith('.js')) jsFiles.push(p)
    })
  })(APP)
  const allCss = styleFiles.map(p => fs.readFileSync(p, 'utf8')).join('\n')
  const allTpl = tplFiles.map(p => fs.readFileSync(p, 'utf8')).join('\n')

  // emoji 区块 + 箭头 + dingbats(★ U+2605 / ☆ U+2606 在 2600-26FF,不在此列,属允许字符)
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2700}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u

  t('样式里没有 word-break:break-all', !/word-break\s*:\s*break-all/.test(allCss))
  t('声明了 overflow-wrap:break-word 兜底', /overflow-wrap\s*:\s*break-word/.test(allCss))
  t('样式里没有 emoji 当图标', !EMOJI.test(allCss))
  t('模板里没有 emoji 当图标', !EMOJI.test(allTpl))
  // 只查"声明"形式,避免把解释性注释也算命中
  t('没有用 clip-path 声明(低版本基础库支持不稳)', !/clip-path\s*:/.test(allCss))
  t('清掉了 <button> 默认 ::after 边框', /\.btn::after\s*\{[^}]*border\s*:\s*none/.test(allCss))
  t('有深色模式媒体查询', /prefers-color-scheme\s*:\s*dark/.test(allCss))
  t('贴底元素适配了安全区', allCss.indexOf('env(safe-area-inset-bottom)') !== -1)
  t('胶囊热区撑到 88rpx', /\.chip::after\s*\{[^}]*height\s*:\s*88rpx/.test(allCss))
  t('广告位默认不渲染(adUnitId 为空)',
    /adUnitId:\s*''/.test(fs.readFileSync(path.join(APP, 'pages', 'detail', 'detail.js'), 'utf8')))

  // tabBar 页必须 switchTab,不能 navigateTo
  const tabPaths = tabs.map(x => '/' + x.pagePath)
  const badNav = []
  jsFiles.forEach(p => {
    const src = fs.readFileSync(p, 'utf8')
    tabPaths.forEach(tp => {
      if (src.indexOf("navigateTo({ url: '" + tp) !== -1) {
        badNav.push(path.relative(APP, p) + ' -> ' + tp)
      }
    })
  })
  t('没有用 navigateTo 打开 tabBar 页', badNav.length === 0, badNav.join(' | '))
  t('tab 页 onShow 里同步了 tabBar 激活态', ['index', 'picks', 'favorite'].every(f => {
    const src = fs.readFileSync(path.join(APP, 'pages', f, f + '.js'), 'utf8')
    return src.indexOf('getTabBar') !== -1 && src.indexOf('selected') !== -1
  }))
})()

// ---- 10. 分享 / 搜索历史 / 阅读设置 / 热词 / 启动弹窗 / 收藏搜索 ----
;(function () {
  const PAGES = ['index', 'section', 'topic', 'detail', 'picks', 'favorite', 'about']
  const src = {}
  PAGES.forEach(f => { src[f] = fs.readFileSync(path.join(APP, 'pages', f, f + '.js'), 'utf8') })

  // 分享:光定义 onShareAppMessage 不够,还要显式 showShareMenu 才会出现朋友圈入口
  t('每个页面都定义了 onShareAppMessage', PAGES.every(f => src[f].indexOf('onShareAppMessage') !== -1))
  t('每个页面都调用了 enableShare', PAGES.every(f => src[f].indexOf('enableShare()') !== -1))
  t('章节页分享指向章节自身(不再是首页)',
    src.section.indexOf("'/pages/section/section?id='") !== -1 &&
    src.section.indexOf("path: '/pages/index/index'") === -1)
  t('详情页分享带条目 id', src.detail.indexOf("'/pages/detail/detail?id='") !== -1)
  t('收藏页可分享', src.favorite.indexOf('onShareAppMessage') !== -1)
  t('首页今日一条有分享入口',
    fs.readFileSync(path.join(APP, 'pages', 'index', 'index.wxml'), 'utf8').indexOf('open-type="share"') !== -1)
  t('分享工具只声明不发送任何请求', (function () {
    const s = fs.readFileSync(path.join(APP, 'utils', 'share.js'), 'utf8')
    return s.indexOf('wx.request') === -1 && /https?:\/\//.test(s) === false
  })())

  // 搜索历史
  const sh = require(path.join(APP, 'utils', 'search-history.js'))
  t('搜索历史初始为空', sh.list().length === 0)
  sh.push('租房')
  t('搜索历史记一条', sh.list().length === 1 && sh.list()[0] === '租房')
  sh.push('工伤')
  t('新搜的排最前', sh.list()[0] === '工伤' && sh.list()[1] === '租房')
  sh.push('租房')
  t('重复词提前且不重复', sh.list().length === 2 && sh.list()[0] === '租房')
  sh.push('   ')
  t('空白词不记', sh.list().length === 2)
  for (let i = 0; i < 20; i++) sh.push('w' + i)
  t('搜索历史上限 8 条', sh.list().length === sh.MAX && sh.MAX === 8, sh.list().length)
  sh.remove('w19')
  t('可删单条', sh.list().indexOf('w19') === -1 && sh.list().length === 7)
  sh.clear()
  t('可清空搜索历史', sh.list().length === 0)

  // 阅读设置(正文字号)
  const st = require(path.join(APP, 'utils', 'settings.js'))
  t('字号默认标准档', st.get().fontScale === st.DEFAULT_FONT_SCALE && st.DEFAULT_FONT_SCALE === 1)
  st.setFontScale(2)
  t('可切到大号', st.get().fontScale === 2)
  st.setFontScale(0)
  t('可切到小号', st.get().fontScale === 0)
  st.setFontScale(99)
  t('越界值兜底回标准档', st.get().fontScale === 1)
  t('三档字号递增', st.FONT_SCALES[0] < st.FONT_SCALES[1] && st.FONT_SCALES[1] < st.FONT_SCALES[2])
  t('最小档不低于 30rpx(设计系统禁区)', st.FONT_SCALES[0] >= 30, st.FONT_SCALES[0])
  t('详情页按档位渲染正文',
    /read-body f\{\{fontScale\}\}/.test(fs.readFileSync(path.join(APP, 'pages', 'detail', 'detail.wxml'), 'utf8')))

  // 热词:每个都必须在库里搜得到,否则等于把用户推去搜一个搜不到的词
  const hot = require(path.join(APP, 'utils', 'hot-words.js'))
  t('热词是非空字符串数组', Array.isArray(hot) && hot.length > 0 && hot.every(w => typeof w === 'string' && w))
  const dead = hot.filter(w => guide.search(w, null).length === 0)
  t('每个热词都有命中', dead.length === 0, dead.join(','))
  t('搜索框占位与空态建议都取自热词表(不硬编码)',
    fs.readFileSync(path.join(APP, 'pages', 'index', 'index.wxml'), 'utf8').indexOf('hotWords[0]') !== -1)

  // 启动弹窗
  t('launch-popup 四件套齐全', ['js', 'json', 'wxml', 'wxss'].every(e =>
    fs.existsSync(path.join(APP, 'components', 'launch-popup', 'index.' + e))))
  t('launch-popup 声明为组件', JSON.parse(
    fs.readFileSync(path.join(APP, 'components', 'launch-popup', 'index.json'), 'utf8')).component === true)
  t('首页注册了 launch-popup', (function () {
    const j = JSON.parse(fs.readFileSync(path.join(APP, 'pages', 'index', 'index.json'), 'utf8'))
    return !!(j.usingComponents && j.usingComponents['launch-popup'])
  })())
  const noticeCfg = require(path.join(APP, 'utils', 'notice.js'))
  t('弹窗模式合法', noticeCfg.mode === 'card' || noticeCfg.mode === 'image', noticeCfg.mode)
  // card 模式不读图,image 允许为空;一旦填了就必须是包内路径,不能是外链
  t('弹窗图片必须是包内路径,不能是外链',
    noticeCfg.image === '' || /^\/assets\//.test(noticeCfg.image))
  // 位图模式才需要那张图真的在包里 —— 否则用户开屏看到一张裂图
  t('位图模式下图片必须真实存在', (function () {
    if (!noticeCfg.enabled || noticeCfg.mode !== 'image') return true
    return fs.existsSync(path.join(APP, noticeCfg.image.replace(/^\//, '')))
  })(), noticeCfg.image)
  t('弹窗图片体积受控(<400KB)', (function () {
    const p = path.join(APP, noticeCfg.image.replace(/^\//, ''))
    return !fs.existsSync(p) || fs.statSync(p).size < 400 * 1024
  })())
  t('弹窗宽度比例合法', noticeCfg.widthRatio > 0 && noticeCfg.widthRatio <= 1)
  t('弹窗同一次冷启动内只弹一次', (function () {
    const s = fs.readFileSync(path.join(APP, 'pages', 'index', 'index.js'), 'utf8')
    return /let noticeShown = false/.test(s) && s.indexOf('if (noticeShown) return') !== -1
  })())
  // 开篇卡文案:v3(slogan 取自摸鱼指南封面,数字从 manifest 实时取,不再硬编码)
  const popupJs = fs.readFileSync(path.join(APP, 'components', 'launch-popup', 'index.js'), 'utf8')
  const COPY = [
    '高性价比摸鱼指南',
    '少一点无效忙碌，多留',
    '时间、精力与边界',
    '会议与异步 · 注意力 · 休假边界 · 情绪劳动 · 远程协作 · 工时排班 · 场景话术',
    'guide.meta.count',          // 总条数从 manifest 取
    "e.item.level === 'A'",      // A 级条数实时统计
    'guide.meta.linkCount'       // 来源链接数从 manifest 取
  ]
  t('弹窗卡片文案与原图逐字一致', COPY.every(function (s) { return popupJs.indexOf(s) !== -1 }),
    COPY.filter(function (s) { return popupJs.indexOf(s) === -1 }).join(' / '))
  t('弹窗文案的审核风险已在代码里标注',
    /审核风险/.test(popupJs) && /绝对化用语/.test(popupJs) && /效果承诺/.test(popupJs))
  t('弹窗卡片用慢水品牌配色(与全站一致)',
    /#1E5A8A/.test(fs.readFileSync(path.join(APP, 'components', 'launch-popup', 'index.wxss'), 'utf8')) &&
    /#1B1B1F/.test(fs.readFileSync(path.join(APP, 'components', 'launch-popup', 'index.wxss'), 'utf8')) &&
    /#66666C/.test(fs.readFileSync(path.join(APP, 'components', 'launch-popup', 'index.wxss'), 'utf8')))
  t('弹窗卡片配色不随深色模式改写',
    !/prefers-color-scheme/.test(fs.readFileSync(path.join(APP, 'components', 'launch-popup', 'index.wxss'), 'utf8')))
  t('弹窗图加载失败会自动收起',
    fs.readFileSync(path.join(APP, 'components', 'launch-popup', 'index.wxml'), 'utf8').indexOf('binderror') !== -1)

  // 收藏页搜索与排序
  t('收藏页有搜索', src.favorite.indexOf('applyFilter') !== -1 && src.favorite.indexOf('keyword') !== -1)
  t('收藏页有排序切换', src.favorite.indexOf("sort === 'section'") !== -1)
  t('收藏搜索走统一的 searchText(不直接读字段)', /guide\.searchText\(/.test(src.favorite))
  // 数据改结构后,页面里不能再引用已经删掉的 body 字段
  t('页面里没有残留的 item.body 引用',
    !/it\.body|item\.body|\.item\.body/.test(src.favorite + src.index + src.section + src.detail))
  t('今日一条显示的是成本标签(costTag)而不是散文成本',
    fs.readFileSync(path.join(APP, 'pages', 'index', 'index.wxml'), 'utf8').indexOf('daily.item.costTag') !== -1)
  t('搜索覆盖标题/说人话/收益/备注/成本五处',
    /\[it\.title, it\.plain, it\.benefit, it\.note, it\.cost\]/.test(
      fs.readFileSync(path.join(APP, 'utils', 'guide.js'), 'utf8')))

  // 长列表分批与回到顶部
  t('搜索结果分批渲染', /const PAGE = \d+/.test(src.index) && src.index.indexOf('onReachBottom') !== -1)
  t('章节页分批渲染', /const PAGE = \d+/.test(src.section) && src.section.indexOf('onReachBottom') !== -1)
  t('长列表有回到顶部', src.index.indexOf('backToTop') !== -1 && src.section.indexOf('backToTop') !== -1)

  // 「可信」是立身之本:同样命中位置时,A 级证据必须排在 C 级前面
  t('搜索结果按证据等级排序(A 在 C 前)', (function () {
    const order = { A: 0, B: 1, C: 2 }
    const r = guide.search('的', 'all')
    const groups = {}
    r.forEach(function (h) {
      if (!groups[h.hits]) groups[h.hits] = []
      const v = order[h.entry.item.level]
      groups[h.hits].push(v === undefined ? 9 : v)
    })
    return Object.keys(groups).every(function (k) {
      const arr = groups[k]
      for (let i = 1; i < arr.length; i++) if (arr[i] < arr[i - 1]) return false
      return true
    })
  })())
  t('A 级筛选只返回 A 级', (function () {
    const r = guide.search('四天工作周', 'A')
    return r.length > 0 && r.every(function (h) { return h.entry.item.level === 'A' })
  })())

  // 打包体积:主包上限 2MB,超了直接传不上去
  const packed = (function () {
    let size = 0
    ;(function walk(d) {
      fs.readdirSync(d).forEach(n => {
        const p = path.join(d, n)
        if (fs.statSync(p).isDirectory()) return walk(p)
        if (p.indexOf(path.sep + 'tests' + path.sep) !== -1) return
        if (path.basename(p) === 'README.md') return
        size += fs.statSync(p).size
      })
    })(APP)
    return size
  })()
  t('打包体积 < 2MB(主包上限)', packed < 2 * 1024 * 1024, (packed / 1048576).toFixed(2) + 'MB')
})()

// ---- 11. 边界与兜底 ----
;(function () {
  const read = function (p) { return fs.readFileSync(path.join(APP, p), 'utf8') }

  // 日期:给人看的是中文,不是 ISO
  t('dateLabel 把 ISO 日期转成中文', guide.dateLabel('2026-10-09') === '10月9日 周五', guide.dateLabel('2026-10-09'))
  t('dateLabel 无参可用', /^\d+月\d+日 周[日一二三四五六]$/.test(guide.dateLabel()), guide.dateLabel())
  t('dateLabel 非法输入原样返回', guide.dateLabel('nope') === 'nope')
  t('dateLabel 与 dateKey 同源', guide.dateLabel(guide.dateKey()) === guide.dateLabel())
  t('首页显示中文日期而不是 ISO 日期', read('pages/index/index.wxml').indexOf('{{todayLabel}}') !== -1)

  // 从分享链接直接打开时的兜底 —— 页面栈里没有上一页,navigateBack 会失败
  t('章节页无上一页时退回首页(不会卡在空白页)',
    read('pages/section/section.js').indexOf('getCurrentPages().length > 1') !== -1 &&
    read('pages/section/section.js').indexOf("switchTab({ url: '/pages/index/index' })") !== -1)
  t('详情页失效态有出口', read('pages/detail/detail.js').indexOf('goHome()') !== -1 &&
    read('pages/detail/detail.wxml').indexOf('bindtap="goHome"') !== -1)

  // 输入框限长
  t('首页搜索框限长', /maxlength="\d+"/.test(read('pages/index/index.wxml')))
  t('收藏搜索框限长', /maxlength="\d+"/.test(read('pages/favorite/favorite.wxml')))

  // 搜一搜:显式声明允许索引,别靠默认值
  const sm = JSON.parse(read('sitemap.json'))
  t('sitemap 显式声明允许索引',
    Array.isArray(sm.rules) && sm.rules.some(r => r.action === 'allow' && r.page === '*'))
  // 页面标题也参与搜一搜匹配,每个页面都该带上词根且各不相同
  const titles = ['index', 'section', 'detail', 'favorite', 'about'].map(f =>
    JSON.parse(read('pages/' + f + '/' + f + '.json')).navigationBarTitleText)
  t('每个页面标题都带「摸鱼指南」词根',
    titles.every(x => typeof x === 'string' && x.indexOf('摸鱼指南') !== -1), titles.join(' | '))
  t('页面标题各不相同(覆盖更多搜索词)', new Set(titles).size === titles.length)

  // 死代码
  t('app.js 没有无用的 globalData.guideCount', read('app.js').indexOf('guideCount') === -1)

  // 字号档位要覆盖到「说人话」——需要大字的人第一眼看的就是这一块
  t('字号档位同时作用于说人话块', /\.plain\.big\.f0/.test(read('pages/detail/detail.wxss')))

  // 无 tabBar 的页面,回顶按钮不该按"避让 tabBar"的高度放
  t('章节页回顶按钮按无 tabBar 定位', /\.to-top\s*\{[^}]*bottom/.test(read('pages/section/section.wxss')))

  // 空态样式已提到公共层,避免各页各写一份
  t('空态标题与按钮是公共样式', /\.empty-title/.test(read('app.wxss')) && /\.empty-btn/.test(read('app.wxss')))

  // 核心差异点要亮出来,别藏着
  t('首页亮出了来源数量', read('pages/index/index.wxml').indexOf('{{sourceCount}}') !== -1 &&
    read('pages/index/index.js').indexOf('linkCount') !== -1)
  t('详情页有来源区且可复制链接',
    read('pages/detail/detail.wxml').indexOf('src-item') !== -1 &&
    read('pages/detail/detail.js').indexOf('onCopyLink') !== -1)
  // 个人主体小程序不能用 web-view(官方:个人类型暂不支持),所以只能复制链接
  t('来源区说明了为什么不能直接打开', read('pages/detail/detail.wxml').indexOf('src-tip') !== -1)
  t('复制后给了明确的下一步提示', read('pages/detail/detail.js').indexOf('去浏览器打开') !== -1)
  t('支持一次复制全部来源', read('pages/detail/detail.js').indexOf('onCopyAllSource') !== -1)
  t('代码里标注了个人主体不能用 web-view 的原因',
    /个人类型的小程序暂不支持/.test(read('pages/detail/detail.js')))
  t('没有使用 web-view 组件(个人主体用不了)',
    !/<\s*web-view/.test(read('pages/detail/detail.wxml') + read('pages/index/index.wxml')))

  // 详情页不再有分享卡片入口(2026-10-09 用户决定去掉整个卡片功能)
  t('详情页没有残留的卡片入口',
    read('pages/detail/detail.js').indexOf('goPoster') === -1 &&
    read('pages/detail/detail.wxml').indexOf('goPoster') === -1)
  t('app.json 里没有残留的 poster 页面',
    JSON.parse(read('app.json')).pages.indexOf('pages/poster/poster') === -1)

  // ---- 点击反馈覆盖率 ----
  // 用户反馈「点击延迟高」。实测 JS 全部 <1ms,真因是大量可点元素没有任何按下反馈
  // —— 用户感知的"延迟"其实是"点了没反应"。
  // 这条断言守住:每个可点元素都必须有 :active 反馈(自己的,或它容器的)。
  t('每个可点元素都有按下反馈', (function () {
    const WXML = ['pages/index/index', 'pages/section/section', 'pages/topic/topic',
      'pages/detail/detail', 'pages/picks/picks', 'pages/favorite/favorite',
      'pages/about/about', 'components/launch-popup/index', 'custom-tab-bar/index']
    const tpl = WXML.map(function (p) { return read(p + '.wxml') }).join('\n')
    const css = WXML.map(function (p) { return read(p + '.wxss') }).join('\n') + read('app.wxss')

    const act = {}
    const reAct = /([^{}]*):active/g
    let m
    while ((m = reAct.exec(css))) {
      (m[1].match(/\.([\w-]+)/g) || []).forEach(function (c) { act[c.slice(1)] = 1 })
    }

    const miss = []
    const reTag = /<([\w-]+)([^>]*?)>/g
    while ((m = reTag.exec(tpl))) {
      const attrs = m[2]
      if (!/bindtap|catchtap|open-type/.test(attrs)) continue
      const cm = attrs.match(/class="([^"]*)"/)
      if (!cm) continue
      const names = cm[1].split(/\s+/).filter(function (c) { return c && c.indexOf('{{') === -1 })
      // 透明点击层(share-hit / fb-hit):反馈挂在容器上,容器 class 是去掉 -hit 再加 -slot
      names.slice().forEach(function (c) {
        if (/-hit$/.test(c)) names.push(c.replace(/-hit$/, '-slot'))
      })
      if (!names.some(function (c) { return act[c] })) miss.push(names.join(' ') || '(无class)')
    }
    // mask 是有意不加的:点遮罩的反馈就是弹窗关闭本身,再加闪烁反而怪
    return miss.filter(function (s) { return s.indexOf('mask') === -1 }).length === 0
  })())
  t('详情页把六字段拆开显示(要花什么/能得什么/要注意什么)',
    read('pages/detail/detail.wxml').indexOf('要花什么') !== -1 &&
    read('pages/detail/detail.wxml').indexOf('能得什么') !== -1 &&
    read('pages/detail/detail.wxml').indexOf('要注意什么') !== -1)

  // 关于页的授权与来源必须取自数据里的 meta.sources(两份开源项目分别署名) —— 硬编码的那份迟早和数据对不上
  t('关于页授权与来源取自 meta',
    read('pages/about/about.wxml').indexOf('wx:for="{{meta.sources}}"') !== -1 &&
    read('pages/about/about.wxml').indexOf('{{item.url}}') !== -1 &&
    read('pages/about/about.wxml').indexOf('{{item.license}}') !== -1)

  // 今日一条的排版:分享按钮和成本信息挤一行会把成本压成每行 6 个字
  const idxWxml = read('pages/index/index.wxml')
  const idxWxss = read('pages/index/index.wxss')

  // 搜不到时不能只写一串死文字,要给能点的热词
  t('搜不到时给的是可点热词', /class="empty-hot"/.test(idxWxml) &&
    idxWxml.indexOf('bindtap="onTapHot"') !== -1)

  // ---- 已读标记 ----
  t('已读状态在列表里可见', /\.read-tag/.test(read('app.wxss')) &&
    read('pages/section/section.wxml').indexOf('item.read') !== -1 &&
    idxWxml.indexOf('item.read') !== -1)
  t('已读集合与「最近在看」分开存(30 条不够做标记)',
    /read_ids_v1/.test(read('utils/recent.js')))
  t('已读集合只在遇到新 id 时才写 storage(不拖慢详情页)',
    /if \(m\[id\]\) return/.test(read('utils/recent.js')))
  t('打开详情会记入已读集合', /markReadId\(/.test(read('pages/detail/detail.js')))
  // 已读集合最多 200 个 id(约 1KB),同步写 storage 不能挡在首屏渲染前面
  t('已读写盘挪到 onReady(不挡首屏渲染)', (function () {
    const src = read('pages/detail/detail.js')
    const onLoad = src.slice(src.indexOf('onLoad('), src.indexOf('onReady('))
    const onReady = src.slice(src.indexOf('onReady('), src.indexOf('onPageScroll('))
    return onLoad.indexOf('markReadId') === -1 && onReady.indexOf('markReadId') !== -1
  })())
  // onPageScroll 每帧跨线程回调,处理器必须只做一次比较就返回
  t('onPageScroll 只在跨阈值时才干活', (function () {
    const src = read('pages/detail/detail.js')
    // 不能按 syncBar 切 —— syncBar 在 onReady 里也出现了一次,取固定长度更稳
    const i = src.indexOf('onPageScroll(')
    const body = src.slice(i, i + 400)
    return /if \(over === this\._over\) return/.test(body)
  })())

  // ---- 长条目的浮动操作条 ----
  t('详情页有浮动操作条(长条目不用滚到底)',
    read('pages/detail/detail.wxml').indexOf('float-bar') !== -1 &&
    /onPageScroll/.test(read('pages/detail/detail.js')))
  t('浮动操作条在底部操作条进入视口后自动收起',
    /createIntersectionObserver/.test(read('pages/detail/detail.js')))
  t('浮动操作条的分享仍用「view 管外观 + 透明 button 管点击」',
    /fb-hit/.test(read('pages/detail/detail.wxml')) && /fb-visual/.test(read('pages/detail/detail.wxml')))
  t('离开详情页会断开 IntersectionObserver',
    /_io\.disconnect\(\)/.test(read('pages/detail/detail.js')))

  // ---- 今日三条 ----
  t('今日三条来自不同章节', (function () {
    const t3 = guide.dailyTriple('2026-10-09')
    return t3.length === 3 && t3.map(function (e) { return e.sectionId })
      .filter(function (v, i, a) { return a.indexOf(v) === i }).length === 3
  })())
  t('今日三条同一天固定不变', (function () {
    const a = guide.dailyTriple('2026-10-09').map(function (e) { return e.item.id }).join()
    const b = guide.dailyTriple('2026-10-09').map(function (e) { return e.item.id }).join()
    return a === b
  })())
  t('今日三条换一天会变', (function () {
    const a = guide.dailyTriple('2026-10-09').map(function (e) { return e.item.id }).join()
    const b = guide.dailyTriple('2026-10-10').map(function (e) { return e.item.id }).join()
    return a !== b
  })())

  // ---- 结果太宽泛时的提示 ----
  t('搜索结果太宽泛时给提示', idxWxml.indexOf('tooBroad') !== -1 &&
    read('pages/index/index.js').indexOf('tooBroad') !== -1)

  // ---- 证据等级说明 ----
  t('关于页解释了证据等级 A/B/C',
    read('pages/about/about.wxml').indexOf('怎么看这些内容') !== -1 &&
    read('pages/about/about.wxml').indexOf('证据等级') !== -1)

  // ---- 主题标签(摸鱼指南无人生阶段标签) ----
  const tp = require(path.join(APP, 'utils', 'topics.js'))
  t('主题标签覆盖全部 22 章',
    guide.sectionTitles().every(function (s) { return tp.topicsOf(s.id).length > 0 }))
  t('每个标签都能查到章节', tp.TOPICS.concat(tp.STAGES).every(function (t) {
    return tp.sectionsOfTag(t.id).length > 0
  }))
  t('标签 id 无重复', (function () {
    const ids = tp.TOPICS.concat(tp.STAGES).map(function (t) { return t.id })
    return ids.filter(function (v, i) { return ids.indexOf(v) === i }).length === ids.length
  })())
  t('标签指向的章节号都在 1..22 内', tp.TOPICS.concat(tp.STAGES).every(function (tag) {
    return tp.sectionsOfTag(tag.id).every(function (n) { return n >= 1 && n <= 22 })
  }))
  t('首页有主题入口', idxWxml.indexOf('goTopic') !== -1 &&
    idxWxml.indexOf('topicList') !== -1)
  t('标签页已注册进 app.json',
    JSON.parse(read('app.json')).pages.indexOf('pages/topic/topic') !== -1)

  // ---- 「先看这 10 条」:用数据算,不靠人工挑 ----
  t('精选榜单按证据等级排序(A 全部排在 B 前)', (function () {
    const p = guide.easyPicks(60)
    const levels = p.map(function (e) { return e.item.level })
    const firstB = levels.indexOf('B')
    const lastA = levels.lastIndexOf('A')
    return p.length > 0 && (firstB === -1 || lastA === -1 || lastA < firstB)
  })())
  t('精选 10 条每章最多一条(保证覆盖不同领域)', (function () {
    const p = guide.easyPicks(10)
    const ids = p.map(function (e) { return e.sectionId })
    return p.length === 10 && ids.filter(function (v, i) { return ids.indexOf(v) === i }).length === 10
  })())
  t('精选榜首选 A 级证据', (function () {
    return guide.easyPicks(10).every(function (e) { return e.item.level === 'A' })
  })())
  t('精选总数与实测一致(A 级 25 条)', guide.easyPickCount() === 25, guide.easyPickCount())
  t('首页有精选入口', idxWxml.indexOf('goPicks') !== -1 &&
    read('pages/index/index.js').indexOf('goPicks()') !== -1)
  t('精选页解释了筛选规则(可解释性)', read('pages/picks/picks.wxml').indexOf('证据等级') !== -1)
  // 收藏了却没理由回来 = 收藏夹坟墓,首页亮出数量是最低成本的回访钩子
  t('首页显示收藏数量(回访钩子)',
    /\{\{favCount/.test(idxWxml) && /refreshFavCount/.test(read('pages/index/index.js')))
  t('今日一条的成本信息独占一行(不再被按钮挤压)',
    idxWxml.indexOf('t-foot') === -1 && idxWxml.indexOf('class="cost"') !== -1)
  t('分享与换一条同处卡片底部动作行',
    idxWxml.indexOf('class="t-actions"') !== -1 &&
    /\.t-actions\s*\{[^}]*justify-content\s*:\s*flex-end/.test(idxWxss))
  t('分享与换一条同高(都是 52rpx 胶囊)',
    /\.share-visual\s*\{[^}]*height\s*:\s*52rpx/.test(idxWxss) &&
    /\.btn-shuffle\s*\{[^}]*height\s*:\s*52rpx/.test(idxWxss))
  t('换一条在卡片内,用 catchtap 阻止冒泡到详情页',
    /class="btn-shuffle"\s*catchtap="onAnother"/.test(idxWxml))
  t('换一条不再被拉满整张卡片高', !/\.row-actions/.test(idxWxss))
  t('换一条有自己的 88rpx 热区', /\.btn-shuffle::after\s*\{[^}]*height\s*:\s*88rpx/.test(idxWxss))

  // 小程序 <button> 宽度极难约束,外观与点击必须拆成两个元素
  t('分享入口把外观与点击拆开(view 管外观 + 透明 button 管点击)',
    idxWxml.indexOf('share-visual') !== -1 && idxWxml.indexOf('share-hit') !== -1 &&
    idxWxml.indexOf('open-type="share"') !== -1)
  t('点击层是绝对定位的透明 button',
    /\.share-hit\s*\{[^}]*position\s*:\s*absolute/.test(idxWxss) &&
    /\.share-hit\s*\{[^}]*opacity\s*:\s*0/.test(idxWxss))
  t('外观层是固定宽高的 view',
    /\.share-slot\s*\{[^}]*width\s*:\s*\d+rpx/.test(idxWxss) &&
    /\.share-visual\s*\{[^}]*width\s*:\s*\d+rpx/.test(idxWxss))
  t('分享入口样式没有重复定义', (function () {
    // 只数「平铺的类定义」,把 :active / 后代选择器排除在外 —— 那些是别的规则,不是重复定义
    const plain = idxWxss.split('\n').filter(function (l) { return l.indexOf(':active') === -1 }).join('\n')
    return (plain.match(/\.share-(btn|hit|visual|slot|wrap)\s*\{/g) || []).length === 3
  })())

  // 最近在看:标题动辄 20 多字,用胶囊只能看到前半句
  t('最近在看改成横向滑动卡片',
    idxWxml.indexOf('recent-scroll') !== -1 && idxWxml.indexOf('recent-card') !== -1)
  t('最近在看卡片带所属章节',
    /rc-sub/.test(idxWxml) && read('pages/index/index.js').indexOf('section: e.section') !== -1)
})()

console.log('\n结果:' + pass + ' 通过 / ' + fail + ' 失败,共 ' + (pass + fail))
if (fail) process.exit(1)
