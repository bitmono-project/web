import type { Dict } from '../lib/translate'

// Arabic is right-to-left; the provider sets <html dir="rtl"> so the layout mirrors.
export const ar: Dict = {
  nav: {
    obfuscate: 'تشويش',
    crackmes: 'تحديات الكراك',
    leaderboard: 'المتصدّرون',
    review: 'المراجعة',
    admin: 'الإدارة',
    docs: 'الوثائق',
    submissions: 'الإرسالات',
    submit: 'إرسال',
    login: 'تسجيل الدخول',
    logout: 'تسجيل الخروج',
    notifications: 'الإشعارات',
    language: 'اللغة',
  },
  footer: {
    copy: '© bitmono — مشوّش مفتوح المصدر ومجاني لـ .NET و Mono · web {version}',
    privacy: 'الخصوصية',
    terms: 'الشروط',
    contact: 'تواصل',
    docs: 'الوثائق',
    source: 'الكود المصدري',
    obfuscation: 'التشويش',
    engine: 'المحرّك',
    discord: 'discord',
  },
  home: {
    badge: 'مجاني ومفتوح المصدر ↗',
    heroBefore: 'شوّش',
    heroAfter: 'الخاص بك مباشرةً في المتصفح.',
    subtitle: 'أفلِت ملف .dll — واستعده بأسماء رموز مُعاد تسميتها، ومساحات أسماء مُزالة، وسلاسل نصية مُشفّرة. دون تثبيت، ودون حفظ أي شيء.',
    engineLabel: 'المحرّك · BitMono',
    protections: 'الحمايات //',
    pillars: {
      static: {
        title: 'تحليل ساكن، دون تشغيل',
        body: 'يعيد BitMono كتابة شيفرة IL باستخدام AsmResolver. يُحلَّل تجميعك فقط ولا يُنفَّذ أبدًا — آمن بحكم التصميم.',
      },
      nothingKept: {
        title: 'لا يُحفظ أي شيء',
        body: 'يُحذف ملفك المرفوع فور تشويشه، وتُمحى النتيجة لحظة تنزيلك لها.',
      },
      realEngine: {
        title: 'المحرّك الحقيقي',
        body: 'نفس BitMono المنشور على NuGet والذي يعمل في خطوط CI — وليس نسخة ويب مُختزلة.',
      },
    },
  },
  login: {
    title: 'تسجيل الدخول',
    subtitle: 'الحسابات عبر OAuth فقط — دون كلمات مرور. تحتاج حسابًا للرفع أو التعليق أو التصويت. يبقى التنزيل مجهول الهوية.',
    discord: 'المتابعة عبر Discord',
    github: 'المتابعة عبر GitHub',
    notConfigured: '· غير مُهيّأ',
    devTitle: 'دخول المطوّر (للتطوير فقط)',
    handle: 'المعرّف',
    admin: 'مدير',
    signIn: 'دخول',
    failed: 'فشل دخول المطوّر',
  },
}
