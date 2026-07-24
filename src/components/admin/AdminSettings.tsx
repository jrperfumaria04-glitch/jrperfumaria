import { useState, useRef, useEffect } from "react";
import { useStoreConfig } from "@/contexts/StoreConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Info, Upload, X, Loader2, Cloud, Database, Image as ImageIcon, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { formatWhatsAppNumber } from "@/lib/utils";

interface CloudflareStatus {
  configured: boolean;
  r2: { configured: boolean; bucket: string; publicUrl: string };
  d1: { configured: boolean; working?: boolean; databaseId: string; error?: string };
  kv: { configured: boolean; namespaceId: string };
  accountId: string;
}

const LOGO_SIZES = {
  recommended: "200×60px",
  format: "PNG com fundo transparente",
  maxSize: "10MB",
};

const AdminSettings = () => {
  const { config, updateStoreName, updateLogoUrl, updateWhatsappNumber, updateFooter, updatePromoMessage } = useStoreConfig();

  const [storeName, setStoreName] = useState(config.storeName);
  const [logoUrl, setLogoUrl] = useState(config.logoUrl);
  const [whatsapp, setWhatsapp] = useState(config.whatsappNumber);
  const [promoMessage, setPromoMessage] = useState(config.promoMessage || "");
  const [footer, setFooter] = useState({
    ...config.footer,
    address: config.footer.address || "",
    mapEmbedUrl: config.footer.mapEmbedUrl || "",
    instagramUrl: config.footer.instagramUrl || "",
    facebookUrl: config.footer.facebookUrl || "",
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cfStatus, setCfStatus] = useState<CloudflareStatus | null>(null);
  const [loadingCfStatus, setLoadingCfStatus] = useState(false);
  const [initializingD1, setInitializingD1] = useState(false);
  const [pullingD1, setPullingD1] = useState(false);
  const [pushingD1, setPushingD1] = useState(false);

  const fetchCloudflareStatus = async () => {
    setLoadingCfStatus(true);
    try {
      const res = await fetch("/api/cloudflare/status");
      if (res.ok) {
        const data = await res.json();
        setCfStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch Cloudflare status:", err);
    } finally {
      setLoadingCfStatus(false);
    }
  };

  const handleInitD1 = async () => {
    setInitializingD1(true);
    try {
      const res = await fetch("/api/cloudflare/init-d1", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Tabelas criadas com sucesso no Cloudflare D1!");
        fetchCloudflareStatus();
      } else {
        toast.error(data.error || "Erro ao inicializar tabelas no Cloudflare D1.");
      }
    } catch (err: any) {
      toast.error("Falha ao comunicar com o servidor.");
    } finally {
      setInitializingD1(false);
    }
  };

  const handlePullD1 = async () => {
    setPullingD1(true);
    try {
      const res = await fetch("/api/cloudflare/pull-from-d1", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Dados importados do Cloudflare D1 com sucesso!");
        fetchCloudflareStatus();
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error(data.error || "Erro ao puxar dados do Cloudflare D1.");
      }
    } catch (err: any) {
      toast.error("Falha ao comunicar com o servidor.");
    } finally {
      setPullingD1(false);
    }
  };

  const handlePushD1 = async () => {
    setPushingD1(true);
    try {
      const res = await fetch("/api/cloudflare/push-to-d1", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Dados enviados para o Cloudflare D1 com sucesso!");
        fetchCloudflareStatus();
      } else {
        toast.error(data.error || "Erro ao enviar dados para o Cloudflare D1.");
      }
    } catch (err: any) {
      toast.error("Falha ao comunicar com o servidor.");
    } finally {
      setPushingD1(false);
    }
  };

  const sqlScript = `-- 1. CRIAÇÃO DAS TABELAS
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

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parentId TEXT,
  isBrand INTEGER DEFAULT 0
);

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

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 2. INSERÇÃO DE CATEGORIAS DE TESTE
INSERT OR IGNORE INTO categories (id, name, slug, parentId, isBrand) VALUES
('cat-perfumes', 'Perfumes Importados', 'perfumes-importados', NULL, 0),
('cat-maquiagem', 'Maquiagem & Beleza', 'maquiagem-beleza', NULL, 0),
('cat-corpo', 'Corpo e Banho', 'corpo-e-banho', NULL, 0),
('brand-chanel', 'Chanel', 'chanel', NULL, 1),
('brand-dior', 'Dior', 'dior', NULL, 1);

-- 3. INSERÇÃO DE PRODUTOS GENERICOS DE TESTE
INSERT OR IGNORE INTO products (id, name, description, price, original_price, image, category, subCategory1, subCategory2, featured, stock, sku) VALUES
('p-101', 'Perfume Eau de Parfum Royale 100ml', 'Fragrância marcante e sofisticada com notas amadeiradas e florais de alta fixação.', 289.90, 349.90, 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80', 'cat-perfumes', 'Feminino', 'Eau de Parfum', 1, 50, 'PERF-ROY-100'),
('p-102', 'Batom Liquido Matte Velvet Red', 'Batom líquido de alta cobertura com efeito aveludado e hidratação profunda.', 49.90, 69.90, 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800&q=80', 'cat-maquiagem', 'Lábios', 'Batom', 1, 120, 'BAT-VELVET-RED'),
('p-103', 'Sérum Facial Hidratante Glow 30ml', 'Sérum renovador enriquecido com Ácido Hialurônico e Vitamina C para uma pele radiante.', 89.00, 119.00, 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80', 'cat-maquiagem', 'Skincare', 'Sérum', 0, 80, 'SERUM-GLOW-30'),
('p-104', 'Hidratante Corporal Amêndoas & Baunilha 400ml', 'Creme corporal nutritivo de absorção rápida com fragrância suave de baunilha.', 39.90, 49.90, 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80', 'cat-corpo', 'Hidratantes', 'Corporal', 0, 200, 'HIDRA-CORP-400'),
('p-105', 'Perfume Masculino Deep Noir 100ml', 'Perfume intenso e misterioso com notas de pimenta preta, cedro e bergamota.', 259.00, 319.00, 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=800&q=80', 'cat-perfumes', 'Masculino', 'Eau de Toilette', 1, 40, 'PERF-NOIR-100');`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlScript);
    toast.success("Script SQL copiado para a área de transferência!");
  };

  useEffect(() => {
    fetchCloudflareStatus();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }

    setUploading(true);
    try {
      const result = await api.upload(file);
      setLogoUrl(result.url);
      toast.success("Logo enviada com sucesso!");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao enviar imagem da logo.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = () => {
    const formattedDisplay = formatWhatsAppNumber(whatsapp);
    const updatedFooter = { ...footer, whatsappDisplay: formattedDisplay };

    updateStoreName(storeName);
    updateLogoUrl(logoUrl);
    updateWhatsappNumber(whatsapp);
    updatePromoMessage(promoMessage);
    updateFooter(updatedFooter);
    toast.success("Configurações salvas!");
  };

  return (
    <div className="space-y-8">
      {/* Cloudflare Integration Section */}
      <div className="bg-card p-5 rounded-lg border border-orange-500/20 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                Integração Cloudflare (Banco de Dados & Imagens R2)
              </h3>
              <p className="text-xs text-muted-foreground">
                Armazenamento de imagens (R2) e persistência de produtos/categorias (D1 / KV).
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCloudflareStatus}
            disabled={loadingCfStatus}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingCfStatus ? "animate-spin" : ""}`} />
            Verificar Status
          </Button>
        </div>

        {cfStatus ? (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* R2 Image Storage Status */}
              <div className={`p-3.5 rounded-md border text-sm flex items-start gap-3 ${
                cfStatus.r2.configured 
                  ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-950 dark:text-emerald-200" 
                  : "bg-amber-500/5 border-amber-500/30 text-amber-950 dark:text-amber-200"
              }`}>
                <ImageIcon className={`h-5 w-5 shrink-0 mt-0.5 ${cfStatus.r2.configured ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`} />
                <div>
                  <div className="font-semibold flex items-center gap-1.5">
                    Cloudflare R2 (Imagens)
                    {cfStatus.r2.configured ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> Conectado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                        <AlertCircle className="h-3 w-3" /> Armazenamento Local Ativo
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-90 mt-1">
                    {cfStatus.r2.configured 
                      ? `Bucket configurado: ${cfStatus.r2.bucket}` 
                      : "Todas as imagens de produtos enviadas pelo painel são salvas e servidas com segurança."}
                  </p>
                </div>
              </div>

              {/* D1 / KV Database Status */}
              <div className={`p-3.5 rounded-md border text-sm flex items-start gap-3 ${
                cfStatus.d1.configured || cfStatus.kv.configured
                  ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-950 dark:text-emerald-200" 
                  : "bg-blue-500/5 border-blue-500/30 text-blue-950 dark:text-blue-200"
              }`}>
                <Database className={`h-5 w-5 shrink-0 mt-0.5 ${cfStatus.d1.configured || cfStatus.kv.configured ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"}`} />
                <div>
                  <div className="font-semibold flex items-center gap-1.5">
                    Cloudflare Database (D1 / KV)
                    {cfStatus.d1.configured || cfStatus.kv.configured ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> Conectado ({cfStatus.d1.configured ? "D1 SQL" : "KV Store"})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> Firestore & JSON Sync
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-90 mt-1">
                    {cfStatus.d1.configured
                      ? `D1 Database ID: ${cfStatus.d1.databaseId}`
                      : cfStatus.kv.configured
                      ? `KV Namespace ID: ${cfStatus.kv.namespaceId}`
                      : "Banco de dados sincronizado automaticamente no Firebase Firestore e no servidor."}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Bar for D1 Creation & Synchronization */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-md border">
              <div>
                <p className="text-xs font-semibold">Sincronizar & Criar Tabelas no Cloudflare D1</p>
                <p className="text-[11px] text-muted-foreground">
                  Puxe produtos cadastrados no D1 ou crie as tabelas <code className="bg-muted px-1 rounded">products</code>, <code className="bg-muted px-1 rounded">categories</code>, <code className="bg-muted px-1 rounded">banners</code> e <code className="bg-muted px-1 rounded">settings</code> no D1.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handlePushD1}
                  disabled={pushingD1}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
                >
                  {pushingD1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Enviar Dados Atuais para o D1
                </Button>
                <Button
                  size="sm"
                  onClick={handlePullD1}
                  disabled={pullingD1}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                >
                  {pullingD1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Puxar / Importar do D1
                </Button>
                <Button
                  size="sm"
                  onClick={handleInitD1}
                  disabled={initializingD1}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs gap-1.5"
                >
                  {initializingD1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                  Criar Tabelas D1 Via API
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copySql}
                  className="text-xs gap-1.5"
                >
                  Copiar Script SQL
                </Button>
              </div>
            </div>

            {/* Diagnostic Alert if D1 API authentication failed */}
            {cfStatus?.d1?.configured && !cfStatus?.d1?.working && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-md text-xs text-amber-950 dark:text-amber-200 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0" /> Conectividade do Cloudflare D1
                </p>
                <p className="text-[11px] leading-relaxed">
                  {cfStatus.d1.error || "Erro ao conectar com a API REST do Cloudflare D1."}
                </p>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  📌 <strong>Nota:</strong> Se você rodou o script SQL no Console do Cloudflare e os dados foram inseridos, mas o token de API em <code>CLOUDFLARE_API_TOKEN</code> não tiver permissão de leitura/escrita em D1, o aplicativo opera com o Banco de Dados Local para garantir que a loja continue funcionando normalmente. Para que a loja consulte diretamente o Cloudflare D1 via API, crie um API Token no painel do Cloudflare com a permissão <strong>Account -&gt; D1 -&gt; Edit</strong>.
                </p>
              </div>
            )}

            {/* Instruction Collapsible & SQL Script Box */}
            <div className="bg-secondary/40 p-3.5 rounded-md border space-y-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Info className="h-4 w-4 text-orange-500" />
                Opção Manual: Cole este código no Console SQL do Cloudflare D1:
              </p>
              <div className="relative">
                <pre className="font-mono text-[11px] bg-background p-3 rounded border overflow-x-auto text-foreground max-h-48">
                  {sqlScript}
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={copySql}
                  className="absolute top-2 right-2 h-7 px-2 text-[10px] bg-muted hover:bg-muted/80"
                >
                  Copiar SQL
                </Button>
              </div>

              <div className="pt-2 border-t space-y-1">
                <p className="font-semibold text-foreground">Variáveis de ambiente do Cloudflare (.env / Secrets):</p>
                <ul className="list-disc list-inside space-y-1 font-mono text-[11px] bg-background/80 p-2.5 rounded border">
                  <li>CLOUDFLARE_ACCOUNT_ID (Seu ID de Conta do Cloudflare)</li>
                  <li>CLOUDFLARE_API_TOKEN (Seu Token de API com permissões D1)</li>
                  <li>CLOUDFLARE_D1_DATABASE_ID (ID do seu Banco D1)</li>
                  <li>CLOUDFLARE_R2_ACCESS_KEY_ID (ID da Chave R2)</li>
                  <li>CLOUDFLARE_R2_SECRET_ACCESS_KEY (Chave Secreta R2)</li>
                  <li>CLOUDFLARE_R2_BUCKET_NAME (Nome do Bucket R2)</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Carregando status da integração...
          </div>
        )}
      </div>

      {/* Logo */}
      <div className="bg-card p-5 rounded-lg border space-y-4">
        <h3 className="font-display text-lg font-semibold">Logo da Loja</h3>
        <div className="bg-secondary/50 p-3 rounded-md border flex items-start gap-2">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p><strong>Tamanho recomendado:</strong> {LOGO_SIZES.recommended}</p>
            <p><strong>Formato:</strong> {LOGO_SIZES.format}</p>
            <p><strong>Tamanho máximo:</strong> {LOGO_SIZES.maxSize}</p>
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label>Enviar arquivo</Label>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Enviando..." : "Escolher arquivo"}
            </Button>
            {logoUrl && (
              <Button type="button" variant="ghost" size="icon" onClick={handleRemoveLogo}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* URL fallback */}
        <div className="space-y-2">
          <Label>Ou cole a URL</Label>
          <Input value={logoUrl.startsWith("data:") ? "" : logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://... (deixe vazio para usar texto)" />
        </div>

        {logoUrl && (
          <div className="p-3 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground mb-2">Preview:</p>
            <img src={logoUrl} alt="Logo preview" className="h-12 object-contain" />
          </div>
        )}
      </div>

      {/* Store Name */}
      <div className="bg-card p-5 rounded-lg border space-y-4">
        <h3 className="font-display text-lg font-semibold">Nome da Loja</h3>
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </div>
      </div>

      {/* WhatsApp */}
      <div className="bg-card p-5 rounded-lg border space-y-4">
        <h3 className="font-display text-lg font-semibold">WhatsApp (Contato e Pedidos)</h3>
        <div className="space-y-2">
          <Label>Número do WhatsApp (com código do país, ex: 5554991407378)</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="5554991407378" />
          <p className="text-xs text-muted-foreground">
            Este número será usado para receber as mensagens de novos pedidos do carrinho, botão flutuante do site e no rodapé. Use apenas números. Ex: 55 (Brasil) + DDD + número.
          </p>
          {whatsapp && (
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">
              Visualização formatada no site: <span className="font-semibold">{formatWhatsAppNumber(whatsapp)}</span>
            </p>
          )}
        </div>
      </div>

      {/* Announcement Bar */}
      <div className="bg-card p-5 rounded-lg border space-y-4">
        <h3 className="font-display text-lg font-semibold">Mensagem no Topo (Barra de Avisos)</h3>
        <div className="space-y-2">
          <Label>Mensagens do Topo (Separe por ponto e vírgula ";" para exibir várias em slide rotativo)</Label>
          <Textarea 
            value={promoMessage} 
            onChange={(e) => setPromoMessage(e.target.value)} 
            placeholder="Ex: Frete Grátis acima de R$ 499;Fragrâncias selecionadas com 30% de desconto"
            className="min-h-[100px]"
          />
          <p className="text-xs text-muted-foreground">
            Cada mensagem separada por ";" será exibida de forma rotativa a cada 5 segundos na barra de avisos preta do topo.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-card p-5 rounded-lg border space-y-4">
        <h3 className="font-display text-lg font-semibold">Rodapé</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome no Rodapé</Label>
            <Input value={footer.storeName} onChange={(e) => setFooter({ ...footer, storeName: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={footer.email} onChange={(e) => setFooter({ ...footer, email: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea value={footer.description} onChange={(e) => setFooter({ ...footer, description: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Copyright</Label>
          <Input value={footer.copyright} onChange={(e) => setFooter({ ...footer, copyright: e.target.value })} />
        </div>

        {/* Social Links */}
        <div className="space-y-2 border-t pt-4">
          <h4 className="font-display text-sm font-semibold text-primary">Redes Sociais</h4>
          <p className="text-xs text-muted-foreground">Insira os endereços das redes sociais da sua loja para os botões do rodapé.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Link do Instagram (ou "none" para ocultar)</Label>
            <Input 
              value={footer.instagramUrl} 
              onChange={(e) => setFooter({ ...footer, instagramUrl: e.target.value })} 
              placeholder="https://instagram.com/jrperfumaria" 
            />
          </div>
          <div className="space-y-2">
            <Label>Link do Facebook (ou "none" para ocultar)</Label>
            <Input 
              value={footer.facebookUrl} 
              onChange={(e) => setFooter({ ...footer, facebookUrl: e.target.value })} 
              placeholder="https://facebook.com/jrperfumaria" 
            />
          </div>
        </div>

        <div className="space-y-2 border-t pt-4">
          <h4 className="font-display text-sm font-semibold text-primary">Endereço e Mapa</h4>
          <p className="text-xs text-muted-foreground">Adicione a localização física da sua loja para exibir no rodapé da página.</p>
        </div>
        <div className="space-y-2">
          <Label>Endereço Completo</Label>
          <Input 
            value={footer.address} 
            onChange={(e) => setFooter({ ...footer, address: e.target.value })} 
            placeholder="Av. Brasil, 1200 - Centro, Passo Fundo - RS, 99010-001" 
          />
        </div>
        <div className="space-y-2">
          <Label>Link do Mapa do Google (Opcional - caso queira um link de incorporação específico iframe src)</Label>
          <Input 
            value={footer.mapEmbedUrl} 
            onChange={(e) => setFooter({ ...footer, mapEmbedUrl: e.target.value })} 
            placeholder="https://www.google.com/maps/embed?pb=..." 
          />
          <p className="text-[11px] text-muted-foreground">
            Deixe o campo do link em branco para gerar um mapa automático com base no seu <strong>Endereço Completo</strong>.
          </p>
        </div>
      </div>

      <Button variant="hero" size="lg" onClick={handleSave} className="w-full">
        Salvar Todas as Configurações
      </Button>
    </div>
  );
};

export default AdminSettings;
