-- ====================================
-- MAIN DATABASE INDEXES (react)
-- ====================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_selected_branch ON users(selected_branch);

-- Branches table indexes
CREATE INDEX IF NOT EXISTS idx_branches_user_id ON branches(user_id);
CREATE INDEX IF NOT EXISTS idx_branches_id_user_id ON branches(id, user_id);

-- Branch Kasas table indexes
CREATE INDEX IF NOT EXISTS idx_branch_kasas_branch_id ON branch_kasas(branch_id);

-- Analyze to update statistics
ANALYZE users;
ANALYZE branches;
ANALYZE branch_kasas;

-- ====================================
-- BRANCH DATABASE INDEXES
-- Run this on each branch database
-- ====================================

-- ads_acik table (Open Orders)
CREATE INDEX IF NOT EXISTS idx_ads_acik_kasa ON ads_acik(kasa);
CREATE INDEX IF NOT EXISTS idx_ads_acik_adsno ON ads_acik(adsno);
CREATE INDEX IF NOT EXISTS idx_ads_acik_actar ON ads_acik(actar);
CREATE INDEX IF NOT EXISTS idx_ads_acik_kasa_adsno ON ads_acik(kasa, adsno);
CREATE INDEX IF NOT EXISTS idx_ads_acik_kasa_actar ON ads_acik(kasa, actar);
CREATE INDEX IF NOT EXISTS idx_ads_acik_masano ON ads_acik(masano);
CREATE INDEX IF NOT EXISTS idx_ads_acik_pluid ON ads_acik(pluid);
CREATE INDEX IF NOT EXISTS idx_ads_acik_adtur ON ads_acik(adtur);
CREATE INDEX IF NOT EXISTS idx_ads_acik_sturu ON ads_acik(sturu);

-- ads_adisyon table (Closed Orders)
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_kasa ON ads_adisyon(kasa);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_adsno ON ads_adisyon(adsno);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_kaptar ON ads_adisyon(kaptar);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_kasa_adsno ON ads_adisyon(kasa, adsno);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_kasa_kaptar ON ads_adisyon(kasa, kaptar);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_masano ON ads_adisyon(masano);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_pluid ON ads_adisyon(pluid);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_garsonno ON ads_adisyon(garsonno);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_adtur ON ads_adisyon(adtur);
CREATE INDEX IF NOT EXISTS idx_ads_adisyon_sturu ON ads_adisyon(sturu);

-- ads_odeme table (Payments)
CREATE INDEX IF NOT EXISTS idx_ads_odeme_kasa ON ads_odeme(kasa);
CREATE INDEX IF NOT EXISTS idx_ads_odeme_adsno ON ads_odeme(adsno);
CREATE INDEX IF NOT EXISTS idx_ads_odeme_raptar ON ads_odeme(raptar);
CREATE INDEX IF NOT EXISTS idx_ads_odeme_kasa_raptar ON ads_odeme(kasa, raptar);
CREATE INDEX IF NOT EXISTS idx_ads_odeme_kasa_adsno ON ads_odeme(kasa, adsno);
CREATE INDEX IF NOT EXISTS idx_ads_odeme_otip ON ads_odeme(otip);
CREATE INDEX IF NOT EXISTS idx_ads_odeme_adtur ON ads_odeme(adtur);
CREATE INDEX IF NOT EXISTS idx_ads_odeme_kasa_adsno_adtur ON ads_odeme(kasa, adsno, adtur);

-- ads_iptal table (Cancellations)
CREATE INDEX IF NOT EXISTS idx_ads_iptal_tarih_saat ON ads_iptal(tarih_saat);

-- ads_hareket table (Debt Transactions)
CREATE INDEX IF NOT EXISTS idx_ads_hareket_kasano ON ads_hareket(kasano);
CREATE INDEX IF NOT EXISTS idx_ads_hareket_islem_zamani ON ads_hareket(islem_zamani);
CREATE INDEX IF NOT EXISTS idx_ads_hareket_ads_no ON ads_hareket(ads_no);
CREATE INDEX IF NOT EXISTS idx_ads_hareket_kasano_zamani ON ads_hareket(kasano, islem_zamani);

-- product table
CREATE INDEX IF NOT EXISTS idx_product_plu ON product(plu);
CREATE INDEX IF NOT EXISTS idx_product_tip ON product(tip);

-- personel table
CREATE INDEX IF NOT EXISTS idx_personel_id ON personel(id);

-- ads_musteri table (Customers)
CREATE INDEX IF NOT EXISTS idx_ads_musteri_mustid ON ads_musteri(mustid);

-- ads_odmsekli table (Payment Types)
CREATE INDEX IF NOT EXISTS idx_ads_odmsekli_odmno ON ads_odmsekli(odmno);

-- product_group table
CREATE INDEX IF NOT EXISTS idx_product_group_id ON product_group(id);

-- Analyze all tables to update statistics
ANALYZE ads_acik;
ANALYZE ads_adisyon;
ANALYZE ads_odeme;
ANALYZE ads_iptal;
ANALYZE ads_hareket;
ANALYZE product;
ANALYZE personel;
ANALYZE ads_musteri;
ANALYZE ads_odmsekli;
ANALYZE product_group;

-- Optional: Vacuum to reclaim space and update statistics
-- VACUUM ANALYZE;
