// Diagnóstico de conexão com o Cloudflare D1.
// Uso: npm run check-d1
// Mostra apenas dados mascarados — nunca imprime o token completo.
import "dotenv/config";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY;
const d1Id = process.env.CLOUDFLARE_D1_DATABASE_ID;
const email = process.env.CLOUDFLARE_AUTH_EMAIL || process.env.CLOUDFLARE_EMAIL;

const mask = (v) => (v ? `definido (len=${v.length}, final ...${v.slice(-4)})` : "AUSENTE");
console.log("CLOUDFLARE_ACCOUNT_ID :", accountId ? `...${accountId.slice(-4)}` : "AUSENTE");
console.log("CLOUDFLARE_API_TOKEN  :", mask(token));
console.log("CLOUDFLARE_D1_DATABASE_ID:", d1Id || "AUSENTE");
console.log("Auth email (Global Key):", email || "(nenhum → usando Bearer token)");
console.log("--------------------------------------------------");

if (!accountId || !token || !d1Id) {
  console.error("\n❌ Faltam variáveis no .env. Defina CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN e CLOUDFLARE_D1_DATABASE_ID.");
  process.exit(1);
}

const authHeaders = email
  ? { "X-Auth-Email": email, "X-Auth-Key": token }
  : { Authorization: `Bearer ${token}` };

let ok = true;

if (!email) {
  try {
    const r = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    console.log(`[1] Verificar token   → http ${r.status} | success=${j.success} | status=${j.result?.status ?? "-"}`);
    if (!j.success) {
      ok = false;
      console.log("    erros:", JSON.stringify(j.errors));
    }
  } catch (e) {
    ok = false;
    console.log("[1] Verificar token   → erro de rede:", e.message);
  }
}

try {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${d1Id}/query`,
    { method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ sql: "SELECT 1 AS ok;" }) }
  );
  const j = await r.json();
  console.log(`[2] Query no D1       → http ${r.status} | success=${j.success}`);
  if (!j.success) {
    ok = false;
    console.log("    erros:", JSON.stringify(j.errors));
  }
} catch (e) {
  ok = false;
  console.log("[2] Query no D1       → erro de rede:", e.message);
}

console.log("--------------------------------------------------");
if (ok) {
  console.log("✅ Cloudflare D1 conectado com sucesso! A loja já pode ler/gravar no D1.");
  process.exit(0);
} else {
  console.log("❌ Falha na conexão com o D1. Verifique o valor do token (código 1000 = token inválido) e a permissão Account → D1 → Edit.");
  process.exit(1);
}
