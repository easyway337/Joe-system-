# Joe System — Nexus AI CRM & ERP

## خطة العمل (Roadmap)

| # | الخطوة | الحالة |
|---|--------|--------|
| 1 | هيكلة المشروع (Backend FastAPI skeleton + Frontend base layout/CSS tokens) | ✅ تم في هذا التسليم |
| 2 | صفحة الـ Dashboard (Charts + KPI Cards + Active Opportunities Table) مطابقة للتصميم | ✅ تم في هذا التسليم |
| 3 | Voice Widget "Nexus Ava" (Web Speech API + Wave Animation + ربطها بالـ Backend) | ✅ تم في هذا التسليم (نسخة أولى) |
| 4 | وحدة CRM كاملة (Leads / Accounts / Pipeline) + Supabase (PostgreSQL) | ✅ تم في هذا التسليم |
| 5 | وحدة ERP كاملة (Inventory / Orders / Procurement / Reports) + Supabase (PostgreSQL) | ✅ تم في هذا التسليم |
| 6 | ربط AI Parser بنموذج LLM حقيقي (Groq — مجاني) بدل الـ keyword matching | ✅ تم في هذا التسليم |
| 7 | Authentication (Supabase Auth، حماية الصفحات والـ Endpoints، Logout) | ✅ تم في هذا التسليم |
| 8 | Deployment (Docker, docker-compose, GitHub Actions CI/CD) | ✅ تم في هذا التسليم |

نحن الآن أنجزنا **كل الخطوات الثمانية (1 → 8)** — المشروع بقى Full-Stack كامل: Frontend + Backend + قاعدة بيانات حقيقية + مساعد صوتي بالذكاء الاصطناعي + تسجيل دخول محمي + جاهز للنشر بـ Docker.

أفكار لمراحل تالية لو حبيت تكمل (مش جزء من الخطة الأصلية): كتابة Automated Tests (pytest)، مراقبة وتنبيهات (Sentry/Logging)، دعم أكثر من شركة على نفس النظام (Multi-tenancy)، وصلاحيات مستخدمين متعددة المستويات (Admin/Sales/Warehouse Roles).

## ⚠️ حل مشكلة "الكروت فاضية" على بيئات سحابية (Google IDX, Codespaces...)

المشكلة كانت أن `api.js` كان مكتوب عليه رابط ثابت `http://localhost:8000`، وهذا لا يعمل عندما الفرونت إند شغّال على دومين معاينة مختلف عن الباك إند (كل بورت له رابط preview منفصل في IDX).

**الحل المُطبّق:** ملف جديد `frontend/js/config.js` يتم تحميله **قبل** أي سكربت آخر، ويحاول يكتشف تلقائياً الرابط الصحيح للـ Backend حسب شكل الدومين الحالي (يدعم نمط IDX/Cloud Workstations اللي البورت يكون بادئة الدومين، ونمط Codespaces اللي البورت يكون لاحقة). لو الاكتشاف التلقائي ما ظبط مع بيئتك، افتح `frontend/js/config.js` واكتب الرابط يدوياً في أول سطر بعد التعليقات:

```js
window.APP_CONFIG = { API_BASE_URL: "https://8000-<your-idx-preview-domain>/api" };
```

**مهم في IDX تحديداً:** تأكد إن البورت 8000 (اللي شغال عليه `uvicorn`) معمول له "Preview" / public access من إعدادات الـ IDX، وليس فقط البورت اللي شغال عليه الفرونت إند.

كمان تم تعديل CORS في `backend/main.py` بحيث يسمح لأي origin (`allow_origins=["*"]`) بدون الاعتماد على cookies، وهذا يشتغل مع أي دومين معاينة بدون تعديل إضافي.

## إعداد Supabase (لخطوة CRM)

1. أنشئ مشروع جديد على [supabase.com](https://supabase.com).
2. من **SQL Editor**، شغّل محتوى الملف `sql/schema.sql` مرة واحدة — هيُنشئ جداول `accounts` و `leads` و `deals` مع بيانات تجريبية.
3. من **Project Settings → API**، انسخ:
   - `Project URL`
   - `service_role` key (ليس `anon` — لأن الباك إند يحتاج صلاحية الكتابة المباشرة بدون المرور بـ RLS)
4. في `backend/`، انسخ `.env.example` إلى `.env` واملأ القيمتين:
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_KEY=eyJhbGciOi...
   ```
5. شغّل `pip install -r requirements.txt` مرة أخرى (فيها الآن `supabase` و `python-dotenv`).
6. أعد تشغيل `uvicorn` — الآن `/api/crm/*` كلها تقرأ/تكتب من Supabase مباشرة.

⚠️ ملف `.env` **لا يجب رفعه لأي مستودع Git** — أضفه إلى `.gitignore`.

## إعداد Supabase (لخطوة ERP)

نفس المشروع، خطوة إضافية فقط:

1. من **SQL Editor** في نفس مشروع Supabase، شغّل محتوى `sql/erp_schema.sql` (بعد `sql/schema.sql` لو لسه ما شغلتوش) — هيُنشئ:
   - `inventory_items` (المخزون)
   - `orders` + `order_items` (أوامر البيع)
   - `purchase_orders` + `purchase_order_items` (أوامر الشراء/التوريد)
   - بيانات تجريبية (Seed) لكل الجداول دي.
2. لا حاجة لتعديل `.env` — نفس بيانات الاتصال المستخدمة في CRM تُستخدم هنا تلقائياً.
3. افتح `frontend/erp.html` (رابط "Inventory" أو "Procurement" أو "Reports" في الـ Sidebar) لتشوف الصفحات الجديدة.

**آلية العمل المهمة:**
- إنشاء طلب بيع (Order) بينزل الكمية من `inventory_items` تلقائياً (Fulfillment).
- تغيير حالة أمر شراء (Purchase Order) إلى `received` بيزوّد الكمية في `inventory_items` تلقائياً (Restocking).
- تقرير "Low Stock" بيفلتر العناصر اللي كميتها ≤ `reorder_level`.

## إعداد المساعد الصوتي بذكاء حقيقي (Groq — مجاني بالكامل)

اخترنا **Groq** تحديداً لأنه:
- **مجاني فعلاً** بدون بطاقة ائتمان (30 طلب/دقيقة تقريباً — أكتر من كافي لمساعد صوتي).
- متوافق مع نفس شكل API بتاع OpenAI (Function/Tool Calling)، فالكود بسيط وواضح.
- سريع جداً (بنية LPU الخاصة بيهم) — مهم للمساعد الصوتي عشان الرد ما يتأخرش.

**خطوات الحصول على المفتاح (دقيقتين، إيميل بس، من غير بطاقة):**

1. افتح [console.groq.com/keys](https://console.groq.com/keys) وسجّل حساب.
2. اضغط **Create API Key** وانسخ المفتاح (يبدأ بـ `gsk_...`).
3. في `backend/.env`، ضيف:
   ```
   GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
   GROQ_MODEL=llama-3.3-70b-versatile
   ```
4. `pip install -r requirements.txt` مرة أخرى (فيها الآن مكتبة `groq`).
5. أعد تشغيل `uvicorn`.

**ملاحظة مهمة:** لو سبت `GROQ_API_KEY` فاضي، المشروع **يفضل شغّال عادي** — `ai_parser.py` بيرجع تلقائياً لطريقة الـ keyword matching القديمة (خطوة 3) بدون أي كسر أو Error. يعني تقدر تجرب المشروع من غير أي مفتاح، وتضيف Groq وقت ما تحب.

### إيه اللي اتغيّر في `ai_parser.py`

- بدل ما الكود يدوّر على كلمات مفتاحية ثابتة، دلوقتي بيبعت النص المستخرج من الصوت لموديل `llama-3.3-70b-versatile` على Groq مع قايمة أدوات (Tools) — كل أداة منها مربوطة بدالة حقيقية في `db_queries.py`.
- الموديل هو اللي بيقرر: (أ) هل الأمر ده يتنفذ بأداة موجودة ولا لأ، (ب) لو أيوه، إيه الأداة الصح، (ج) استخراج القيم (اسم المنتج، اسم العميل، الكمية...) من كلام حر مش لازم يطابق كلمة بكلمة.
- الأدوات المتاحة حالياً: `check_inventory`، `create_lead`، `get_top_leads`، `get_revenue_summary`، `search_crm`، `create_deal`، `create_order`، `get_low_stock_report`.
- لو الموديل مالقاش أداة مناسبة (كلام عادي أو سؤال مش مرتبط)، بيرد بجملة قصيرة عادية من غير ما ينفذ أي حاجة في قاعدة البيانات.
- أي خطأ في الاتصال بـ Groq (شبكة، حد الاستخدام...) بيرجّع تلقائياً لطريقة الـ keyword matching، فمفيش نقطة فشل واحدة (Single Point of Failure) توقف المساعد الصوتي بالكامل.

### أمثلة أوامر صوتية أصبحت مفهومة أدق دلوقتي

- "Do we still have any hydraulic pumps?" (بدون كلمة "inventory" أو "stock" صريحة)
- "Add John from Apex Solutions as a new lead, his email is john@apex.com"
- "Create an order for Apex Solutions, 50 units of Steel Bracket"
- "What's low on stock right now?"
- "كام قطعة فاضلة من الـ Control Panel؟"

## إعداد الـ Authentication (خطوة 7)

### 1) في Supabase Dashboard

1. من القائمة الجانبية: **Authentication → Providers → Email** — تأكد إن Email مفعّل (مفعّل بشكل افتراضي).
2. **مهم للتجربة السريعة:** من **Authentication → Providers → Email**، فيه خيار **"Confirm email"**. لو سايبه مفعّل (الافتراضي)، أي حساب جديد لازم يأكّد إيميله الأول قبل ما يقدر يعمل Login. لو عايز تجرب بسرعة من غير الدخول على الإيميل، عطّله مؤقتاً من هنا (تقدر ترجّعه تاني وقت الإنتاج الفعلي).
3. من **Project Settings → API**، انسخ الـ **anon / public key** (مش service_role اللي استخدمناه في الباك إند).

### 2) في الفرونت إند

افتح `frontend/js/supabase-config.js` واملأ القيمتين:
```js
window.SUPABASE_CONFIG = {
  SUPABASE_URL: "https://xxxxx.supabase.co",       // نفس القيمة اللي في backend/.env
  SUPABASE_ANON_KEY: "eyJhbGciOi...",                // الـ anon key (public) من نفس المكان اللي جبت منه service_role
};
```

⚠️ الـ anon key **مصمم يكون public** وآمن يترفع حتى لو الكود Open Source — الحماية الحقيقية جايه من RLS على مستوى الجداول (الخطوة الجاية).

### 3) تحصين قاعدة البيانات (مهم جداً — خطوة أمان لازمة)

بما إننا دلوقتي حطينا الـ anon key في المتصفح، أي حد يقدر ياخده من كود الصفحة ويستخدمه يكلم REST API بتاع Supabase **مباشرة**، من غير ما يمر على الباك إند بتاعنا خالص. السياسات اللي عملناها في الخطوة 4 و5 كانت `using (true)` من غير تحديد role، يعني بتنطبق على أي حد **بما فيهم anon**.

شغّل `sql/auth_rls_lockdown.sql` في SQL Editor — بيعيد كتابة كل السياسات دي عشان تقتصر على `service_role` بس (يعني الباك إند بس اللي يقدر يقرا/يكتب في الجداول، مش أي حد معاه الـ anon key). آخر سطر في الملف استعلام تأكيدي هيوريك كل سياسة وعليها الـ role بتاعها — المفروض تلاقي `{service_role}` قدام كل واحدة.

### 4) تجربة النظام

1. `pip install -r requirements.txt` (مفيش مكتبات باك إند جديدة في الخطوة دي، فقط تأكد إنها محدّثة).
2. شغّل `uvicorn` والفرونت إند زي المعتاد.
3. افتح `frontend/index.html` — المفروض يوديك على طول لـ `login.html` (مفيش session).
4. من `login.html`، دوس "Create one" → `register.html` → اعمل حساب.
5. لو "Confirm email" لسه مفعّل، هتتبعت لك رسالة تأكيد على الإيميل — افتحها واضغط الرابط، بعدين ارجع لـ `login.html` وسجّل دخول.
6. بعد تسجيل الدخول هتوصل لـ `index.html` وتلاقي إيميلك ظاهر فوق يمين، وزرار **Logout** جنبه.

### إيه اللي بيحصل تقنياً

- **الفرونت إند** بيكلم Supabase Auth مباشرة (`frontend/js/auth.js`) — مفيش استضافة سيشن على الباك إند، الباك إند بس بيتحقق من التوكين.
- عند تسجيل الدخول، Supabase بيرجّع `access_token` (JWT، صالح لمدة ساعة تقريباً) و `refresh_token`. الاتنين بيتخزنوا في `localStorage` تحت مفتاح `nexus_session`.
- كل طلب لـ `api.js` بيضيف الهيدر `Authorization: Bearer <access_token>` تلقائياً.
- في الباك إند، `services/auth.py` فيه Dependency اسمها `get_current_user` — متطبّقة على كل الـ routers (CRM, ERP, Analytics, AI Assistant) في `main.py`. أي طلب من غير توكين صحيح بيرجع `401` قبل ما يوصل لأي Route Handler خالص.
- لو الـ `access_token` انتهت صلاحيته، `api.js` بيحاول يجدده تلقائياً باستخدام `refresh_token` (مرة واحدة) قبل ما يرجّعك لصفحة Login.
- زرار **Logout** (في `header.html`) بيمسح الـ session من `localStorage` ويرجّعك لـ `login.html`.
- `/api/health` هو الـ endpoint الوحيد اللي **مش** محمي — عشان يفضل شغال كـ "فحص إن السيرفر شغال" حتى من غير تسجيل دخول.

## تشغيل الـ Backend

> 💡 الطريقتين تحت (بدون Docker) مفيدتين للتطوير اليومي. لو عايز تشغّل المشروع كله بأمر واحد (زي بيئة الإنتاج بالظبط)، شوف قسم **"خطة النشر (Deployment)"** تحت واستخدم `docker compose up --build`.

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API متاح على: `http://127.0.0.1:8000` — وثائق تفاعلية على `http://127.0.0.1:8000/docs`

## تشغيل الـ Frontend

الـ Frontend يستخدم `fetch()` لتحميل مكونات HTML (`components/*.html`) وبالتالي **لا يعمل** بفتح `index.html` مباشرة من الجهاز (`file://`). شغّله عبر سيرفر بسيط:

```bash
cd frontend
python -m http.server 5500
```

ثم افتح: `http://127.0.0.1:5500`

تأكد أن الـ Backend شغّال على المنفذ 8000 أولاً (CORS مفعّل بالفعل في `main.py`).

## بنية المشروع

```
/.github/workflows
  ci-cd.yml                    # فحص + بناء صور Docker + رفعها على ghcr.io
docker-compose.yml              # يشغّل backend + frontend مع بعض
.gitignore                       # يستبعد .env والملفات المؤقتة
/backend
  Dockerfile                    # صورة الباك إند (Python 3.12 + Uvicorn)
  .dockerignore
  main.py                        # نقطة الدخول + تسجيل الـ routers + CORS + حماية Auth
  .env.example                    # نموذج بيانات اتصال Supabase + Groq
  /routers
    analytics.py                # بيانات الداشبورد (KPIs, Charts, Opportunities)
    crm.py                       # Leads, Accounts, Deals/Pipeline (Supabase)
    erp.py                       # Inventory, Orders, Procurement, Reports (Supabase)
    ai_assistant.py              # نقطة نهاية المساعد الصوتي /api/ai/voice-command
  /models
    schemas.py                   # Pydantic models (CRM + ERP create/update)
  /services
    supabase_client.py           # عميل Supabase الموحّد (singleton)
    groq_client.py                # عميل Groq الموحّد (singleton) — يرجع None لو مفيش مفتاح
    auth.py                        # Dependency للتحقق من JWT وحماية الـ Endpoints
    db_queries.py                   # طبقة الوصول للبيانات (كل شيء الآن على Supabase)
    ai_parser.py                     # Groq LLM (Tool Calling) + fallback بالكلمات المفتاحية
/sql
  schema.sql                      # جداول accounts / leads / deals + RLS + seed data
  erp_schema.sql                    # جداول inventory_items / orders / purchase_orders + RLS + seed data
  auth_rls_lockdown.sql              # يقيّد كل السياسات على service_role فقط (خطوة 7)
/frontend
  Dockerfile                       # صورة الفرونت إند (nginx)
  nginx.conf                        # يقدّم الملفات الثابتة + proxy لـ /api
  .dockerignore
  index.html                        # صفحة الداشبورد (محمية)
  crm.html                           # صفحة CRM (محمية)
  erp.html                            # صفحة ERP (محمية)
  login.html                           # تسجيل الدخول
  register.html                         # إنشاء حساب
  /css
    main.css                        # المتغيرات (الألوان) + الـ Layout العام
    dashboard.css                    # الـ Sidebar, Header (+ Logout), Cards, Charts, Table
    ai_widget.css                     # ويدجت "Nexus Ava" (Glassmorphism + Wave)
    crm.css                            # تبويبات، Modals، لوحة الـ Pipeline (مشتركة مع ERP)
    erp.css                             # Stock badges، صفوف الـ line-items، ملخص التقارير
    auth.css                             # تصميم صفحات Login/Register
  /js
    supabase-config.js                # بيانات Supabase العامة (URL + anon key) للفرونت إند
    config.js                          # اكتشاف رابط الـ Backend تلقائياً (لأي بيئة، يدعم IDX)
    auth.js                             # عميل Supabase Auth (fetch مباشر) + إدارة الـ session
    api.js                               # عميل الـ API (fetch wrapper) — يرفق Authorization تلقائياً
    layout.js                             # تحميل الـ Sidebar/Header/AI widget + حماية الصفحة
    charts.js                              # رسم الـ Charts وجدول الـ Opportunities
    crm.js                                   # منطق صفحة CRM (تبويبات، جداول، نماذج)
    erp.js                                    # منطق صفحة ERP (تبويبات، جداول، line-items ديناميكية)
    ai_voice.js                                # منطق Web Speech API وربطه بالـ Backend
    app.js                                      # نقطة انطلاق صفحة الداشبورد
    login.js                                     # منطق صفحة تسجيل الدخول
    register.js                                   # منطق صفحة إنشاء الحساب
  /components
    sidebar.html
    header.html                     # فيه إيميل المستخدم + زرار Logout
    ai_widget.html
    crm_table.html
```

## كيف يعمل المساعد الصوتي (الربط JS ↔ Python)

1. المستخدم يضغط زر المايك → `ai_voice.js` يستدعي `SpeechRecognition` (Web Speech API) في المتصفح.
2. عند انتهاء الكلام، `recognition.onresult` يعطينا نص (transcript) بالكامل داخل المتصفح — بدون أي مكتبة صوت في الباك إند.
3. `ai_voice.js` يرسل هذا النص كـ `POST /api/ai/voice-command` عبر `api.js`.
4. في الباك إند، `routers/ai_assistant.py` يستقبل الطلب ويمرره إلى `services/ai_parser.py`.
5. `ai_parser.py` يحلل النص (كلمات مفتاحية عربي/إنجليزي حالياً، قابلة للاستبدال بنموذج LLM لاحقاً) ليحدد الـ **Intent** (مثال: `check_inventory`) ثم يستدعي `db_queries.py` لجلب البيانات الفعلية.
6. الرد (نص + بيانات JSON) يرجع للـ Frontend، حيث `ai_voice.js` يستخدم `SpeechSynthesisUtterance` للنطق بالرد، ويطلق `CustomEvent` (مثل `ava:inventory-result`) حتى تقدر أي صفحة تانية (CRM/ERP) تستمع له وتحدّث الجدول/الفلاتر تلقائياً.

### الأوامر الصوتية المرتبطة بـ Supabase (جديد في الخطوة 4)

- **"Create a new Lead"** → `ai_parser.py` يستدعي `db_queries.create_lead()` اللي بيعمل `INSERT` حقيقي في جدول `leads` على Supabase.
- **"Show me top leads this month"** → يستدعي `db_queries.get_top_leads()` اللي بيقرأ من جدول `deals` (الأعلى قيمة).
- **"find account Apex"** أو **"ابحث عن عميل Apex"** → intent جديد اسمه `search_crm` يستدعي `db_queries.search_crm()` اللي بيعمل بحث `ILIKE` على جدولي `leads` و `accounts` معاً ويرجّع النتائج.

## خطة النشر (Deployment) — خطوة 8

المشروع دلوقتي متغلف بالكامل بـ Docker: صورتين (Images) — واحدة للباك إند (Python/FastAPI) وواحدة للفرونت إند (nginx بيقدّم الملفات الثابتة). ملف `docker-compose.yml` في جذر المشروع بيشغّل الاتنين مع بعض ويربطهم.

### ليه الشكل ده بالذات (Architecture)

```
المتصفح  →  nginx (frontend container, بورت 80)
                ├── يقدّم index.html/crm.html/erp.html/... مباشرة
                └── /api/*  →  proxy_pass  →  backend container (بورت 8000، داخلي بس)
```

- **origin واحد بس** من وجهة نظر المتصفح — نفس الدومين بيقدّم الصفحات ويستقبل طلبات الـ API، فمفيش مشاكل CORS ومفيش حاجة تتظبط يدوي في `config.js` (قاعدة رقم 3 فيه — "مفيش بورت في الرابط" — بترجع `/api` تلقائياً، وده بالظبط اللي nginx بيعمله proxy له).
- الباك إند **مش متعرّض للإنترنت مباشرة** — بس nginx اللي بيكلمه، على الشبكة الداخلية لـ Docker.

### 1) تجربة محلية بأمر واحد

```bash
cp backend/.env.example backend/.env    # واملأ القيم الحقيقية (Supabase + Groq)
# افتح frontend/js/supabase-config.js واملأ SUPABASE_URL و SUPABASE_ANON_KEY

docker compose up --build
```

افتح `http://localhost` — هتلاقي الموقع شغال بالكامل، الفرونت إند والباك إند وراه في حاوية واحدة لكل واحد.

### 2) خيارات النشر الفعلي — اختار حسب ميزانيتك وخبرتك

**خيار أ) سيرفر واحد (VPS) + docker-compose — الأبسط والأرخص**

- استأجر VPS رخيص (Hetzner ~4-5€/شهر، DigitalOcean، أو حتى Oracle Cloud Free Tier).
- ثبّت Docker و Docker Compose عليه.
- انسخ المشروع (`git clone`)، اعمل نفس خطوات "التجربة المحلية" فوق.
- وجّه الدومين بتاعك (A record) على IP السيرفر.
- **الـ HTTPS:** أسهل طريقة هي تحط السيرفر وراء [Cloudflare](https://cloudflare.com) (مجاني) وتفعّل "Proxy" (السحابة البرتقالية) — بيديك HTTPS تلقائي من غير ما تتعامل مع شهادات SSL خالص. البديل: أضف حاوية [Caddy](https://caddyserver.com) قدام nginx، بيجيب شهادات Let's Encrypt تلقائياً بسطرين إعداد.
- **الميزة:** كل حاجة في مكان واحد، تحكم كامل، أرخص حل على المدى الطويل.
- **العيب:** إنت المسؤول عن الصيانة والتحديثات الأمنية للسيرفر نفسه.

**خيار ب) استضافة مُدارة (Managed) — أسهل بداية، تحتاج تعديل بسيط**

- **الباك إند:** [Render](https://render.com) أو [Railway](https://railway.app) — الاتنين بيقروا `backend/Dockerfile` مباشرة وبيدوك رابط HTTPS جاهز. حط متغيرات البيئة (`SUPABASE_URL`, `SUPABASE_KEY`, `GROQ_API_KEY`, `GROQ_MODEL`) من الداشبورد بتاعهم (مش من ملف `.env` — الملف ده محلي بس).
- **الفرونت إند:** بما إنه ملفات ثابتة بدون build step، أسهل حل [Cloudflare Pages](https://pages.cloudflare.com) أو [Netlify](https://netlify.com) (مجانيين) — اسحب فولدر `frontend/` وخلاص، أو استخدم نفس صورة الـ Docker لو حابب.
- **⚠️ الفرق المهم هنا:** الفرونت إند والباك إند هيبقوا على **دومينين مختلفين** (مثلاً `nexus.pages.dev` و `nexus-api.onrender.com`)، يعني قاعدة "same-origin" في `config.js` مش هتنطبق. لازم تعدّل يدوياً في أول `frontend/js/config.js`:
  ```js
  window.APP_CONFIG = { API_BASE_URL: "https://nexus-api.onrender.com/api" };
  ```
- **الميزة:** صفر صيانة سيرفرات، الاتنين بيعملوا Deploy تلقائي من GitHub، وعندهم تير مجاني كويس للتجربة.
- **العيب:** الباك إند المجاني بينام لو مفيش طلبات لفترة (Render/Railway free tier) — أول طلب بعد فترة راحة بياخد ثواني إضافية.

### 3) الـ CI/CD (`.github/workflows/ci-cd.yml`)

الـ Workflow شغّال تلقائي على GitHub Actions، وبيعمل:

1. **`lint-and-check`** (على كل push و كل Pull Request): يتأكد إن الباك إند بيعمل import صح ومفيش أخطاء بايثون، وإن كل ملفات الجافاسكريبت خالية من Syntax Errors — قبل ما نضيّع وقت في بناء صورة Docker كاملة لكود فيه غلطة.
2. **`build-and-push`** (على push لـ `main` بس، ولو الفحص السابق نجح): يبني صورتين Docker (backend + frontend) ويرفعهم على **GitHub Container Registry** (`ghcr.io`) — مجاني ومربوط بحسابك على GitHub مباشرة، مفيش حاجة تتظبط.
3. **خطوة الـ Deploy الفعلية (اختيارية، معلّقة في الملف):** فيه مثالين جاهزين (Render deploy hook، أو SSH لسيرفر VPS وعمل `docker compose pull && up`) — افك التعليق على اللي يناسب اختيارك من فوق وضيف الـ Secrets المطلوبة من **Settings → Secrets and variables → Actions** في المستودع بتاعك على GitHub.

### 4) الأسرار (Secrets) — قاعدة واحدة مهمة

- **متغيرات الباك إند** (`SUPABASE_URL`, `SUPABASE_KEY`, `GROQ_API_KEY`) **متبعتش أبداً جوا صورة الـ Docker** — بتتحط وقت التشغيل بس (عن طريق `env_file` في docker-compose، أو Environment Variables في Render/Railway). كده لو حد شاف الصورة أو الكود على GitHub، مش هيلاقي فيها أي مفتاح سري.
- **متغيرات الفرونت إند** (`SUPABASE_ANON_KEY` في `supabase-config.js`) **آمنة تتحط في الكود/الصورة مباشرة** — مصممة أصلاً تكون عامة (public)، والحماية الحقيقية جايه من RLS في قاعدة البيانات (`sql/auth_rls_lockdown.sql`).
