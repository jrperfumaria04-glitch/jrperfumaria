import { Link } from "react-router-dom";
import logoImg from "@/assets/logo.png";
import { ShoppingCart, User, Search, Menu, X, Heart, ChevronRight, ChevronLeft } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreConfig } from "@/contexts/StoreConfigContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { FavoritesDrawer } from "@/components/FavoritesDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const Header = ({ searchQuery, onSearchChange }: HeaderProps) => {
  const { totalItems } = useCart();
  const { favorites } = useFavorites();
  const { user, logout } = useAuth();
  const { config } = useStoreConfig();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [promoIndex, setPromoIndex] = useState(0);

  const promoMessages = (config.promoMessage || "")
    .split(";")
    .map((msg) => msg.trim())
    .filter(Boolean);

  const activeMessages = promoMessages.length > 0 ? promoMessages : [
    "Frete Grátis para todo o Brasil em compras acima de R$ 499",
    "Descubra nossa coleção exclusiva de perfumes importados",
    "Fragrâncias selecionadas com até 30% de desconto",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setPromoIndex((i) => (i + 1) % activeMessages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeMessages.length]);

  return (
    <header className="sticky top-0 z-50">
      {/* Promo Bar */}
      <div className="bg-promo-bar text-white">
        <div className="container mx-auto px-4 flex items-center justify-center h-8 relative overflow-hidden">
          <button
            onClick={() => setPromoIndex((i) => (i - 1 + activeMessages.length) % activeMessages.length)}
            className="absolute left-2 text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-medium text-center truncate px-8">
            {activeMessages[promoIndex % activeMessages.length]}
          </p>
          <button
            onClick={() => setPromoIndex((i) => (i + 1) % activeMessages.length)}
            className="absolute right-2 text-white/50 hover:text-white transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Header */}
      <div className="bg-white border-b border-black/5 shadow-none">
        <div className="container mx-auto px-4 sm:px-12">
          <div className="flex h-16 sm:h-20 items-center justify-between gap-4">
            {/* Mobile menu */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <img 
                src={config.logoUrl && config.logoUrl !== "default" ? config.logoUrl : logoImg} 
                alt={config.storeName} 
                className="h-12 sm:h-18 w-auto object-contain max-w-[160px] sm:max-w-[240px]" 
              />
            </Link>

            {/* Search - Desktop */}
            <div className="hidden lg:flex flex-1 max-w-xl relative">
              <Input
                placeholder="O que você procura hoje?"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-4 pr-12 h-11 bg-muted border-border rounded-full text-sm"
              />
              <button className="absolute right-1 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground rounded-full h-9 w-9 flex items-center justify-center hover:bg-accent transition-colors">
                <Search className="h-4 w-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-4">
              {user ? (
                <div className="hidden sm:flex items-center gap-1">
                  {user.isAdmin && (
                    <Link to="/admin">
                      <Button variant="ghost" size="sm" className="text-xs font-medium">
                        Painel Admin
                      </Button>
                    </Link>
                  )}
                  <Button variant="ghost" size="sm" className="text-xs" onClick={logout}>
                    Sair
                  </Button>
                </div>
              ) : (
                <Link to="/login" className="hidden sm:flex flex-col items-center gap-0.5 group">
                  <User className="h-5 w-5 text-foreground group-hover:text-primary transition-colors" />
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    Entrar
                  </span>
                </Link>
              )}

              <FavoritesDrawer>
                <button className="relative flex flex-col items-center gap-0.5 group cursor-pointer focus:outline-none">
                  <div className="relative">
                    <Heart className="h-5 w-5 text-foreground group-hover:text-primary transition-colors" />
                    {favorites.length > 0 && (
                      <span className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                        {favorites.length}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-primary transition-colors hidden sm:block">
                    Favoritos
                  </span>
                </button>
              </FavoritesDrawer>

              <Link to="/cart" className="relative flex flex-col items-center gap-0.5 group">
                <div className="relative">
                  <ShoppingCart className="h-5 w-5 text-foreground group-hover:text-primary transition-colors" />
                  {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                      {totalItems}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-primary transition-colors hidden sm:block">
                  Sacola
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Category Navigation - Desktop */}
        <div className="hidden lg:block border-t border-black/5 bg-white">
          <div className="container mx-auto px-4">
            <nav className="flex items-center justify-center gap-8 h-12 text-xs uppercase tracking-widest font-semibold text-slate-500">
              <Link to="/" className="text-black hover:opacity-80 transition-opacity">Início</Link>
              {config.categories.map((cat) => (
                <button
                  key={cat.id}
                  className="hover:text-black transition-colors relative group uppercase tracking-widest font-semibold text-xs"
                >
                  {cat.name}
                  <span className="absolute -bottom-1.5 left-0 w-0 h-0.5 bg-black transition-all group-hover:w-full" />
                </button>
              ))}
              <span className="text-primary hover:text-black transition-colors cursor-pointer tracking-widest font-semibold text-xs uppercase">
                Promoções
              </span>
            </nav>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-card border-b shadow-lg animate-in slide-in-from-top-2">
          <div className="container mx-auto px-4 py-4 space-y-4">
            <div className="relative">
              <Input
                placeholder="O que você procura hoje?"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-4 pr-12 h-11 bg-muted rounded-full"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {config.categories.map((cat) => (
                <button
                  key={cat.id}
                  className="text-sm font-medium text-foreground py-2 px-3 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground transition-colors text-left"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t space-y-2">
              <FavoritesDrawer>
                <Button variant="outline" size="sm" className="w-full flex items-center justify-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <Heart className="h-4 w-4 fill-destructive text-destructive" />
                  Ver Favoritos ({favorites.length})
                </Button>
              </FavoritesDrawer>

              {user ? (
                <>
                  <p className="text-sm text-muted-foreground px-1">{user.email}</p>
                  {user.isAdmin && (
                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full">
                        Painel Admin
                      </Button>
                    </Link>
                  )}
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => { logout(); setMobileMenuOpen(false); }}>
                    Sair
                  </Button>
                </>
              ) : (
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full">
                    Entrar / Cadastrar
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
