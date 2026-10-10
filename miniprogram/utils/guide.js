// 纯逻辑:数据索引、搜索、每日一条。不依赖微信 API,可在 node 下测试。
// 数据按章节拆分为 data/sections/*.js(单个最大约 110KB,并避开基础库 require .json 的编译缺陷)。
const manifest = require('../data/sections/index.js')
const topics = require('./topics.js')

const SECTIONS = manifest.sections.map(function (s) {
  return require('../data/sections/' + s.file)
})

const FLAT = []
SECTIONS.forEach(function (s) {
  s.items.forEach(function (it) {
    FLAT.push({ item: it, section: s.title, sectionId: s.id })
  })
})

// 预计算小写检索字段(标题 / 说人话)。这两个字段小,常驻内存无压力。
// 其余正文(收益 / 备注 / 成本)不预存小写副本,首次拉丁查询时构建一次(见 lowerBodies);
// 纯中文查询直接原文匹配 —— 覆盖绝大多数真实输入,热路径零额外开销。
const HAYSTACK = FLAT.map(function (e) {
  return {
    title: String(e.item.title || '').toLowerCase(),
    plain: String(e.item.plain || '').toLowerCase()
  }
})
const HAS_LATIN = /[a-z]/

// 搜索排序用:A 级证据排最前,未知等级沉底(全站唯一一份等级权重)
const LEVEL_WEIGHT = { A: 0, B: 1, C: 2 }

// 除标题和说人话之外的正文部分,参与搜索与「朴素匹配」对照
function restText(it) {
  return [it.benefit, it.note, it.cost, it.costTag].join('\n')
}

// 一条建议的全部可检索文字(给测试做朴素匹配对照用)
function searchText(it) {
  return [it.title, it.plain, it.benefit, it.note, it.cost].join('\n')
}

const meta = manifest.meta

function allItems() {
  return FLAT
}

function itemCount() {
  return FLAT.length
}

function sectionTitles() {
  return SECTIONS.map(function (s) {
    return { id: s.id, title: s.title, count: s.items.length }
  })
}

function findItem(id) {
  for (let i = 0; i < FLAT.length; i++) {
    if (FLAT[i].item.id === id) return FLAT[i]
  }
  return null
}

function itemsOfSection(sectionId) {
  const s = SECTIONS.filter(function (x) { return x.id === sectionId })[0]
  if (!s) return []
  return s.items.map(function (it) {
    return { item: it, section: s.title, sectionId: s.id }
  })
}

function levelOf(item) {
  return item && item.level ? String(item.level).toUpperCase() : ''
}

// 关键词匹配:标题 > 说人话 > 正文;按字段权重排序。
// 拉丁查询用的小写正文副本:首次拉丁查询时构建一次,之后复用。
// 用户连续输入英文关键词时,不再每次输入都把全部正文 toLowerCase 一遍。
let LOWER_BODY = null
function lowerBodies() {
  if (!LOWER_BODY) {
    LOWER_BODY = FLAT.map(function (e) {
      return restText(e.item).toLowerCase()
    })
  }
  return LOWER_BODY
}

function search(query, filter) {
  const q = String(query || '').trim().toLowerCase()
  const lowerBody = HAS_LATIN.test(q)
  const wantLevel = filter && filter !== 'all' ? String(filter).toUpperCase() : ''
  const bodies = lowerBody ? lowerBodies() : null
  const out = []
  for (let i = 0; i < FLAT.length; i++) {
    const e = FLAT[i]
    const it = e.item
    if (wantLevel && levelOf(it) !== wantLevel) continue
    if (!q) {
      out.push({ entry: e, hits: 0, field: '' })
      continue
    }
    const t = HAYSTACK[i].title
    const pl = HAYSTACK[i].plain
    const b = lowerBody ? bodies[i] : restText(it)
    if (t.indexOf(q) !== -1) out.push({ entry: e, hits: 3, field: 'title' })
    else if (pl.indexOf(q) !== -1) out.push({ entry: e, hits: 2, field: 'plain' })
    else if (b.indexOf(q) !== -1) out.push({ entry: e, hits: 1, field: 'body' })
  }
  out.sort(function (x, y) {
    // ① 命中位置:标题 > 说人话 > 正文
    if (y.hits !== x.hits) return y.hits - x.hits
    // ② 同样命中位置时,证据等级高的排前面 ——
    //    「可信」是这个产品的立身之本,不能让 C 级内容排在 A 级前面
    const lx = LEVEL_WEIGHT[x.entry.item.level]
    const ly = LEVEL_WEIGHT[y.entry.item.level]
    if (lx !== ly) return (lx === undefined ? 9 : lx) - (ly === undefined ? 9 : ly)
    // ③ 最后按 id 保证顺序稳定
    return x.entry.item.id < y.entry.item.id ? -1 : 1
  })
  return out
}

// ---- 「先看这几条」:用数据算,不靠人工挑 ----
//
// 摸鱼指南的条目没有成本标签(上游只有成本散文),所以精选不按性价比筛,
// 改按**证据等级**:A 级优先,每章最多一条保证覆盖不同工作场景。
// 等级权重复用顶部的 LEVEL_WEIGHT。
// 这个榜单同样**可解释**:每条为什么排前面,点开就能看到证据等级和来源。

function easyPickCount() {
  return FLAT.filter(function (e) { return levelOf(e.item) === 'A' }).length
}

function easyPicks(n) {
  const pool = FLAT.slice().sort(function (a, b) {
    const la = LEVEL_WEIGHT[levelOf(a.item)]
    const lb = LEVEL_WEIGHT[levelOf(b.item)]
    if (la !== lb) return (la === undefined ? 9 : la) - (lb === undefined ? 9 : lb)
    return a.item.id < b.item.id ? -1 : 1
  })
  const out = []
  const used = {}
  const want = n || 10
  for (let i = 0; i < pool.length && out.length < want; i++) {
    if (used[pool[i].sectionId]) continue
    used[pool[i].sectionId] = 1
    out.push(pool[i])
  }
  return out
}

// ---- 跨章节「相关推荐」 ----
//
// 被分享进来的人看完一条,只有「上一条 / 下一条 / 本章目录」= 全是章节内导航,
// 既不知道这条属于什么体系,也没有「看更多同类」的出口,分享落地等于零转化。
//
// 复用 utils/topics.js 的主题标签(摸鱼 22 章 100% 覆盖),零新数据:
// 用本条所在章节的主题标签,去匹配**别的章节**里的条目。
// 排序:证据等级(A>B)优先,再按 id 保证稳定。
function related(id, n) {
  const e = findItem(id)
  if (!e) return []
  const mine = topics.topicsOf(e.sectionId)
  if (!mine.length) return []
  const pool = []
  for (let i = 0; i < FLAT.length; i++) {
    const c = FLAT[i]
    if (c.sectionId === e.sectionId) continue
    const tags = topics.topicsOf(c.sectionId)
    if (!tags.some(function (t) { return mine.indexOf(t) !== -1 })) continue
    pool.push(c)
  }
  pool.sort(function (a, b) {
    const la = LEVEL_WEIGHT[levelOf(a.item)]
    const lb = LEVEL_WEIGHT[levelOf(b.item)]
    if (la !== lb) return (la === undefined ? 9 : la) - (lb === undefined ? 9 : lb)
    return a.item.id < b.item.id ? -1 : 1
  })
  return pool.slice(0, n || 4)
}

// 每日一条:同一天固定同一条。
function dateKey(d) {
  const now = d === undefined || d === null ? new Date() : (d instanceof Date ? d : new Date(d))
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}

// 把 2026-10-09 变成「10月9日 周五」—— 给人看的是这个,不是 ISO 日期
function dateLabel(key) {
  const k = key || dateKey()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k)
  if (!m) return k
  const month = Number(m[2])
  const day = Number(m[3])
  const d = new Date(Number(m[1]), month - 1, day)
  if (isNaN(d.getTime())) return k
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return month + '月' + day + '日 周' + week
}

// 每日三条:一条太少形不成习惯。同一天固定同样三条,且来自不同章节。
// 步长取 97(质数,与 90 互质),保证在全书里不重复地走一圈。
function dailyTriple(key) {
  const k = key || dateKey()
  const n = FLAT.length
  const seed = hashStr(k)
  const out = []
  const used = {}
  for (let j = 0; out.length < 3 && j < n; j++) {
    const e = FLAT[(seed + j * 97) % n]
    if (used[e.sectionId]) continue
    used[e.sectionId] = 1
    out.push(e)
  }
  return out
}

function hashStr(s) {  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return h >>> 0
}

function dailyIndex(count, key) {
  const k = key || dateKey()
  return count <= 0 ? -1 : hashStr(k) % count
}

function dailyEntry(key) {
  if (!FLAT.length) return null
  return FLAT[dailyIndex(FLAT.length, key)]
}

function randomEntry(excludeId) {
  if (!FLAT.length) return null
  const pool = FLAT.filter(function (e) { return excludeId ? e.item.id !== excludeId : true })
  const src = pool.length ? pool : FLAT
  const seed = Math.floor(Math.random() * src.length)
  const idx = Math.min(Math.max(seed, 0), src.length - 1)
  return src[idx]
}

// 关键词切片:把命中的关键词裹成 {hit:true} 片段,供页面高亮。
function highlight(text, query) {
  const s = String(text || '')
  const q = String(query || '').trim()
  if (!q) return [{ text: s, hit: false }]
  const out = []
  let pos = 0
  for (;;) {
    const i = s.toLowerCase().indexOf(q.toLowerCase(), pos)
    if (i === -1) break
    if (i > pos) out.push({ text: s.slice(pos, i), hit: false })
    out.push({ text: s.slice(i, i + q.length), hit: true })
    pos = i + q.length
  }
  if (pos < s.length) out.push({ text: s.slice(pos), hit: false })
  if (!out.length) out.push({ text: s, hit: false })
  return out
}

// 同一章节内的上一条 / 下一条,用于详情页翻页。
function neighbor(id) {
  for (let s = 0; s < SECTIONS.length; s++) {
    const items = SECTIONS[s].items
    for (let i = 0; i < items.length; i++) {
      if (items[i].id !== id) continue
      return {
        section: SECTIONS[s].title,
        sectionId: SECTIONS[s].id,
        total: items.length,
        index: i + 1,
        prev: i > 0 ? items[i - 1] : null,
        next: i < items.length - 1 ? items[i + 1] : null
      }
    }
  }
  return null
}

module.exports = {
  meta: meta,
  allItems: allItems,
  itemCount: itemCount,
  sectionTitles: sectionTitles,
  itemsOfSection: itemsOfSection,
  findItem: findItem,
  search: search,
  highlight: highlight,
  searchText: searchText,
  easyPicks: easyPicks,
  easyPickCount: easyPickCount,
  related: related,
  neighbor: neighbor,
  dailyIndex: dailyIndex,
  dailyEntry: dailyEntry,
  dailyTriple: dailyTriple,
  randomEntry: randomEntry,
  dateKey: dateKey,
  dateLabel: dateLabel,
  LEVEL_WEIGHT: LEVEL_WEIGHT
}
