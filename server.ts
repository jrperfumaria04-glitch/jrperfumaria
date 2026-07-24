import "dotenv/config";
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

// -----------------------------------------------------------------------------
// CLOUDFLARE INTEGRATION (R2 Object Storage & D1 Database)
//
// This store uses Cloudflare D1 as the SINGLE source of truth. There is no
// local JSON database anymore — every read/write goes straight to D1.
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
    (process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY) &&
    process.env.CLOUDFLARE_D1_DATABASE_ID
  );
}

const D1_NOT_CONFIGURED_MESSAGE =
  "Cloudflare D1 não está configurado. Defina CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN e CLOUDFLARE_D1_DATABASE_ID no arquivo .env para que a loja funcione.";

async function executeD1(sql: string, params: any[] = []): Promise<any[]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY;
  const d1Id = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const email = process.env.CLOUDFLARE_AUTH_EMAIL || process.env.CLOUDFLARE_EMAIL;

  if (!accountId || !token || !d1Id) {
    throw new Error(D1_NOT_CONFIGURED_MESSAGE);
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
        "Erro de Autenticação na API do Cloudflare D1: O token 'CLOUDFLARE_API_TOKEN' não possui a permissão 'Account -> D1 -> Edit' ou as credenciais estão incorretas. Verifique seu API Token."
      );
    }
    throw new Error(rawErr);
  }

  return json.result?.[0]?.results || [];
}

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

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
  overlayOpacity?: number;
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

// Default catalog used ONLY to seed an empty Cloudflare D1 database.
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

// -----------------------------------------------------------------------------
// D1 SCHEMA, MIGRATION & SEED
// -----------------------------------------------------------------------------

async function createD1Tables() {
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
      sku TEXT,
      brand TEXT,
      categories TEXT,
      expirationDate TEXT
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
      opacity INTEGER DEFAULT 100,
      overlayOpacity INTEGER DEFAULT 60
    );
  `);

  await executeD1(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

// Idempotent migrations for D1 databases created before extra columns existed.
async function migrateD1Schema() {
  const migrations = [
    "ALTER TABLE products ADD COLUMN brand TEXT;",
    "ALTER TABLE products ADD COLUMN categories TEXT;",
    "ALTER TABLE products ADD COLUMN expirationDate TEXT;",
    "ALTER TABLE banners ADD COLUMN overlayOpacity INTEGER DEFAULT 60;",
  ];
  for (const sql of migrations) {
    try {
      await executeD1(sql);
    } catch (err: any) {
      const msg = String(err?.message || err).toLowerCase();
      // "duplicate column name" simply means the migration already ran.
      if (!msg.includes("duplicate column")) {
        console.warn("[D1 Migration Notice]", err?.message || err);
      }
    }
  }
}

// Insert the default catalog. Uses INSERT OR IGNORE so it never overwrites
// data that already exists in D1 (only fills in what is missing).
async function seedDefaultsToD1() {
  for (const p of DEFAULT_DB.products) {
    await executeD1(
      `INSERT OR IGNORE INTO products (id, name, description, price, original_price, image, category, subCategory1, subCategory2, featured, stock, sku, brand, categories, expirationDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.name, p.description || "", p.price, p.original_price ?? null, p.image || "", p.category || "", p.subCategory1 || null, p.subCategory2 || null, p.featured ? 1 : 0, p.stock ?? null, p.sku || null, p.brand || null, p.categories && p.categories.length ? JSON.stringify(p.categories) : null, p.expirationDate || null]
    );
  }
  for (const c of DEFAULT_DB.categories) {
    await executeD1(
      `INSERT OR IGNORE INTO categories (id, name, slug, parentId, isBrand) VALUES (?, ?, ?, ?, ?)`,
      [c.id, c.name, c.slug, c.parentId || null, c.isBrand ? 1 : 0]
    );
  }
  for (const b of DEFAULT_DB.banners) {
    await executeD1(
      `INSERT OR IGNORE INTO banners (id, image, title, subtitle, cta, active, device, opacity, overlayOpacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.id, b.image, b.title, b.subtitle, b.cta, b.active ? 1 : 0, b.device || "all", b.opacity ?? 100, b.overlayOpacity ?? 60]
    );
  }
  for (const s of DEFAULT_DB.settings) {
    await executeD1(
      `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
      [s.key, s.value]
    );
  }
}

async function initD1Schema() {
  if (!isCloudflareD1Configured()) return;
  console.log("[Cloudflare D1] Verificando e criando tabelas SQL...");
  await createD1Tables();
  await migrateD1Schema();
  console.log("[Cloudflare D1] Tabelas (products, categories, banners, settings) prontas!");

  const existingProducts = await executeD1("SELECT COUNT(*) as count FROM products;");
  if (existingProducts?.[0]?.count === 0) {
    console.log("[Cloudflare D1] Banco vazio — semeando catálogo padrão...");
    await seedDefaultsToD1();
    console.log("[Cloudflare D1] Catálogo padrão gravado no D1!");
  }
}

// -----------------------------------------------------------------------------
// ROW <-> OBJECT MAPPERS + D1 HELPERS
// -----------------------------------------------------------------------------

function safeParseArray(value: any): string[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : undefined;
  } catch {
    return undefined;
  }
}

function mapProductRow(r: any): Product {
  return {
    id: String(r.id),
    name: r.name || "",
    description: r.description || "",
    price: Number(r.price) || 0,
    original_price: r.original_price !== null && r.original_price !== undefined ? Number(r.original_price) : undefined,
    image: r.image || "",
    category: r.category || "",
    subCategory1: r.subCategory1 || undefined,
    subCategory2: r.subCategory2 || undefined,
    categories: safeParseArray(r.categories),
    brand: r.brand || undefined,
    featured: Boolean(r.featured),
    sku: r.sku || undefined,
    stock: r.stock !== null && r.stock !== undefined ? Number(r.stock) : undefined,
    expirationDate: r.expirationDate || undefined,
  };
}

function mapCategoryRow(r: any): Category {
  return {
    id: String(r.id),
    name: r.name || "",
    slug: r.slug || "",
    parentId: r.parentId || undefined,
    isBrand: Boolean(r.isBrand),
  };
}

function mapBannerRow(r: any): Banner {
  return {
    id: String(r.id),
    image: r.image || "",
    title: r.title || "",
    subtitle: r.subtitle || "",
    cta: r.cta || "",
    active: Boolean(r.active),
    device: r.device || "all",
    opacity: r.opacity !== null && r.opacity !== undefined ? Number(r.opacity) : 100,
    overlayOpacity: r.overlayOpacity !== null && r.overlayOpacity !== undefined ? Number(r.overlayOpacity) : 60,
  };
}

async function upsertProduct(p: Product) {
  await executeD1(
    `INSERT OR REPLACE INTO products (id, name, description, price, original_price, image, category, subCategory1, subCategory2, featured, stock, sku, brand, categories, expirationDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.id,
      p.name,
      p.description || "",
      p.price,
      p.original_price ?? null,
      p.image || "",
      p.category || "",
      p.subCategory1 || null,
      p.subCategory2 || null,
      p.featured ? 1 : 0,
      p.stock ?? null,
      p.sku || null,
      p.brand || null,
      p.categories && p.categories.length ? JSON.stringify(p.categories) : null,
      p.expirationDate || null,
    ]
  );
}

async function getProductById(id: string): Promise<Product | null> {
  const rows = await executeD1("SELECT * FROM products WHERE id = ?;", [id]);
  return rows?.[0] ? mapProductRow(rows[0]) : null;
}

// Gera o próximo id sequencial de produto no formato "p-<n>", continuando a
// partir do maior número já existente (aceita "8" ou "p-105"). IDs que não são
// numéricos (ex: UUIDs antigos) são ignorados no cálculo.
async function nextProductId(): Promise<string> {
  const rows = await executeD1("SELECT id FROM products;");
  let max = 0;
  for (const r of rows) {
    const match = String(r.id).match(/^(?:p-)?(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `p-${max + 1}`;
}

async function upsertCategory(c: Category) {
  await executeD1(
    `INSERT OR REPLACE INTO categories (id, name, slug, parentId, isBrand) VALUES (?, ?, ?, ?, ?)`,
    [c.id, c.name, c.slug, c.parentId || null, c.isBrand ? 1 : 0]
  );
}

async function getCategoryById(id: string): Promise<Category | null> {
  const rows = await executeD1("SELECT * FROM categories WHERE id = ?;", [id]);
  return rows?.[0] ? mapCategoryRow(rows[0]) : null;
}

async function upsertBanner(b: Banner) {
  await executeD1(
    `INSERT OR REPLACE INTO banners (id, image, title, subtitle, cta, active, device, opacity, overlayOpacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.id, b.image, b.title, b.subtitle, b.cta, b.active ? 1 : 0, b.device || "all", b.opacity ?? 100, b.overlayOpacity ?? 60]
  );
}

async function getBannerById(id: string): Promise<Banner | null> {
  const rows = await executeD1("SELECT * FROM banners WHERE id = ?;", [id]);
  return rows?.[0] ? mapBannerRow(rows[0]) : null;
}

// Express guard: ensure D1 is configured before touching the database.
function ensureD1(res: express.Response): boolean {
  if (!isCloudflareD1Configured()) {
    res.status(503).json({ error: D1_NOT_CONFIGURED_MESSAGE });
    return false;
  }
  return true;
}

function d1ErrorResponse(res: express.Response, err: any, fallback: string) {
  const message = err?.message || fallback;
  console.error("[D1 Error]", message);
  res.status(500).json({ error: message });
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
    configured: r2Ok || d1Ok,
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
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ? "****" + process.env.CLOUDFLARE_ACCOUNT_ID.slice(-4) : "",
  });
});

// Initialize Cloudflare D1 Schema & seed defaults
app.post("/api/cloudflare/init-d1", async (req, res) => {
  if (!ensureD1(res)) return;
  try {
    await initD1Schema();
    res.json({ ok: true, message: "Tabelas no Cloudflare D1 criadas/atualizadas com sucesso!" });
  } catch (err: any) {
    console.error("[Init D1 Endpoint Error]", err);
    res.status(500).json({ error: err.message || "Falha ao criar tabelas no Cloudflare D1." });
  }
});

// Populate D1 with the default catalog (only inserts rows that are missing).
app.post("/api/cloudflare/push-to-d1", async (req, res) => {
  if (!ensureD1(res)) return;
  try {
    await createD1Tables();
    await migrateD1Schema();
    await seedDefaultsToD1();

    const productsRows = await executeD1("SELECT COUNT(*) as count FROM products;");
    const categoriesRows = await executeD1("SELECT COUNT(*) as count FROM categories;");
    const bannersRows = await executeD1("SELECT COUNT(*) as count FROM banners;");

    return res.json({
      ok: true,
      message: `Catálogo padrão garantido no Cloudflare D1 (itens ausentes inseridos). Total: ${productsRows?.[0]?.count ?? 0} produtos, ${categoriesRows?.[0]?.count ?? 0} categorias, ${bannersRows?.[0]?.count ?? 0} banners.`,
    });
  } catch (err: any) {
    console.error("[Push to D1 Error]", err);
    return res.status(500).json({ error: err.message || "Erro ao popular o Cloudflare D1." });
  }
});

// Report the current record counts stored in Cloudflare D1.
app.post("/api/cloudflare/pull-from-d1", async (req, res) => {
  if (!ensureD1(res)) return;
  try {
    const productsRows = await executeD1("SELECT COUNT(*) as count FROM products;");
    const categoriesRows = await executeD1("SELECT COUNT(*) as count FROM categories;");
    const bannersRows = await executeD1("SELECT COUNT(*) as count FROM banners;");

    const counts = {
      products: Number(productsRows?.[0]?.count ?? 0),
      categories: Number(categoriesRows?.[0]?.count ?? 0),
      banners: Number(bannersRows?.[0]?.count ?? 0),
    };

    return res.json({
      ok: true,
      message: `Dados atuais no Cloudflare D1: ${counts.products} produtos, ${counts.categories} categorias, ${counts.banners} banners.`,
      counts,
    });
  } catch (err: any) {
    console.error("[Pull from D1 Error]", err);
    return res.status(500).json({ error: err.message || "Erro ao consultar o Cloudflare D1." });
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
  if (!ensureD1(res)) return;
  try {
    const rows = await executeD1("SELECT * FROM products;");
    res.json(rows.map(mapProductRow));
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao carregar produtos do Cloudflare D1.");
  }
});

app.post("/api/products", async (req, res) => {
  if (!ensureD1(res)) return;
  const productData = req.body;

  try {
    const id = productData.id || (await nextProductId());
    const newProduct: Product = {
      ...productData,
      id,
      price: Number(productData.price) || 0,
      original_price: productData.original_price ? Number(productData.original_price) : undefined,
      featured: !!productData.featured,
    };
    await upsertProduct(newProduct);
    res.json([newProduct]);
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao salvar produto no Cloudflare D1.");
  }
});

app.patch("/api/products/:id", async (req, res) => {
  if (!ensureD1(res)) return;
  const { id } = req.params;
  const updates = req.body;

  try {
    const existing = await getProductById(id);
    let updated: Product;

    if (existing) {
      updated = {
        ...existing,
        ...updates,
        id,
        price: updates.price !== undefined ? Number(updates.price) : existing.price,
        original_price:
          updates.original_price !== undefined
            ? (updates.original_price ? Number(updates.original_price) : undefined)
            : existing.original_price,
        featured: updates.featured !== undefined ? !!updates.featured : existing.featured,
      };
    } else {
      updated = {
        id,
        name: updates.name || "",
        description: updates.description || "",
        price: Number(updates.price) || 0,
        image: updates.image || "",
        category: updates.category || "",
        ...updates,
        featured: !!updates.featured,
      };
    }

    await upsertProduct(updated);
    res.json([updated]);
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao atualizar produto no Cloudflare D1.");
  }
});

app.delete("/api/products/:id", async (req, res) => {
  if (!ensureD1(res)) return;
  try {
    await executeD1("DELETE FROM products WHERE id = ?;", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao remover produto no Cloudflare D1.");
  }
});

// --- CATEGORIES ---
const toSlug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");

app.get("/api/categories", async (req, res) => {
  if (!ensureD1(res)) return;
  try {
    const rows = await executeD1("SELECT * FROM categories;");
    res.json(rows.map(mapCategoryRow));
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao carregar categorias do Cloudflare D1.");
  }
});

app.post("/api/categories", async (req, res) => {
  if (!ensureD1(res)) return;
  const { name, slug, parentId, isBrand } = req.body;
  const finalSlug = slug || toSlug(name || "categoria");

  const newCategory: Category = {
    id: req.body.id || crypto.randomUUID(),
    name,
    slug: finalSlug,
    parentId: parentId || undefined,
    isBrand: !!isBrand,
  };

  try {
    await upsertCategory(newCategory);
    res.json([newCategory]);
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao salvar categoria no Cloudflare D1.");
  }
});

app.patch("/api/categories/:id", async (req, res) => {
  if (!ensureD1(res)) return;
  const { id } = req.params;
  const updates = req.body;

  try {
    const existing = await getCategoryById(id);
    let updated: Category;

    if (existing) {
      const name = updates.name !== undefined ? updates.name : existing.name;
      const slug = updates.slug !== undefined ? updates.slug : (updates.name ? toSlug(updates.name) : existing.slug);
      const parentId = updates.parentId !== undefined ? updates.parentId : existing.parentId;
      const isBrand = updates.isBrand !== undefined ? !!updates.isBrand : existing.isBrand;

      updated = { ...existing, name, slug, parentId: parentId || undefined, isBrand };
    } else {
      updated = {
        id,
        name: updates.name || "Categoria",
        slug: updates.slug || toSlug(updates.name || "categoria"),
        parentId: updates.parentId || undefined,
        isBrand: !!updates.isBrand,
      };
    }

    await upsertCategory(updated);
    res.json([updated]);
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao atualizar categoria no Cloudflare D1.");
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  if (!ensureD1(res)) return;
  try {
    await executeD1("DELETE FROM categories WHERE id = ?;", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao remover categoria no Cloudflare D1.");
  }
});

// --- BANNERS ---
app.get("/api/banners", async (req, res) => {
  if (!ensureD1(res)) return;
  try {
    const rows = await executeD1("SELECT * FROM banners;");
    res.json(rows.map(mapBannerRow));
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao carregar banners do Cloudflare D1.");
  }
});

app.post("/api/banners", async (req, res) => {
  if (!ensureD1(res)) return;
  const bannerData = req.body;
  const newBanner: Banner = {
    id: bannerData.id || crypto.randomUUID(),
    image: bannerData.image || "",
    title: bannerData.title || "",
    subtitle: bannerData.subtitle || "",
    cta: bannerData.cta || "",
    active: bannerData.active !== undefined ? !!bannerData.active : true,
    device: bannerData.device || "all",
    opacity: bannerData.opacity !== undefined ? Number(bannerData.opacity) : 100,
    overlayOpacity: bannerData.overlayOpacity !== undefined ? Number(bannerData.overlayOpacity) : 60,
  };

  try {
    await upsertBanner(newBanner);
    res.json([newBanner]);
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao salvar banner no Cloudflare D1.");
  }
});

app.patch("/api/banners/:id", async (req, res) => {
  if (!ensureD1(res)) return;
  const { id } = req.params;
  const updates = req.body;

  try {
    const existing = await getBannerById(id);
    let updated: Banner;

    if (existing) {
      updated = {
        ...existing,
        ...updates,
        id,
        active: updates.active !== undefined ? !!updates.active : existing.active,
        opacity: updates.opacity !== undefined ? Number(updates.opacity) : existing.opacity,
        overlayOpacity: updates.overlayOpacity !== undefined ? Number(updates.overlayOpacity) : existing.overlayOpacity,
      };
    } else {
      updated = {
        id,
        image: updates.image || "",
        title: updates.title || "",
        subtitle: updates.subtitle || "",
        cta: updates.cta || "",
        active: updates.active !== undefined ? !!updates.active : true,
        device: updates.device || "all",
        opacity: updates.opacity !== undefined ? Number(updates.opacity) : 100,
        overlayOpacity: updates.overlayOpacity !== undefined ? Number(updates.overlayOpacity) : 60,
      };
    }

    await upsertBanner(updated);
    res.json([updated]);
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao atualizar banner no Cloudflare D1.");
  }
});

app.delete("/api/banners/:id", async (req, res) => {
  if (!ensureD1(res)) return;
  try {
    await executeD1("DELETE FROM banners WHERE id = ?;", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao remover banner no Cloudflare D1.");
  }
});

// --- SETTINGS ---
app.get("/api/settings", async (req, res) => {
  if (!ensureD1(res)) return;
  try {
    const rows = await executeD1("SELECT * FROM settings;");
    res.json(rows.map((r: any) => ({ key: r.key, value: r.value })));
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao carregar configurações do Cloudflare D1.");
  }
});

app.post("/api/settings", async (req, res) => {
  if (!ensureD1(res)) return;
  const { key, value } = req.body;
  try {
    await executeD1(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
    const rows = await executeD1("SELECT * FROM settings;");
    res.json(rows.map((r: any) => ({ key: r.key, value: r.value })));
  } catch (err: any) {
    d1ErrorResponse(res, err, "Erro ao salvar configuração no Cloudflare D1.");
  }
});

// Error handling middleware for API routes to ensure JSON format
app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[API Error]", err);
  res.status(err.status || 500).json({
    error: err.message || "Ocorreu um erro interno no servidor.",
  });
});

// -----------------------------------------------------------------------------
// VITE OR STATIC SERVING MIDDLEWARE
// -----------------------------------------------------------------------------

async function startServer() {
  if (isCloudflareD1Configured()) {
    try {
      await initD1Schema();
    } catch (err: any) {
      console.warn("[Cloudflare D1 Init Warning]", err?.message || err);
    }
  } else {
    console.warn(
      "\n⚠️  " + D1_NOT_CONFIGURED_MESSAGE +
      "\n    Enquanto o D1 não estiver configurado, as rotas da API responderão 503 e a loja ficará sem dados.\n"
    );
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
    console.log(
      isCloudflareD1Configured()
        ? "Fonte de dados: Cloudflare D1"
        : "Fonte de dados: NENHUMA (configure o Cloudflare D1 no .env)"
    );
  });
}

startServer();
