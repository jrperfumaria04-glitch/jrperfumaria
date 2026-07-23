import { useState, useRef } from "react";
import { useStoreConfig } from "@/contexts/StoreConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Upload, Image, Loader2, Tag, Award, Layers } from "lucide-react";
import { toast } from "sonner";
import { Product } from "@/types/store";
import { api } from "@/services/api";

const formatToBrazilianDateMask = (value: string) => {
  const clean = value.replace(/\D/g, "");
  if (clean.length <= 2) return clean;
  if (clean.length <= 4) return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 8)}`;
};

const isoToBrDate = (isoStr?: string): string => {
  if (!isoStr) return "";
  if (isoStr.includes("/")) return isoStr;
  const parts = isoStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoStr;
};

const brToIsoDate = (brStr?: string): string => {
  if (!brStr) return "";
  const parts = brStr.split("/");
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    if (y.length === 4) {
      return `${y}-${m}-${d}`;
    }
  }
  return brStr;
};

const AdminProducts = () => {
  const { config, addProduct, updateProduct, removeProduct } = useStoreConfig();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: "", 
    description: "", 
    price: "", 
    category: "", 
    subCategory1: "", 
    subCategory2: "", 
    categories: [] as string[],
    brand: "", 
    image: "", 
    featured: false,
    sku: "", 
    stock: "", 
    expirationDate: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setForm({ 
      name: "", 
      description: "", 
      price: "", 
      category: "", 
      subCategory1: "", 
      subCategory2: "", 
      categories: [],
      brand: "", 
      image: "", 
      featured: false, 
      sku: "", 
      stock: "", 
      expirationDate: "" 
    });
    setEditing(null);
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category: product.category || "",
      subCategory1: product.subCategory1 || "",
      subCategory2: product.subCategory2 || "",
      categories: product.categories || [
        product.category,
        ...(product.subCategory1 ? [product.subCategory1] : []),
        ...(product.subCategory2 ? [product.subCategory2] : [])
      ].filter(Boolean),
      brand: product.brand || "",
      image: product.image,
      featured: product.featured || false,
      sku: product.sku || "",
      stock: product.stock !== undefined ? product.stock.toString() : "",
      expirationDate: product.expirationDate || "",
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
      toast.success("Imagem enviada!");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) {
      toast.error("Preencha os campos obrigatórios (Nome e Preço).");
      return;
    }
    if (form.categories.length === 0) {
      toast.error("Selecione pelo menos uma categoria.");
      return;
    }

    let expDate = form.expirationDate || undefined;
    if (expDate) {
      if (expDate.includes("/")) {
        toast.error("Insira a data de validade completa no formato DD/MM/AAAA.");
        return;
      }
      const parsedDate = new Date(expDate + "T12:00:00");
      if (isNaN(parsedDate.getTime())) {
        toast.error("Data de validade inválida. Use o formato DD/MM/AAAA.");
        return;
      }
    }

    // Determine legacy primary, sub1 and sub2 values for compatibility:
    const selectedSlugs = form.categories;
    const firstMainCat = config.categories.find(c => !c.parentId && !c.isBrand && selectedSlugs.includes(c.slug));
    const firstSub1 = firstMainCat 
      ? config.categories.find(c => c.parentId === firstMainCat.id && !c.isBrand && selectedSlugs.includes(c.slug))
      : undefined;
    const firstSub2 = firstSub1 
      ? config.categories.find(c => c.parentId === firstSub1.id && !c.isBrand && selectedSlugs.includes(c.slug))
      : undefined;

    const productData = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      category: firstMainCat?.slug || selectedSlugs[0] || "",
      subCategory1: firstSub1?.slug || undefined,
      subCategory2: firstSub2?.slug || undefined,
      categories: selectedSlugs,
      brand: form.brand || undefined,
      image: form.image || "/placeholder.svg",
      featured: form.featured,
      sku: form.sku || undefined,
      stock: form.stock !== "" ? parseInt(form.stock) : undefined,
      expirationDate: expDate,
    };
    if (editing) {
      updateProduct(editing.id, productData);
      toast.success("Produto atualizado!");
    } else {
      addProduct(productData);
      toast.success("Produto cadastrado!");
    }
    resetForm();
  };

  // Helper data collections from config
  const mainCategories = config.categories.filter(c => !c.parentId && !c.isBrand);
  
  // Calculate Subcategory 1 options
  const selectedMainCategoryObj = config.categories.find(c => c.slug === form.category && !c.isBrand);
  const sub1Categories = selectedMainCategoryObj
    ? config.categories.filter(c => c.parentId === selectedMainCategoryObj.id && !c.isBrand)
    : [];

  // Calculate Subcategory 2 options
  const selectedSub1CategoryObj = sub1Categories.find(c => c.slug === form.subCategory1);
  const sub2Categories = selectedSub1CategoryObj
    ? config.categories.filter(c => c.parentId === selectedSub1CategoryObj.id && !c.isBrand)
    : [];

  // Brand list
  const brands = config.categories.filter(c => c.isBrand === true);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-display text-lg font-semibold">Produtos ({config.products.length})</h3>
        <Button variant="hero" size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Produto
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card p-5 rounded-lg border space-y-5 max-w-4xl">
          <h4 className="font-semibold text-foreground border-b pb-2">
            {editing ? "Editar Produto" : "Novo Produto"}
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prod-name">Nome do Produto *</Label>
              <Input id="prod-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-price">Preço (R$) *</Label>
              <Input id="prod-price" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/45 p-4 rounded-lg border border-dashed">
            {/* Categorias Multi-seleção */}
            <div className="md:col-span-3 space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center justify-between">
                <span>Categorias do Produto * (Selecione uma ou mais)</span>
                {form.categories.length > 0 && (
                  <span className="text-xs font-normal text-indigo-600 dark:text-indigo-400">
                    {form.categories.length} selecionada(s)
                  </span>
                )}
              </Label>
              <div className="bg-background border rounded-lg p-3 max-h-[220px] overflow-y-auto space-y-2 scrollbar-thin">
                {mainCategories.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Nenhuma categoria cadastrada. Cadastre na aba correspondente primeiro.
                  </p>
                ) : (
                  mainCategories.map((rootCat) => {
                    const level1Selected = form.categories.includes(rootCat.slug);
                    const sub1List = config.categories.filter(c => c.parentId === rootCat.id && !c.isBrand);
                    
                    return (
                      <div key={rootCat.id} className="space-y-1">
                        {/* Nível 1 - Principal */}
                        <label className="flex items-center gap-2 px-2 py-1 hover:bg-muted/50 rounded cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={level1Selected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setForm(prev => {
                                const newCats = checked 
                                  ? [...prev.categories, rootCat.slug] 
                                  : prev.categories.filter(slug => slug !== rootCat.slug);
                                return { ...prev, categories: newCats };
                              });
                            }}
                            className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <span className="text-xs font-semibold text-foreground">
                            {rootCat.name}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold px-1 py-0.5 rounded scale-90 font-mono">
                            Principal
                          </span>
                        </label>
                        
                        {/* Nível 2 - Subcategoria 1 */}
                        {sub1List.map((sub1) => {
                          const level2Selected = form.categories.includes(sub1.slug);
                          const sub2List = config.categories.filter(c => c.parentId === sub1.id && !c.isBrand);
                          
                          return (
                            <div key={sub1.id} className="ml-5 space-y-1">
                              <label className="flex items-center gap-2 px-2 py-0.5 hover:bg-muted/50 rounded cursor-pointer transition-colors">
                                <input
                                  type="checkbox"
                                  checked={level2Selected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setForm(prev => {
                                      const newCats = checked 
                                        ? [...prev.categories, sub1.slug] 
                                        : prev.categories.filter(slug => slug !== sub1.slug);
                                      return { ...prev, categories: newCats };
                                    });
                                  }}
                                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                />
                                <span className="text-xs text-foreground font-medium">
                                  {sub1.name}
                                </span>
                                <span className="text-[9px] uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold px-1 py-0.5 rounded scale-90">
                                  Sub 1
                                </span>
                              </label>
                              
                              {/* Nível 3 - Subcategoria 2 */}
                              {sub2List.map((sub2) => {
                                const level3Selected = form.categories.includes(sub2.slug);
                                return (
                                  <div key={sub2.id} className="ml-5">
                                    <label className="flex items-center gap-2 px-2 py-0.5 hover:bg-muted/50 rounded cursor-pointer transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={level3Selected}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          setForm(prev => {
                                            const newCats = checked 
                                              ? [...prev.categories, sub2.slug] 
                                              : prev.categories.filter(slug => slug !== sub2.slug);
                                            return { ...prev, categories: newCats };
                                          });
                                        }}
                                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                      />
                                      <span className="text-xs text-muted-foreground font-medium">
                                        {sub2.name}
                                      </span>
                                      <span className="text-[9px] uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold px-1 py-0.5 rounded scale-90">
                                        Sub 2
                                      </span>
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Marca */}
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="prod-brand">Marca</Label>
              <Select value={form.brand || "none"} onValueChange={(v) => setForm({ ...form, brand: v === "none" ? "" : v })}>
                <SelectTrigger id="prod-brand" className="bg-background h-10 md:mt-7">
                  <SelectValue placeholder={brands.length === 0 ? "Nenhuma marca" : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (Sem Marca)</SelectItem>
                  {brands.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Imagem do Produto</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Upload button */}
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-10"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Enviando...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-1" /> Enviar Imagem</>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
              {/* URL input */}
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="ou cole a URL da imagem"
                  className="h-10 text-sm"
                />
              </div>
            </div>
            {/* Preview */}
            {form.image && (
              <div className="mt-2">
                <img
                  src={form.image}
                  alt="Preview"
                  className="h-20 w-20 rounded-md object-cover border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prod-sku">Código / SKU</Label>
              <Input 
                id="prod-sku"
                value={form.sku} 
                onChange={(e) => setForm({ ...form, sku: e.target.value })} 
                placeholder="Ex: PERF-001" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-stock">Quantidade em Estoque</Label>
              <Input 
                id="prod-stock"
                type="number" 
                min="0" 
                value={form.stock} 
                onChange={(e) => setForm({ ...form, stock: e.target.value })} 
                placeholder="Ex: 50" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-val">Data de Validade (DD/MM/AAAA)</Label>
              <Input 
                id="prod-val"
                type="text" 
                placeholder="Ex: 31/12/2026"
                maxLength={10}
                value={isoToBrDate(form.expirationDate)} 
                onChange={(e) => {
                  const masked = formatToBrazilianDateMask(e.target.value);
                  const iso = brToIsoDate(masked);
                  setForm({ ...form, expirationDate: iso || masked });
                }} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prod-desc">Descrição (max 100 caracteres)</Label>
            <Textarea id="prod-desc" maxLength={100} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <p className="text-xs text-muted-foreground">{form.description.length}/100</p>
          </div>
          
          <div className="flex items-center gap-2 border-t pt-3">
            <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
            <Label>Produto destaque na página inicial</Label>
          </div>
          
          <div className="flex gap-3 border-t pt-3 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={resetForm}>Cancelar</Button>
            <Button type="submit" variant="hero" size="sm">{editing ? "Salvar Alterações" : "Cadastrar Produto"}</Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {config.products.map((product) => (
          <div key={product.id} className="flex gap-4 p-4 bg-card rounded-lg border items-center">
            <img src={product.image} alt={product.name} className="h-16 w-16 rounded-md object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground truncate">{product.name}</h4>
              <p className="text-sm text-muted-foreground">
                {(() => {
                  const parts: string[] = [];
                  
                  if (product.categories && product.categories.length > 0) {
                    const catNames = product.categories.map(slug => {
                      const catObj = config.categories.find(c => c.slug === slug && !c.isBrand);
                      return catObj ? catObj.name : null;
                    }).filter(Boolean) as string[];
                    if (catNames.length > 0) {
                      parts.push(catNames.join(", "));
                    }
                  } else {
                    const catObj = config.categories.find(c => c.slug === product.category && !c.isBrand);
                    if (catObj) parts.push(catObj.name);

                    if (product.subCategory1) {
                      const sub1Obj = config.categories.find(c => c.slug === product.subCategory1 && !c.isBrand);
                      if (sub1Obj) parts.push(sub1Obj.name);
                    }

                    if (product.subCategory2) {
                      const sub2Obj = config.categories.find(c => c.slug === product.subCategory2 && !c.isBrand);
                      if (sub2Obj) parts.push(sub2Obj.name);
                    }
                  }

                  if (product.brand) {
                    const brandObj = config.categories.find(c => c.slug === product.brand && c.isBrand);
                    if (brandObj) parts.push(`Marca: ${brandObj.name}`);
                  }

                  return parts.length > 0 ? parts.join(" • ") : (product.category || "Sem Categoria");
                })()} • R$ {product.price.toFixed(2).replace(".", ",")}
                {product.featured && " • ⭐ Destaque"}
              </p>
              <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1 text-xs">
                {product.sku && (
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">
                    SKU: {product.sku}
                  </span>
                )}
                {product.stock !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded font-medium ${product.stock <= 5 ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"}`}>
                    Estoque: {product.stock} un
                  </span>
                )}
                {product.expirationDate && (
                  <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                    Validade: {new Date(product.expirationDate + "T12:00:00").toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="icon" onClick={() => handleEdit(product)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => { removeProduct(product.id); toast.success("Removido."); }} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminProducts;
