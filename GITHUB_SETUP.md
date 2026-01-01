# إعداد رفع المشروع على GitHub Private Repository

## الخطوات:

### 1. إنشاء Repository جديد على GitHub

1. اذهب إلى https://github.com/new
2. اختر اسم للمشروع (مثلاً: `gmail-account-creator`)
3. اختر **Private** (مهم جداً!)
4. **لا** تضع علامة على Initialize with README
5. اضغط **Create repository**

### 2. رفع المشروع

بعد إنشاء الـ repository، قم بتنفيذ الأوامر التالية:

```bash
# إضافة جميع الملفات
git add .

# عمل commit
git commit -m "Initial commit: Gmail Account Creator with GPM Login"

# إضافة remote repository (استبدل YOUR_USERNAME و REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# أو إذا كنت تستخدم SSH:
# git remote add origin git@github.com:YOUR_USERNAME/REPO_NAME.git

# رفع المشروع
git branch -M main
git push -u origin main
```

### 3. التحقق من الملفات الحساسة

تأكد من أن الملفات التالية **غير موجودة** في الـ repository:
- `.env`
- `config/proxies.txt`
- `email.txt`
- `gmlogin.txt`
- `results.json`
- `summary.json`
- `logs/`

### 4. إنشاء ملف .env.example

أنشئ ملف `.env.example` يحتوي على المتغيرات المطلوبة بدون القيم الحساسة:

```env
# GPM Login API URL
GPM_API_URL=http://127.0.0.1:14517

# OMO Captcha API Key
OMOCAPTCHA_KEY=your_omocaptcha_key_here

# SMS Verification API Key
SMS_VERIFY_API_KEY=your_sms_verify_key_here

# Application Settings
ACCOUNTS_COUNT=1
THREADS_COUNT=1
LOG_LEVEL=info
TEST_PROXY=true
```

### 5. تحديث README.md

تأكد من تحديث README.md ليشمل:
- وصف المشروع
- متطلبات التشغيل
- تعليمات الإعداد
- كيفية الاستخدام

## ملاحظات أمنية:

⚠️ **مهم جداً:**
- تأكد من أن الـ repository **Private**
- لا ترفع أي ملفات تحتوي على:
  - API keys
  - Proxies
  - Passwords
  - Personal data
- استخدم `.env` للمتغيرات الحساسة
- أضف `.env` إلى `.gitignore`

## إذا نسيت إضافة ملف حساس:

إذا رفعت ملف حساس بالخطأ:

```bash
# إزالة الملف من git history
git rm --cached config/proxies.txt
git commit -m "Remove sensitive file"
git push
```

