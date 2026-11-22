<div align="center">

# 🧪 جارویکس — Jarvixxx

**آزمایشگاه ساخت محصولات وب — از ایده تا محصول، با استاندارد حرفه‌ای**

[![Live](https://img.shields.io/badge/🟢_Live-jx3.ir-59c2e6?style=for-the-badge)](https://jx3.ir/)
[![First Product](https://img.shields.io/badge/محصول_اول-رساکس_(رزومه‌ساز)-4fd1a5?style=for-the-badge)](https://resux.jx3.ir/)
[![License](https://img.shields.io/badge/License-MIT-e8b96b?style=for-the-badge)](LICENSE)

**هاب پروژه‌ها + صفحه‌ی اصلی برند** — هر پروژه‌ای که از این به بعد ساخته می‌شود، از اینجا لینک و معرفی می‌شود.

</div>

---

## اینجا کجاست؟

جارویکس خط تولید محصولات وب است: ایده‌ها را از **زمین آزمایش** عبور می‌دهیم و فقط چیزهایی که از آزمونِ واقعی سربلند بیرون بیایند را به محصول تبدیل می‌کنیم — در دو مسیر موازی:

| مسیر | برای چه کسی؟ | نمونه |
|---|---|---|
| 🟢 **متن‌باز و رایگان** | تازه‌کارها، جامعه، یادگیری | [رساکس — رزومه‌ساز](https://resux.jx3.ir/) |
| 🟡 **تجاری و آماده** | کسب‌وکارها، برندها | Studio Pack (به‌زودی) |

اولین محصول، [**رساکس**](https://resux.jx3.ir/) است: رزومه‌ساز آنلاین فارسی/انگلیسی با خروجی PDF برداری — کاملاً رایگان و متن‌باز.

## معماری صفحه (چه چیزهایی داخلش است)

- **هیروی Canvas 2D ذره‌ای** — واژه‌ی JARVIXXX با فیزیک فنری (Float32Array، dithering honeycomb، دافعه‌ی ماوس، سقف DPR=2، توقف روی خارج‌شدن از دید)
- **شیشه‌ی مایع سه‌لایه** — Tier 0 fallback تخت / Tier 1 با `backdrop-filter` / Tier 2 انکسار نوری `feDisplacementMap` فقط برای Chromium (تشخیص با `userAgentData`، نه `@supports`)
- **سیستم رنگ OKLCH قفل‌شده** — بدون `#000000` خالص (جلوگیری از halation)، پس‌زمینه‌ی ابسیدینِ رنگ‌گرفته با hue متافلو
- **مانیفست اسکرولی** — هایلایت کلمه‌به‌کلمه با `ScrollTrigger` (word-level چون فارسی پیوسته است؛ هرگز char-level)
- **بنتو گریج سخت‌گیرانه** — math دقیق (`grid-template-areas`، یک کاشی فلاگشیپ 2x2، شعاع درونی `r-4px`)، فیلتر دو مسیره با state در URL
- **حرکات مغناطیسی** — `gsap.quickTo` (بدون تولد tween در mousemove)، اسپات‌لایت مرز کارت‌ها با `mask-composite: exclude`
- **تک‌RAF** — Lenis و ScrollTrigger هر دو در یک `gsap.ticker` با `lagSmoothing(0)`
- **ScrambleText** روی لینک‌های تماس (سلول‌های ثابت em، `aria-label` سالم)
- **فونت متغیر** — وزیرمتن + استعداد (فارسی)، Syne + JetBrains Mono (لاتین با `unicode-range`)
- **رعایت کامل** `prefers-reduced-motion` و `prefers-reduced-transparency` + honeypot و rate-limit در فرم تماس

## ساختار

```
├── index.html              # کل صفحه در یک فایل (۸ سکشن)
├── api/contact.php         # فرم تماس: SQLite + honeypot + rate-limit 5/h
├── assets/
│   ├── css/main.css        # توکن‌های OKLCH + Liquid Glass + بنتو + ...
│   ├── js/main.js          # موتور حرکت (هیرو، مانیفست، فیلتر، فرم)
│   ├── js/vendor/          # GSAP 3.13 + Lenis
│   ├── fonts/              # فونت‌های متغیر woff2 خودمیزبان
│   └── img/                # آیکون‌ها + OG cover (تولیدشده با OKLCH)
├── manifest.webmanifest    # PWA manifest
├── robots.txt / sitemap.xml
└── .htaccess               # کش + هدرهای امنیتی
```

## اجرا

هیچ build-step‌ای وجود ندارد؛ فایل‌ها را روی هر هاست Apache/LiteSpeed بریزید و تمام. برای توسعه‌ی محلی:

```bash
php -S localhost:8899 -t .
```

## نقشه‌ی راه

- [x] **رساکس** — رزومه‌ساز آنلاین ([لایو](https://resux.jx3.ir/) · [گیت‌هاب](https://github.com/Daronely/resux))
- [ ] DevToolkit — مجموعه ابزارهای رایگان توسعه‌دهندگان
- [ ] Build Log — ثبت قدم‌به‌قدم ساخت پروژه‌ها برای یادگیری
- [ ] Studio Pack — بسته‌های تجاری آماده برای کسب‌وکارها

ایده‌ای داری که ارزش ساختن دارد؟ [بفرست](https://jx3.ir/#contact) — اگر از آزمایشگاه ما عبور کند، به محصول واقعی تبدیل می‌شود.

---

<div align="center">

**[🟢 jx3.ir](https://jx3.ir/)** · [resux.jx3.ir](https://resux.jx3.ir/) · MIT License

</div>
