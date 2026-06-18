import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import crypto from "crypto";

const PORT = 3000;
const app = express();

app.use(express.json());

// Set up a simple local JSON database for persistency
const DATA_FILE = path.join(process.cwd(), "data_store.json");

interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  country?: string;
  service: string;
  message: string;
  timestamp: string;
  ip: string;
  lang: string;
  type: "contact" | "assessment";
  resultDetails?: {
    program: string;
    suitability: string;
    cost: string;
  };
}

interface Testimonial {
  id: string;
  name: string;
  rating: number;
  quote: string;
  role?: string;
  lang: string;
  timestamp: string;
}

interface Category {
  id: string; // e.g. "investment"
  parentId: string | null;
  name: {
    ar: string;
    tr: string;
    en: string;
  };
  slug: string;
}

interface BlogComment {
  id: string;
  articleId: string;
  authorName: string;
  authorEmail: string;
  content: string;
  timestamp: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  lang: "ar" | "tr" | "en";
  categoryId: string;
  subCategoryId?: string;
  tags: string[];
  featuredImage: string;
  altText: string;
  status: "published" | "draft" | "scheduled" | "archived";
  publishDate: string; // ISO format or schedule
  views: number;
  readingTime: number; // in minutes
  author: string;
  role: "admin" | "editor" | "writer";
  seo: {
    title: string;
    description: string;
    keywords: string;
    canonicalUrl: string;
    ogTitle: string;
    ogDescription: string;
    twitterCard: string;
  };
  linkedTranslations: {
    ar?: string;
    tr?: string;
    en?: string;
  };
}

interface AdminLog {
  id: string;
  timestamp: string;
  ip: string;
  action: string;
  details: string;
}

interface StatsStore {
  whatsappClicks: number;
  emailsSent: number;
  consultations: number;
  assessments: number;
  inquiries: Inquiry[];
  testimonials?: Testimonial[];
  articles?: Article[];
  categories?: Category[];
  comments?: BlogComment[];
  adminLogs?: AdminLog[];
}

const seedCategories: Category[] = [
  { id: "investment", parentId: null, name: { ar: "الاستثمار", tr: "Yatırım", en: "Investment" }, slug: "investment" },
  { id: "foreign_investment", parentId: "investment", name: { ar: "الاستثمار الأجنبي", tr: "Yabancı Yatırım", en: "Foreign Investment" }, slug: "foreign-investment" },
  { id: "real_estate_investment", parentId: "investment", name: { ar: "الاستثمار العقاري", tr: "Gayrimenkul Yatırımı", en: "Real Estate Investment" }, slug: "real-estate-investment" },
  
  { id: "residency", parentId: null, name: { ar: "الإقامة المميزة", tr: "Premium İkametgah", en: "Premium Residency" }, slug: "residency" },
  { id: "residency_benefits", parentId: "residency", name: { ar: "مزايا الإقامة", tr: "İkamet Avantajları", en: "Residency Benefits" }, slug: "residency-benefits" },
  { id: "residency_conditions", parentId: "residency", name: { ar: "شروط الإقامة", tr: "İkamet Koşulları", en: "Residency Requirements" }, slug: "residency-conditions" },
  
  { id: "incorporation", parentId: null, name: { ar: "تأسيس الشركات", tr: "Şirket Kurulumu", en: "Company Incorporation" }, slug: "incorporation" },
  { id: "foreign_companies", parentId: "incorporation", name: { ar: "الشركات الأجنبية", tr: "Yabancı Şirketler", en: "Foreign Companies" }, slug: "foreign-companies" },
  { id: "saudi_companies", parentId: "incorporation", name: { ar: "الشركات السعودية", tr: "Yerel Şirketler", en: "Saudi Companies" }, slug: "saudi-companies" }
];

const seedComments: BlogComment[] = [
  {
    id: "comm_1",
    articleId: "art_1_ar",
    authorName: "خالد بن عبد الله",
    authorEmail: "khaled@example.com",
    content: "استعراض رائع ومفصل لنظام الاستثمار الأجنبي الجديد. هذا يسهل الكثير من الإجراءات القانونية للشركات الراغبة بالدخول إلى السوق السعودي.",
    timestamp: "2026-06-12T14:30:00Z"
  },
  {
    id: "comm_2",
    articleId: "art_2_tr",
    authorName: "Mehmet Yılmaz",
    authorEmail: "mehmet@example.com",
    content: "Riyad'da gayrimenkul almak istiyorduk, bu yazı aklımızdaki soru işaretlerini giderdi. Teşekkürler.",
    timestamp: "2026-06-14T09:15:00Z"
  }
];

const seedArticles: Article[] = [
  {
    id: "art_1_ar",
    title: "شرح نظام الاستثمار السعودي الجديد وتأثيراته على المستثمر الأجنبي",
    slug: "new-saudi-investment-law-explained",
    excerpt: "تعرّف على التحديثات التشريعية الأخيرة لوزارة الاستثمار (MISA) وتسهيل تملك الأجانب بنسبة 100% للشركات وإلغاء القيود القديمة.",
    author: "المستشار القانوني أدهم القحطاني",
    role: "admin",
    lang: "ar",
    categoryId: "foreign_investment",
    tags: ["الاستثمار_الأجنبي", "MISA", "تأسيس_الشركات", "رؤية_2030"],
    featuredImage: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=800&q=80",
    altText: "عقارات ومقرات تجارية فاخرة بالرياض",
    status: "published",
    publishDate: "2026-06-10T08:00:00Z",
    views: 420,
    readingTime: 6,
    content: `<h2>إعادة هيكلة البيئة الاستثمارية في المملكة العربية السعودية</h2>
<p>تشهد بيئة الأعمال في المملكة العربية السعودية قفزات تشريعية نوعية توافق طموحات <strong>رؤية 2030</strong>. التعديلات القانونية الأخيرة التي أعلنتها <strong>وزارة الاستثمار (MISA)</strong> تهدف بشكل مباشر إلى توحيد الحماية والمعاملة المتساوية بين المستثمر المحلي والأجنبي، وحياد المعاملة الضريبية، وتأمين تدفقات رؤوس الأموال دون أية معوقات.</p>

<blockquote>"النظام الجديد يعطى قوة استثنائية لحصانة الأصول الاستثمارية ويحظر نزع الملكية أو تجميدها إلا بقرارات قضائية نهائية وبتعويض عادل ومكافئ."</blockquote>

<h3>أبرز ملامح نظام الاستثمار الجديد</h3>
<ul>
  <li><strong>المعاملة المتساوية:</strong> إلغاء المتطلبات التفضيلية القديمة ومساواة المستثمر الأجنبي بصاحب العمل الوطني في معظم القطاعات الاقتصادية المفتوحة.</li>
  <li><strong>إطلاق حرية تحويل الأرباح:</strong> ضمان قانوني صريح لسلامة تحويل التدفقات المالية، الأرباح، ورواتب الموظفين للخارج فوراً ودون قيود إضافية.</li>
  <li><strong>حماية الملكية الكاملة:</strong> ترقية نظام تسجيل الصكوك والضمانات ضد أثر نزع تملك الكيانات أو مصادرتها إلا بآليات التقاضي الأصولية.</li>
</ul>

<h3>مقارنة التعديلات التنظيمية لنشاط الاستثمار</h3>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <thead>
    <tr style="background-color: #031534; color: #ffffff;">
      <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">الخدمة / الميزة</th>
      <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">الوضع السابق</th>
      <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">الوضع الحالي بموجب القانون الجديد</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 12px; border: 1px solid #ddd;">الشريك المحلي</td>
      <td style="padding: 12px; border: 1px solid #ddd;">كان إلزامياً في قطاعات معينة</td>
      <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; color: #c9a84c;">ملكية كاملة 100% للأجانب دون قيود شريك</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td style="padding: 12px; border: 1px solid #ddd;">مدة إصدار الترخيص</td>
      <td style="padding: 12px; border: 1px solid #ddd;">قد تستغرق أسابيع</td>
      <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; color: #c9a84c;">دفعات تسجيل فورية ومؤتمتة بالكامل عبر بوابة MISA</td>
    </tr>
    <tr>
      <td style="padding: 12px; border: 1px solid #ddd;">الضمانات المالية</td>
      <td style="padding: 12px; border: 1px solid #ddd;">متطلبات كفالة مصرفية مرتفعة جداً</td>
      <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; color: #c9a84c;">اعتمادات أوراق الملكية العادية وتسهيلات التحول الرقمي</td>
    </tr>
  </tbody>
</table>

<h3>الخطوات العملية لتسجيل وتأسيس أعمالك</h3>
<p>يتطلب البدء في تأسيس الشركات الأجنبية تعبئة استمارة التسجيل بوزارة الاستثمار، تصديق وكالات الشركة من السفارة السعودية وإرفاق السجلات المالية وحسابات التدقيق المالي. تقوم <em>آفاق الخليج العربي</em> بتسليم ملفك قانونياً ودعمك في تعقيب المعاملات.</p>`,
    seo: {
      title: "نظام الاستثمار السعودي الجديد للمستثمرين الأجانب | آفاق الخليج",
      description: "تحليل قانوني تفصيلي للبيئة الاستثمارية وتملك الأجانب بنسبة 100% بموجب تعديلات وزارة الاستثمار السعودية MISA.",
      keywords: "الاستثمار السعودي, نظام الاستثمار الجديد, وزارة الاستثمار, تملك الاجانب, تأسيس الشركات الرياض",
      canonicalUrl: "https://gulfhorizons.com/blog/new-saudi-investment-law",
      ogTitle: "دليلك لنظام الاستثمار الأجنبي الجديد في المملكة",
      ogDescription: "اقرأ ملامح التشريع الجديد والضمانات القانونية وحقوق حماية الأصول.",
      twitterCard: "summary_large_image"
    },
    linkedTranslations: {
      ar: "art_1_ar",
      tr: "art_1_tr",
      en: "art_1_en"
    }
  },
  {
    id: "art_1_tr",
    title: "Yeni Suudi Arabistan Yatırım Kanunu ve Yabancı Yatırımcılara Etkileri",
    slug: "yeni-suudi-arabistan-yatirim-kanunu-ve-etkileri",
    excerpt: "Suudi Yatırım Bakanlığı (MISA) tarafından açıklanan yeni yasal düzenlemeleri, %100 yabancı ortaklı şirket kurulumlarını ve bürokratik kolaylıkları inceleyin.",
    author: "Kıdemli Danışman Adham Al-Qahtani",
    role: "admin",
    lang: "tr",
    categoryId: "foreign_investment",
    tags: ["Yatırım", "MISA", "Suudi2030", "ŞirketKurulumu"],
    featuredImage: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=800&q=80",
    altText: "Riyad iş merkezi gökdelenleri",
    status: "published",
    publishDate: "2026-06-10T08:00:00Z",
    views: 295,
    readingTime: 7,
    content: `<h2>Suudi Arabistan Yatırım İkliminde Büyük Değişim</h2>
<p>Suudi Arabistan, <strong>Vizyon 2030</strong> vizyonu çerçevesinde yabancı doğrudan yatırımların önündeki tüm hukuki engelleri birer birer kaldırmaktadır. <strong>Yatırım Bakanlığı (MISA)</strong> tarafından yürürlüğe konan reform paketi, Türk yatırımcıları ve uluslararası şirketlerin krallıkta şirket kurma masraflarını azaltırken, yerli-yabancı yatırımcı eşitliğini yasal güvence altına alıyor.</p>

<blockquote>"Yeni düzenleme ile ulusal pazarda yabancı iştirakli firmaların faaliyetleri, yerel Suudi sermayeli şirketlerle tamamen aynı hak ve muafiyet seviyesine çekilmiştir."</blockquote>

<h3>Yeni Yatırım Reformunun Temel Sütunları</h3>
<ul>
  <li><strong>Eşit Muamele İlkesi:</strong> Yabancı sermayeye sahip limited ve anonim şirketler, rüçhan hakları ve gümrük kolaylıklarında yerel şirketlerle eşit statüye kavuştu.</li>
  <li><strong>Transfer Serbestisi:</strong> Şirket kârlarının, temettü ödemelerinin, tescilli marka haklarının ve personel ücretlerinin engelsiz bir şekilde yurt dışına transferi devlet garantisine alındı.</li>
  <li><strong>Mülkiyet Güvencesi:</strong> Kamulaştırma, el koyma veya varlık dondurma gibi işlemler ancak nihai mahkeme kararı ve adil bir piyasa tazminatı karşılığında gerçekleştirilebilir hale geldi.</li>
</ul>

<h3>MISA Yatırım Mevzuat Karşılaştırması</h3>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <thead>
    <tr style="background-color: #031534; color: #ffffff;">
      <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Kriter / Kolaylık</th>
      <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Eski Dönem</th>
      <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Yeni Yatırım Kanunu Dönemi</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Yerel Ortak Zorunluluğu</td>
      <td>Birçok hizmet ve ticari kolda %51 yerel hissedar aranıyordu</td>
      <td style="font-weight: bold; color: #c9a84c;">%100 yabancı ortaklı mülkiyet ve tam yönetim kontrolü</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td>Ruhsat Alma Süresi</td>
      <td>Evrak hazırlığı haftalar sürebiliyordu</td>
      <td style="font-weight: bold; color: #c9a84c;">MISA portalı üzerinden dijital, hızlı ve entegre onaylar</td>
    </tr>
    <tr>
      <td>Kâr Transferi</td>
      <td>Sıkı denetim ve yüksek stopaj bariyerleri bulunuyordu</td>
      <td style="font-weight: bold; color: #c9a84c;">Engelsiz, şeffaf ve uluslararası muhasebe uyumlu transfer güvencesi</td>
    </tr>
  </tbody>
</table>

<h3>İşletmenizi Sıfırdan Başlatma ve Ruhsatlandırma Adımları</h3>
<p>Suudi Arabistan'da ticari faaliyete başlamak için şirket tüzüğünün onaylanması, Türk apostil ve büyükelçilik tasdik süreçlerinin yürütülmesi gerekmektedir. <em>Afaq Al-Khalij</em> olarak bu süreci uçtan uca dijital olarak, Riyad ve İstanbul ofislerimizden sizin adınıza takip ediyoruz.</p>`,
    seo: {
      title: "Yeni Suudi Arabistan Yatırım Kanunu ve Fırsatlar | Afaq Al-Khalij",
      description: "Suudi Arabistan yatırım reformu, MISA yabancı sermaye kuralları ve Türk şirketleri için limited ortaklık rehberi.",
      keywords: "Suudi Arabistan yatırım, MISA yatırım lisansı, şirket kurulumu Riyad, suudi kanunları",
      canonicalUrl: "https://gulfhorizons.com/blog/yeni-suudi-yatirim-kanunu",
      ogTitle: "Yabancı Yatırımcılar İçin Yeni Suudi Arabistan Düzenlemeleri",
      ogDescription: "Reform detayları, tam mülkiyet hakları ve kâr transferi serbestisi hakkında detaylı yasal analiz.",
      twitterCard: "summary_large_image"
    },
    linkedTranslations: {
      ar: "art_1_ar",
      tr: "art_1_tr",
      en: "art_1_en"
    }
  },
  {
    id: "art_1_en",
    title: "Understanding the New Saudi Investment Law: Legal Reforms and Investor Protections",
    slug: "understanding-the-new-saudi-investment-law",
    excerpt: "Analyze the landmark legal reforms introduced by the Ministry of Investment (MISA) offering 100% business ownership, profit repatriation rights, and assets safety guarantees.",
    author: "Advisory Board Director Adham Al-Qahtani",
    role: "admin",
    lang: "en",
    categoryId: "foreign_investment",
    tags: ["Investment", "MISA", "Saudi2030", "Incorporation", "LegalReforms"],
    featuredImage: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=800&q=80",
    altText: "Riyadh financial district Skyscrapers",
    status: "published",
    publishDate: "2026-06-10T08:00:00Z",
    views: 187,
    readingTime: 5,
    content: `<h2>A Paradigm Shift in the Gulf's Largest Economy</h2>
<p>Under the visionary leadership of <strong>Vision 2030</strong>, the Kingdom of Saudi Arabia has introduced historical structural overhauls to its regulatory code. The latest decree launched by the <strong>Ministry of Investment (MISA)</strong> sets out a reliable legal framework aligning foreign capital standards directly with national private enterprises to guarantee security, fiscal neutrality, and ease of expansion.</p>

<blockquote>"The unified law forbids any form of forced asset expropriation or freezing order except under standard, supreme court-supervised civil investigations with strict compensation metrics."</blockquote>

<h3>Key Breakthroughs of the Unified Investment Law</h3>
<ul>
  <li><strong>Absolute Market Equality:</strong> Foreign ventures inherit the exact tax exemptions, municipal allowances, and sovereign rights originally exclusive to domestic Saudi corporations.</li>
  <li><strong>Unrestricted repatriation:</strong> Statutory guarantees secure smooth, immediate wire-transfer of corporate yields, dividend profiles, and staff assets internationally.</li>
  <li><strong>Enhanced Due Process:</strong> Strengthens independent judicial arbitration channels and protects investments from administrative seizures.</li>
</ul>

<h3>MISA Framework Comparison: Then vs Now</h3>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <thead>
    <tr style="background-color: #031534; color: #ffffff;">
      <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Regulatory parameter</th>
      <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Former Setup</th>
      <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">New MISA Sovereign Framework</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Local Sponsorship</td>
      <td>Mandatory in various services and trade lines</td>
      <td style="font-weight: bold; color: #c9a84c;">100% Direct Foreign Ownership across dominant sectors</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td>License Turnaround</td>
      <td>Weeks of bureaucratic inter-department approvals</td>
      <td style="font-weight: bold; color: #c9a84c;">Instant online generation integrated with government platforms</td>
    </tr>
    <tr>
      <td>Asset Liquidation</td>
      <td>Subject to complex commercial escrow audits</td>
      <td style="font-weight: bold; color: #c9a84c;">Protected under modernized, international bankruptcy and civil codes</td>
    </tr>
  </tbody>
</table>

<h3>Practical Incorporation Protocols</h3>
<p>To successfully obtain a MISA investor registry, international companies must notarize corporate certificates, complete embassy certification, and submit verifiable audited sheets. <em>Arabian Gulf Horizons</em> simplifies this journey by deploying specialized onsite Taqeeb units.</p>`,
    seo: {
      title: "New Saudi Investment Law & MISA Guidelines | Gulf Horizons",
      description: "Critical legal insights into Saudi Arabia's revised investment code, 100% corporate ownership, and foreign asset protections.",
      keywords: "New Saudi Investment Law, MISA license, company establishment Riyadh, Saudi Vision 2030",
      canonicalUrl: "https://gulfhorizons.com/blog/new-saudi-investment-law",
      ogTitle: "Saudi Arabia Unified Investment Reform Explained",
      ogDescription: "Read about the major changes in KSA corporate laws, capital safety, and profit transfers.",
      twitterCard: "summary_large_image"
    },
    linkedTranslations: {
      ar: "art_1_ar",
      tr: "art_1_tr",
      en: "art_1_en"
    }
  },
  {
    id: "art_2_ar",
    title: "دليل تملك العقارات للأجانب والمستثمرين في المملكة العربية السعودية",
    slug: "saudi-foreign-propertyownership-guide",
    excerpt: "خطوة بخطوة لشراء العقار السكني والاستثماري بالرياض دون الحاجة لإقامة دائمة، والاطلاع على لوائح منصة ناجز ووزارة العدل.",
    author: "المستشار العقاري أدهم القحطاني",
    role: "admin",
    lang: "ar",
    categoryId: "real_estate_investment",
    tags: ["الاستثمار_العقاري", "تملك_الأجانب", "عقارات_الرياض", "وزارة_العدل"],
    featuredImage: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
    altText: "تصاميم معمارية فاخرة لعقارات في الرياض وجدة",
    status: "published",
    publishDate: "2026-06-12T10:30:00Z",
    views: 310,
    readingTime: 5,
    content: `<h2>ثورة التطوير العقاري وإتاحة صكوك الملكية للأجانب</h2>
<p>تتمتع المدن الرئيسية في المملكة مثل <strong>الرياض وجدة والظهران</strong> بجاذبية استثمارية هائلة تجعل من عقاراتها رافداً مالياً واعداً. مع تعديل الضوابط القانونية، سمحت المملكة للأجانب بشراء وتملك وتوثيق صكوك الأصول العقارية السكنية والتجارية عبر آليات رقمية يسيرة ومقترنة بالتحقق الأمني والمالي.</p>

<blockquote>"التملك العقاري في الرياض لم يعد حكراً على المواطنين أو الخليجيين، بل تتيح بوابات وزارة العدل ترخيص الصكوك للمستشارين والمديرين المقيمين والمستثمرين الخارجيين بأبسط الخطوات."</blockquote>

<h3>خطوات نقل ملكية العقار للأجنبي</h3>
<ul>
  <li><strong>استخراج موافقة وزارة الداخلية:</strong> التقديم عبر بوابة <em>أبشر</em> أو <em>منصة ناجز (Najiz)</em> لتقديم السندات وإثبات مبررات الشراء لتلقي موافقة رسمية من وزارة الداخلية.</li>
  <li><strong>تصفية الحسابات المالية:</strong> سداد قيمة العقار عبر شيكات مصدقة أو تحويلات مصرفية معتمدة لإثبات عدم غسيل الأموال وسلامة المصدر.</li>
  <li><strong>إقرار إفراغ الصك:</strong> التنسيق العقاري لحجز جلسة كتابة العدل للإفراغ الفوري للصك بصيغة إلكترونية تصل لمالكها الجديد فوراً.</li>
</ul>

<h3>الاشتراطات والشروط العامة لتملك العقار</h3>
<p>يحظر على غير السعوديين التملك العقاري بمحيط الحرمين الشريفين (مكة المكرمة والمدينة المنورة)، إلا عن طريق التأجير التمويلي أو الانتفاع لفترات زمنية ومشاريع مخصصة. بينما تتاح باقي أراضي المملكة والمدن الاستراتيجية كجزء من التملك الكامل والحر.</p>`,
    seo: {
      title: "دليل تملك العقار للأجانب في السعودية 2026 | آفاق الخليج",
      description: "هل يحق للأجنبي شراء عقار في الرياض؟ تعرف على شروط وزارة العدل والحصول على الموافقات الحكومية وإفراغ الصكوك المعتمدة.",
      keywords: "شراء عقار الرياض للأجانب, صكوك عقارية للأجانب, منصة ناجز, استثمار عقاري السعودية",
      canonicalUrl: "https://gulfhorizons.com/blog/saudi-foreign-propertyownership-guide",
      ogTitle: "تملك العقارات للأجانب بالمملكة العربية السعودية بالتفصيل",
      ogDescription: "تعرف على اللوائح التنظيمية ونظام الإفراغ ومناطق التملك الحر للأجانب.",
      twitterCard: "summary_large_image"
    },
    linkedTranslations: {
      ar: "art_2_ar",
      tr: "art_2_tr",
      en: "art_2_en"
    }
  },
  {
    id: "art_2_tr",
    title: "Yabancılar İçin Suudi Arabistan'da Konut ve Gayrimenkul Edinim Rehberi",
    slug: "yabancilar-icin-suudi-arabistan-gayrimenkul-rehberi",
    excerpt: "Riyad'da yabancı olarak gayrimenkul satın almanın hukuki şartları, İçişleri Bakanlığı ile Adalet Bakanlığı (Najiz) onay süreçleri ve tapu devir adımları.",
    author: "Kıdemli Danışman Adham Al-Qahtani",
    role: "admin",
    lang: "tr",
    categoryId: "real_estate_investment",
    tags: ["Yatırım", "Gayrimenkul", "RiyadKonut", "TapuDevri"],
    featuredImage: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
    altText: "Riyad modern lüks villalar",
    status: "published",
    publishDate: "2026-06-12T10:30:00Z",
    views: 195,
    readingTime: 5,
    content: `<h2>Yabancı Yatırımcılar İçin Gayrimenkul Fırsatları</h2>
<p>Suudi Arabistan genelinde <strong>Riyad, Cidde ve nehir kıyısı Doğu Bölgesi</strong>, emlak projelerinde küresel yatırım fonlarının ilgisini çeken lüks yaşam alanlarına ev sahipliği yapmaktadır. Yeni düzenlemeler sayesinde, ülkede sürekli oturumu (Premium Residency) olmayan yabancı yatırımcılar dahi belirli yasal prosedürleri izleyerek kendi adlarına tapulu mülk satın alabilmektedir.</p>

<blockquote>"Riyad'da gayrimenkul edinmek sadece körfez ülkeleri vatandaşlarına ait bir hak olmaktan çıkmış, Adalet Bakanlığı'nın dijital Najiz platformu aracılığıyla tüm yabancı üst düzey profesyonellere ve yatırımcılara açılmıştır."</blockquote>

<h3>Yabancılar İçin Tapu Sicil ve Onay Aşamaları</h3>
<ul>
  <li><strong>İçişleri Bakanlığı (Absher/Najiz) Onayı:</strong> Satın alınacak mülkün coğrafi konumu ve ada/parsel numarası girilerek, yabancı uyruklu gayrimenkul edinim muvafakati için online başvuru yapılması ilk şarttır.</li>
  <li><strong>Bloke Çek ve Finansal Hesaplaşma:</strong> Kara para aklamayı önleme yasaları gereği, emlak ödemesinin Suudi Arabistan'daki lisanslı bir bankadan tescilli bloke çek (Manager's Check) ile yapılması zorunludur.</li>
  <li><strong>Tapu Devri (Ifrag):</strong> Adalet Bakanlığı nezdinde veya yetkili noterliklerde tarafların bir araya gelmesiyle tapu elektronize edilerek devre hazır hale getirilir ve yeni dijital mülkiyet belgesi anında teslim edilir.</li>
</ul>

<h3>Kısıtlı Bölgeler ve Genel Şartlar</h3>
<p>Yabancıların Mekke ve Medine şehirlerinin idari sınırları içerisinde doğrudan gayrimenkul edinmesi yasaktır (Bu sınırlarda sadece uzun kiralama veya intifa hakları tanınmaktadır). Riyad ve diğer tüm endüstriyel, turistik ve finansal merkezlerde ise tam mülkiyet ve serbest gayrimenkul alımı hakkı mevcuttur.</p>`,
    seo: {
      title: "Yabancılar İçin Suudi Arabistan Emlak ve Tapu Rehberi | Afaq Al-Khalij",
      description: "Suudi Arabistan'da yabancı olarak nasıl ev veya arsa satın alınır? Tapu müdürlüğü onayları ve gerekli evraklar listesi.",
      keywords: "suudi arabistan emlak satın alma, riyad satılık daire, yabancı tapu suudi, emlak yatırımı",
      canonicalUrl: "https://gulfhorizons.com/blog/yabancilar-icin-suudi-arabistan-gayrimenkul-rehberi",
      ogTitle: "Yabancılar İçin Adım Adım Suudi Arabistan Emlak Satın Alma Rehberi",
      ogDescription: "Riyad'da mülk edinme mevzuatı, İçişleri Bakanlığı onaylarının alınması ve Ifrag prosedürü.",
      twitterCard: "summary_large_image"
    },
    linkedTranslations: {
      ar: "art_2_ar",
      tr: "art_2_tr",
      en: "art_2_en"
    }
  },
  {
    id: "art_2_en",
    title: "Ultimate Real Estate & Property Purchase Guide for Foreigners in Saudi Arabia",
    slug: "property-purchase-guide-foreigners-saudi-arabia",
    excerpt: "Discover the legal frameworks and step-by-step documentation to acquire residential or commercial assets in Riyadh without requiring permanent residency.",
    author: "Advisory Board Director Adham Al-Qahtani",
    role: "admin",
    lang: "en",
    categoryId: "real_estate_investment",
    tags: ["Properties", "RiyadhRealEstate", "Najiz", "MOJ", "Investment"],
    featuredImage: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
    altText: "Luxury residential buildings in Riyadh",
    status: "published",
    publishDate: "2026-06-12T10:30:00Z",
    views: 142,
    readingTime: 6,
    content: `<h2>The Growth of Real Estate and Direct Title Deeds for Global Investors</h2>
<p>Metropolises such as <strong>Riyadh and Jeddah</strong> present highly lucrative residential and commercial options for global investors. Under revised Saudi civil laws, non-Saudi individuals are legally entitled to purchase, hold, and bequeath real estate assets in most tactical development areas through structured national digital platforms.</p>

<blockquote>"Property ownership in Riyadh has transformed. Today, the Ministry of Justice supports title deed authorizations directly to resident managers, corporate foreign investors, and independent individuals."</blockquote>

<h3>Step-by-Step Title Deed Transfer Protocol</h3>
<ul>
  <li><strong>Ministry of Interior Approval:</strong> Buyers must log through the unified <em>Najiz</em> portal to submit verified proof of residency/investment and receive MoI property validation clearance prior to closing.</li>
  <li><strong>Secured Financial Payments:</strong> Transactions must be processed through local certified banker checks (Manager's Checks) to assure monetary checks and compliance with anti-money laundering codes.</li>
  <li><strong>Deed Execution (Ifrag):</strong> Final title deed notarization is finalized on the automated MoJ system, assigning the digital registration instantly to the foreign owner's online portal.</li>
</ul>

<h3>Key Restrictions and Areas</h3>
<p>Direct ownership by non-Saudis is prohibited in the holy areas of Makkah and Madinah (except via long-term, specialized leasing or trust agreements). All other economic areas, freezones, and high-prestige quarters in Riyadh, Khobar, and Jeddah are fully accessible for freehold and direct deed registration.</p>`,
    seo: {
      title: "Saudi Arabia Property License & Ownership Guide for Foreigners | Gulf Horizons",
      description: "Comprehensive tutorial explaining how non-Saudi citizens buy properties in Riyadh, including Absher and Najiz ministerial approvals.",
      keywords: "how to buy property KSA, foreign property ownership Riyadh, Saudi Ministry of Justice, real estate yields KSA",
      canonicalUrl: "https://gulfhorizons.com/blog/property-purchase-guide-for-foreigners",
      ogTitle: "Saudi Real Estate Ownership Regulations for Foreign Nationals",
      ogDescription: "Practical guide explaining required approvals, escrow protocols, and MoI validation.",
      twitterCard: "summary_large_image"
    },
    linkedTranslations: {
      ar: "art_2_ar",
      tr: "art_2_tr",
      en: "art_2_en"
    }
  },
  {
    id: "art_3_ar",
    title: "برنامج المقرات الإقليمية بالمملكة (RHQ) وتأثيراته الضريبية والتنظيمية",
    slug: "regional-headquarters-saudi-rhq",
    excerpt: "تفصيل لقرار إلزامية المقرات الإقليمية الـ RHQ للتعاقد مع الجهات الحكومية السعودية، والمزايا الجمركية والإعفاء الضريبي لمدة 30 عاماً.",
    author: "المستشار المالي أدهم القحطاني",
    role: "admin",
    lang: "ar",
    categoryId: "foreign_companies",
    tags: ["الشركات_الأجنبية", "برنامج_RHQ", "وزارة_الاستثمار", "ضرائب_السعودية"],
    featuredImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    altText: "مجمع للشركات والمكاتب الاستثمارية في الرياض",
    status: "published",
    publishDate: "2026-06-14T11:00:00Z",
    views: 512,
    readingTime: 7,
    content: `<h2>مبادرة المقرات الإقليمية وتوطين الأعمال الكبرى</h2>
<p>يمثّل <strong>برنامج المقر الإقليمي (RHQ)</strong> إطاراً مشتركاً لوزارة الاستثمار والهيئة الملكية لمدينة الرياض لحث المجموعات العالمية متعددة الجنسيات على قيادة وإطلاق عملياتها الإقليمية في الشرق الأوسط وإفريقيا من داخل الأراضي السعودية.</p>

<blockquote>"الشركات التي تختار الرياض مقراً إقليمياً لها ستحصل على إعفاءات ضريبية متكاملة لمدة 30 عاماً قادماً تشمل ضريبة دخل الشركات وضريبة الاستقطاع."</blockquote>

<h3>امتيازات برنامج المقرات الإقليمية (RHQ)</h3>
<ul>
  <li><strong>إعفاء ضريبي شامل:</strong> خفض نسبة الضريبة إلى 0% على الأرباح التشغيلية للمقر الإقليمي لمدة ثلاثة عقود.</li>
  <li><strong>الأولوية في التعاقد الحكومي:</strong> حرمان المنشآت التي لا تملك مقر إقليمي مسجل بالمملكة من التنافس على عقود ومناقصات الهيئات والوزارات الحكومية والمؤسسات المدعومة من صندوق الاستثمارات العامة (PIF).</li>
  <li><strong>تجاوز نظام السعودة للموظفين الإداريين:</strong> تسهيلات استثنائية لإصدار الإقامات وتأشيرات العمل للمديرين التنفيذيين والمنقولين من الفروع العالمية.</li>
</ul>

<h3>الحد الأدنى لمتطلبات الترخيص التشغيلي للـ RHQ</h3>
<p>يتطلب إصدار ترخيص المقر الإقليمي تشغيل فرع حقيقي بالرياض يضم ما لا يقل عن 15 موظفاً إدارياً بدوام كامل في وظائف التوجيه والتدريب القانوني والتسويقي لفروع المنطقة الأخرى خلال عام واحد من إطلاق العمل.</p>`,
    seo: {
      title: "تفاصيل برنامج المقر الإقليمي السعودي RHQ والضرائب | آفاق الخليج",
      description: "دراسة مهنية لمتطلبات وزارة الاستثمار لتأسيس مقر إقليمي قانوني بالرياض وحيازة الإعفاء الضريبي لمدة 30 سنة.",
      keywords: "المقر الإقليمي السعودية, برنامج RHQ, الإعفاء الضريبي الرياض, وزارة الاستثمار, صندوق الاستثمارات العامة",
      canonicalUrl: "https://gulfhorizons.com/blog/saudi-regional-headquarters-program",
      ogTitle: "دليل تأسيس مقر إقليمي RHQ بالرياض للشركات المتعددة الجنسيات",
      ogDescription: "المزايا التنظيمية، شروط الموظفين، وضريبة 0% التشغيلية لمدد 30 عاماً.",
      twitterCard: "summary_large_image"
    },
    linkedTranslations: {
      ar: "art_3_ar",
      tr: "art_3_tr",
      en: "art_3_en"
    }
  },
  {
    id: "art_3_tr",
    title: "Suudi Arabistan Bölgesel Merkez (RHQ) Programı ve Vergi Avantajları",
    slug: "suudi-arabistan-bolgesel-merkez-rhq-avantajlari",
    excerpt: "Riyad'da bölgesel merkez (RHQ) kuran çok uluslu şirketlere tanınan 30 yıllık kurumlar vergisi muafiyeti, gümrük kolaylıkları ve resmi ihalelere katılım şartları.",
    author: "Kıdemli Danışman Adham Al-Qahtani",
    role: "admin",
    lang: "tr",
    categoryId: "foreign_companies",
    tags: ["Yatırım", "RHQRiyad", "VergiMuafiyeti", "GlobalSirketler"],
    featuredImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    altText: "Riyad modern ofis binaları kompleksi",
    status: "published",
    publishDate: "2026-06-14T11:00:00Z",
    views: 312,
    readingTime: 6,
    content: `<h2>Çok Uluslu Şirketlerin Yeni Üssü: Riyad</h2>
<p>Suudi Arabistan Yatırım Bakanlığı (MISA) ve Riyad Kraliyet Komisyonu ortaklığıyla yürütülen <strong>Bölgesel Merkez (Regional Headquarters - RHQ)</strong> girişimi, Orta Doğu bölgesinde büyük ölçekli ticari faaliyet sürdüren uluslararası firmaların yönetim ofislerini krallık sınırlarına çekmeyi amaçlamaktadır.</p>

<blockquote>"Riyad'ı bölgesel yönetim üssü olarak seçen global firmalara, kurumlar vergisi ve stopaj vergilerinden tam 30 yıl boyunca %0 muafiyet hakkı sunulmaktadır."</blockquote>

<h3>Bölgesel Merkez (RHQ) Kurmanın Sağladığı İmtiyazlar</h3>
<ul>
  <li><strong>30 Yıl Boyunca %0 Vergi:</strong> Bölgesel merkezin elde edeceği yönetimsel gelirlerin tamamı, üç on yıl boyunca resmi olarak vergi matrahı dışında tutulur.</li>
  <li><strong>Devlet İhalelerinde Öncelik:</strong> Suudi Arabistan'da tescilli bir RHQ lisansı bulunmayan yabancı firmalar, krallıktaki kamu bakanlıkları, devlet kurumları ve Kamu Yatırım Fonu (PIF) iştirakleri tarafından açılan büyük ölçekli ihale ve satın alımlardan elenecektir.</li>
  <li><strong>Vize Kolaylığı ve Kota Muafiyeti:</strong> Şirketin üst yönetim kademesinde görev yapacak yabancı yöneticiler ve onların aileleri için doğrudan 'premium' oturum ve çalışma izinleri kolaylaştırılmış prosedürle sağlanır.</li>
</ul>

<h3>RHQ Lisanslama İçin Minimum Operasyonel Kriterler</h3>
<p>MISA yönergelerine göre, RHQ lisansı alan bir şirketin, kuruluş yılından itibaren Riyad'daki merkezinde en az 15 tam zamanlı idari direktör ve kilit personel çalıştırması, komşu 3 ülkede bulunan şubeleri doğrudan Riyad üzerinden yönetmesi gerekmektedir.</p>`,
    seo: {
      title: "Suudi Arabistan Bölgesel Merkez RHQ ve Teşvikleri | Afaq Al-Khalij",
      description: "Suudi Arabistan RHQ bölgesel merkez kurma kuralları, 30 yıllık vergi muafiyetleri ve başvuru evrakları takibi.",
      keywords: "suudi bölgesel merkez, RHQ programı, riyad ticaret ihaleleri, vergi muafiyeti",
      canonicalUrl: "https://gulfhorizons.com/blog/suudi-bolgesel-merkez-rhq-avantajlari",
      ogTitle: "Çok Uluslu Şirketler İçin Suudi Arabistan RHQ Kurulum Rehberi",
      ogDescription: "Afaq Al-Khalij'den vergi muafiyeti şartları, personel gereksinimleri ve ihale kuralları raporu.",
      twitterCard: "summary_large_image"
    },
    linkedTranslations: {
      ar: "art_3_ar",
      tr: "art_3_tr",
      en: "art_3_en"
    }
  },
  {
    id: "art_3_en",
    title: "The Saudi Regional Headquarters (RHQ) Program: Taxes & Regulatory Updates",
    slug: "saudi-regional-headquarters-program-guide",
    excerpt: "Understand the regulatory mandates for multinational corporations establishing Regional Headquarters in Riyadh to secure government contracts, plus 30-year tax holidays.",
    author: "Advisory Board Director Adham Al-Qahtani",
    role: "admin",
    lang: "en",
    categoryId: "foreign_companies",
    tags: ["Business", "RHQ", "MISA", "TaxHoliday", "Vision2030"],
    featuredImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    altText: "Corporate skyscraper plaza in Saudi city",
    status: "published",
    publishDate: "2026-06-14T11:00:00Z",
    views: 228,
    readingTime: 6,
    content: `<h2>Centering Multinational Operations inside Riyadh</h2>
<p>The landmark <strong>Regional Headquarters (RHQ) Program</strong> is a strategic joint initiative managed by MISA and Royal Commission for Riyadh City. It enforces that multinational conglomerates steering Middle East and Africa markets set up their administrative base camp inside KSA soil to maintain eligibility for lucrative state budgets.</p>

<blockquote>"Enterprises certifying Riyadh as their official regional headquarters receive a robust 30-year tax holiday pack covering corporate and withholding earnings."</blockquote>

<h3>Core Strategic Advantages of the RHQ License</h3>
<ul>
  <li><strong>30-Year Tax Holiday:</strong> Enjoy a sovereign tax rate of 0% on direct operating profits earned by the Riyadh regional office.</li>
  <li><strong>Government Contract Exclusivity:</strong> Ministries, royal agencies, and PIF-backed enterprises cannot execute project agreements exceeding 1M SAR with overseas corporations lacking an authorized national RHQ registry.</li>
  <li><strong>Executive Recruitment Ease:</strong> Skips domestic quota matrices for international corporate transhipment, allowing immediate visas for directors.</li>
</ul>

<h3>Minimum Organizational Benchmarks</h3>
<p>To sustain an active RHQ certificate, enterprises must operate an active local Riyadh hub containing at least 15 technical and executive leaders supporting other regional branches within 12 months from launch dates.</p>`,
    seo: {
      title: "Saudi Arabia RHQ Program & 30-Year Tax Holiday Guide | Gulf Horizons",
      description: "Strategic handbook explaining how multinational companies establish their regional headquarters in Riyadh, including MISA policies.",
      keywords: "Saudi RHQ Program, Regional Headquarters Riyadh, tax exemptions Saudi, MISA corporate rules",
      canonicalUrl: "https://gulfhorizons.com/blog/saudi-regional-headquarters-program",
      ogTitle: "Establishing an RHQ Office in Saudi Arabia: Taxes and Rules",
      ogDescription: "Analysis detailing the 0% corporate tax exemptions, executive visas, and public tender protocols.",
      twitterCard: "summary_large_image"
    },
    linkedTranslations: {
      ar: "art_3_ar",
      tr: "art_3_tr",
      en: "art_3_en"
    }
  }
];

const defaultStats: StatsStore = {
  whatsappClicks: 0,
  emailsSent: 0,
  consultations: 0,
  assessments: 0,
  inquiries: [],
  testimonials: [],
  articles: seedArticles,
  categories: seedCategories,
  comments: seedComments,
  adminLogs: []
};

// Helper to read statistics - WITH AUTO-MIGRATION IN PLACE
function readStats(): StatsStore {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      const d = JSON.parse(content);
      
      let changed = false;
      if (!d.articles || d.articles.length === 0) {
        d.articles = seedArticles;
        changed = true;
      }
      if (!d.categories || d.categories.length === 0) {
        d.categories = seedCategories;
        changed = true;
      }
      if (!d.comments) {
        d.comments = seedComments;
        changed = true;
      }
      if (!d.adminLogs) {
        d.adminLogs = [];
        changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), "utf-8");
      }
      return d;
    }
  } catch (err) {
    console.error("Error reading stats file:", err);
  }
  return { ...defaultStats };
}

// Helper to write statistics
function writeStats(stats: StatsStore) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing stats file:", err);
  }
}

// Initialize stats if not present
if (!fs.existsSync(DATA_FILE)) {
  writeStats(defaultStats);
}

// Helper to extract absolute client IP with Fallback support
function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    } else if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].trim();
    }
  }
  return req.ip || req.socket.remoteAddress || "Unknown";
}

// Activity Log helper
function logAdminAction(action: string, details: string, ip: string) {
  try {
    const stats = readStats();
    if (!stats.adminLogs) {
      stats.adminLogs = [];
    }
    const newLog = {
      id: "log_" + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      ip,
      action,
      details
    };
    stats.adminLogs.unshift(newLog);
    if (stats.adminLogs.length > 300) {
      stats.adminLogs.pop();
    }
    writeStats(stats);
  } catch (err) {
    console.error("Failed to write administrative log event:", err);
  }
}

// Session store definitions
interface AdminSession {
  token: string;
  username: string;
  clientIp: string;
  createdAt: string;
  expiresAt: number;
}
const activeSessions = new Map<string, AdminSession>();

// Brute Force protection structures
interface BruteTracker {
  attempts: number;
  lockUntil?: number;
}
const bruteTrackers = new Map<string, BruteTracker>();

// Authentication Middleware
function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  const clientIp = getClientIp(req);

  if (!token) {
    return res.status(401).json({ error: "Access Denied: Session token not provided." });
  }

  const sess = activeSessions.get(token);
  if (!sess) {
    return res.status(401).json({ error: "Access Denied: Session does not exist or has been invalidated." });
  }

  if (sess.expiresAt < Date.now()) {
    activeSessions.delete(token);
    logAdminAction("session_expired", `Admin session for ${sess.username} expired automatically.`, clientIp);
    return res.status(401).json({ error: "Access Denied: Session expired. Please log in again." });
  }

  // Slide expiration window by 20 minutes of inactivity
  sess.expiresAt = Date.now() + 20 * 60 * 1000;
  activeSessions.set(token, sess);

  (req as any).adminSession = sess;
  next();
}

// Security sanitization helper
function sanitizePayload(str: any): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

// Authentication login endpoint
app.post("/api/admin/auth/login", (req, res) => {
  const { username, password } = req.body;
  const clientIp = getClientIp(req);

  // SQL Injection & XSS prevention: enforce strict string validation on credentials fields
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid credentials format." });
  }

  const cleanUser = username.trim();
  const cleanPass = password.trim();

  // Brute force protection check
  const tracker = bruteTrackers.get(clientIp);
  if (tracker && tracker.lockUntil && tracker.lockUntil > Date.now()) {
    const remainingMin = Math.ceil((tracker.lockUntil - Date.now()) / (1000 * 60));
    return res.status(403).json({ 
      error: "LOCKED", 
      remaining: remainingMin 
    });
  }

  const sysUser = process.env.ADMIN_USERNAME || "admin";
  const sysPass = process.env.ADMIN_PASSWORD || "Bara_Secure_2026!#";

  if (cleanUser === sysUser && cleanPass === sysPass) {
    // Reset brute force tracker on successful authentication
    bruteTrackers.delete(clientIp);

    // Generate secure session token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes session

    activeSessions.set(token, {
      token,
      username: sysUser,
      clientIp,
      createdAt: new Date().toISOString(),
      expiresAt
    });

    logAdminAction("login_success", `Administrative dashboard accessed successfully. Username: ${sysUser}`, clientIp);

    return res.json({
      success: true,
      token,
      expiresAt
    });
  } else {
    // Increment failed login attempt
    const track = bruteTrackers.get(clientIp) || { attempts: 0 };
    track.attempts += 1;

    if (track.attempts >= 5) {
      track.lockUntil = Date.now() + 15 * 60 * 1000; // 15 mins lock
      bruteTrackers.set(clientIp, track);
      
      logAdminAction(
        "failed_login_locked", 
        `Brute force detected. Username tried: "${sanitizePayload(cleanUser)}". Host locked for 15 minutes.`, 
        clientIp
      );

      return res.status(403).json({ 
        error: "LOCKED", 
        remaining: 15 
      });
    } else {
      bruteTrackers.set(clientIp, track);

      logAdminAction(
        "failed_login", 
        `Unauthorized entry attempt. Tried: "${sanitizePayload(cleanUser)}". Attempts: ${track.attempts}/5`, 
        clientIp
      );

      return res.status(401).json({ 
        error: "INVALID_CREDENTIALS", 
        attempts: track.attempts 
      });
    }
  }
});

// Authentication logout endpoint
app.post("/api/admin/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  const clientIp = getClientIp(req);

  if (token) {
    const sess = activeSessions.get(token);
    if (sess) {
      logAdminAction("logout", `Administrative session formally terminated. Username: ${sess.username}`, clientIp);
      activeSessions.delete(token);
    }
  }
  return res.json({ success: true });
});

// API: Get admin stats
app.get("/api/admin/stats", requireAdminAuth, (req, res) => {
  const stats = readStats();
  res.json(stats);
});

// API: Track WhatsApp clicks
app.post("/api/admin/log-click", (req, res) => {
  const { page } = req.body;
  const stats = readStats();
  stats.whatsappClicks += 1;
  writeStats(stats);
  res.json({ success: true, count: stats.whatsappClicks });
});

// API: Get custom testimonials (approved only for visitors)
app.get("/api/testimonials", (req, res) => {
  const stats = readStats();
  const list = stats.testimonials || [];
  // Exclude testimonials that are explicitly not approved
  const approvedList = list.filter(t => (t as any).approved !== false);
  res.json(approvedList);
});

// API: Add custom testimonial (default to unapproved)
app.post("/api/testimonials", (req, res) => {
  const { name, rating, quote, role, lang } = req.body;
  if (!name || !rating || !quote) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const stats = readStats();
  if (!stats.testimonials) {
    stats.testimonials = [];
  }

  const newTestimonial = {
    id: "testi_" + Math.random().toString(36).substr(2, 9),
    name,
    rating: Number(rating),
    quote,
    role: role || "",
    lang: lang || "ar",
    timestamp: new Date().toISOString(),
    approved: false, // Must be approved by admin FIRST!
  };

  stats.testimonials.unshift(newTestimonial);
  writeStats(stats);

  res.json({ success: true, testimonial: newTestimonial });
});

// Admin API: List all testimonials (approved + pending)
app.get("/api/admin/testimonials", requireAdminAuth, (req, res) => {
  const stats = readStats();
  res.json(stats.testimonials || []);
});

// Admin API: Approve a testimonial
app.post("/api/admin/testimonials/approve", requireAdminAuth, (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing testimonial ID" });

  const stats = readStats();
  let found = false;
  if (stats.testimonials) {
    stats.testimonials = stats.testimonials.map(t => {
      if (t.id === id) {
        found = true;
        return { ...t, approved: true };
      }
      return t;
    });
  }

  if (!found) {
    return res.status(404).json({ error: "Testimonial not found" });
  }

  writeStats(stats);
  logAdminAction("approve_testimonial", `Successfully approved testimonial ID: ${id}`, getClientIp(req));
  res.json({ success: true });
});

// Admin API: Delete a testimonial
app.delete("/api/admin/testimonials/:id", requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const stats = readStats();
  
  if (!stats.testimonials) {
    return res.status(404).json({ error: "Testimonials array empty" });
  }

  const initialCount = stats.testimonials.length;
  stats.testimonials = stats.testimonials.filter(t => t.id !== id);

  if (stats.testimonials.length === initialCount) {
    return res.status(404).json({ error: "Testimonial not found" });
  }

  writeStats(stats);
  logAdminAction("delete_testimonial", `Deleted testimonial ID: ${id}`, getClientIp(req));
  res.json({ success: true });
});

// ==========================================
// NEW ADVANCED CMS & BLOG ENGINE ENDPOINTS
// ==========================================

// API: Get all blog articles with filtering
app.get("/api/blog/articles", (req, res) => {
  const stats = readStats();
  let articles = stats.articles || [];
  
  const { lang, category, status, search, tag } = req.query;
  
  if (lang) {
    articles = articles.filter(a => a.lang === lang);
  }
  
  if (status) {
    articles = articles.filter(a => a.status === status);
  } else {
    // By default, non-dashboard users can only see published articles
    if (req.query.dashboard !== "true") {
      articles = articles.filter(a => a.status === "published");
    }
  }
  
  if (category) {
    articles = articles.filter(a => a.categoryId === category || a.subCategoryId === category);
  }
  
  if (tag) {
    articles = articles.filter(a => a.tags && a.tags.includes(tag as string));
  }
  
  if (search) {
    const q = (search as string).toLowerCase();
    articles = articles.filter(a => 
      a.title.toLowerCase().includes(q) || 
      a.content.toLowerCase().includes(q) || 
      a.excerpt.toLowerCase().includes(q) ||
      (a.tags && a.tags.some(t => t.toLowerCase().includes(q)))
    );
  }
  
  // Sort by publishDate descending
  articles.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
  
  res.json(articles);
});

// API: Get single blog article with analytics increment and related articles
app.get("/api/blog/articles/:id_or_slug", (req, res) => {
  const { id_or_slug } = req.params;
  const stats = readStats();
  const articles = stats.articles || [];
  
  // Find article by id or slug
  const articleIndex = articles.findIndex(a => a.id === id_or_slug || a.slug === id_or_slug);
  if (articleIndex === -1) {
    return res.status(404).json({ error: "Article not found" });
  }
  
  const article = articles[articleIndex];
  
  // Increment view counts
  article.views = (article.views || 0) + 1;
  stats.articles![articleIndex] = article;
  writeStats(stats);
  
  // Get comments for this article
  const comments = (stats.comments || []).filter(c => c.articleId === article.id);
  
  // Get Related articles (same language, excluding this article, preferring same category or tags)
  let related = articles.filter(a => a.lang === article.lang && a.id !== article.id && a.status === "published");
  const sameCategory = related.filter(a => a.categoryId === article.categoryId || a.subCategoryId === article.categoryId);
  if (sameCategory.length > 0) {
    related = sameCategory.slice(0, 3);
  } else {
    related = related.slice(0, 3);
  }
  
  // Resolve linked translation details
  const resolvedTranslations: Record<string, { id: string; title: string; slug: string; lang: string }> = {};
  if (article.linkedTranslations) {
    for (const [l, translationId] of Object.entries(article.linkedTranslations)) {
      const transArt = articles.find(a => a.id === translationId);
      if (transArt) {
        resolvedTranslations[l] = {
          id: transArt.id,
          title: transArt.title,
          slug: transArt.slug,
          lang: transArt.lang
        };
      }
    }
  }
  
  res.json({
    article,
    comments,
    related,
    translations: resolvedTranslations
  });
});

// API: Create new article
app.post("/api/blog/articles", (req, res) => {
  const data = req.body;
  if (!data.title || !data.content || !data.lang || !data.categoryId) {
    return res.status(400).json({ error: "Missing required core fields" });
  }
  
  const stats = readStats();
  if (!stats.articles) stats.articles = [];
  
  // Calculate reading time based on word count
  const wordCount = data.content.split(/\s+/).length || 100;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  
  // Generate random article id
  const newId = "art_" + Math.random().toString(36).substr(2, 9);
  
  // Generate slug from title if not provided
  let slug = data.slug || data.title.toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF\u00C0-\u017F-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  
  if (!slug) {
    slug = `article-${newId}`;
  }
  
  const newArticle: Article = {
    id: newId,
    title: data.title,
    slug,
    content: data.content,
    excerpt: data.excerpt || data.content.substring(0, 150).replace(/<[^>]*>/g, "") + "...",
    lang: data.lang,
    categoryId: data.categoryId,
    subCategoryId: data.subCategoryId || "",
    tags: data.tags || [],
    featuredImage: data.featuredImage || "https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=800&q=80",
    altText: data.altText || data.title,
    status: data.status || "draft",
    publishDate: data.publishDate || new Date().toISOString(),
    views: Number(data.views) || 0,
    readingTime,
    author: data.author || "Afaq Gulf Advisory",
    role: data.role || "editor",
    seo: {
      title: data.seo?.title || data.title,
      description: data.seo?.description || data.excerpt || "",
      keywords: data.seo?.keywords || (data.tags || []).join(", "),
      canonicalUrl: data.seo?.canonicalUrl || `https://gulfhorizons.com/blog/${slug}`,
      ogTitle: data.seo?.ogTitle || data.title,
      ogDescription: data.seo?.ogDescription || data.excerpt || "",
      twitterCard: data.seo?.twitterCard || "summary_large_image"
    },
    linkedTranslations: data.linkedTranslations || {}
  };
  
  // Bi-directional link updates
  if (data.linkedTranslations) {
    for (const [l, translationId] of Object.entries(data.linkedTranslations)) {
      if (translationId) {
        const transIdx = stats.articles.findIndex(a => a.id === translationId);
        if (transIdx !== -1) {
          stats.articles[transIdx].linkedTranslations = stats.articles[transIdx].linkedTranslations || {};
          stats.articles[transIdx].linkedTranslations[data.lang] = newId;
        }
      }
    }
  }
  
  stats.articles.unshift(newArticle);
  writeStats(stats);
  
  res.json({ success: true, article: newArticle });
});

// API: Update an article
app.put("/api/blog/articles/:id", (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const stats = readStats();
  const articles = stats.articles || [];
  
  const idx = articles.findIndex(a => a.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Article not found" });
  }
  
  const currentArt = articles[idx];
  
  // Re-estimate reading time if content changed
  const wordCount = (data.content || currentArt.content).split(/\s+/).length || 100;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  
  const updatedArt: Article = {
    ...currentArt,
    title: data.title !== undefined ? data.title : currentArt.title,
    slug: data.slug !== undefined ? data.slug : currentArt.slug,
    content: data.content !== undefined ? data.content : currentArt.content,
    excerpt: data.excerpt !== undefined ? data.excerpt : currentArt.excerpt,
    lang: data.lang !== undefined ? data.lang : currentArt.lang,
    categoryId: data.categoryId !== undefined ? data.categoryId : currentArt.categoryId,
    subCategoryId: data.subCategoryId !== undefined ? data.subCategoryId : currentArt.subCategoryId,
    tags: data.tags !== undefined ? data.tags : currentArt.tags,
    featuredImage: data.featuredImage !== undefined ? data.featuredImage : currentArt.featuredImage,
    altText: data.altText !== undefined ? data.altText : currentArt.altText,
    status: data.status !== undefined ? data.status : currentArt.status,
    publishDate: data.publishDate !== undefined ? data.publishDate : currentArt.publishDate,
    author: data.author !== undefined ? data.author : currentArt.author,
    role: data.role !== undefined ? data.role : currentArt.role,
    readingTime,
    seo: {
      ...currentArt.seo,
      ...(data.seo || {})
    },
    linkedTranslations: data.linkedTranslations !== undefined ? data.linkedTranslations : currentArt.linkedTranslations
  };
  
  // If translations changed, sync bidirectionally
  if (data.linkedTranslations) {
    for (const [l, transId] of Object.entries(data.linkedTranslations)) {
      if (transId) {
        const transIdx = articles.findIndex(a => a.id === transId);
        if (transIdx !== -1) {
          articles[transIdx].linkedTranslations = articles[transIdx].linkedTranslations || {};
          articles[transIdx].linkedTranslations[updatedArt.lang] = updatedArt.id;
        }
      }
    }
  }
  
  stats.articles![idx] = updatedArt;
  writeStats(stats);
  
  res.json({ success: true, article: updatedArt });
});

// API: Delete an article
app.delete("/api/blog/articles/:id", (req, res) => {
  const { id } = req.params;
  const stats = readStats();
  const articles = stats.articles || [];
  
  const initialLen = articles.length;
  stats.articles = articles.filter(a => a.id !== id);
  
  if (stats.articles.length === initialLen) {
    return res.status(404).json({ error: "Article not found" });
  }
  
  writeStats(stats);
  res.json({ success: true });
});

// API : Get categories
app.get("/api/blog/categories", (req, res) => {
  const stats = readStats();
  res.json(stats.categories || seedCategories);
});

// API : Post categories (add or nest)
app.post("/api/blog/categories", (req, res) => {
  const { name, parentId } = req.body;
  
  if (!name || !name.ar || !name.tr || !name.en) {
    return res.status(400).json({ error: "Multilingual names required (ar, tr, en)" });
  }
  
  const stats = readStats();
  if (!stats.categories) stats.categories = [];
  
  const newCatId = "cat_" + Math.random().toString(36).substr(2, 9);
  const slug = name.en.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  
  const newCategory: Category = {
    id: newCatId,
    parentId: parentId || null,
    name,
    slug
  };
  
  stats.categories.push(newCategory);
  writeStats(stats);
  
  res.json({ success: true, category: newCategory });
});

// API : Add public article comments
app.post("/api/blog/articles/:id/comments", (req, res) => {
  const { id } = req.params;
  const { authorName, authorEmail, content } = req.body;
  
  if (!authorName || !authorEmail || !content) {
    return res.status(400).json({ error: "authorName, authorEmail, and content are required" });
  }
  
  const stats = readStats();
  if (!stats.comments) stats.comments = [];
  
  const newComment: BlogComment = {
    id: "comm_" + Math.random().toString(36).substr(2, 9),
    articleId: id,
    authorName,
    authorEmail,
    content,
    timestamp: new Date().toISOString()
  };
  
  stats.comments.push(newComment);
  writeStats(stats);
  
  res.json({ success: true, comment: newComment });
});

// API : Get blog analysis summary
app.get("/api/blog/analytics", (req, res) => {
  const stats = readStats();
  const articles = stats.articles || [];
  
  // Count by status
  const counts = {
    total: articles.length,
    published: articles.filter(a => a.status === "published").length,
    draft: articles.filter(a => a.status === "draft").length,
    scheduled: articles.filter(a => a.status === "scheduled").length,
    archived: articles.filter(a => a.status === "archived").length
  };
  
  // Total views
  const totalViews = articles.reduce((acc, a) => acc + (a.views || 0), 0);
  
  // Most viewed articles (top 5)
  const popularArticles = [...articles]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5)
    .map(a => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      views: a.views,
      lang: a.lang,
      status: a.status
    }));
    
  // Most viewed categories
  const categoryViews: Record<string, number> = {};
  articles.forEach(a => {
    categoryViews[a.categoryId] = (categoryViews[a.categoryId] || 0) + (a.views || 0);
  });
  
  const popularCategories = Object.entries(categoryViews).map(([catId, views]) => {
    const origCat = (stats.categories || seedCategories).find(c => c.id === catId);
    return {
      id: catId,
      name: origCat ? origCat.name : { ar: catId, tr: catId, en: catId },
      views
    };
  }).sort((a, b) => b.views - a.views);
  
  // Simulated traffic channels
  const trafficSources = [
    { source: "Google (SEO / Organic)", percentage: 42, views: Math.floor(totalViews * 0.42) },
    { source: "WhatsApp (Direct Shares)", percentage: 28, views: Math.floor(totalViews * 0.28) },
    { source: "Direct Visits", percentage: 18, views: Math.floor(totalViews * 0.18) },
    { source: "LinkedIn & Social", percentage: 12, views: Math.floor(totalViews * 0.12) }
  ];
  
  res.json({
    counts,
    totalViews,
    popularArticles,
    popularCategories,
    trafficSources
  });
});

// API : Simulated Image compress & conversion to WebP + Auto ALT text recomendation
app.post("/api/blog/images/compress", (req, res) => {
  const { fileName, fileSize, fileType } = req.body;
  if (!fileName) {
    return res.status(400).json({ error: "fileName is required" });
  }
  
  const originalSizeInMb = fileSize ? (fileSize / (1024 * 1024)) : (Math.random() * 2 + 0.5);
  const ratio = 0.15 + (Math.random() * 0.15); // -70% to -85%
  const webpSizeInMb = originalSizeInMb * ratio;
  const webpSavingsPercentage = (100 - (ratio * 100)).toFixed(1);
  
  // Smart dynamic ALT Text recommendations based on search phrases
  let altTextRecommendation = "مستندات مرخصة ومباني تجارية لآفاق الخليج";
  const nameLower = fileName.toLowerCase();
  if (nameLower.includes("investment") || nameLower.includes("invest") || nameLower.includes("misa")) {
    altTextRecommendation = "بيئة استثمارية متطورة وتفويضات رسمية في الرياض";
  } else if (nameLower.includes("property") || nameLower.includes("villa") || nameLower.includes("comp") || nameLower.includes("building")) {
    altTextRecommendation = "مجمعات سكنية وعقارات متميزة لتملك الأجانب بالمملكة";
  } else if (nameLower.includes("setup") || nameLower.includes("office") || nameLower.includes("company")) {
    altTextRecommendation = "خطوات تأسيس الشركات الأجنبية وإحداث الكيانات التجارية بوزارة التجارة";
  } else if (nameLower.includes("visa") || nameLower.includes("id") || nameLower.includes("residency")) {
    altTextRecommendation = "وثيقة الإقامة المميزة والفيزا الذهبية السعودية للمستثمرين";
  }
  
  res.json({
    success: true,
    originalName: fileName,
    originalSize: (originalSizeInMb * 1024 * 1024).toFixed(0) + " B",
    compressedName: fileName.substring(0, fileName.lastIndexOf('.')) + ".webp",
    compressedSize: (webpSizeInMb * 1024 * 1024).toFixed(0) + " B",
    savingsPercentage: `${webpSavingsPercentage}%`,
    targetFormat: "image/webp",
    altTextSuggestion: altTextRecommendation
  });
});

// API: Send email
app.post("/api/send-email", async (req, res) => {
  const {
    name,
    email,
    phone,
    country = "N/A",
    service,
    message,
    lang, // 'ar' | 'tr' | 'en'
    pathUrl = "N/A",
    localTime = "N/A",
    type = "contact", // 'contact' | 'assessment'
    resultDetails, // { program, suitability, cost }
  } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "Unknown IP";
  const dateStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }) + " (Riyadh Time)";

  // Translate labels for HTML Email
  const translations = {
    ar: {
      emailSubject: type === "assessment" ? "نتيجة تقييم الاستحقاق الاستثماري الفوري" : "طلب تواصل وتنسيق عميل جديد",
      customerName: "اسم العميل",
      phoneNumber: "رقم الجوال",
      emailAddress: "البريد الإلكتروني",
      clientCountry: "الدولة / البلد",
      requestedService: "الخدمة المطلوبة",
      clientMessage: "تفاصيل الرسالة أو الطلب",
      submissionDetails: "تفاصيل الإرسال الفنية",
      dateLabel: "تاريخ ووقت الإرسال (مكة)",
      pageUrlLabel: "رابط الصفحة المصدر",
      clientIpLabel: "عنوان الـ IP للمرسل",
      localTimeLabel: "الزمن المحلي لجهاز العميل",
      languageLabel: "لغة العميل المختارة",
      proposedProg: "البرنامج المقترح",
      suitabilityLevel: "درجة الملاءمة",
      estimatedCostLabel: "التكلفة التقديرية",
      footerMsg: "هذه الرسالة مرسلة بشكل مؤتمت من البوابة الإلكترونية لآفاق الخليج العربي.",
    },
    tr: {
      emailSubject: type === "assessment" ? "Anlık Yatırım Değerlendirme Sonucu" : "Yeni Müşteri İrtibat & Talebi",
      customerName: "Müşteri Adı Soyadı",
      phoneNumber: "Telefon Numarası",
      emailAddress: "E-Posta Adresi",
      clientCountry: "Ülke",
      requestedService: "Talep Edilen Hizmet",
      clientMessage: "Müşteri Mesajı",
      submissionDetails: "Gönderim Teknik Bilgileri",
      dateLabel: "Gönderim Tarihi (Mekke Saat Dilimi)",
      pageUrlLabel: "Kaynak Sayfa URL",
      clientIpLabel: "Gönderici IP Adresi",
      localTimeLabel: "Müşterinin Yerel Saati",
      languageLabel: "Seçilen Dil Tercihi",
      proposedProg: "Önerilen Program",
      suitabilityLevel: "Uygunluk Oranı",
      estimatedCostLabel: "Tahmini Yatırım Bedeli",
      footerMsg: "Bu e-posta Arabian Gulf Horizons (Afaq Al-Khalij) web platformu tarafından otomatik olarak gönderilmiştir.",
    },
    en: {
      emailSubject: type === "assessment" ? "Instant Investment Suitability Result" : "New Client Consultation Request",
      customerName: "Client Name",
      phoneNumber: "Phone Number",
      emailAddress: "Email Address",
      clientCountry: "Country",
      requestedService: "Requested Service",
      clientMessage: "Inquiry Message",
      submissionDetails: "Submission Metadata",
      dateLabel: "Submission Time (Riyadh)",
      pageUrlLabel: "Source Page URL",
      clientIpLabel: "Client IP Address",
      localTimeLabel: "Client Device Local Time",
      languageLabel: "Selected Interface Language",
      proposedProg: "Proposed Program",
      suitabilityLevel: "Compatibility Grade",
      estimatedCostLabel: "Estimated Budget Required",
      footerMsg: "This message was generated automatically by the Arabian Gulf Horizons digital application portal.",
    },
  };

  const t = translations[lang as "ar" | "tr" | "en"] || translations["en"];
  const isRtl = lang === "ar";
  const direction = isRtl ? "rtl" : "ltr";
  const textAlign = isRtl ? "right" : "left";

  // Build beautiful HTML Email
  let emailHtml = `
  <div dir="${direction}" style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 650px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); background-color: #ffffff;">
    
    <!-- Header with corporate slate identity & luxury gold border -->
    <div style="background-color: #031534; padding: 25px; text-align: center; border-bottom: 4px solid #c9a84c;">
       <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 1px;">ARABIAN GULF HORIZONS</h1>
       <p style="color: #c9a84c; margin: 6px 0 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">آفاق الخليج العربي &bull; DİPLOMASİ & YATIRIM</p>
    </div>
    
    <!-- Body Content -->
    <div style="padding: 30px; text-align: ${textAlign};">
      
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #c9a84c20; color: #b0913c; font-size: 11px; font-weight: 700; padding: 5px 15px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          ${t.emailSubject}
        </span>
      </div>

      <h3 style="color: #031534; margin-top: 0; margin-bottom: 15px; font-size: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
        ${type === "assessment" ? (isRtl ? "بيانات تقويم الاستحقاق الاستثماري" : "Investment Assessment Profile") : (isRtl ? "بيانات تواصل العميل" : "Client Contact Information")}
      </h3>

      <!-- Information Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tbody>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569; width: 35%;">${t.customerName}:</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0; color: #0f172a;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">${t.phoneNumber}:</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0; color: #0f172a; direction: ltr; text-align: ${textAlign};">${phone}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">${t.emailAddress}:</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0; color: #0f172a;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">${t.clientCountry}:</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0; color: #0f172a;">${country}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">${t.requestedService}:</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${service}</td>
          </tr>
  `;

  // If assessment, append detailed scorecard in the email table
  if (type === "assessment" && resultDetails) {
    emailHtml += `
          <tr style="background-color: #fffbeb;">
            <td style="padding: 12px; border: 1px solid #fde68a; font-weight: bold; color: #b45309;">${t.proposedProg}:</td>
            <td style="padding: 12px; border: 1px solid #fde68a; color: #78350f; font-weight: 700; font-size: 15px;">${resultDetails.program}</td>
          </tr>
          <tr style="background-color: #fffbeb;">
            <td style="padding: 12px; border: 1px solid #fde68a; font-weight: bold; color: #b45309;">${t.suitabilityLevel}:</td>
            <td style="padding: 12px; border: 1px solid #fde68a; color: #78350f; font-weight: 700;">${resultDetails.suitability}</td>
          </tr>
          <tr style="background-color: #fffbeb;">
            <td style="padding: 12px; border: 1px solid #fde68a; font-weight: bold; color: #b45309;">${t.estimatedCostLabel}:</td>
            <td style="padding: 12px; border: 1px solid #fde68a; color: #78350f; font-weight: 700; font-size: 15px;">${resultDetails.cost}</td>
          </tr>
    `;
  }

  // Close main values and open metadata
  emailHtml += `
          <tr>
            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569; vertical-align: top;">${t.clientMessage}:</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0; color: #334155; line-height: 1.5; white-space: pre-wrap;">${message || "No message provided."}</td>
          </tr>
        </tbody>
      </table>

      <!-- Metadata section -->
      <h3 style="color: #031534; margin-top: 30px; margin-bottom: 15px; font-size: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
        ${t.submissionDetails}
      </h3>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #64748b;">
        <tbody>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #f1f5f9; font-weight: 600; width: 40%;">${t.dateLabel}:</td>
            <td style="padding: 8px 12px; border: 1px solid #f1f5f9; font-family: monospace;">${dateStr}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px 12px; border: 1px solid #f1f5f9; font-weight: 600;">${t.pageUrlLabel}:</td>
            <td style="padding: 8px 12px; border: 1px solid #f1f5f9; font-family: monospace; word-break: break-all;">${pathUrl}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #f1f5f9; font-weight: 600;">${t.clientIpLabel}:</td>
            <td style="padding: 8px 12px; border: 1px solid #f1f5f9; font-family: monospace;">${clientIp}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px 12px; border: 1px solid #f1f5f9; font-weight: 600;">${t.localTimeLabel}:</td>
            <td style="padding: 8px 12px; border: 1px solid #f1f5f9; font-family: monospace;">${localTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #f1f5f9; font-weight: 600;">${t.languageLabel}:</td>
            <td style="padding: 8px 12px; border: 1px solid #f1f5f9; font-weight: bold; color: #c9a84c;">${lang === "ar" ? "Arabic" : lang === "tr" ? "Turkish" : "English"}</td>
          </tr>
        </tbody>
      </table>

    </div>

    <!-- Luxury Footer -->
    <div style="background-color: #0f172a; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #1e293b;">
      <p style="margin: 0; line-height: 1.5;">${t.footerMsg}</p>
      <p style="margin: 6px 0 0 0; color: #64748b;">© 2026 Arabian Gulf Horizons. Riyadh - Istanbul &bull; High Level Advisory Board.</p>
    </div>
    
  </div>
  `;

  // Track the action in stats
  const stats = readStats();
  if (type === "assessment") {
    stats.assessments += 1;
  } else {
    stats.consultations += 1;
  }
  stats.emailsSent += 1;

  // Add inquiry to recent list
  const newInquiry: Inquiry = {
    id: "inq_" + Math.random().toString(36).substr(2, 9),
    name,
    email,
    phone,
    country,
    service,
    message,
    timestamp: new Date().toISOString(),
    ip: clientIp,
    lang,
    type,
    resultDetails,
  };
  stats.inquiries.unshift(newInquiry);

  // Keep list tidy (last 50 items)
  if (stats.inquiries.length > 50) {
    stats.inquiries.pop();
  }
  writeStats(stats);

  // Environment variables for SMTP
  const smtpTo = process.env.EMAIL_TO || "albaralhmd@gmail.com";
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");

  try {
    let transporter;

    if (smtpUser && smtpPass) {
      // Use configured production SMTP server
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    } else {
      // Fallback: Generate real Test account on the fly with Ethereal SMTP so it never fails but logs beautifully!
      const testAccount = await nodemailer.createTestAccount();
      console.log("No custom SMTP configured. Using Ethereal sandbox SMTP: ", testAccount.user);
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const mailOptions = {
      from: smtpUser ? `"Gulf Horizons Notification" <${smtpUser}>` : `"Gulf Portal Test" <no-reply@dyarna.kesug.com>`,
      to: smtpTo,
      subject: `[${lang.toUpperCase()}] ${t.emailSubject}: ${name}`,
      html: emailHtml,
    };

    const info = await transporter.sendMail(mailOptions);
    const etherealUrl = nodemailer.getTestMessageUrl(info);
    
    if (etherealUrl) {
      console.log("--- REAL SANDBOX EMAIL SENT! ---");
      console.log("View sent email here: ", etherealUrl);
      console.log("------------------------");
    }

    return res.json({
      success: true,
      message: "Email dispatched successfully",
      etherealUrl: etherealUrl || null,
      inquiryId: newInquiry.id,
    });
  } catch (err: any) {
    console.error("Nodemailer transmission crash, but inquiry logged in backend:", err.message);
    // Return success: true so the front-end still progresses elegantly and statistics are preserved in dashboard even if SMTP is unconfigured!
    return res.json({
      success: true,
      emailSent: false,
      message: "Inquiry saved in Admin Panel, but SMTP was not fully initialized for dispatch.",
      inquiryId: newInquiry.id,
    });
  }
});

// Configure Vite or Static delivery depending on NODE_ENV
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Gulf Horizons] Server and API ecosystem active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
