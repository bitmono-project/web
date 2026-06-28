import type { Dict } from '../lib/translate'

export const zh: Dict = {
  nav: {
    obfuscate: '混淆',
    crackmes: '破解挑战',
    leaderboard: '排行榜',
    review: '审核',
    admin: '管理',
    docs: '文档',
    submissions: '提交记录',
    submit: '提交',
    login: '登录',
    logout: '退出',
    notifications: '通知',
    language: '语言',
  },
  footer: {
    copy: '© bitmono — 免费开源的 .NET 与 Mono 混淆器 · web {version}',
    privacy: '隐私',
    terms: '条款',
    contact: '联系',
    docs: '文档',
    source: '源代码',
    obfuscation: '混淆服务',
    engine: '引擎',
    discord: 'discord',
  },
  home: {
    badge: '免费开源 ↗',
    heroBefore: '混淆你的',
    heroAfter: '，就在浏览器中。',
    subtitle: '拖入一个 .dll — 取回时符号已重命名、命名空间已剥离、字符串已加密。无需安装，不留存任何内容。',
    engineLabel: '引擎 · BitMono',
    protections: '保护 //',
    pillars: {
      static: {
        title: '静态分析，从不运行',
        body: 'BitMono 使用 AsmResolver 重写 IL。你的程序集只被分析，绝不执行 — 从设计上就是安全的。',
      },
      nothingKept: {
        title: '不留存任何内容',
        body: '你上传的文件在混淆完成的瞬间即被删除，结果也在你下载的瞬间被清除。',
      },
      realEngine: {
        title: '真正的引擎',
        body: '与发布到 NuGet、在 CI 流水线中运行的 BitMono 完全相同 — 不是阉割版的网页移植。',
      },
    },
  },
  login: {
    title: '登录',
    subtitle: '账户仅支持 OAuth — 无需密码。上传、评论或投票需要登录。下载始终匿名。',
    discord: '使用 Discord 继续',
    github: '使用 GitHub 继续',
    notConfigured: '· 未配置',
    devTitle: '开发登录（仅限开发环境）',
    handle: '用户名',
    admin: '管理员',
    signIn: '登录',
    failed: '开发登录失败',
  },
}
