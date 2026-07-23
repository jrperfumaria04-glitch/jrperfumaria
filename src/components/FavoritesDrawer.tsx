import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Trash2, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";

interface FavoritesDrawerProps {
  children: React.ReactNode;
}

export const FavoritesDrawer = ({ children }: FavoritesDrawerProps) => {
  const { favorites, removeFavorite } = useFavorites();
  const { addItem } = useCart();
  const [open, setOpen] = useState(false);

  const handleAddToCart = (product: any) => {
    addItem(product);
    toast.success(`${product.name} adicionado à sacola!`);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-6 bg-white border-l border-black/10">
        <SheetHeader className="pb-4 border-b border-black/5">
          <SheetTitle className="font-display font-semibold text-lg flex items-center gap-2">
            <Heart className="h-5 w-5 fill-destructive text-destructive" />
            Meus Favoritos ({favorites.length})
          </SheetTitle>
        </SheetHeader>

        {favorites.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 p-4">
            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center border border-black/5">
              <Heart className="h-6 w-6 text-slate-300" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-800 text-sm">Lista de favoritos vazia</p>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                Toque no ícone de coração nos produtos para salvar suas fragrâncias preferidas aqui.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-none text-xs uppercase tracking-widest font-bold border-black/10 hover:bg-slate-50"
            >
              Explorar Perfumes
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scrollbar-thin">
            {favorites.map((product) => (
              <div
                key={product.id}
                className="flex gap-3 p-3 bg-white border border-black/5 hover:border-black/10 transition-colors duration-200"
              >
                <Link
                  to={`/produto/${product.id}`}
                  onClick={() => setOpen(false)}
                  className="h-16 w-16 rounded-none bg-slate-50 overflow-hidden shrink-0 border border-black/5 flex items-center justify-center"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </Link>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <Link
                      to={`/produto/${product.id}`}
                      onClick={() => setOpen(false)}
                      className="font-display font-semibold text-xs sm:text-sm text-slate-800 hover:text-neutral-500 transition-colors line-clamp-1 block"
                    >
                      {product.name}
                    </Link>
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest font-medium mt-0.5">
                      {product.category}
                    </p>
                  </div>
                  <div className="text-xs font-bold text-slate-900 font-display mt-1">
                    R$ {product.price.toFixed(2).replace(".", ",")}
                  </div>
                </div>
                <div className="flex flex-col gap-2 justify-center shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleAddToCart(product)}
                    className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5 rounded-none"
                    title="Adicionar à sacola"
                  >
                    <ShoppingCart className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeFavorite(product.id)}
                    className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-none"
                    title="Remover dos favoritos"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
