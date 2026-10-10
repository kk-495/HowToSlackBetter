// 标签体系:把 34 章映射到「主题」和「人生阶段」两组标签。
//
// 为什么需要:34 章的标题是**书的语言**(不要早死 / 不要慢慢死 / 别把自己搭进去),
// 不是**用户的语言**(我该注意什么 / 这事跟我有关吗)。加一层标签,用户才能按自己的处境找。
//
// 纯静态配置,零网络、零体积负担。章节号与 data/sections/index.js 的 id 一一对应。
// 一章可以属于多个主题(比如「出国留学」既是学习也是安全)。

const TOPICS = [
  { id: 'money',  name: '钱',     desc: '省钱、防骗、买房、看病花销' },
  { id: 'health', name: '健康',   desc: '防病、筛查、吃药、急救' },
  { id: 'law',    name: '法律',   desc: '合同、租房、遗产、踩线风险' },
  { id: 'work',   name: '工作',   desc: '入职离职、工伤、创业、技能' },
  { id: 'family', name: '家庭',   desc: '婚育、孩子、老人、身后事' },
  { id: 'safety', name: '安全',   desc: '突发事件、账号信息、出行' },
  { id: 'life',   name: '生活',   desc: '精力、时间、放松、心态' },
  { id: 'study',  name: '学习',   desc: '升学、留学、学什么划算' }
]

const STAGES = [
  { id: 'student', name: '学生时代', desc: '在读、升学、留学、打工' },
  { id: 'early',   name: '刚工作',   desc: '入职离职、工伤、副业、攒钱' },
  { id: 'couple',  name: '成家',     desc: '恋爱结婚、租房买房、财产' },
  { id: 'parent',  name: '养孩子',   desc: '怀孕生产、新生儿、上学' },
  { id: 'midlife', name: '中年',     desc: '慢性病、父母养老、体检' },
  { id: 'elder',   name: '晚年',     desc: '老年照护、身后事、临终' }
]

// 章节号 → 主题 id
const TOPIC_BY_SECTION = {
  1:  ['health'],
  2:  ['health'],
  3:  ['life'],
  4:  ['life'],
  5:  ['money'],
  6:  ['law', 'safety'],
  7:  ['money'],
  8:  ['law'],
  9:  ['law'],
  10: ['family'],
  11: ['work', 'law'],
  12: ['money', 'work'],
  13: ['safety'],
  14: ['safety'],
  15: ['money', 'life'],
  16: ['health'],
  17: ['family', 'health'],
  18: ['family', 'money'],
  19: ['work'],
  20: ['family'],
  21: ['safety'],
  22: ['life'],
  23: ['work', 'study'],
  24: ['health', 'money'],
  25: ['family', 'law'],
  26: ['work', 'law'],
  27: ['family', 'health'],
  28: ['health'],
  29: ['health', 'life'],
  30: ['family', 'study'],
  31: ['study', 'life'],
  32: ['study', 'safety'],
  33: ['health', 'life'],
  34: ['health', 'safety']
}

// 章节号 → 人生阶段 id
const STAGE_BY_SECTION = {
  1:  ['midlife', 'elder'],
  2:  ['midlife', 'elder'],
  3:  ['early', 'student'],
  4:  ['student', 'early'],
  5:  ['early', 'couple'],
  6:  ['early', 'midlife'],
  7:  ['early', 'student'],
  8:  ['couple', 'midlife'],
  9:  ['early', 'midlife'],
  10: ['couple'],
  11: ['early'],
  12: ['early', 'midlife'],
  13: ['student', 'early', 'couple', 'parent', 'midlife', 'elder'],
  14: ['student', 'early', 'midlife'],
  15: ['early', 'couple'],
  16: ['midlife', 'elder'],
  17: ['midlife', 'elder'],
  18: ['parent'],
  19: ['early'],
  20: ['parent'],
  21: ['student', 'early'],
  22: ['student', 'early'],
  23: ['student', 'early'],
  24: ['midlife', 'elder'],
  25: ['midlife', 'elder'],
  26: ['early'],
  27: ['parent'],
  28: ['student', 'early'],
  29: ['early', 'midlife', 'elder'],
  30: ['parent'],
  31: ['student'],
  32: ['student'],
  33: ['midlife', 'elder'],
  34: ['parent', 'midlife', 'elder']
}

function topicsOf(sectionId) {
  return TOPIC_BY_SECTION[sectionId] || []
}

function stagesOf(sectionId) {
  return STAGE_BY_SECTION[sectionId] || []
}

// 某个标签覆盖的章节号
function sectionsOfTag(tagId) {
  const out = []
  Object.keys(TOPIC_BY_SECTION).forEach(function (k) {
    if (TOPIC_BY_SECTION[k].indexOf(tagId) !== -1) out.push(Number(k))
  })
  Object.keys(STAGE_BY_SECTION).forEach(function (k) {
    if (STAGE_BY_SECTION[k].indexOf(tagId) !== -1 && out.indexOf(Number(k)) === -1) out.push(Number(k))
  })
  return out.sort(function (a, b) { return a - b })
}

function findTag(tagId) {
  const all = TOPICS.concat(STAGES)
  for (let i = 0; i < all.length; i++) {
    if (all[i].id === tagId) return all[i]
  }
  return null
}

function topicName(id) {
  for (let i = 0; i < TOPICS.length; i++) {
    if (TOPICS[i].id === id) return TOPICS[i].name
  }
  return ''
}

module.exports = {
  TOPICS: TOPICS,
  STAGES: STAGES,
  topicsOf: topicsOf,
  stagesOf: stagesOf,
  sectionsOfTag: sectionsOfTag,
  findTag: findTag,
  topicName: topicName
}
