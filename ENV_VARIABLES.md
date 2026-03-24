# Environment Variables (.env)

## SMS Provider Configuration

### اختيار مزود خدمة الأرقام

```env
# SMS Provider Selection
# Options: 'sms-verification' (default) or 'fivesim-legacy'
SMS_PROVIDER=sms-verification
```

#### المزودون المدعومون:

1. **SMS Verification** (افتراضي)
   - API: `api.sms-verification.com`
   - متغيرات مطلوبة:
     ```env
     SMS_VERIFY_API_KEY=your_api_key_here
     SMS_VERIFY_LANG=ru  # أو 'en'
     ```

2. **5SIM Legacy** 
   - API: `api1.5sim.net`
   - متغيرات مطلوبة:
     ```env
     SMS_PROVIDER=fivesim-legacy
     FIVESIM_API_KEY=your_api_key_here
     # أو يمكن استخدام SMS_VERIFY_API_KEY
     ```

### إعدادات 5SIM Legacy (اختيارية)

```env
# Country (default: 'england')
# Available: saudiarabia, england, russia, india, germany, etc.
FIVESIM_COUNTRY=saudiarabia

# Operator (default: 'any')
# ⚠️ RECOMMENDED: Use 'any' to avoid NO_NUMBERS errors
# Options: any, virtual58, vodafone, virtual15, etc.
FIVESIM_OPERATOR=any

# Service (default: 'go' for Google/YouTube)
# Options: 'go' (Google/YouTube), 'fu' (Snapchat), etc.
FIVESIM_SERVICE=go

# Maximum price in dollars (default: 50)
FIVESIM_MAX_PRICE=50
```

## مثال كامل لملف .env

### استخدام SMS Verification (افتراضي)
```env
# SMS Provider
SMS_PROVIDER=sms-verification
SMS_VERIFY_API_KEY=your_sms_verify_api_key
SMS_VERIFY_LANG=ru
```

### استخدام 5SIM Legacy
```env
# SMS Provider
SMS_PROVIDER=fivesim-legacy
FIVESIM_API_KEY=your_5sim_api_key
FIVESIM_COUNTRY=saudiarabia
FIVESIM_OPERATOR=any
FIVESIM_SERVICE=go
FIVESIM_MAX_PRICE=50
```

**ملاحظة:** إذا لم يتم تحديد `FIVESIM_COUNTRY` أو `FIVESIM_OPERATOR` في `.env`، سيتم استخدام القيم من الكود (الدولة المحددة في `config.smsVerify.countries` والمشغل `any`).

## ملاحظات

- إذا لم يتم تحديد `SMS_PROVIDER`، سيتم استخدام `sms-verification` افتراضياً
- يمكن استخدام `SMS_VERIFY_API_KEY` مع 5SIM Legacy إذا لم يتم تحديد `FIVESIM_API_KEY`
- جميع الإعدادات الاختيارية لها قيم افتراضية معقولة

