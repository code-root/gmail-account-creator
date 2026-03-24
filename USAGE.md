# دليل الاستخدام

## تشغيل البوت

### الطريقة 1: استخدام متغيرات البيئة

أضف في ملف `.env`:
```env
ACCOUNTS_COUNT=10
THREADS_COUNT=3
```

ثم شغّل:
```bash
npm start
```

### الطريقة 2: استخدام معاملات سطر الأوامر

```bash
# إنشاء 10 حسابات بـ 3 threads متزامنة
npm start -- --accounts=10 --threads=3

# أو بشكل مختصر
npm start -- -a=10 -t=3
```

### الطريقة 3: استخدام متغيرات البيئة مباشرة

```bash
ACCOUNTS_COUNT=10 THREADS_COUNT=3 npm start
```

## أمثلة

### مثال 1: إنشاء حساب واحد
```bash
npm start
# أو
npm start -- --accounts=1 --threads=1
```

### مثال 2: إنشاء 5 حسابات بشكل متسلسل (thread واحد)
```bash
npm start -- --accounts=5 --threads=1
```

### مثال 3: إنشاء 20 حساب بـ 5 threads متزامنة
```bash
npm start -- --accounts=20 --threads=5
```

### مثال 4: إنشاء 100 حساب بـ 10 threads
```bash
npm start -- --accounts=100 --threads=10
```

## ملاحظات مهمة

1. **عدد البروكسيات**: تأكد من وجود عدد كافٍ من البروكسيات في `config/proxies.txt`
   - إذا كان لديك 5 بروكسيات وطلبت 10 threads، سيتم إعادة استخدام البروكسيات

2. **الأداء**: 
   - عدد threads أكبر = أسرع لكن استهلاك موارد أكبر
   - عدد threads أقل = أبطأ لكن أكثر استقراراً

3. **النتائج**: 
   - النتائج تُحفظ في `results.json`
   - الملخص يُحفظ في `summary.json`

4. **السجلات**: 
   - جميع السجلات في مجلد `logs/`
   - كل thread له رقم معرّف في السجلات

## إعدادات افتراضية

- `ACCOUNTS_COUNT=1` (حساب واحد)
- `THREADS_COUNT=1` (thread واحد)

## مثال على المخرجات

```
=== Gmail Account Creator Bot Started ===
Configuration: {
  accountsCount: 10,
  threadsCount: 3,
  proxyCount: 50,
  availableProxies: 50
}
Starting creation of 10 accounts with 3 concurrent threads
[Thread 1] Starting account creation 1/10
[Thread 2] Starting account creation 2/10
[Thread 3] Starting account creation 3/10
...
=== Execution Summary ===
Statistics: {
  total: 10,
  completed: 8,
  failed: 2,
  successRate: '80.00%',
  duration: '245.30s',
  averageTime: '24.53s per account'
}
```


