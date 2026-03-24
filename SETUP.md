# إعداد المشروع

## إضافة API Keys

قم بإنشاء ملف `.env` في المجلد الرئيسي وأضف التالي:

```env
# GoLogin API Configuration (if you use GoLogin paths — optional for GPM/Dolphin-only flows)
GOLOGIN_API_KEY=your_gologin_api_key_here

# OMO Captcha Extension API Key
OMOCAPTCHA_KEY=your_omocaptcha_key_here

# SMS Verification API Configuration
SMS_VERIFY_API_KEY=your_sms_verify_api_key_here
SMS_VERIFY_LANG=ru

# Application Settings
LOG_LEVEL=info
MAX_RETRIES=3

# Account Creation Settings
ACCOUNTS_COUNT=1      # عدد الحسابات المراد إنشاؤها
THREADS_COUNT=1       # عدد الـ threads المتزامنة
```

## تثبيت التبعيات

```bash
npm install
```

## تشغيل المشروع

```bash
npm start
```

## ملاحظات

- تأكد من إضافة البروكسيات في `config/proxies.txt`
- ضع مفاتيحك الحقيقية في `.env` فقط ولا ترفعها إلى Git
- Extension ID لـ OMO Captcha: `dfjghhjachoacpgpkmbpdlpppeagojhe`
- يمكن تحديد عدد الحسابات والـ threads من `.env` أو من سطر الأوامر
- راجع `USAGE.md` لأمثلة مفصلة

