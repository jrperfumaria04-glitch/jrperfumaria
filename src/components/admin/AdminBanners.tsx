import { useState, useRef } from "react";
import { useStoreConfig } from "@/contexts/StoreConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Info, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Banner } from "@/types/store";
import { api } from "@/services/api";

const BANNER_SIZES = [
  { device: "📱 Mobile", width: "768px", height: "300px", ratio: "2.56:1" },
  { device: "📱 Tablet", width: "1024px", height: "400px", ratio: "2.56:1" },
  { device: "🖥️ Desktop", width: "1920px", height: "480px", ratio: "4:1" },
];

const AdminBanners = () => {
  const { config, addBanner, updateBanner, removeBanner } = useStoreConfig();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ 
    image: "", 
    title: "", 
    subtitle: "", 
    cta: "", 
    active: true, 
    device: "all" as "all" | "desktop" | "tablet" | "mobile",
    opacity: 100,
    overlayOpacity: 60
  });

  const resetForm = () => {
    setForm({ image: "", title: "", subtitle: "", cta: "", active: true, device: "all", opacity: 100, overlayOpacity: 60 });
    setEditing(null);
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEdit = (banner: Banner) => {
    setEditing(banner);
    setForm({ 
      image: banner.image, 
      title: banner.title, 
      subtitle: banner.subtitle, 
      cta: banner.cta, 
      active: banner.active, 
      device: banner.device || "all",
      opacity: banner.opacity !== undefined ? banner.opacity : 100,
      overlayOpacity: banner.overlayOpacity !== undefined ? banner.overlayOpacity : 60
    });
    setShowForm(true);
  };

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
      setForm((prev) => ({ ...prev, image: result.url }));
      toast.success("Imagem do banner enviada!");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.image || !form.title) {
      toast.error("Preencha imagem e título.");
      return;
    }
    if (editing) {
      updateBanner(editing.id, form);
      toast.success("Banner atualizado!");
    } else {
      addBanner(form);
      toast.success("Banner adicionado!");
    }
    resetForm();
  };

  return (
    <div className="space-y-6">
      {/* Size guide */}
      <div className="bg-secondary/50 p-4 rounded-lg border space-y-2">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Info className="h-4 w-4 text-primary" />
          Tamanhos recomendados para banners
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {BANNER_SIZES.map((s) => (
            <div key={s.device} className="bg-card p-3 rounded-md border text-sm">
              <p className="font-semibold">{s.device}</p>
              <p className="text-muted-foreground">{s.width} × {s.height}</p>
              <p className="text-muted-foreground">Proporção: {s.ratio}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          💡 Use uma imagem de <strong>1920×480px</strong> para melhor resultado em todos os dispositivos. Formato JPG ou PNG.
        </p>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-display text-lg font-semibold">Banners ({config.banners.length})</h3>
        <Button variant="hero" size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Banner
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card p-5 rounded-lg border space-y-4">
          <h4 className="font-semibold">{editing ? "Editar Banner" : "Novo Banner"}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label className="font-semibold text-foreground">Imagem do Banner *</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div className="md:col-span-2 space-y-2">
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
                      className="flex items-center gap-2 text-xs"
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {uploading ? "Enviando..." : "Fazer Upload de Imagem"}
                    </Button>
                    {form.image && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={() => {
                          setForm((prev) => ({ ...prev, image: "" }));
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        Remover Imagem
                      </Button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold text-muted-foreground font-mono">Ou URL:</span>
                    <Input 
                      value={form.image.startsWith("data:") ? "" : form.image} 
                      onChange={(e) => setForm({ ...form, image: e.target.value })} 
                      placeholder="https://..." 
                      className="pl-16 text-sm"
                    />
                  </div>
                </div>
                {form.image && (
                  <div className="border rounded p-2 bg-muted/30 flex flex-col items-center justify-center">
                    <span className="text-[9px] text-muted-foreground mb-1 self-start font-mono uppercase tracking-wider">Preview do Banner:</span>
                    <img src={form.image} alt="Preview" className="h-16 w-full object-cover rounded border" />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo</Label>
              <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Texto do Botão</Label>
              <Input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Dispositivo Alvo</Label>
              <Select 
                value={form.device} 
                onValueChange={(v) => setForm({ ...form, device: v as any })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o dispositivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🌐 Todos os dispositivos</SelectItem>
                  <SelectItem value="desktop">🖥️ Apenas Computador (Desktop)</SelectItem>
                  <SelectItem value="tablet">📱 Apenas Tablet</SelectItem>
                  <SelectItem value="mobile">📱 Apenas Celular (Mobile)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Opacidade do Banner ({form.opacity}%)</Label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  step="5"
                  value={form.opacity} 
                  onChange={(e) => setForm({ ...form, opacity: parseInt(e.target.value) })}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-xs font-mono font-bold w-10 text-right shrink-0">{form.opacity}%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Opacidade do Gradiente / Fundo Lateral ({form.overlayOpacity}%)</Label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="5"
                  value={form.overlayOpacity} 
                  onChange={(e) => setForm({ ...form, overlayOpacity: parseInt(e.target.value) })}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-xs font-mono font-bold w-10 text-right shrink-0">{form.overlayOpacity}%</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            <Label>Banner ativo</Label>
          </div>
          <div className="flex gap-3">
            <Button type="submit" variant="hero" size="sm">{editing ? "Salvar" : "Adicionar"}</Button>
            <Button type="button" variant="outline" size="sm" onClick={resetForm}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {config.banners.map((banner) => (
          <div key={banner.id} className="flex gap-4 p-4 bg-card rounded-lg border items-center">
            <img src={banner.image} alt={banner.title} className="h-16 w-28 rounded-md object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground truncate">{banner.title}</h4>
              <p className="text-sm text-muted-foreground truncate">{banner.subtitle}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-semibold tracking-wider ${banner.active ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted border-muted-foreground/10 text-muted-foreground"}`}>
                  {banner.active ? "✅ Ativo" : "⏸️ Inativo"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded border bg-secondary border-secondary-foreground/10 text-secondary-foreground uppercase font-semibold tracking-wider">
                  {banner.device === "desktop" ? "🖥️ Desktop" : banner.device === "tablet" ? "📱 Tablet" : banner.device === "mobile" ? "📱 Celular" : "🌐 Todos"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded border bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 uppercase font-semibold tracking-wider">
                  💧 Opacidade: {banner.opacity ?? 100}%
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded border bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400 uppercase font-semibold tracking-wider">
                  🖤 Fundo Lateral: {banner.overlayOpacity ?? 60}%
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="icon" onClick={() => handleEdit(banner)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => { removeBanner(banner.id); toast.success("Banner removido."); }} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminBanners;
