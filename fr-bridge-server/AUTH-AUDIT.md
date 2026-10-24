# Kimlik doğrulama ve secret saklama denetimi

## Akış

1. `POST /api/agent/enroll` → sunucu `secret` (24 byte base64url) üretir, DB’ye yalnızca `sha256(secret)` yazar; plaintext bir kez agent’a döner.
2. Agent `config.json` içine `agentId` + `secret` kaydeder.
3. HTTP poll / WS auth / job-result: body’de plaintext secret; sunucu hash ile `timingSafeEqual` benzeri karşılaştırma.

## Saklama

| Yer | Ne var | Risk |
|-----|--------|------|
| Cloud PG `branch_agents.secret_hash` | SHA-256 | Hash sızıntısı → offline brute (uzun random secret ile düşük) |
| POS `config.json` | plaintext secret | Disk erişimi = köprü ele geçirme; ACL + BitLocker önerilir |
| bridge.log | secret yazılmaz | Agent log’a secret basmaz |
| WS ilk frame | secret | TLS/WSS zorunlu (Render) |

## Uygulanan sertleştirmeler

- Hash karşılaştırması uzunluk + `timingSafeEqual`
- agentId başına tek WS
- Internal notify: `X-Bridge-Secret` (env); secret yoksa endpoint 503
- Test mode secret sabit (`load-test-secret`) — yalnızca `BRIDGE_TEST_MODE=1`

## Bilinçli kabul / kalan risk

- POS’ta plaintext secret (mevcut FrRaporBridge modeli); DPAPI sarmalama ileride
- Enroll endpoint’i auth’suz (pairing kodu 45 dk) — mevcut ürün kararı
- Secret rotate API yok — compromise’te yeniden enroll + pair
