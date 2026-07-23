import { useParams, Link } from "react-router-dom";
import { useStoreConfig } from "@/contexts/StoreConfigContext";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ChevronRight, Heart, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { config } = useStoreConfig();
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [quantity, setQuantity] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const product = config.products.find((p) => p.id === id);

  const breadcrumbs = useMemo(() => {
    if (!product) return [];
    const list: Array<{ label: string }> = [];
    
    if (product.categories && product.categories.length > 0) {
      product.categories.forEach(slug => {
        const catObj = config.categories.find(c => c.slug === slug && !c.isBrand);
        if (catObj && !list.some(item => item.label === catObj.name)) {
          list.push({ label: catObj.name });
        }
      });
    } else {
      // Main Category
      const catObj = config.categories.find(c => c.slug === product.category && !c.isBrand);
      if (catObj) {
        list.push({ label: catObj.name });
      }
      
      // Sub 1
      if (product.subCategory1) {
        const sub1Obj = config.categories.find(c => c.slug === product.subCategory1 && !c.isBrand);
        if (sub1Obj) {
          list.push({ label: sub1Obj.name });
        }
      }
      
      // Sub 2
      if (product.subCategory2) {
        const sub2Obj = config.categories.find(c => c.slug === product.subCategory2 && !c.isBrand);
        if (sub2Obj) {
          list.push({ label: sub2Obj.name });
        }
      }
    }
    
    // Brand
    if (product.brand) {
      const brandObj = config.categories.find(c => c.slug === product.brand && c.isBrand);
      if (brandObj) {
        list.push({ label: brandObj.name });
      }
    }
    
    return list;
  }, [product, config.categories]);

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-xl font-display font-bold text-foreground">Produto não encontrado</p>
            <Link to="/">
              <Button>Voltar à loja</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const relatedProducts = config.products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      addItem(product);
    }
    toast.success(`${quantity}x ${product.name} adicionado à sacola!`);
  };

  const priceFormatted = product.price.toFixed(2).replace(".", ",");
  const installment = (product.price / 3).toFixed(2).replace(".", ",");

  const categoryLabel = config.categories.find((c) => c.slug === product.category)?.name || product.category;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="container mx-auto px-4 sm:px-12 py-6 border-b border-black/5 bg-white">
          <nav className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-slate-400">
            <Link to="/" className="hover:text-black transition-colors">Início</Link>
            {breadcrumbs.map((bc, idx) => (
              <span key={idx} className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
                <span className="hover:text-black transition-colors cursor-pointer">{bc.label}</span>
              </span>
            ))}
            <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
            <span className="text-black font-semibold truncate max-w-[200px]">{product.name}</span>
          </nav>
        </div>

        {/* Product */}
        <section className="container mx-auto px-4 sm:px-12 py-10 sm:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="relative aspect-square bg-slate-50 border border-black/5 rounded-none overflow-hidden group flex items-center justify-center"
            >
              <img
                src={product.image}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <button
                onClick={() => toggleFavorite(product)}
                className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors border border-black/5 shadow-none z-10"
              >
                <Heart
                  className={`h-4.5 w-4.5 transition-colors ${isFavorite(product.id) ? "fill-destructive text-destructive" : "text-slate-400"}`}
                />
              </button>
              {product.featured && (
                <span className="absolute top-4 left-4 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-none">
                  Destaque
                </span>
              )}
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex flex-col space-y-6"
            >
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">
                  {breadcrumbs.map(bc => bc.label).join(" › ") || categoryLabel}
                </p>
                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-light text-slate-900 leading-none">
                  {product.name.split(" ").slice(0, -1).join(" ")}{" "}
                  <span className="font-bold italic">{product.name.split(" ").slice(-1)[0]}</span>
                </h1>
              </div>

              <div className="py-4 border-y border-black/5">
                <p className="text-3xl sm:text-4xl font-display font-bold text-slate-900 leading-none">
                  R$ {priceFormatted}
                </p>
                <p className="text-xs uppercase tracking-wider text-slate-400 mt-2">
                  ou <span className="font-bold text-slate-800">3x de R$ {installment}</span> sem juros
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest font-bold text-slate-400">Descrição</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Quantity + Add to cart */}
              <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="flex items-center border border-black/10 rounded-none overflow-hidden h-12">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="h-full w-12 flex items-center justify-center text-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    −
                  </button>
                  <span className="h-full w-12 flex items-center justify-center font-display font-semibold text-sm">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="h-full w-12 flex items-center justify-center text-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    +
                  </button>
                </div>

                <Button
                  onClick={handleAddToCart}
                  className="flex-1 h-12 rounded-none bg-primary text-primary-foreground hover:bg-moss-dark font-display text-xs uppercase tracking-widest font-bold border-none"
                >
                  <ShoppingCart className="h-4.5 w-4.5 mr-2 shrink-0" />
                  Adicionar à Sacola
                </Button>
              </div>

              {/* Benefits */}
              <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-black/5">
                <div className="flex items-center gap-3 p-4 rounded-none bg-slate-50 border border-black/5">
                  <Truck className="h-5 w-5 text-black shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-800">Frete Grátis</p>
                    <p className="text-[10px] text-slate-500">Acima de R$ 199</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-none bg-slate-50 border border-black/5">
                  <ShieldCheck className="h-5 w-5 text-black shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-800">100% Original</p>
                    <p className="text-[10px] text-slate-500">Garantia absoluta</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-none bg-slate-50 border border-black/5">
                  <RotateCcw className="h-5 w-5 text-black shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-800">Troca Fácil</p>
                    <p className="text-[10px] text-slate-500">Até 30 dias grátis</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="bg-slate-50 border-t border-black/5 py-12 sm:py-16">
            <div className="container mx-auto px-4 sm:px-12">
              <h2 className="text-xs uppercase tracking-[0.3em] font-black text-slate-400 mb-8">
                Produtos Relacionados
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
      <WhatsAppFloat />
    </div>
  );
};

export default ProductDetail;
