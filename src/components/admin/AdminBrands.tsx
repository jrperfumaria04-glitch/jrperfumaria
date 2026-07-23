import { useState } from "react";
import { useStoreConfig } from "@/contexts/StoreConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Category } from "@/types/store";

const AdminBrands = () => {
  const { config, addCategory, updateCategory, removeCategory } = useStoreConfig();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", slug: "" });

  const resetForm = () => {
    setForm({ name: "", slug: "" });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (brand: Category) => {
    setEditing(brand);
    setForm({ name: brand.name, slug: brand.slug });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    const brandData = {
      name: form.name,
      slug: form.slug,
      isBrand: true
    };

    if (editing) {
      updateCategory(editing.id, brandData);
      toast.success("Marca atualizada com sucesso!");
    } else {
      addCategory(brandData);
      toast.success("Marca adicionada com sucesso!");
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

  // Filter categories that are registered as brands
  const brands = config.categories.filter((c) => c.isBrand === true);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">Gerenciamento de Marcas ({brands.length})</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Adicione e gerencie as marcas dos seus perfumes. Elas ficarão disponíveis nos filtros e no cadastro de produtos.
          </p>
        </div>
        <Button variant="hero" size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Marca
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card p-5 rounded-lg border space-y-4 max-w-xl">
          <h4 className="font-semibold text-foreground">{editing ? "Editar Marca" : "Nova Marca"}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Nome da Marca *</Label>
              <Input 
                id="brand-name"
                value={form.name} 
                onChange={(e) => autoSlug(e.target.value)} 
                placeholder="Ex: Chanel"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-slug">Slug (Identificador único) *</Label>
              <Input 
                id="brand-slug"
                value={form.slug} 
                onChange={(e) => setForm({ ...form, slug: e.target.value })} 
                placeholder="ex: chanel"
                required 
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="hero" size="sm">{editing ? "Salvar" : "Adicionar"}</Button>
            <Button type="button" variant="outline" size="sm" onClick={resetForm}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {brands.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-card">
            Nenhuma marca cadastrada ainda.
          </div>
        ) : (
          brands.map((brand) => (
            <div key={brand.id} className="flex items-center justify-between p-3.5 bg-card rounded-lg border hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{brand.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">Slug: {brand.slug}</p>
              </div>
              <div className="flex gap-1.5 shrink-0 ml-3">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEdit(brand)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 text-destructive hover:text-destructive" 
                  onClick={() => { 
                    removeCategory(brand.id); 
                    toast.success("Marca removida."); 
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminBrands;
