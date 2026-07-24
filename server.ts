import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const app = express();
const PORT = 3000;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(12).toString("hex") + ext;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Use JPG, PNG, GIF ou WEBP."));
    }
  },
});

// JSON File Database structure
const DB_PATH = path.join(process.cwd(), "database.json");

// -----------------------------------------------------------------------------
// CLOUDFLARE INTEGRATION (R2 Object Storage & D1/KV Database)
// -----------------------------------------------------------------------------

function isCloudflareR2Configured(): boolean {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    accountId &&
    process.env.CLOUDFLARE_R2_BUCKET_NAME
  );
}

async function uploadToCloudflareR2(filePath: string, filename: string, mimeType: string): Promise<string> {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;

  if (!accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_R2_ACCOUNT_ID is missing.");
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const fileBuffer = fs.readFileSync(filePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: filename,
      Body: fileBuffer,
      ContentType: mimeType,
    })
  );

  if (publicUrl) {
    const baseUrl = publicUrl.replace(/\/+$/, "");
    return `${baseUrl}/${filename}`;
  }

  return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${filename}`;
}

function isCloudflareD1Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_API_TOKEN &&
    process.env.CLOUDFLARE_D1_DATABASE_ID
  );
}

function isCloudflareKVConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_API_TOKEN &&
    process.env.CLOUDFLARE_KV_NAMESPACE_ID
  );
}

async function executeD1(sql: string, params: any[] = []): Promise<any[]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY;
  const d1Id = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const email = process.env.CLOUDFLARE_AUTH_EMAIL || process.env.CLOUDFLARE_EMAIL;

  if (!accountId || !token || !d1Id) {
    throw new Error("Cloudflare D1 não está totalmente configurado no .env.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (email) {
    headers["X-Auth-Email"] = email;
    headers["X-Auth-Key"] = token;
  } else {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${d1Id}/query`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ sql, params }),
    }
  );

  const json: any = await res.json();
  if (!json.success) {
    const rawErr = json.errors?.[0]?.message || "Cloudflare D1 query failed";
    if (rawErr.toLowerCase().includes("authentication error")) {
      throw new Error(
        "Erro de Autenticação na API do Cloudflare D1: O token 'CLOUDFLARE_API_TOKEN' não possui a permissão 'Account -> D1 -> Edit' ou as credenciais estão incorretas. Verifique seu API Token ou use a aba Console do Cloudflare D1 para colar o script SQL."
      );
    }
    throw new Error(rawErr);
  }

  return json.result?.[0]?.results || [];
}

async function initD1Schema() {
  if (!isCloudflareD1Configured()) return;
  try {
    console.log("[Cloudflare D1 SQL] Verificando e criando tabelas SQL...");
    await executeD1(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        original_price REAL,
        image TEXT,
        category TEXT,
        subCategory1 TEXT,
        subCategory2 TEXT,
        featured INTEGER DEFAULT 0,
        stock INTEGER DEFAULT 0,
        sku TEXT
      );
    `);

    await executeD1(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        parentId TEXT,
        isBrand INTEGER DEFAULT 0
      );
    `);

    await executeD1(`
      CREATE TABLE IF NOT EXISTS banners (
        id TEXT PRIMARY KEY,
        image TEXT NOT NULL,
        title TEXT,
        subtitle TEXT,
        cta TEXT,
        active INTEGER DEFAULT 1,
        device TEXT DEFAULT 'all',
        opacity INTEGER DEFAULT 100
      );
    `);

    await executeD1(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    console.log("[Cloudflare D1 SQL] Tabelas SQL (products, categories, banners, settings) prontas!");

    const existingProducts = await executeD1("SELECT COUNT(*) as count FROM products;");
    if (existingProducts?.[0]?.count === 0) {
      console.log("[Cloudflare D1 SQL] Semeadura inicial com dados padrão...");
      for (const p of DEFAULT_DB.products) {
        await executeD1(
          `INSERT OR REPLACE INTO products (id, name, description, price, original_price, image, category, subCategory1, subCategory2, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.id, p.name, p.description || "", p.price, p.original_price || null, p.image, p.category, p.subCategory1 || null, p.subCategory2 || null, p.featured ? 1 : 0]
        );
      }
      for (const c of DEFAULT_DB.categories) {
        await executeD1(
          `INSERT OR REPLACE INTO categories (id, name, slug, parentId, isBrand) VALUES (?, ?, ?, ?, ?)`,
          [c.id, c.name, c.slug, c.parentId || null, c.isBrand ? 1 : 0]
        );
      }
      for (const b of DEFAULT_DB.banners) {
        await executeD1(
          `INSERT OR REPLACE INTO banners (id, image, title, subtitle, cta, active, device, opacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [b.id, b.image, b.title, b.subtitle, b.cta, b.active ? 1 : 0, b.device, b.opacity]
        );
      }
      for (const s of DEFAULT_DB.settings) {
        await executeD1(
          `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
          [s.key, s.value]
        );
      }
      console.log("[Cloudflare D1 SQL] Dados padrão gravados no D1!");
    }
  } catch (err: any) {
    console.warn("[Cloudflare D1 Schema Init Warning]", err.message || err);
  }
}

async function syncDbToCloudflare(dbData: JsonDatabase) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (isCloudflareD1Configured()) {
    try {
      for (const p of dbData.products) {
        await executeD1(
          `INSERT OR REPLACE INTO products (id, name, description, price, original_price, image, category, subCategory1, subCategory2, featured, stock, sku) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.id, p.name, p.description || "", p.price, p.original_price || null, p.image, p.category, p.subCategory1 || null, p.subCategory2 || null, p.featured ? 1 : 0, p.stock ?? null, p.sku || null]
        );
      }
      for (const c of dbData.categories) {
        await executeD1(
          `INSERT OR REPLACE INTO categories (id, name, slug, parentId, isBrand) VALUES (?, ?, ?, ?, ?)`,
          [c.id, c.name, c.slug, c.parentId || null, c.isBrand ? 1 : 0]
        );
      }
      for (const b of dbData.banners) {
        await executeD1(
          `INSERT OR REPLACE INTO banners (id, image, title, subtitle, cta, active, device, opacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [b.id, b.image, b.title, b.subtitle, b.cta, b.active ? 1 : 0, b.device, b.opacity]
        );
      }
      for (const s of dbData.settings) {
        await executeD1(
          `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
          [s.key, s.value]
        );
      }
      console.log("[Cloudflare D1 SQL] Sincronização de tabelas SQL concluída!");
    } catch (err: any) {
      console.warn("[Cloudflare D1 SQL Sync Notice]", err?.message || err);
    }
  } else if (isCloudflareKVConfigured()) {
    const kvId = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
    const jsonString = JSON.stringify(dbData);
    try {
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/database`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: jsonString,
        }
      );
      console.log("[Cloudflare KV] Database sync completed!");
    } catch (err: any) {
      console.warn("[Cloudflare KV Sync Notice]", err?.message || err);
    }
  }
}

async function loadDbFromCloudflare(): Promise<JsonDatabase | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (isCloudflareD1Configured()) {
    const d1Id = process.env.CLOUDFLARE_D1_DATABASE_ID;
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${d1Id}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sql: "SELECT json_data FROM store_data WHERE key = 'database';",
          }),
        }
      );
      const data: any = await res.json();
      if (data?.result?.[0]?.results?.[0]?.json_data) {
        console.log("[Cloudflare D1] Database successfully loaded from Cloudflare!");
        return JSON.parse(data.result[0].results[0].json_data);
      }
    } catch (err: any) {
      console.warn("[Cloudflare D1 Load Notice]", err?.message || err);
    }
  } else if (isCloudflareKVConfigured()) {
    const kvId = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/database`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (res.ok) {
        const text = await res.text();
        console.log("[Cloudflare KV] Database successfully loaded from Cloudflare!");
        return JSON.parse(text);
      }
    } catch (err: any) {
      console.warn("[Cloudflare KV Load Notice]", err?.message || err);
    }
  }

  return null;
}


interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image: string;
  category: string;
  subCategory1?: string;
  subCategory2?: string;
  categories?: string[];
  brand?: string;
  featured?: boolean;
  sku?: string;
  stock?: number;
  expirationDate?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  isBrand?: boolean;
}

interface Banner {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  cta: string;
  active: boolean;
  device?: string;
  opacity?: number;
}

interface Setting {
  key: string;
  value: string;
}

interface JsonDatabase {
  products: Product[];
  categories: Category[];
  banners: Banner[];
  settings: Setting[];
}

const DEFAULT_DB: JsonDatabase = {
  categories: [
    { id: "10", name: "Perfumaria", slug: "perfumaria" },
    { id: "1", name: "Masculino", slug: "masculino", parentId: "10" },
    { id: "2", name: "Feminino", slug: "feminino", parentId: "10" },
    { id: "11", name: "Floral", slug: "floral", parentId: "10" },
    { id: "3", name: "Unissex", slug: "unissex" },
    { id: "4", name: "Importados", slug: "importados" },
    { id: "5", name: "Nacionais", slug: "nacionais" }
  ],
  banners: [
    {
      id: "1",
      image: "/assets/banner-1.jpg",
      title: "Novas Fragrâncias",
      subtitle: "Descubra nossa coleção exclusiva de perfumes importados",
      cta: "Ver Coleção",
      active: true
    },
    {
      id: "2",
      image: "/assets/banner-2.jpg",
      title: "Promoção Especial",
      subtitle: "Até 30% de desconto em perfumes selecionados",
      cta: "Aproveitar",
      active: true
    }
  ],
  products: [
    {
      id: "1",
      name: "Eau de Parfum Royal",
      description: "Fragráncia sofisticada com notas de sândalo, âmbar e baunilha para ocasiões especiais.",
      price: 189.90,
      image: "/assets/perfume-1.jpg",
      category: "masculino",
      featured: true,
      sku: "ROYAL-001",
      stock: 25,
      expirationDate: "2027-12-15"
    },
    {
      id: "2",
      name: "Floral Essence",
      description: "Perfume delicado com essência de rosas, jasmim e um toque de almíscar branco.",
      price: 159.90,
      image: "/assets/perfume-2.jpg",
      category: "feminino",
      featured: true,
      sku: "FLORAL-002",
      stock: 3,
      expirationDate: "2026-07-20"
    },
    {
      id: "3",
      name: "Night Oud Intense",
      description: "Oud autêntico combinado com especiarias orientais. Intenso e marcante para noites.",
      price: 249.90,
      image: "/assets/perfume-3.jpg",
      category: "importados",
      featured: true,
      sku: "OUD-003",
      stock: 12,
      expirationDate: "2026-06-15"
    },
    {
      id: "4",
      name: "Fresh Citrus",
      description: "Frescor cítrico com bergamota, limão siciliano e notas aquáticas revigorantes.",
      price: 119.90,
      image: "/assets/perfume-4.jpg",
      category: "unissex",
      featured: false,
      sku: "CITRUS-004",
      stock: 50,
      expirationDate: "2028-03-10"
    },
    {
      id: "5",
      name: "Velvet Rose",
      description: "Rosa aveludada com peônia e um fundo cremoso de musk. Elegância feminina pura.",
      price: 199.90,
      image: "/assets/perfume-5.jpg",
      category: "feminino",
      featured: true,
      sku: "ROSE-005",
      stock: 8,
      expirationDate: "2026-08-01"
    },
    {
      id: "6",
      name: "Âmbar Dourado",
      description: "Âmbar quente com baunilha, canela e resinas preciosas. Caloroso e envolvente.",
      price: 139.90,
      image: "/assets/perfume-6.jpg",
      category: "nacionais",
      featured: false,
      sku: "AMBAR-006",
      stock: 14,
      expirationDate: "2027-05-20"
    },
    {
      id: "7",
      name: "Brisa do Mar",
      description: "Notas marinhas com sal, algas e madeira flutuante. Frescor natural e leve.",
      price: 99.90,
      image: "/assets/perfume-7.jpg",
      category: "unissex",
      featured: false,
      sku: "BRISA-007",
      stock: 4,
      expirationDate: "2026-07-10"
    },
    {
      id: "8",
      name: "Black Leather",
      description: "Couro, tabaco e café numa composição audaciosa. Para homens de personalidade forte.",
      price: 219.90,
      image: "/assets/perfume-8.jpg",
      category: "masculino",
      featured: true,
      sku: "LEATHER-008",
      stock: 19,
      expirationDate: "2027-11-30"
    }
  ],
  settings: [
    { key: "storeName", value: "JR Perfumaria" },
    { key: "whatsappNumber", value: "5581987654321" },
    { key: "logoUrl", value: "/assets/logo.png" },
    { key: "description", value: "A sua perfumaria de confiança com as melhores fragrâncias nacionais e importadas." },
    { key: "email", value: "contato@jrperfumaria.com" },
    { key: "whatsappDisplay", value: "(81) 98765-4321" },
    { key: "copyright", value: "© 2026 JR Perfumaria. Todos os direitos reservados." }
  ]
};

// Helper functions to read/write JSON Database
function readDb(): JsonDatabase {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
      return DEFAULT_DB;
    }
    const data = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading db.json, falling back to default:", error);
    return DEFAULT_DB;
  }
}

function writeDb(data: JsonDatabase) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
    syncDbToCloudflare(data).catch((e) => console.warn("Cloudflare background sync warning:", e));
  } catch (error) {
    console.error("Error writing db.json:", error);
  }
}

// Global middlewares
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));

// Logger middleware for debugging
app.use((req, res, next) => {
  console.log(`[API Request] ${req.method} ${req.url}`);
  next();
});

// -----------------------------------------------------------------------------
// API ENDPOINTS
// -----------------------------------------------------------------------------

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Cloudflare status
app.get("/api/cloudflare/status", async (req, res) => {
  const r2Ok = isCloudflareR2Configured();
  const d1Ok = isCloudflareD1Configured();
  const kvOk = isCloudflareKVConfigured();

  let d1Working = false;
  let d1Error = "";

  if (d1Ok) {
    try {
      await executeD1("SELECT 1;");
      d1Working = true;
    } catch (err: any) {
      d1Error = err.message || "Falha na conexão com D1 API";
    }
  }

  res.json({
    configured: r2Ok || d1Ok || kvOk,
    r2: {
      configured: r2Ok,
      bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME || "",
      publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || "",
    },
    d1: {
      configured: d1Ok,
      working: d1Working,
      databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID || "",
      error: d1Error,
    },
    kv: {
      configured: kvOk,
      namespaceId: process.env.CLOUDFLARE_KV_NAMESPACE_ID || "",
    },
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ? "****" + process.env.CLOUDFLARE_ACCOUNT_ID.slice(-4) : "",
  });
});

// Initialize Cloudflare D1 Schema & Sync Data
app.post("/api/cloudflare/init-d1", async (req, res) => {
  if (!isCloudflareD1Configured()) {
    return res.status(400).json({
      error: "Cloudflare D1 não configurado no .env (requer CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN e CLOUDFLARE_D1_DATABASE_ID)."
    });
  }
  try {
    await initD1Schema();
    const db = readDb();
    await syncDbToCloudflare(db);
    res.json({ ok: true, message: "Tabelas no Cloudflare D1 criadas e sincronizadas com sucesso!" });
  } catch (err: any) {
    console.error("[Init D1 Endpoint Error]", err);
    res.status(500).json({ error: err.message || "Falha ao criar tabelas no Cloudflare D1." });
  }
});

// Import/Pull all records from Cloudflare D1 into local DB
app.post("/api/cloudflare/pull-from-d1", async (req, res) => {
  if (!isCloudflareD1Configured()) {
    return res.status(400).json({
      error: "Cloudflare D1 não está configurado nas variáveis do .env."
    });
  }

  try {
    const productsRows = await executeD1("SELECT * FROM products;");
    const categoriesRows = await executeD1("SELECT * FROM categories;");
    const bannersRows = await executeD1("SELECT * FROM banners;");
    const settingsRows = await executeD1("SELECT * FROM settings;");

    const db = readDb();

    if (Array.isArray(productsRows) && productsRows.length > 0) {
      db.products = productsRows.map((r: any) => ({
        id: String(r.id),
        name: String(r.name || ""),
        description: String(r.description || ""),
        price: Number(r.price) || 0,
        original_price: r.original_price ? Number(r.original_price) : undefined,
        image: String(r.image || ""),
        category: String(r.category || ""),
        subCategory1: r.subCategory1 ? String(r.subCategory1) : undefined,
        subCategory2: r.subCategory2 ? String(r.subCategory2) : undefined,
        featured: Boolean(r.featured),
        stock: r.stock !== null && r.stock !== undefined ? Number(r.stock) : undefined,
        sku: r.sku ? String(r.sku) : undefined
      }));
    }

    if (Array.isArray(categoriesRows) && categoriesRows.length > 0) {
      db.categories = categoriesRows.map((r: any) => ({
        id: String(r.id),
        name: String(r.name || ""),
        slug: String(r.slug || ""),
        parentId: r.parentId ? String(r.parentId) : undefined,
        isBrand: Boolean(r.isBrand)
      }));
    }

    if (Array.isArray(bannersRows) && bannersRows.length > 0) {
      db.banners = bannersRows.map((r: any) => ({
        id: String(r.id),
        image: String(r.image || ""),
        title: r.title ? String(r.title) : undefined,
        subtitle: r.subtitle ? String(r.subtitle) : undefined,
        cta: r.cta ? String(r.cta) : undefined,
        active: Boolean(r.active ?? true),
        device: (r.device || "all") as any,
        opacity: Number(r.opacity ?? 100)
      }));
    }

    if (Array.isArray(settingsRows) && settingsRows.length > 0) {
      db.settings = settingsRows.map((r: any) => ({
        key: String(r.key || ""),
        value: String(r.value || "")
      }));
    }

    writeDb(db);

    return res.json({
      ok: true,
      message: `Dados importados do Cloudflare D1 com sucesso! (${productsRows.length} produtos, ${categoriesRows.length} categorias, ${bannersRows.length} banners).`,
      counts: {
        products: productsRows.length,
        categories: categoriesRows.length,
        banners: bannersRows.length
      }
    });
  } catch (err: any) {
    console.error("[Pull from D1 Error]", err);
    return res.status(500).json({
      error: err.message || "Erro ao puxar dados do Cloudflare D1."
    });
  }
});

// Upload endpoint
app.post("/api/upload", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      console.error("[Upload Error]", err);
      return res.status(400).json({ error: err.message || "Erro ao realizar o upload." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    if (isCloudflareR2Configured()) {
      try {
        console.log(`[Cloudflare R2] Uploading ${req.file.filename}...`);
        const r2Url = await uploadToCloudflareR2(req.file.path, req.file.filename, req.file.mimetype);
        console.log(`[Cloudflare R2] Upload success: ${r2Url}`);
        return res.json({ url: r2Url, filename: req.file.filename, storage: "cloudflare_r2" });
      } catch (r2Err: any) {
        console.error("[Cloudflare R2 Upload Error, falling back to local]", r2Err);
      }
    }

    const url = `/uploads/${req.file.filename}`;
    res.json({ url, filename: req.file.filename, storage: "local" });
  });
});

// --- PRODUCTS ---
app.get("/api/products", async (req, res) => {
  if (isCloudflareD1Configured()) {
    try {
      const rows = await executeD1("SELECT * FROM products;");
      const products = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description || "",
        price: Number(r.price) || 0,
        original_price: r.original_price ? Number(r.original_price) : undefined,
        image: r.image || "",
        category: r.category || "",
        subCategory1: r.subCategory1 || undefined,
        subCategory2: r.subCategory2 || undefined,
        featured: Boolean(r.featured),
        stock: r.stock !== null && r.stock !== undefined ? Number(r.stock) : undefined,
        sku: r.sku || undefined
      }));
      return res.json(products);
    } catch (err: any) {
      console.warn("[D1 Get Products Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }
  const db = readDb();
  res.json(db.products);
});

app.post("/api/products", async (req, res) => {
  const productData = req.body;
  const newProduct: Product = {
    ...productData,
    id: productData.id || crypto.randomUUID(),
    price: Number(productData.price) || 0,
    original_price: productData.original_price ? Number(productData.original_price) : undefined,
    featured: !!productData.featured
  };

  if (isCloudflareD1Configured()) {
    try {
      await executeD1(
        `INSERT OR REPLACE INTO products (id, name, description, price, original_price, image, category, subCategory1, subCategory2, featured, stock, sku) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newProduct.id,
          newProduct.name,
          newProduct.description || "",
          newProduct.price,
          newProduct.original_price || null,
          newProduct.image || "",
          newProduct.category || "",
          newProduct.subCategory1 || null,
          newProduct.subCategory2 || null,
          newProduct.featured ? 1 : 0,
          newProduct.stock ?? null,
          newProduct.sku || null
        ]
      );
    } catch (err: any) {
      console.warn("[D1 Insert Product Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }

  const db = readDb();
  db.products = db.products.filter(p => p.id !== newProduct.id);
  db.products.push(newProduct);
  writeDb(db);
  res.json([newProduct]);
});

app.patch("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const db = readDb();
  const index = db.products.findIndex(p => p.id === id);
  let updated: Product;

  if (index !== -1) {
    db.products[index] = {
      ...db.products[index],
      ...updates,
      price: updates.price !== undefined ? Number(updates.price) : db.products[index].price,
      original_price: updates.original_price !== undefined ? (updates.original_price ? Number(updates.original_price) : undefined) : db.products[index].original_price,
      featured: updates.featured !== undefined ? !!updates.featured : db.products[index].featured
    };
    updated = db.products[index];
    writeDb(db);
  } else {
    updated = {
      id,
      name: updates.name || "",
      description: updates.description || "",
      price: Number(updates.price) || 0,
      image: updates.image || "",
      category: updates.category || "",
      ...updates
    };
  }

  if (isCloudflareD1Configured()) {
    try {
      await executeD1(
        `INSERT OR REPLACE INTO products (id, name, description, price, original_price, image, category, subCategory1, subCategory2, featured, stock, sku) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          updated.id,
          updated.name,
          updated.description || "",
          updated.price,
          updated.original_price || null,
          updated.image || "",
          updated.category || "",
          updated.subCategory1 || null,
          updated.subCategory2 || null,
          updated.featured ? 1 : 0,
          updated.stock ?? null,
          updated.sku || null
        ]
      );
    } catch (err: any) {
      console.warn("[D1 Update Product Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }

  res.json([updated]);
});

app.delete("/api/products/:id", async (req, res) => {
  const { id } = req.params;

  if (isCloudflareD1Configured()) {
    try {
      await executeD1("DELETE FROM products WHERE id = ?;", [id]);
    } catch (err: any) {
      console.warn("[D1 Delete Product Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }

  const db = readDb();
  db.products = db.products.filter(p => p.id !== id);
  writeDb(db);
  res.json({ ok: true });
});

// --- CATEGORIES ---
app.get("/api/categories", async (req, res) => {
  if (isCloudflareD1Configured()) {
    try {
      const rows = await executeD1("SELECT * FROM categories;");
      const categories = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        parentId: r.parentId || undefined,
        isBrand: Boolean(r.isBrand)
      }));
      return res.json(categories);
    } catch (err: any) {
      console.warn("[D1 Get Categories Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }
  const db = readDb();
  res.json(db.categories);
});

app.post("/api/categories", async (req, res) => {
  const { name, slug, parentId, isBrand } = req.body;
  const toSlug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const finalSlug = slug || toSlug(name || "categoria");

  const newCategory: Category = {
    id: req.body.id || crypto.randomUUID(),
    name,
    slug: finalSlug,
    parentId: parentId || undefined,
    isBrand: !!isBrand
  };

  if (isCloudflareD1Configured()) {
    try {
      await executeD1(
        `INSERT OR REPLACE INTO categories (id, name, slug, parentId, isBrand) VALUES (?, ?, ?, ?, ?)`,
        [newCategory.id, newCategory.name, newCategory.slug, newCategory.parentId || null, newCategory.isBrand ? 1 : 0]
      );
    } catch (err: any) {
      console.warn("[D1 Insert Category Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }

  const db = readDb();
  db.categories.push(newCategory);
  writeDb(db);
  res.json([newCategory]);
});

app.patch("/api/categories/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const db = readDb();
  const index = db.categories.findIndex(c => c.id === id);

  const toSlug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  
  let updated: Category;
  if (index !== -1) {
    const name = updates.name !== undefined ? updates.name : db.categories[index].name;
    const slug = updates.slug !== undefined ? updates.slug : (updates.name ? toSlug(updates.name) : db.categories[index].slug);
    const parentId = updates.parentId !== undefined ? updates.parentId : db.categories[index].parentId;
    const isBrand = updates.isBrand !== undefined ? !!updates.isBrand : db.categories[index].isBrand;

    db.categories[index] = {
      ...db.categories[index],
      name,
      slug,
      parentId: parentId || undefined,
      isBrand
    };
    updated = db.categories[index];
    writeDb(db);
  } else {
    updated = {
      id,
      name: updates.name || "Categoria",
      slug: updates.slug || toSlug(updates.name || "categoria"),
      parentId: updates.parentId || undefined,
      isBrand: !!updates.isBrand
    };
  }

  if (isCloudflareD1Configured()) {
    try {
      await executeD1(
        `INSERT OR REPLACE INTO categories (id, name, slug, parentId, isBrand) VALUES (?, ?, ?, ?, ?)`,
        [updated.id, updated.name, updated.slug, updated.parentId || null, updated.isBrand ? 1 : 0]
      );
    } catch (err: any) {
      console.warn("[D1 Update Category Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }

  res.json([updated]);
});

app.delete("/api/categories/:id", async (req, res) => {
  const { id } = req.params;

  if (isCloudflareD1Configured()) {
    try {
      await executeD1("DELETE FROM categories WHERE id = ?;", [id]);
    } catch (err: any) {
      console.warn("[D1 Delete Category Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }

  const db = readDb();
  db.categories = db.categories.filter(c => c.id !== id);
  writeDb(db);
  res.json({ ok: true });
});

// --- BANNERS ---
app.get("/api/banners", async (req, res) => {
  if (isCloudflareD1Configured()) {
    try {
      const rows = await executeD1("SELECT * FROM banners;");
      const banners = rows.map((r: any) => ({
        id: r.id,
        image: r.image,
        title: r.title || "",
        subtitle: r.subtitle || "",
        cta: r.cta || "",
        active: Boolean(r.active),
        device: r.device || "all",
        opacity: r.opacity !== null && r.opacity !== undefined ? Number(r.opacity) : 100
      }));
      return res.json(banners);
    } catch (err: any) {
      console.warn("[D1 Get Banners Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }
  const db = readDb();
  res.json(db.banners);
});

app.post("/api/banners", async (req, res) => {
  const bannerData = req.body;
  const newBanner: Banner = {
    id: bannerData.id || crypto.randomUUID(),
    image: bannerData.image || "",
    title: bannerData.title || "",
    subtitle: bannerData.subtitle || "",
    cta: bannerData.cta || "",
    active: bannerData.active !== undefined ? !!bannerData.active : true,
    device: bannerData.device || "all",
    opacity: bannerData.opacity !== undefined ? Number(bannerData.opacity) : 100
  };

  if (isCloudflareD1Configured()) {
    try {
      await executeD1(
        `INSERT OR REPLACE INTO banners (id, image, title, subtitle, cta, active, device, opacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newBanner.id, newBanner.image, newBanner.title, newBanner.subtitle, newBanner.cta, newBanner.active ? 1 : 0, newBanner.device, newBanner.opacity]
      );
    } catch (err: any) {
      console.warn("[D1 Insert Banner Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }

  const db = readDb();
  db.banners.push(newBanner);
  writeDb(db);
  res.json([newBanner]);
});

app.patch("/api/banners/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const db = readDb();
  const index = db.banners.findIndex(b => b.id === id);

  let updated: Banner;
  if (index !== -1) {
    db.banners[index] = {
      ...db.banners[index],
      ...updates,
      active: updates.active !== undefined ? !!updates.active : db.banners[index].active,
      opacity: updates.opacity !== undefined ? Number(updates.opacity) : db.banners[index].opacity
    };
    updated = db.banners[index];
    writeDb(db);
  } else {
    updated = {
      id,
      image: updates.image || "",
      title: updates.title || "",
      subtitle: updates.subtitle || "",
      cta: updates.cta || "",
      active: updates.active !== undefined ? !!updates.active : true,
      device: updates.device || "all",
      opacity: updates.opacity !== undefined ? Number(updates.opacity) : 100
    };
  }

  if (isCloudflareD1Configured()) {
    try {
      await executeD1(
        `INSERT OR REPLACE INTO banners (id, image, title, subtitle, cta, active, device, opacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [updated.id, updated.image, updated.title, updated.subtitle, updated.cta, updated.active ? 1 : 0, updated.device, updated.opacity]
      );
    } catch (err: any) {
      console.warn("[D1 Update Banner Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }

  res.json([updated]);
});

app.delete("/api/banners/:id", async (req, res) => {
  const { id } = req.params;

  if (isCloudflareD1Configured()) {
    try {
      await executeD1("DELETE FROM banners WHERE id = ?;", [id]);
    } catch (err: any) {
      console.warn("[D1 Delete Banner Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }

  const db = readDb();
  db.banners = db.banners.filter(b => b.id !== id);
  writeDb(db);
  res.json({ ok: true });
});

// --- SETTINGS ---
app.get("/api/settings", async (req, res) => {
  if (isCloudflareD1Configured()) {
    try {
      const rows = await executeD1("SELECT * FROM settings;");
      if (rows && rows.length > 0) {
        const settings = rows.map((r: any) => ({
          key: r.key,
          value: r.value
        }));
        return res.json(settings);
      }
    } catch (err: any) {
      console.warn("[D1 Get Settings Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }
  const db = readDb();
  res.json(db.settings);
});

app.post("/api/settings", async (req, res) => {
  const { key, value } = req.body;

  if (isCloudflareD1Configured()) {
    try {
      await executeD1(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        [key, value]
      );
    } catch (err: any) {
      console.warn("[D1 Insert Setting Notice] D1 não acessível. Usando banco de dados local:", err?.message || err);
    }
  }

  const db = readDb();
  const index = db.settings.findIndex(s => s.key === key);
  if (index !== -1) {
    db.settings[index].value = value;
  } else {
    db.settings.push({ key, value });
  }
  writeDb(db);
  res.json(db.settings);
});

// Error handling middleware for API routes to ensure JSON format
app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[API Error]", err);
  res.status(err.status || 500).json({
    error: err.message || "Ocorreu um erro interno no servidor."
  });
});

// -----------------------------------------------------------------------------
// VITE OR STATIC SERVING MIDDLEWARE
// -----------------------------------------------------------------------------

async function startServer() {
  if (isCloudflareD1Configured()) {
    await initD1Schema();
  } else {
    try {
      const cloudflareData = await loadDbFromCloudflare();
      if (cloudflareData && Array.isArray(cloudflareData.products)) {
        writeDb(cloudflareData);
        console.log("[Cloudflare] Successfully loaded and restored database state from Cloudflare on startup.");
      }
    } catch (err: any) {
      console.warn("[Cloudflare Startup Load Notice]", err?.message || err);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database initialized at ${DB_PATH}`);
  });
}

startServer();
