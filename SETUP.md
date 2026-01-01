# إعداد المشروع

## إضافة API Keys

قم بإنشاء ملف `.env` في المجلد الرئيسي وأضف التالي:

```env
# GoLogin API Configuration
GOLOGIN_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTUyOTk5OWVjMWIwMDdmMDk0ODE2Y2MiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTUyY2Q3OGQ2ODdmNzQyMDk1NmIzYTMifQ.-3FyMnwki4lAmSph38TT8yG5GslziA27sqI-1H9PCpY

# OMO Captcha Extension API Key
OMOCAPTCHA_KEY=OMO_ENXZJL877JRCK52ZB2L6FNQFRIOIMEXAUKBZ0V2HOQGCMYQ5N1AV9KRY2ZTOSP1765618401

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
- API key لـ GoLogin موجود أعلاه
- Extension ID لـ OMO Captcha: `dfjghhjachoacpgpkmbpdlpppeagojhe`
- يمكن تحديد عدد الحسابات والـ threads من `.env` أو من سطر الأوامر
- راجع `USAGE.md` لأمثلة مفصلة

