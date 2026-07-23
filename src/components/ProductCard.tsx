import { Product } from "@/types/store";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    toast.success(`${product.name} adicionado à sacola!`);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product);
  };

  const liked = isFavorite(product.id);
  const priceFormatted = product.price.toFixed(2).replace(".", ",");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group bg-white border border-black/5 rounded-none overflow-hidden hover:border-black/10 transition-all duration-300 shadow-none"
    >
      <Link to={`/produto/${product.id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-slate-50 flex items-center justify-center">
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <button
            onClick={handleLike}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors z-10 border border-black/5"
          >
            <Heart
              className={`h-3.5 w-3.5 transition-colors ${liked ? "fill-destructive text-destructive" : "text-slate-400 group-hover:text-slate-600"}`}
            />
          </button>
          {product.featured && (
            <span className="absolute top-3 left-3 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-none">
              Destaque
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-10">
            <Button
              onClick={handleAddToCart}
              className="w-full rounded-none h-11 bg-primary text-primary-foreground hover:bg-moss-dark font-display text-xs uppercase tracking-widest font-bold border-none"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Adicionar à Sacola
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
            {product.category}
          </p>
          <h3 className="font-display text-xs sm:text-sm font-semibold text-slate-800 truncate group-hover:text-neutral-500 transition-colors">
            {product.name}
          </h3>
          <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed">
            {product.description}
          </p>
          <div className="pt-1 flex flex-col gap-0.5">
            <span className="text-sm sm:text-base font-bold text-slate-900 font-display">
              R$ {priceFormatted}
            </span>
            <p className="text-[9px] uppercase tracking-wider text-slate-400">
              ou 3x de R$ {(product.price / 3).toFixed(2).replace(".", ",")} sem juros
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
