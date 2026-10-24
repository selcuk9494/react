# fr-bridge-server — güvenli deployment hazırlığı

**Dal:** `fr-bridge-render` (main’e doğrudan push yok)  
**frfood-backend:** dokunulmaz  
**Secret:** Git’e / koda yazılmaz

## Vercel production tetiklenmez mi?

| Kontrol | Sonuç |
|---------|--------|
| Repo Vercel projeleri | `backend/` + `frontend/` — Root Directory `fr-bridge-server` **değil** |
| Production branch | Tipik olarak `main` / `master` |
| Bu dal `fr-bridge-render` | Production Auto Deploy **tetiklemez** (Production Branch ≠ bu dal) |
| Preview Deploy | Vercel’de “preview all branches” açıksa *ayrı preview URL* gelebilir; **production domain’i değiştirmez**. İsterseniz Vercel → Project → Settings → Git → Ignored Build Step: `fr-bridge-render` için skip |

Render Web Service **başlangıçta Branch = `fr-bridge-render`** seçilir.

## Git / Render alanları

| Alan | Değer |
|------|--------|
| Repo | `selcuk9494/react` |
| Branch | **`fr-bridge-render`** |
| Root Directory | `fr-bridge-server` |
| Build | `npm install --omit=dev` |
| Start | `npm start` |
| Plan | Starter |
| Health | `/health` |
| Region | Frankfurt (DB’ye yakın) |

## DATABASE_URL (zorunlu)

Yalnızca FR Rapor main PostgreSQL — içinde **`agent_jobs`** ve **`branch_agents`** olan DB.

- **Kullan:** Vercel Nest’in bağlandığı FR Rapor DB  
- **Kullanma:** `frfood-db` / `yemeksepeti` / başka tenant

### Render Free + Supabase (IPv4)

Render outbound **IPv4-only**. Supabase **direct** (`db.<ref>.supabase.co`) çoğu planda **IPv6** → `ENETUNREACH`.

| Mod | Port | LISTEN | Render Free |
|-----|------|--------|-------------|
| Direct | 5432 | Evet | IPv6 riski — kaçın |
| **Session pooler** | **5432** (`*.pooler.supabase.com`) | **Evet** | **IPv4 — kullan** |
| Transaction pooler | 6543 | **Hayır** | LISTEN için kullanma |

Supabase Dashboard → **Connect** → **Session pooler** string’ini `DATABASE_URL` yap.  
Username genelde `postgres.<project-ref>`. Secret/URL’yi loglama.

Doğrulama (salt okuma):

```sql
SELECT to_regclass('public.agent_jobs') AS agent_jobs,
       to_regclass('public.branch_agents') AS branch_agents;
```

İkisi de non-null olmalı. **UPDATE yok.**

## TLS (güvenli varsayılan)

| Env | Anlam |
|-----|--------|
| *(yok)* / `DB_SSL=disable` | SSL kapalı |
| `DB_SSL=require` veya `PGSSLMODE=require` | SSL + **`rejectUnauthorized: true`** |
| `DB_SSL=no-verify` | SSL + cert doğrulama kapalı (**bilinçli opt-in**; log uyarısı) |

`render.com` host adı **otomatik insecure açmaz**.  
Managed PG’de geçerli CA ile `DB_SSL=require` kullanın. Cert hatası olursa önce CA/URL düzeltin; `no-verify` son çare.

## Bağlantı kapasitesi (Vercel çoklu instance)

| Tüketici | Tahmini |
|----------|---------|
| fr-bridge-server pool | `BRIDGE_PG_POOL_MAX` varsayılan **5** |
| fr-bridge-server LISTEN | **+1** kalıcı |
| Bridge alt toplam | **≈6** |
| Nest/Vercel main pool | kodda `max: 20` **instance başına** |
| Vercel N concurrent instance | en kötü ≈ `N × 20` (+ branch pool’lar) |

Öneri:
1. PG’de `SHOW max_connections;` (salt okuma) not edin.
2. Headroom: `max_connections − (bridge≈6) − (beklenen Nest peak) − admin/monitor`.
3. Vercel spike riski yüksekse PgBouncer / pool `max` düşürme ayrı iş (bu dalda Nest pool’u değiştirilmedi).
4. Bridge için varsayılan pool **5** (önceki 10 yerine) — bilinçli düşük ayak izi.

## BRIDGE_INTERNAL_SECRET üretimi

```bash
# Repoda çalıştır — çıktıyı panoya al, Git'e yapıştırma
node fr-bridge-server/scripts/generate-bridge-secret.js
# veya
openssl rand -base64 32
```

- Render Dashboard → Environment → `BRIDGE_INTERNAL_SECRET`  
- Vercel’e **sonra** (ayrı onay) aynı değer  
- Commit / PR / chat / log’a **yazma**

## Env özeti (Render)

| Key | Zorunlu | Örnek / not |
|-----|---------|-------------|
| `DATABASE_URL` | evet | FR Rapor main PG |
| `BRIDGE_INTERNAL_SECRET` | evet (notify için) | generate script |
| `DB_SSL` | önerilir | `require` (verify) |
| `NODE_ENV` | | `production` |
| `BRIDGE_MAX_AGENTS` | | `50` |
| `BRIDGE_SAFETY_POLL_MS` | | `2000` |
| `BRIDGE_NOTIFY_CHANNEL` | | `agent_job_ready` |
| `BRIDGE_PG_POOL_MAX` | | `5` |
| `PORT` | Render | otomatik |

## Servis ayağa kalkınca — yalnızca health / bağlantı / LISTEN

1. Log: `LISTEN agent_job_ready`, `listening`
2. `curl -sS https://<host>/health` → `ok`, `agents`
3. Yanlış secret → `/internal/job-notify` **401**
4. **UPDATE / sahte job insert yok** (ayrı onay)

## Bu dalda commit edilen kapsam

- `fr-bridge-server/**`
- `branch-agent/` kaynak + test (vendor zip **hariç**)
- `backend/src/agent/agent.service.ts` (reclaim / auth)
- `backend/src/database/database.service.ts` (`pg_notify` + opsiyonel HTTP notify)

## Henüz yapılmayacak (ayrı onay)

- `git push` / GitHub’a dal gönderme  
- Render’da servis Create  
- Vercel production env / deploy  
- Microvise config  
- main merge  
