# fr-bridge-server

FR Rapor Bridge **WebSocket bağlantı yöneticisi**. Render’da **ayrı** Starter servis olarak çalışır.

- `frfood-backend` / restoran sipariş altyapısına **dokunmaz**
- Vercel Nest API + `agent_jobs` kuyruğu kaynak gerçeği olarak kalır
- Agent’lar **WSS outbound** bağlanır (statik IP / port yok)
- En fazla **50** eşzamanlı agent (`BRIDGE_MAX_AGENTS`)

## Protokol

| Yön | Mesaj |
|-----|--------|
| Agent → Server | `{ type:"auth", agentId, secret }` |
| Server → Agent | `{ type:"auth.ok", paired, pairCode?, snapshot? }` |
| Server → Agent | `{ type:"jobs", jobs:[{id,sql,params}] }` |
| Agent → Server | `{ type:"ping" }` / `{ type:"jobs.ack" }` |
| Server → Agent | `{ type:"pong", ...session }` |

Job sonuçları mevcut Vercel `POST /api/agent/job-result` ile yazılır.

## Bildirim

1. Nest `insertAgentJob` → `pg_notify('agent_job_ready', …)`
2. Opsiyonel `BRIDGE_NOTIFY_URL` → `POST /internal/job-notify`
3. Safety poll (~2s) bağlı agent’lar için pending claim

Bildirim kaybolsa job PostgreSQL’de `pending` kalır.

## Ortam değişkenleri

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `DATABASE_URL` veya `DB_*` | evet | FR Rapor main PG (`agent_jobs` / `branch_agents`) — frfood DB değil |
| `BRIDGE_INTERNAL_SECRET` | HTTP notify | `node scripts/generate-bridge-secret.js` — Git’e yazma |
| `DB_SSL` | önerilir | `require` = verify cert; `no-verify` yalnızca bilinçli |
| `BRIDGE_MAX_AGENTS` | hayır | varsayılan 50 |
| `BRIDGE_SAFETY_POLL_MS` | hayır | varsayılan 2000 |
| `BRIDGE_PG_POOL_MAX` | hayır | varsayılan **5** |
| `PORT` | Render | otomatik |

Ayrıntılı kurulum: [DEPLOY.md](./DEPLOY.md) · Dal: **`fr-bridge-render`**

## Yerel

```bash
cd fr-bridge-server
npm install
DATABASE_URL=postgres://… npm start
# health: http://localhost:8080/health
# ws:    ws://localhost:8080/ws
```

## Agent config (Microvise test)

`C:\ProgramData\FrRaporBridge\config.json` (şifreleri buraya yazmayın / loglamayın):

```json
{
  "transport": "auto",
  "bridgeWsUrl": "wss://fr-bridge-server.onrender.com",
  "cloudUrl": "https://react-delta-bice-16.vercel.app"
}
```

`transport: "http"` → eski davranış (varsayılan). WS düşünce HTTP poll fallback açıktır.

## Deploy

Render’da **yeni** Web Service oluştur (`render.yaml` referans). Mevcut `frfood-backend` servisini değiştirmeyin.
