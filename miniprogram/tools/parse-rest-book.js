// 把摸鱼指南(book/*.md, CC BY 4.0)转换成小程序章节格式 data/sections/35..56.js,
// 并把清单(data/sections/index.js)的 sections 与统计(count/sourceCount/linkCount/updatedAt)更新到位。
//
// 用法: node miniprogram/tools/parse-rest-book.js
// 数据源: D:\project\mytest\my\book\NN-*.md (本地,不改 GitHub)
// 输出前先打印报告(章节数/条目数/证据等级分布/来源数),便于和 README 宣称的 22 章 90 条核对。
// 注意:本目录 tools/ 已在 project.config.json packOptions.ignore 中排除,不打进小程序包。
const fs = require('fs')
const path = require('path')

const BOOK_DIR = path.join(__dirname, '..', '..', 'book')
const SECTION_DIR = path.join(__dirname, '..', 'data', 'sections')
const MANIFEST = path.join(SECTION_DIR, 'index.js')
const UPDATED_AT = '2026-10-10'

// ---- md 清理:去掉转义斜杠、强调/斜体记号,保留正文原样 ----
function clean(s) {
  return String(s || '')
    .replace(/\\([\\`*_{}[\]()#+.!-])/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .trim()
}

// 来源行 → [{t,u}]。按全角分号拆多条;每条取第一个链接的 url,
// t = 去掉链接记号后的原文(作者·年份·刊物),无链接则整段归 t。
function parseSources(raw) {
  return String(raw || '')
    .split('；')
    .map(function (seg) {
      const s = seg.trim()
      if (!s) return null
      const m = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(s)
      let u = ''
      let t = s
      if (m) {
        u = m[2]
        // 去掉所有 [文字](链接) 记号,保留作者等前缀文字;前缀为空就用链接文字
        t = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1').trim()
        if (!t) t = m[1]
      }
      t = clean(t).replace(/;$/, '')
      return { t: t, u: u }
    })
    .filter(Boolean)
}

// 条目 id 稳定化:章号 + 标题哈希(36 进制 6 位),不按章内序号编。
// 原因:收藏/已读存的是 id,按序号编时上游在章中间插一条,后续所有 id 集体漂移,
// 用户收藏会静默失效。哈希 id 只取决于条目自己的标题 —— 插入新条目不影响老条目。
// 代价:上游改写某条标题时,那一条的 id 会变(收藏失效一条,可接受)。
function slug(title) {
  let h = 2166136261
  const s = String(title)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return h.toString(36).padStart(6, '0').slice(-6)
}

// 解析单个 md 文件 → {no, title, items[]}
function parseChapter(file) {
  const src = fs.readFileSync(path.join(BOOK_DIR, file), 'utf8')
  const lines = src.split(/\r?\n/)
  const head = /^#\s*第\s*(\d+)\s*章\s*[：:]\s*(.+)$/.exec(lines[0] || '')
  if (!head) throw new Error(file + ' 首行不是章标题: ' + lines[0])
  const chap = { no: Number(head[1]), title: clean(head[2]), items: [] }
  let cur = null
  let lastField = ''
  const ITEM = /^###\s*([\d\\\.、]+)\s*[\.、]?\s*(.+)$/
  const BULLET = /^[-*]\s*(成本|说人话|收益|证据等级|来源|备注)\s*[：:]\s*(.*)$/
  const FIELD = { '成本': 'cost', '说人话': 'plain', '收益': 'benefit', '证据等级': 'level', '备注': 'note' }
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const b = BULLET.exec(line)
    if (b) {
      lastField = b[1]
      if (b[1] === '来源') cur.source = parseSources(b[2])
      else cur[FIELD[b[1]]] = clean(b[2])
      continue
    }
    const it = ITEM.exec(line.trim())
    if (it) {
      cur = {
        title: clean(it[2]),
        cost: '', plain: '', benefit: '', level: '', levelNote: '',
        source: [], note: '', costTag: '', tier: ''
      }
      lastField = ''
      chap.items.push(cur)
      continue
    }
    // 续行(极少数字段折行):并入上一个字段
    const t = line.trim()
    if (cur && t && lastField && !/^#/.test(t)) {
      if (lastField === '来源') cur.source = cur.source.concat(parseSources(t))
      else cur[FIELD[lastField]] += clean(t)
    }
  }
  return chap
}

// ---- 主流程 ----
const files = fs.readdirSync(BOOK_DIR).filter(f => /^\d{2}-.+\.md$/.test(f)).sort()
const chapters = files.map(parseChapter)

// 校验:章号连续 1..22,无空章,条目非空
chapters.forEach((c, i) => {
  if (c.no !== i + 1) throw new Error('章号不连续: 期望 ' + (i + 1) + ' 实得 ' + c.no + ' (' + files[i] + ')')
  if (!c.items.length) throw new Error('空章节: ' + files[i])
  c.items.forEach((it, j) => {
    if (!it.title || !it.plain || !it.level) throw new Error('条目缺关键字段: ' + files[i] + ' 第 ' + (j + 1) + ' 条')
  })
})

// 写章节文件 1..22(摸鱼指南是全库唯一内容,章号即 1..22)
const levelStat = { A: 0, B: 0, other: 0 }
let itemCount = 0
let sourceCount = 0
let linkCount = 0
chapters.forEach((c, i) => {
  const sid = c.no
  const items = c.items.map((it, j) => {
    if (levelStat[it.level] !== undefined) levelStat[it.level]++
    else levelStat.other++
    sourceCount += it.source.length
    linkCount += it.source.filter(s => s.u).length
    return Object.assign({ id: sid + '-' + slug(it.title) }, it)
  })
  itemCount += items.length
  const body = JSON.stringify({ id: sid, title: c.title, items: items })
  fs.writeFileSync(path.join(SECTION_DIR, sid + '.js'),
    '// 由 tools/parse-rest-book.js 从 book/' + files[i] + ' 生成(摸鱼指南,CC BY 4.0)\nmodule.exports = ' + body + '\n')
})

// 全库统计(即摸鱼指南本身)
const totalCount = itemCount
const totalSources = sourceCount
const totalLinks = linkCount

// 清单整体替换为摸鱼指南(不再含人生指南章节);首次运行前请先清空旧的 <数字>.js
const meta = {
  title: '高性价比摸鱼指南',
  sourceUrl: 'https://github.com/kk-495/HowToSlackBetter',
  license: 'CC BY 4.0',
  count: totalCount,
  sourceCount: totalSources,
  linkCount: totalLinks,
  updatedAt: UPDATED_AT,
  sources: [
    {
      name: '高性价比摸鱼指南',
      url: 'https://github.com/kk-495/HowToSlackBetter',
      license: 'CC BY 4.0'
    }
  ]
}
// 幂等:整表替换(重复运行不会叠加)
const outManifest = {
  meta: meta,
  sections: chapters.map((c, i) => ({
    id: c.no,
    title: c.title,
    count: c.items.length,
    file: c.no + '.js'
  }))
}
fs.writeFileSync(MANIFEST,
  '// 章节清单。数据文件 data/sections/<id>.js\n'
  + 'module.exports = ' + JSON.stringify(outManifest) + '\n')

// ---- 报告 ----
console.log('章节: ' + chapters.length + ' 章 (id 1..' + chapters.length + ')')
console.log('条目: ' + itemCount + ' 条')
console.log('证据等级: A=' + levelStat.A + ' B=' + levelStat.B + (levelStat.other ? ' 其他=' + levelStat.other : ''))
console.log('摸鱼来源: ' + sourceCount + ' 条(含链接 ' + linkCount + ')')
console.log('全库合计: ' + totalCount + ' 条 / 来源 ' + totalSources + ' / 链接 ' + totalLinks)
console.log('章节明细:')
chapters.forEach((c, i) => console.log('  ' + c.no + '. ' + c.title + ' (' + c.items.length + ' 条)'))
