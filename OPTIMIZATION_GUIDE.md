# PostgreSQL Performans Optimizasyonları - Micrapor

## 🚀 Yapılan Optimizasyonlar

### 1. **Redis Cache Entegrasyonu**
- ✅ Sık kullanılan verileri cache'leme (branches, dashboard, personnel, product groups)
- ✅ In-memory fallback mekanizması (Redis yoksa otomatik in-memory cache)
- ✅ Akıllı cache invalidation (veri değiştiğinde cache temizleme)
- ✅ Zaman bazlı TTL (Time To Live) stratejisi

### 2. **Connection Pool Optimizasyonları**
- ✅ Ana DB pool ayarları optimize edildi (max: 20, min: 2)
- ✅ Şube DB pool'ları optimize edildi (max: 10, min: 1)
- ✅ Keep-alive mekanizması eklendi
- ✅ Connection timeout ayarları optimize edildi
- ✅ Statement timeout eklendi (slow query protection)

### 3. **Query Optimizasyonları**
- ✅ Dashboard sorguları cache'lendi (today: 2dk, historical: 10dk)
- ✅ Personnel ve Product Groups 30dk-1 saat cache
- ✅ Branch bilgileri 5-10 dakika cache
- ✅ Prepared statements kullanımı için hazırlık

### 4. **Vercel Deployment Optimizasyonu**
- ✅ Lambda memory 1024MB'a çıkarıldı
- ✅ Max duration 30 saniye
- ✅ Max lambda size 50MB

## 📊 Database Index Önerileri

Aşağıdaki indexleri veritabanınıza ekleyerek performansı daha da artırabilirsiniz:

### Ana Veritabanı (micrapor_users / react)

\`\`\`sql
-- Users tablosu
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_selected_branch ON users(selected_branch);

-- Branches tablosu
CREATE INDEX IF NOT EXISTS idx_branches_user_id ON branches(user_id);
CREATE INDEX IF NOT EXISTS idx_branches_id_user_id ON branches(id, user_id);

-- Branch Kasas tablosu
CREATE INDEX IF NOT EXISTS idx_branch_kasas_branch_id ON branch_kasas(branch_id);
\`\`\`

### Şube Veritabanları

Her şube veritabanına aşağıdaki indexleri ekleyin:

\`\`\`sql
-- ads_acik tablosu (Açık Adisyonlar)
CREATE INDEX IF NOT EXISTS idx_ads_acik_kasa ON ads_acik(kasa);
CREATE INDEX IF NOT EXISTS idx_ads_acik_adsno ON ads_acik(adsno);
CREATE INDEX IF NOT EXISTS idx_ads_acik_actar ON ads_acik(actar);
CREATE INDEX IF NOT EXISTS idx_ads_acik_kasa_adsno ON ads_acik(kasa, adsno);
CREATE INDEX IF NOT EXISTS idx_ads_acik_kasa_actar ON ads_acik(kasa, actar);
CREATE INDEX IF NOT EXISTS idx_ads_acik_masano ON ads_acik(masano);
CREATE INDEX IF NOT EXISTS idx_ads_acik_pluid ON ads_acik(pluid);

-- ads_adisyon tablosu (Kapalı Adisyonlar)
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_kasa ON ads_adisyon(kasa);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_adsno ON ads_adisyon(adsno);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_kaptar ON ads_adisyon(kaptar);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_kasa_adsno ON ads_adisyon(kasa, adsno);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_kasa_kaptar ON ads_adisyon(kasa, kaptar);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_masano ON ads_adisyon(masano);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_pluid ON ads_adisyon(pluid);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_garsonno ON ads_adisyon(garsonno);

-- ads_odeme tablosu (Ödemeler)
CREATE INDEX IF NOT EXISTS idx_ads_odeme_kasa ON ads_odeme(kasa);
CREATE INDEX IF NOT EXISTS idx_ads_odeme_adsno ON ads_odeme(adsno);
CREATE INDEX IF NOT EXISTS idx_ads_odeme_raptar ON ads_odeme(raptar);
CREATE INDEX IF NOT EXISTS idx_ads_odeme_kasa_raptar ON ads_odeme(kasa, raptar);
CREATE INDEX IF NOT EXISTS idx_ads_odeme_kasa_adsno ON ads_odeme(kasa, adsno);
CREATE INDEX IF NOT EXISTS idx_ads_odeme_otip ON ads_odeme(otip);

-- ads_iptal tablosu (İptaller)
CREATE INDEX IF NOT EXISTS idx_ads_iptal_tarih_saat ON ads_iptal(tarih_saat);

-- ads_hareket tablosu (Borç Hareketleri)
CREATE INDEX IF NOT EXISTS idx_ads_hareket_kasano ON ads_hareket(kasano);
CREATE INDEX IF NOT EXISTS idx_ads_hareket_islem_zamani ON ads_hareket(islem_zamani);
CREATE INDEX IF NOT EXISTS idx_ads_hareket_ads_no ON ads_hareket(ads_no);

-- product tablosu
CREATE INDEX IF NOT EXISTS idx_product_plu ON product(plu);
CREATE INDEX IF NOT EXISTS idx_product_tip ON product(tip);

-- personel tablosu
CREATE INDEX IF NOT EXISTS idx_personel_id ON personel(id);

-- ads_musteri tablosu
CREATE INDEX IF NOT EXISTS idx_ads_musteri_mustid ON ads_musteri(mustid);
\`\`\`

## 🔧 Kurulum

### Backend

\`\`\`bash
cd backend
yarn install
\`\`\`

### Environment Variables

\`.env\` dosyasını düzenleyin:

\`\`\`env
# Database
DB_HOST=212.108.132.92
DB_PORT=5432
DB_NAME=react
DB_USER=begum
DB_PASSWORD=KORDO

# Redis (Optional - Upstash Redis kullanabilirsiniz)
REDIS_URL=redis://your-redis-url

# JWT
JWT_SECRET=your-secret-key

# Admin
ADMIN_EMAILS=selcuk.yilmaz@microvise.net
\`\`\`

## 📦 Redis Setup (İsteğe Bağlı)

### Option 1: Upstash Redis (Vercel ile uyumlu, ücretsiz tier)

1. [Upstash](https://upstash.com/) hesabı oluşturun
2. Redis database oluşturun
3. Connection URL'i kopyalayın
4. Vercel'de environment variable olarak ekleyin: \`REDIS_URL\`

### Option 2: Redis Cloud

1. [Redis Cloud](https://redis.com/cloud/) hesabı oluşturun
2. Free tier database oluşturun
3. Connection string'i alın
4. \`REDIS_URL\` olarak ayarlayın

### Redis Yoksa Ne Olur?

Redis URL sağlanmazsa, sistem otomatik olarak **in-memory cache** kullanır. Bu da iyi performans sağlar ama:
- Her Vercel function instance'ı ayrı cache'e sahip olur
- Serverless ortamda instancelar sık sık yeniden başlatılır
- Redis daha tutarlı ve hızlı sonuçlar verir

## 🚀 Vercel Deployment

### 1. GitHub'a Push

\`\`\`bash
git add .
git commit -m "feat: PostgreSQL ve cache optimizasyonları"
git push origin main
\`\`\`

### 2. Vercel Environment Variables

Vercel dashboard'da şu environment variable'ları ekleyin:

\`\`\`
DB_HOST=212.108.132.92
DB_PORT=5432
DB_NAME=react
DB_USER=begum
DB_PASSWORD=KORDO
REDIS_URL=<your-redis-url-if-available>
JWT_SECRET=<your-jwt-secret>
ADMIN_EMAILS=selcuk.yilmaz@microvise.net
NODE_ENV=production
\`\`\`

### 3. Deploy

\`\`\`bash
vercel --prod
\`\`\`

## 📈 Beklenen Performans İyileştirmeleri

| İşlem | Öncesi | Sonrası | İyileştirme |
|-------|--------|---------|-------------|
| Şube Listesi | ~2-3s | ~200-500ms | 4-6x daha hızlı |
| Dashboard Yükleme | ~5-8s | ~1-2s | 4x daha hızlı |
| Rapor Görüntüleme | ~4-6s | ~800ms-1.5s | 4x daha hızlı |
| Sipariş Detayları | ~2-3s | ~500ms-1s | 3x daha hızlı |

## 🎯 Cache Stratejisi

| Veri Tipi | Cache Süresi | Açıklama |
|-----------|--------------|----------|
| Branches | 5-10 dakika | Şube bilgileri nadir değişir |
| Dashboard (today) | 2 dakika | Güncel veri için kısa cache |
| Dashboard (historical) | 10 dakika | Geçmiş veri değişmez |
| Personnel | 30 dakika | Personel listesi nadir değişir |
| Product Groups | 1 saat | Ürün grupları çok nadir değişir |

## 🔍 Monitoring

Cache hit/miss oranını görmek için backend loglarını kontrol edin:

\`\`\`bash
vercel logs <your-deployment-url>
\`\`\`

## 📝 Notlar

1. **Index'leri ekleyin**: Yukarıdaki SQL komutlarını çalıştırarak database performansını önemli ölçüde artırabilirsiniz
2. **Redis kullanın**: Upstash Redis free tier gayet yeterli ve Vercel ile mükemmel çalışıyor
3. **ANALYZE komutunu çalıştırın**: Her şube DB'sine \`ANALYZE;\` komutu çalıştırın
4. **VACUUM yapın**: Düzenli olarak \`VACUUM ANALYZE;\` çalıştırın

## 🆘 Sorun Giderme

### Yavaş Sorgular

Database'de slow query log'u aktif edin:

\`\`\`sql
ALTER SYSTEM SET log_min_duration_statement = 1000; -- 1 saniyeden uzun sorgular
SELECT pg_reload_conf();
\`\`\`

### Connection Pool Issues

Vercel loglarında "too many connections" hatası görürseniz:
- Pool size'ları düşürün
- Daha agresif timeout değerleri kullanın

### Cache Issues

Cache çalışmıyorsa:
1. Redis bağlantısını kontrol edin
2. In-memory fallback'i kullanın (otomatik)
3. Backend loglarını kontrol edin

## 📧 İletişim

Sorular için: selcuk.yilmaz@microvise.net
