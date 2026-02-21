# Vercel Dağıtım Kılavuzu (Deployment Guide)

Bu proje Frontend (Next.js) ve Backend (NestJS) olmak üzere iki ana parçadan oluşmaktadır. Vercel üzerinde her ikisini de çalıştırabilirsiniz.

## Ön Hazırlık: Veritabanı
Vercel "Serverless" yapıda çalıştığı için, veritabanınızın internete açık bir sunucuda olması gerekir (Localhost veritabanı çalışmaz).
- Önerilen: **Supabase**, **Neon** veya **Render** gibi bir PostgreSQL sağlayıcısı kullanın.
- Veritabanı bağlantı bilgilerinizi (DB_HOST, DB_USER, vb.) not edin.

---

## 1. Backend Dağıtımı (NestJS)

Backend projesini Vercel'e dağıtmak için yapılandırma dosyaları (`vercel.json` ve `src/vercel.ts`) hazırlanmıştır.

1. Vercel Dashboard'da "Add New Project" deyin.
2. Bu repository'yi seçin.
3. **Root Directory** (Kök Dizin) olarak `backend` klasörünü seçin.
4. **Environment Variables** (Çevresel Değişkenler) kısmına `.env` dosyanızdaki değerleri ekleyin:
   - `DB_HOST`: (Bulut veritabanı adresi)
   - `DB_PORT`: 5432
   - `DB_USER`: (Kullanıcı adı)
   - `DB_PASSWORD`: (Şifre)
   - `DB_NAME`: (Veritabanı adı)
   - `JWT_SECRET`: (Gizli anahtarınız)
5. **Deploy** butonuna basın.
6. Dağıtım bitince size bir URL verecek (örn: `https://backend-xyz.vercel.app`). Bu adresi kopyalayın.

---

## 2. Frontend Dağıtımı (Next.js)

1. Vercel Dashboard'da tekrar "Add New Project" deyin.
2. Aynı repository'yi tekrar seçin.
3. **Root Directory** olarak `frontend` klasörünü seçin.
4. **Framework Preset** otomatik olarak Next.js seçilecektir.
5. **Environment Variables** kısmına backend adresini ekleyin:
   - `NEXT_PUBLIC_API_URL`: `https://backend-xyz.vercel.app/api`
   (Backend dağıtımından aldığınız URL'in sonuna `/api` eklemeyi unutmayın)
6. **Deploy** butonuna basın.

## Önemli Notlar
- Backend `0.0.0.0` IP bağlama ayarı Vercel ortamında `vercel.ts` dosyası üzerinden otomatik yönetilir.
- Veritabanınızın "Allow external connections" (Dış bağlantılara izin ver) ayarının açık olduğundan emin olun.
