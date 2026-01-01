# Gmail Account Creator Bot

مشروع متكامل لإنشاء حسابات Gmail تلقائياً باستخدام GoLogin، OMO Captcha، وSMS Verification API.

## الميزات

- ✅ إنشاء حسابات Gmail تلقائياً
- ✅ استخدام بروفايلات GoLogin (Android)
- ✅ حل reCAPTCHA تلقائياً عبر OMO Captcha Extension
- ✅ التحقق من الهاتف عبر SMS Verification API
- ✅ استخدام بروكسيات مخصصة
- ✅ توليد أسماء عشوائية عربية (بنات ورجال)
- ✅ كشف ذكي للصفحات

## التثبيت

```bash
npm install
```

## الإعداد

1. انسخ `.env.example` إلى `.env` واملأ القيم:

```env
GOLOGIN_API_KEY=your_gologin_api_key
OMOCAPTCHA_KEY=your_omo_captcha_key
SMS_VERIFY_API_KEY=your_sms_verify_api_key
SMS_VERIFY_LANG=ru
```

2. أضف البروكسيات في `config/proxies.txt` (تنسيق: ip:port:username:password)

3. الأسماء موجودة في `config/names.json`

## الاستخدام

### إنشاء حساب واحد (افتراضي)
```bash
npm start
```

### إنشاء عدة حسابات مع threads متزامنة
```bash
# إنشاء 10 حسابات بـ 3 threads متزامنة
npm start -- --accounts=10 --threads=3
npm start -- --accounts=1 --threads=1

# أو استخدام متغيرات البيئة
ACCOUNTS_COUNT=10 THREADS_COUNT=3 npm start
```

### إضافة في ملف .env
```env
ACCOUNTS_COUNT=10
THREADS_COUNT=3
```

راجع `USAGE.md` للتفاصيل الكاملة.

## هيكل المشروع

```
x.com/
├── src/
│   ├── index.js              # نقطة البداية
│   ├── config.js              # الإعدادات
│   ├── gologin/              # GoLogin integration
│   ├── captcha/              # OMO Captcha handler
│   ├── gmail/                # Gmail creator
│   └── utils/                 # Utilities
├── config/
│   ├── proxies.txt           # البروكسيات
│   └── names.json            # الأسماء
└── logs/                      # السجلات
```

## الميزات الجديدة

- ✅ تحديد عدد الحسابات المراد إنشاؤها
- ✅ تحديد عدد الـ threads المتزامنة
- ✅ معالجة متوازية للحسابات
- ✅ إحصائيات مفصلة عن النتائج
- ✅ حفظ ملخص في `summary.json`

## ملاحظات

- تأكد من تثبيت OMO Captcha Extension في بروفايلات GoLogin
- Extension ID: `dfjghhjachoacpgpkmbpdlpppeagojhe`
- النتائج تُحفظ في `results.json`
- الملخص يُحفظ في `summary.json`
- تأكد من وجود عدد كافٍ من البروكسيات في `config/proxies.txt`

