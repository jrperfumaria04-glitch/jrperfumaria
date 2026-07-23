import { useState, useMemo } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BannerCarousel from "@/components/BannerCarousel";
import ProductCard from "@/components/ProductCard";
import CategoryFilter from "@/components/CategoryFilter";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { useStoreConfig } from "@/contexts/StoreConfigContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";

const Index = () => {
  const { config } = useStoreConfig();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [sortBy, setSortBy] = useState("name");

  const rootCategories = useMemo(() => {
    return config.categories.filter((c) => !c.parentId && !c.isBrand);
  }, [config.categories]);

  const subCategories = useMemo(() => {
    if (!selectedCategory) return [];
    const parentCat = config.categories.find((c) => c.slug === selectedCategory && !c.isBrand);
    if (!parentCat) return [];
    return config.categories.filter((c) => c.parentId === parentCat.id && !c.isBrand);
  }, [selectedCategory, config.categories]);

  const brands = useMemo(() => {
    return config.categories.filter((c) => c.isBrand === true);
  }, [config.categories]);

  const filteredProducts = useMemo(() => {
    let products = [...config.products];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      products = products.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }

    if (selectedCategory) {
      const parentCat = config.categories.find((c) => c.slug === selectedCategory && !c.isBrand);
      if (selectedSubCategory) {
        products = products.filter(
          (p) => 
            p.category === selectedSubCategory || 
            p.subCategory1 === selectedSubCategory || 
            p.subCategory2 === selectedSubCategory ||
            (p.categories && p.categories.includes(selectedSubCategory))
        );
      } else if (parentCat) {
        const childSlugs = config.categories
          .filter((c) => c.parentId === parentCat.id && !c.isBrand)
          .map((c) => c.slug);
        products = products.filter(
          (p) => 
            p.category === selectedCategory || 
            childSlugs.includes(p.category) || 
            childSlugs.includes(p.subCategory1 || "") || 
            childSlugs.includes(p.subCategory2 || "") ||
            (p.categories && p.categories.includes(selectedCategory)) ||
            (p.categories && p.categories.some(c => childSlugs.includes(c)))
        );
      } else {
        products = products.filter((p) => 
          p.category === selectedCategory || 
          (p.categories && p.categories.includes(selectedCategory))
        );
      }
    }

    if (selectedBrand) {
      products = products.filter((p) => p.brand === selectedBrand);
    }

    switch (sortBy) {
      case "price-asc":
        products.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        products.sort((a, b) => b.price - a.price);
        break;
      case "name":
      default:
        products.sort((a, b) => a.name.localeCompare(b.name));
    }

    return products;
  }, [searchQuery, selectedCategory, selectedSubCategory, selectedBrand, sortBy, config.products, config.categories]);

  const handleCategorySelect = (slug: string) => {
    setSelectedCategory(slug);
    setSelectedSubCategory("");
  };

  const featuredProducts = config.products.filter((p) => p.featured);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="flex-1">
        {/* Banner - Full Width */}
        <BannerCarousel />

        {/* Category Section */}
        <section className="container mx-auto px-4 py-12">
          <h2 className="text-xs uppercase tracking-[0.3em] font-black text-slate-400 text-center mb-8">
            Qual categoria você procura?
          </h2>
          <CategoryFilter
            categories={rootCategories}
            selected={selectedCategory}
            onSelect={handleCategorySelect}
          />
        </section>

        {/* Subcategories Row */}
        {subCategories.length > 0 && (
          <div className="container mx-auto px-4 -mt-4 mb-12 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setSelectedSubCategory("")}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full border transition-all ${
                selectedSubCategory === ""
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-black dark:border-white"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-400 dark:bg-slate-950 dark:border-slate-800"
              }`}
            >
              Ver Tudo
            </button>
            {subCategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSelectedSubCategory(sub.slug)}
                className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full border transition-all ${
                  selectedSubCategory === sub.slug
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400 dark:bg-slate-950 dark:border-slate-800"
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}

        {/* Featured Products */}
        {!searchQuery && !selectedCategory && !selectedBrand && featuredProducts.length > 0 && (
          <section className="bg-slate-50 border-y border-black/5 py-12 sm:py-16">
            <div className="container mx-auto px-4 sm:px-12">
              <div className="flex justify-between items-end mb-8">
                <h2 className="text-xs uppercase tracking-[0.3em] font-black text-slate-400">
                  Os Mais Vendidos
                </h2>
                <button className="text-xs font-bold border-b border-black pb-0.5 tracking-wider uppercase">
                  Ver todos
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                {featuredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* All Products */}
        <section className="container mx-auto px-4 sm:px-12 py-12 sm:py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <h2 className="text-xs uppercase tracking-[0.3em] font-black text-slate-400">
              {searchQuery ? `Resultados para: ${searchQuery}` : "Coleção Completa"}
            </h2>
            <div className="flex flex-wrap gap-2 items-center">
              {brands.length > 0 && (
                <Select value={selectedBrand || "all"} onValueChange={(v) => setSelectedBrand(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[180px] rounded-none bg-white border border-black/10 text-xs uppercase tracking-wider font-semibold h-10 px-3">
                    <SelectValue placeholder="Filtrar por Marca" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="all" className="text-xs uppercase tracking-wider font-medium">Todas as Marcas</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.slug} className="text-xs uppercase tracking-wider">
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] rounded-none bg-white border border-black/10 text-xs uppercase tracking-wider font-semibold h-10 px-3">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="name" className="text-xs uppercase tracking-wider">Nome A-Z</SelectItem>
                  <SelectItem value="price-asc" className="text-xs uppercase tracking-wider">Menor Preço</SelectItem>
                  <SelectItem value="price-desc" className="text-xs uppercase tracking-wider">Maior Preço</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-lg font-display">Nenhum produto encontrado.</p>
              <p className="text-sm mt-1">Tente outra busca ou categoria.</p>
            </div>
          )}
        </section>
      </main>

      <Footer />
      <WhatsAppFloat />
    </div>
  );
};

export default Index;
