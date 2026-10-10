// 标签体系:把摸鱼指南 22 章映射到「主题」标签。
//
// 为什么需要:22 章的标题是**书的语言**(先把工作说清楚 / 恢复、休假与值班边界),
// 不是**用户的语言**(我该注意什么 / 这事跟我有关吗)。加一层标签,用户才能按自己的处境找。
//
// 纯静态配置,零网络、零体积负担。章节号与 data/sections/index.js 的 id 一一对应。
// 一章可以属于多个主题(比如「下班后的数字边界」既是工作也是生活)。
// 摸鱼指南全部是工作相关内容,人生阶段(STAGES)不适用,保留空数组以兼容旧引用。

const TOPICS = [
  { id: 'work',  name: '工作', desc: '任务、会议、协作、反馈、组织' },
  { id: 'life',  name: '生活', desc: '休息、边界、恢复、注意力' },
  { id: 'safety', name: '安全', desc: '职业安全、记录、凭据' },
  { id: 'health', name: '健康', desc: '工位舒适、身体、情绪劳动' }
]

// 章节号 → 主题 id
const TOPIC_BY_SECTION = {
  1:  ['work', 'life'],
  2:  ['work', 'life'],
  3:  ['work'],
  4:  ['work'],
  5:  ['life', 'work'],
  6:  ['work', 'life'],
  7:  ['work', 'safety'],
  8:  ['work'],
  9:  ['work', 'life'],
  10: ['work'],
  11: ['work', 'life'],
  12: ['work'],
  13: ['work', 'life'],
  14: ['work', 'health'],
  15: ['work'],
  16: ['life', 'work'],
  17: ['work', 'life'],
  18: ['work', 'health'],
  19: ['work'],
  20: ['work'],
  21: ['work', 'life'],
  22: ['work', 'life']
}

// 人生阶段:摸鱼指南不适用,保留空数组以兼容旧引用(topic 页的类型判断)
const STAGES = []
const STAGE_BY_SECTION = {}

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
