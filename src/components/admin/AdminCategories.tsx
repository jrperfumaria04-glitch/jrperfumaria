import { useState } from "react";
import { useStoreConfig } from "@/contexts/StoreConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Tag, Award, Layers } from "lucide-react";
import { toast } from "sonner";
import { Category } from "@/types/store";
import AdminBrands from "./AdminBrands";

const AdminCategories = () => {
  const { config, addCategory, updateCategory, removeCategory } = useStoreConfig();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", parentId: "", isBrand: false });
  const [activeTab, setActiveTab] = useState("categories-list");

  const resetForm = () => {
    setForm({ name: "", slug: "", parentId: "", isBrand: false });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ 
      name: cat.name, 
      slug: cat.slug, 
      parentId: cat.parentId || "", 
      isBrand: cat.isBrand || false 
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    const categoryData = {
      name: form.name,
      slug: form.slug,
      parentId: form.parentId || undefined,
      isBrand: form.isBrand
    };
    if (editing) {
      updateCategory(editing.id, categoryData);
      toast.success(form.isBrand ? "Marca atualizada!" : "Categoria atualizada!");
    } else {
      addCategory(categoryData);
      toast.success(form.isBrand ? "Marca adicionada!" : "Categoria adicionada!");
    }
    resetForm();
  };

  const autoSlug = (name: string) => {
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setForm((prev) => ({ ...prev, name, slug }));
  };

  // Group normal categories hierarchically (excluding brands)
  const rootCategories = config.categories.filter((c) => !c.parentId && !c.isBrand);
  
  const getSubcategories = (parentId: string) => {
    return config.categories.filter((c) => c.parentId === parentId && !c.isBrand);
  };

  // Helper to determine the category depth/level
  const getCategoryLevelLabel = (cat: Category) => {
    if (!cat.parentId) return "Principal";
    const parent = config.categories.find(p => p.id === cat.parentId);
    if (parent && !parent.parentId) return "Subcategoria 1";
    return "Subcategoria 2";
  };

  // Populate eligible parent categories: Level 1 and Level 2 are allowed to have children.
  const eligibleParents = config.categories.filter((cat) => {
    if (cat.isBrand) return false;
    if (cat.id === editing?.id) return false;
    
    // Level 1: yes
    if (!cat.parentId) return true;
    
    // Level 2: yes, parent has no parent
    const parent = config.categories.find(p => p.id === cat.parentId);
    if (parent && !parent.parentId) return true;
    
    return false; // Level 3 cannot be parents (supports up to Level 3 / Subcategory 2)
  });

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b pb-4">
        <TabsList className="grid grid-cols-2 w-full sm:w-[350px]">
          <TabsTrigger value="categories-list" className="gap-1.5">
            <Layers className="h-4 w-4" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="brands-list" className="gap-1.5">
            <Award className="h-4 w-4" />
            Marcas
          </TabsTrigger>
        </TabsList>

        {activeTab === "categories-list" && (
          <Button variant="hero" size="sm" onClick={() => { resetForm(); setShowForm(true); }} className="shrink-0 self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-1" /> Nova Categoria
          </Button>
        )}
        {activeTab === "brands-list" && (
          <Button variant="hero" size="sm" onClick={() => { resetForm(); setForm(p => ({ ...p, isBrand: true })); setShowForm(true); setActiveTab("categories-list"); }} className="shrink-0 self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-1" /> Cadastrar Nova Marca
          </Button>
        )}
      </div>

      <TabsContent value="categories-list" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-card p-5 rounded-lg border space-y-4 max-w-2xl">
            <h4 className="font-semibold text-foreground">
              {editing ? "Editar Registro" : form.isBrand ? "Nova Marca" : "Nova Categoria"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => autoSlug(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Slug *</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Type selector */}
              <div className="space-y-2">
                <Label>Tipo de Registro</Label>
                <Select 
                  value={form.isBrand ? "brand" : "category"} 
                  onValueChange={(v) => {
                    const isB = v === "brand";
                    setForm({ ...form, isBrand: isB, parentId: isB ? "" : form.parentId });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">Categoria / Subcategoria</SelectItem>
                    <SelectItem value="brand">Marca</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Parent category selector (disabled if it is a brand) */}
              {!form.isBrand && (
                <div className="space-y-2">
                  <Label>Categoria Mãe (Opcional - Selecione para criar uma Subcategoria)</Label>
                  <Select 
                    value={form.parentId || "none"} 
                    onValueChange={(v) => setForm({ ...form, parentId: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma (Categoria Principal)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma (Categoria Principal)</SelectItem>
                      {eligibleParents.map((cat) => {
                        const level = getCategoryLevelLabel(cat);
                        return (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name} ({level})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="hero" size="sm">{editing ? "Salvar" : "Adicionar"}</Button>
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>Cancelar</Button>
            </div>
          </form>
        )}

        {/* Tree List */}
        <div className="space-y-4">
          {rootCategories.length === 0 && (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-card">
              Nenhuma categoria cadastrada. Comece adicionando uma categoria principal!
            </div>
          )}
          
          {rootCategories.map((cat) => {
            const sub1List = getSubcategories(cat.id);
            return (
              <div key={cat.id} className="bg-card/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                {/* LEVEL 1: Main Category */}
                <div className="flex gap-4 p-3 bg-card rounded-lg border items-center">
                  <Tag className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground text-sm">{cat.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2.5 uppercase font-bold tracking-wider bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">Categoria</span>
                    <span className="text-xs text-muted-foreground ml-2 font-mono truncate hidden sm:inline">({cat.slug})</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEdit(cat)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { removeCategory(cat.id); toast.success("Categoria removida."); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* LEVEL 2: Subcategories Level 1 */}
                {sub1List.map((sub1) => {
                  const sub2List = getSubcategories(sub1.id);
                  return (
                    <div key={sub1.id} className="ml-6 space-y-2.5 relative">
                      {/* Branch line */}
                      <div className="absolute -left-3 top-0 bottom-3 w-[1px] border-l border-dashed border-slate-300 dark:border-slate-700"></div>
                      
                      <div className="flex gap-4 p-3 bg-card/80 rounded-lg border items-center relative">
                        {/* Horizontal bracket connector */}
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-3 h-[1px] border-t border-dashed border-slate-300 dark:border-slate-700"></div>
                        <div className="flex-1 min-w-0 pl-1">
                          <span className="font-medium text-foreground text-sm">{sub1.name}</span>
                          <span className="text-[10px] text-indigo-700 dark:text-indigo-400 ml-2.5 uppercase font-bold tracking-wider bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">Sub 1</span>
                          <span className="text-xs text-muted-foreground ml-2 font-mono truncate hidden sm:inline">({sub1.slug})</span>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEdit(sub1)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { removeCategory(sub1.id); toast.success("Subcategoria removida."); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* LEVEL 3: Subcategories Level 2 */}
                      {sub2List.map((sub2) => (
                        <div key={sub2.id} className="ml-8 relative">
                          <div className="flex gap-4 p-2.5 bg-card/60 rounded-lg border border-dashed items-center relative">
                            {/* Horizontal bracket connector */}
                            <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-5 h-[1px] border-t border-dashed border-slate-300 dark:border-slate-700"></div>
                            <div className="flex-1 min-w-0">
                              <span className="text-foreground text-sm font-medium">{sub2.name}</span>
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 ml-2.5 uppercase font-bold tracking-wider bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">Sub 2</span>
                              <span className="text-xs text-muted-foreground ml-2 font-mono truncate hidden sm:inline">({sub2.slug})</span>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEdit(sub2)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { removeCategory(sub2.id); toast.success("Subcategoria 2 removida."); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="brands-list" className="focus-visible:outline-none focus-visible:ring-0">
        <AdminBrands />
      </TabsContent>
    </Tabs>
  );
};

export default AdminCategories;
