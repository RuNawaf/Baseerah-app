import { createContext, useContext } from 'react';

// Interface text in English and Arabic. Rule names and descriptions come from axe-core, which has no Arabic
// translation, so they stay in English in both languages.

const NOUNS = {
  en: {
    page: ['page', 'pages'],
    scannedPage: ['scanned page', 'scanned pages'],
    issue: ['issue', 'issues'],
    accessibilityIssue: ['accessibility issue', 'accessibility issues'],
    element: ['element', 'elements'],
    rule: ['rule', 'rules'],
  },
  // Arabic forms by Intl.PluralRules category: one, two, few (3-10), many (11-99), other (0, 100+).
  ar: {
    page: { one: 'صفحة واحدة', two: 'صفحتان', few: '{n} صفحات', many: '{n} صفحة', other: '{n} صفحة' },
    scannedPage: { one: 'صفحة واحدة مفحوصة', two: 'صفحتين مفحوصتين', few: '{n} صفحات مفحوصة', many: '{n} صفحة مفحوصة', other: '{n} صفحة مفحوصة' },
    issue: { one: 'مشكلة واحدة', two: 'مشكلتان', few: '{n} مشكلات', many: '{n} مشكلة', other: '{n} مشكلة' },
    accessibilityIssue: {
      one: 'مشكلة إتاحة واحدة',
      two: 'مشكلتا إتاحة',
      few: '{n} مشكلات إتاحة',
      many: '{n} مشكلة إتاحة',
      other: '{n} مشكلة إتاحة',
    },
    element: { one: 'عنصر واحد', two: 'عنصران', few: '{n} عناصر', many: '{n} عنصرًا', other: '{n} عنصر' },
    rule: { one: 'قاعدة واحدة', two: 'قاعدتان', few: '{n} قواعد', many: '{n} قاعدة', other: '{n} قاعدة' },
  },
};

const arPlural = new Intl.PluralRules('ar');

// The noun alone, to sit beside a large figure ("5 issues").
const UNITS = {
  en: { issue: ['issue', 'issues'] },
  ar: { issue: { one: 'مشكلة', two: 'مشكلتان', few: 'مشكلات', many: 'مشكلة', other: 'مشكلة' } },
};

export function unitWord(lang, n, noun) {
  if (lang === 'ar') return UNITS.ar[noun][arPlural.select(n)] ?? UNITS.ar[noun].other;
  return UNITS.en[noun][n === 1 ? 0 : 1];
}

export function countWord(lang, n, noun) {
  if (lang === 'ar') {
    const forms = NOUNS.ar[noun];
    return (forms[arPlural.select(n)] ?? forms.other).replace('{n}', n);
  }
  const [one, many] = NOUNS.en[noun];
  return `${n} ${n === 1 ? one : many}`;
}

const STRINGS = {
  en: {
    skip: 'Skip to content',
    home: 'Baseerah (بصيرة) home',
    navHow: 'How it works',
    navScan: 'Scan a website',
    langButton: 'ع',
    langLabel: 'العربية',
    langCode: 'ar',
    pageTitle: 'Baseerah – website accessibility scanner',
    previewScanning: 'Scanning 6 of 10',
    previewReport: 'Report',
    previewShowScan: 'Show the scan in progress',
    previewShowReport: 'Show the report',

    badgeTag: 'New',
    badgeText: 'Scans the whole website, not just one page',
    heroTitle: 'Baseerah',
    tagline: 'Accessibility checks for every page of your website.',
    heroLede:
      'Paste a link. Baseerah follows the site’s own links, runs axe-core on each page and shows what blocks people who are blind or have low vision, page by page.',
    howLink: 'How a scan works',

    urlLabel: 'Website URL',
    urlHint: 'The start page of a public website. Only public pages are scanned.',
    scanButton: 'Scan website',
    checkingButton: 'Checking address…',
    scanningButton: 'Scanning…',

    statementBefore: 'Build websites for',
    statementStruck: 'some',
    statementAfter: 'everyone.',
    statementText:
      'One in six people lives with a disability. Baseerah gives developers the barriers on every page, the people each one affects and the elements to fix, before those visitors find them first.',

    aboutTitle: 'What a scan does',
    aboutLede:
      'Baseerah checks each page against the W3C Accessibility Guidelines (WCAG) 3.0. The Bronze, Silver and Gold rating comes in a later release.',
    stage1Title: 'It follows the site’s links',
    stage1Text: 'Every internal page it can reach joins the queue once. Other websites, files and email links are left alone.',
    stage2Title: 'It checks every element',
    stage2Text: 'Each page is loaded like a visitor would see it, then each failing element is recorded with its code.',
    stage3Title: 'It tells you what to fix first',
    stage3Text: 'The report adds up the issues by severity and puts the rule that matters most at the top.',
    fragChecked: 'Checked',
    fragChecking: 'Checking',
    fragWaiting: 'Waiting',
    fragBlind: 'Blind visitors hear nothing for this image.',
    fragFix: 'Fix:',
    fragFixText: 'describe the image in an {alt} attribute, or mark it as decorative with {empty}.',
    fragWcag: 'WCAG 3.0: Text alternatives, found on 1 page.',
    factDepth: 'links deep',
    factDepthText: 'from the page you start on',
    factTime: 's per page',
    factTimeText: 'with {n} pages checked at a time',
    factForms: 'forms sent',
    factFormsText: 'it never clicks, submits or signs in',

    footer: 'Baseerah is a SWE 444 project by Inclusive Minds, King Saud University. Checks are powered by {axe}. Automated tools find some barriers, not all of them.',

    currentScan: 'Current scan',
    scanningTitle: 'Scanning {host}',
    scannedTitle: 'Scanned {host}',
    openingFirst: 'Opening the first page…',
    progressLine: '{done} of {total} done',
    progressQueue: ', {n} waiting in the queue',
    countFound: 'Found',
    countQueue: 'In queue',
    countChecked: 'Checked',
    countFailed: 'Failed',
    countSkipped: 'Skipped',
    notifyGranted: 'You can switch to another tab. Baseerah will send a notification when the scan finishes.',
    notifyDefault: 'You can switch to another tab. The tab title shows the progress and the result.',
    notifyDenied:
      'You can switch to another tab. The tab title shows the progress and the result. Notifications are blocked for this site in your browser settings.',
    pagesFound: 'Pages found on the website',
    key: 'Key',

    doneTitle: 'Scan complete',
    doneText: '{pages} checked and {issues} found.',
    doneFailed: '{pages} could not be scanned.',
    stoppedEarly: 'Stopped early:',
    viewReport: 'View report',
    failedTitle: 'The scan could not be completed',
    failedUnknown: 'The scan stopped because of an unexpected error.',
    failedNoReport: 'No report was created, because no pages could be checked.',
    tryAgain: 'Try again',

    tileWaiting: 'Waiting',
    tileChecking: 'Checking now',
    tileCritical: 'Worst issue critical',
    tileSerious: 'Worst issue serious',
    tileModerate: 'Worst issue moderate',
    tileMinor: 'Worst issue minor',
    tileClean: 'No issues found',
    tileFailed: 'Could not be scanned',
    tileSkipped: 'Skipped',
    labelChecked0: '{path}: checked, 0 issues',
    labelChecked: '{path}: checked, {issues}, worst {impact}',
    labelFailed: '{path}: could not be scanned',
    labelSkipped: '{path}: skipped',
    labelScanning: '{path}: checking now',
    labelWaiting: '{path}: waiting',

    reportFor: 'Accessibility report for',
    started: 'Started {start}, finished {end} ({duration})',
    scanAnother: 'Scan another website',
    scanAgain: 'Scan again',
    fixFirst: 'Fix first:',
    fixFirstText: '{rule}. {impact}, {elements} on {pages}.',
    previewSeverity: '4 critical, 1 serious',
    previewTally: '8 scanned, 1 failed, 1 skipped',
    noIssuesFinding: 'axe-core found no issues on the {pages}. Automated checks find some barriers, not all, so test by hand too.',
    partial: 'Partial scan.',
    issuesTitle: 'Issues',
    affected: 'Affected elements',
    onPages: 'On {n} of {pages}',
    severityCaption: 'Issues by severity',
    severity: 'Severity',
    share: 'Share',
    total: 'Total',
    rulesTitle: 'Rules broken',
    noRules: 'No axe-core rule failed on the scanned pages.',
    ruleMeta: '{impact}, on {pages}',
    moreRules: '{n} more in the page list below.',
    pagesTitle: 'Pages',
    selectPage: 'Select a page to open it',
    pagesOnSite: 'Pages on the website',
    tallyFound: 'Found',
    tallyScanned: 'Scanned',
    tallyFailed: 'Could not be scanned',
    tallySkipped: 'Skipped',
    byPage: 'Page by page',
    byPageHint: 'Most severe first. Open a page to see each issue and the elements involved.',
    colPage: 'Page',
    colIssues: 'Issues',
    none: 'None',
    noIssues: 'No issues',
    open: 'Open {path}',
    newTab: '(opens in a new tab)',
    pageClean: 'axe-core found no issues on this page. Automated checks cannot catch every barrier, so test it by hand too.',
    elementsAffected: '{elements} affected. Rule {rule}',
    wcagTags: ', WCAG tags {tags}',
    showing: 'Showing {shown} of {total} elements.',
    howToFix: 'How to fix it, on Deque University',
    couldNotScan: 'Could not be scanned.',
    skippedRow: 'Skipped.',
    noteRedirect: 'Redirects to a page that was already scanned ({url}).',
    noteTime: 'Not scanned: the scan time limit was reached.',

    impact_critical: 'Critical',
    impact_serious: 'Serious',
    impact_moderate: 'Moderate',
    impact_minor: 'Minor',

    limit_maxPages: 'The scan stopped at the {maxPages}-page limit, so some pages on this website were not scanned.',
    limit_maxDepth: 'Some pages are more than {maxDepth} links away from the start page and were not scanned.',
    limit_maxDuration: 'The scan reached its {minutes}-minute time limit, so pages still waiting in the queue were not scanned.',

    announceChecking: 'Checking that the website can be reached…',
    announceStarted: 'Scan started for {host}.',
    announceDone: 'Scan complete. {pages} checked, {issues} found.',
    announceFailed: 'Scan failed. {message}',
    titleScanning: 'Scanning {done}/{total} – Baseerah',
    titleScanningStart: 'Scanning… – Baseerah',
    titleDone: 'Scan complete – Baseerah',
    titleFailed: 'Scan failed – Baseerah',
    notifyDoneBody: '{host}: {pages} checked, {issues} found.',
    notifyFailedBody: 'The scan could not be completed.',
    notifyFailedTitle: 'Scan failed',
  },

  ar: {
    skip: 'تخطَّ إلى المحتوى',
    home: 'بصيرة: الصفحة الرئيسية',
    navHow: 'كيف يعمل',
    navScan: 'افحص موقعًا',
    langButton: 'En',
    langLabel: 'English',
    langCode: 'en',
    pageTitle: 'بصيرة – فحص إتاحة المواقع',
    previewScanning: 'جارٍ الفحص 6 من 10',
    previewReport: 'التقرير',
    previewShowScan: 'اعرض بطاقة الفحص الجاري',
    previewShowReport: 'اعرض بطاقة التقرير',

    badgeTag: 'جديد',
    badgeText: 'يفحص الموقع كاملًا، لا صفحة واحدة فقط',
    heroTitle: 'بصيرة',
    tagline: 'فحص الإتاحة لكل صفحة في موقعك.',
    heroLede:
      'الصق الرابط، وتتبّع بصيرة روابط الموقع الداخلية، وتشغّل axe-core على كل صفحة، وتعرض ما يعيق المكفوفين وضعاف البصر، صفحةً صفحة.',
    howLink: 'كيف يعمل الفحص',

    urlLabel: 'رابط الموقع',
    urlHint: 'الصفحة الأولى لموقع عام. لا تُفحص إلا الصفحات العامة.',
    scanButton: 'افحص الموقع',
    checkingButton: 'جارٍ التحقق من الرابط…',
    scanningButton: 'جارٍ الفحص…',

    statementBefore: 'ابنِ مواقع',
    statementStruck: 'لبعض الناس',
    statementAfter: 'للجميع.',
    statementText:
      'واحد من كل ستة أشخاص يعيش مع إعاقة. تعطي بصيرة المطوّرين العوائق في كل صفحة، ومن تؤثر فيهم، والعناصر التي يجب إصلاحها، قبل أن يصطدم بها الزوّار.',

    aboutTitle: 'ماذا يفعل الفحص',
    aboutLede:
      'تفحص بصيرة كل صفحة وفق إرشادات W3C للإتاحة (WCAG) 3.0. أما التصنيف البرونزي والفضي والذهبي فيأتي في إصدار لاحق.',
    stage1Title: 'يتتبّع روابط الموقع',
    stage1Text: 'كل صفحة داخلية يصل إليها تدخل الطابور مرة واحدة. أما المواقع الأخرى والملفات وروابط البريد فيتجاهلها.',
    stage2Title: 'يفحص كل عنصر',
    stage2Text: 'تُحمَّل كل صفحة كما يراها الزائر، ثم يُسجَّل كل عنصر مخالف مع الكود الخاص به.',
    stage3Title: 'يخبرك بما تصلحه أولًا',
    stage3Text: 'يجمع التقرير المشكلات حسب خطورتها، ويضع القاعدة الأهم في الأعلى.',
    fragChecked: 'فُحصت',
    fragChecking: 'جارٍ الفحص',
    fragWaiting: 'في الانتظار',
    fragBlind: 'لن يسمع الزائر الكفيف شيئًا عن هذه الصورة.',
    fragFix: 'الإصلاح:',
    fragFixText: 'صِف الصورة في الخاصية {alt}، أو اجعلها زخرفية بـ {empty}.',
    fragWcag: 'WCAG 3.0: البدائل النصية، وُجدت في صفحة واحدة.',
    factDepth: 'روابط عمقًا',
    factDepthText: 'من الصفحة التي تبدأ منها',
    factTime: 'ثانية لكل صفحة',
    factTimeText: 'مع فحص {n} صفحات في الوقت نفسه',
    factForms: 'نماذج تُرسل',
    factFormsText: 'لا يضغط أي زر، ولا يرسل نموذجًا، ولا يسجّل الدخول',

    footer: 'بصيرة مشروع لمقرر SWE 444 من فريق Inclusive Minds في جامعة الملك سعود. الفحص يعمل بـ {axe}. الأدوات الآلية تكشف بعض العوائق، لا كلها.',

    currentScan: 'الفحص الحالي',
    scanningTitle: 'جارٍ فحص {host}',
    scannedTitle: 'اكتمل فحص {host}',
    openingFirst: 'جارٍ فتح الصفحة الأولى…',
    progressLine: 'انتهى {done} من {total}',
    progressQueue: '، و{n} في الطابور',
    countFound: 'المكتشفة',
    countQueue: 'في الطابور',
    countChecked: 'فُحصت',
    countFailed: 'فشلت',
    countSkipped: 'تُخطّيت',
    notifyGranted: 'يمكنك الانتقال إلى تبويب آخر، وسترسل بصيرة إشعارًا عند انتهاء الفحص.',
    notifyDefault: 'يمكنك الانتقال إلى تبويب آخر، وسيعرض عنوان التبويب التقدم والنتيجة.',
    notifyDenied: 'يمكنك الانتقال إلى تبويب آخر، وسيعرض عنوان التبويب التقدم والنتيجة. الإشعارات محظورة لهذا الموقع في إعدادات المتصفح.',
    pagesFound: 'الصفحات المكتشفة في الموقع',
    key: 'دليل الألوان',

    doneTitle: 'اكتمل الفحص',
    doneText: 'فُحصت {pages}، ووُجدت {issues}.',
    doneFailed: 'تعذّر فحص {pages}.',
    stoppedEarly: 'توقف مبكرًا:',
    viewReport: 'اعرض التقرير',
    failedTitle: 'تعذّر إكمال الفحص',
    failedUnknown: 'توقف الفحص بسبب خطأ غير متوقع.',
    failedNoReport: 'لم يُنشأ تقرير، لأنه تعذّر فحص أي صفحة.',
    tryAgain: 'حاول مرة أخرى',

    tileWaiting: 'في الانتظار',
    tileChecking: 'جارٍ الفحص',
    tileCritical: 'أخطر مشكلة: حرجة',
    tileSerious: 'أخطر مشكلة: خطيرة',
    tileModerate: 'أخطر مشكلة: متوسطة',
    tileMinor: 'أخطر مشكلة: بسيطة',
    tileClean: 'لا توجد مشكلات',
    tileFailed: 'تعذّر الفحص',
    tileSkipped: 'تُخطّيت',
    labelChecked0: '{path}: فُحصت، 0 مشكلات',
    labelChecked: '{path}: فُحصت، {issues}، أخطرها {impact}',
    labelFailed: '{path}: تعذّر فحصها',
    labelSkipped: '{path}: تُخطّيت',
    labelScanning: '{path}: جارٍ فحصها',
    labelWaiting: '{path}: في الانتظار',

    reportFor: 'تقرير الإتاحة لموقع',
    started: 'بدأ {start}، وانتهى {end} ({duration})',
    scanAnother: 'افحص موقعًا آخر',
    scanAgain: 'أعد الفحص',
    fixFirst: 'أصلح أولًا:',
    fixFirstText: '{rule}. {impact}، {elements} في {pages}.',
    previewSeverity: '4 حرجة، 1 خطيرة',
    previewTally: 'فُحصت 8، وفشلت 1، وتُخطّيت 1',
    noIssuesFinding: 'لم يجد axe-core أي مشكلة في {pages}. الفحص الآلي يكشف بعض العوائق لا كلها، فاختبر يدويًا أيضًا.',
    partial: 'فحص جزئي.',
    issuesTitle: 'المشكلات',
    affected: 'العناصر المتأثرة',
    onPages: 'في {n} من {pages}',
    severityCaption: 'المشكلات حسب الخطورة',
    severity: 'الخطورة',
    share: 'النسبة',
    total: 'المجموع',
    rulesTitle: 'القواعد المخالَفة',
    noRules: 'لم تُخالَف أي قاعدة من قواعد axe-core في الصفحات المفحوصة.',
    ruleMeta: '{impact}، في {pages}',
    moreRules: '{n} أخرى في قائمة الصفحات بالأسفل.',
    pagesTitle: 'الصفحات',
    selectPage: 'اختر صفحة لفتحها',
    pagesOnSite: 'صفحات الموقع',
    tallyFound: 'المكتشفة',
    tallyScanned: 'فُحصت',
    tallyFailed: 'تعذّر فحصها',
    tallySkipped: 'تُخطّيت',
    byPage: 'صفحةً صفحة',
    byPageHint: 'الأخطر أولًا. افتح صفحة لترى كل مشكلة والعناصر المعنية.',
    colPage: 'الصفحة',
    colIssues: 'المشكلات',
    none: 'لا شيء',
    noIssues: 'لا مشكلات',
    open: 'افتح {path}',
    newTab: '(تُفتح في تبويب جديد)',
    pageClean: 'لم يجد axe-core أي مشكلة في هذه الصفحة. الفحص الآلي لا يكشف كل العوائق، فاختبرها يدويًا أيضًا.',
    elementsAffected: '{elements} متأثرة. القاعدة {rule}',
    wcagTags: '، وسوم WCAG: {tags}',
    showing: 'يُعرض {shown} من {total} عناصر.',
    howToFix: 'طريقة الإصلاح في Deque University',
    couldNotScan: 'تعذّر فحصها.',
    skippedRow: 'تُخطّيت.',
    noteRedirect: 'تعيد التوجيه إلى صفحة فُحصت مسبقًا ({url}).',
    noteTime: 'لم تُفحص: وصل الفحص إلى حدّه الزمني.',

    impact_critical: 'حرجة',
    impact_serious: 'خطيرة',
    impact_moderate: 'متوسطة',
    impact_minor: 'بسيطة',

    limit_maxPages: 'توقف الفحص عند حدّ {maxPages} صفحة، فلم تُفحص بعض صفحات الموقع.',
    limit_maxDepth: 'بعض الصفحات تبعد أكثر من {maxDepth} روابط عن صفحة البداية، فلم تُفحص.',
    limit_maxDuration: 'وصل الفحص إلى حدّه الزمني ({minutes} دقائق)، فلم تُفحص الصفحات التي بقيت في الطابور.',

    announceChecking: 'جارٍ التحقق من إمكانية الوصول إلى الموقع…',
    announceStarted: 'بدأ فحص {host}.',
    announceDone: 'اكتمل الفحص. فُحصت {pages}، ووُجدت {issues}.',
    announceFailed: 'فشل الفحص. {message}',
    titleScanning: 'جارٍ الفحص {done}/{total} – بصيرة',
    titleScanningStart: 'جارٍ الفحص… – بصيرة',
    titleDone: 'اكتمل الفحص – بصيرة',
    titleFailed: 'فشل الفحص – بصيرة',
    notifyDoneBody: '{host}: فُحصت {pages}، ووُجدت {issues}.',
    notifyFailedBody: 'تعذّر إكمال الفحص.',
    notifyFailedTitle: 'فشل الفحص',
  },
};

// Arabic versions of every error the API or the form can report, by code. English uses the API's own message.
const ERRORS_AR = {
  EMPTY_URL: 'أدخل رابط الموقع لفحصه.',
  INVALID_URL: 'هذا ليس رابطًا صحيحًا. تأكد من كتابته، مثل https://www.ksu.edu.sa.',
  UNSUPPORTED_PROTOCOL: 'لا يمكن فحص إلا الروابط التي تبدأ بـ http:// أو https://.',
  CREDENTIALS_NOT_ALLOWED: 'احذف اسم المستخدم أو كلمة المرور من الرابط. بصيرة تفحص الصفحات العامة فقط.',
  BLOCKED_ADDRESS: 'هذا الرابط يشير إلى شبكة خاصة أو داخلية (مثل localhost). بصيرة تفحص المواقع العامة فقط.',
  DNS_NOT_FOUND: 'لا يوجد موقع على هذا النطاق. تأكد من كتابة اسم النطاق.',
  UNREACHABLE: 'تعذّر الوصول إلى الموقع. تأكد من أنه يعمل ومتاح للعموم.',
  TIMEOUT: 'تأخر الموقع في الاستجابة. حاول لاحقًا أو تأكد من أنه يعمل.',
  HTTP_ERROR: 'ردّ الموقع برمز خطأ، فلا يمكن فحصه.',
  TOO_MANY_REDIRECTS: 'يعيد الموقع التوجيه مرات كثيرة فلا يمكن فحصه.',
  UNSUPPORTED_CONTENT: 'هذا الرابط لا يعرض صفحة ويب (HTML)، فلا يمكن فحصه.',
  NAVIGATION_FAILED: 'تعذّر تحميل الصفحة في متصفح الفحص.',
  REDIRECTED_EXTERNAL: 'تعيد الصفحة التوجيه إلى موقع آخر، فلم تُفحص.',
  ANALYSIS_FAILED: 'حُمّلت الصفحة، لكن تعذّر تشغيل فحوص الإتاحة عليها.',
  SCAN_FAILED: 'تعذّر إكمال الفحص بسبب خطأ غير متوقع في أداة الفحص.',
  SCAN_NOT_FOUND: 'هذا الفحص غير موجود أو انتهت صلاحيته. ابدأ فحصًا جديدًا.',
  SCANNER_BUSY: 'أداة الفحص مشغولة بفحوص أخرى. حاول بعد دقيقة.',
  RATE_LIMITED: 'بدأت فحوص كثيرة من شبكتك. انتظر دقيقة ثم حاول مجددًا.',
  INVALID_REQUEST: 'الطلب غير صالح.',
  PAYLOAD_TOO_LARGE: 'الطلب كبير جدًا.',
  NETWORK_ERROR: 'تعذّر على بصيرة الوصول إلى الخادم. تحقق من اتصالك وحاول مجددًا.',
  API_UNAVAILABLE: 'خادم الفحص في بصيرة غير متصل بهذا الموقع بعد، فلا يمكن تشغيل الفحص هنا.',
  INTERNAL_ERROR: 'حدث خطأ في الخادم. حاول لاحقًا.',
};

function fill(template, vars = {}) {
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));
}

export function makeI18n(lang) {
  const strings = STRINGS[lang] ?? STRINGS.en;
  return {
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    t: (key, vars) => fill(strings[key] ?? STRINGS.en[key] ?? key, vars),
    count: (n, noun) => countWord(lang, n, noun),
    unit: (n, noun) => unitWord(lang, n, noun),
    impact: (impact) => strings[`impact_${impact}`] ?? impact,
    /** An error from the API or the form, in the current language. HTTP_ERROR keeps the status the server reported. */
    error: (error) => {
      if (!error) return '';
      if (lang !== 'ar') return error.message;
      const base = ERRORS_AR[error.code];
      if (!base) return error.message;
      const status = error.code === 'HTTP_ERROR' && error.message?.match(/HTTP (\d{3})/)?.[1];
      return status ? `${base} (HTTP ${status})` : base;
    },
    limit: (limit, limits) =>
      limits
        ? fill(strings[`limit_${limit.type}`] ?? limit.message, {
            ...limits,
            minutes: Math.round((limits.maxDurationMs ?? 0) / 60000),
          })
        : limit.message,
    note: (note) => {
      if (!note || lang !== 'ar') return note ?? '';
      const redirect = note.match(/^Redirects to a page that was already scanned \((.+)\)\.$/);
      if (redirect) return fill(strings.noteRedirect, { url: redirect[1] });
      if (note.startsWith('Not scanned: the scan time limit')) return strings.noteTime;
      return note;
    },
  };
}

export const I18nContext = createContext(makeI18n('en'));

export function useI18n() {
  return useContext(I18nContext);
}