import { useCart } from "@/contexts/CartContext";
import { useStoreConfig } from "@/contexts/StoreConfigContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ArrowLeft, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

const Cart = () => {
  const { items, removeItem, updateQuantity, clearCart, totalPrice } = useCart();
  const { config } = useStoreConfig();

  const buildWhatsAppMessage = () => {
    let message = `🛒 *Pedido ${config.storeName}*\n\n`;
    items.forEach((item, index) => {
      const skuStr = item.product.sku ? ` [SKU: ${item.product.sku}]` : "";
      message += `${index + 1}. *${item.product.name}${skuStr}*\n`;
      message += `   Qtd: ${item.quantity} x R$ ${item.product.price.toFixed(2).replace(".", ",")}\n`;
      message += `   Subtotal: R$ ${(item.product.price * item.quantity).toFixed(2).replace(".", ",")}\n\n`;
    });
    message += `━━━━━━━━━━━━━━━\n`;
    message += `*Total: R$ ${totalPrice.toFixed(2).replace(".", ",")}*\n\n`;
    message += `📦 Aguardo confirmação do pedido!`;
    return encodeURIComponent(message);
  };

  const handleFinalize = () => {
    const url = `https://wa.me/${config.whatsappNumber}?text=${buildWhatsAppMessage()}`;
    window.open(url, "_blank");
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFDFD] px-4">
        <div className="text-center space-y-5 max-w-sm">
          <h1 className="text-xs uppercase tracking-[0.3em] font-black text-slate-400">Sacola Vazia</h1>
          <p className="text-sm text-slate-500 leading-relaxed">Sua sacola está vazia. Adicione fragrâncias exclusivas para começar.</p>
          <Link to="/" className="inline-block mt-4">
            <Button className="bg-primary text-primary-foreground hover:bg-moss-dark rounded-none px-8 h-12 text-xs uppercase tracking-widest font-bold">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Início
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD]">
      <div className="container mx-auto px-4 sm:px-12 py-12 max-w-4xl">
        <Link to="/" className="inline-flex items-center text-xs uppercase tracking-wider font-bold text-slate-400 hover:text-black transition mb-8">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Continuar comprando
        </Link>

        <h1 className="text-xs uppercase tracking-[0.3em] font-black text-slate-400 mb-8">Sua Sacola</h1>

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.product.id} className="flex flex-col sm:flex-row gap-4 p-4 bg-white border border-black/5 rounded-none items-center">
              <img src={item.product.image} alt={item.product.name} className="h-20 w-20 rounded-none object-cover shrink-0 border border-black/5" />
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h3 className="font-display font-semibold text-slate-800 truncate text-sm sm:text-base">{item.product.name}</h3>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-medium mt-1">{item.product.category}</p>
                <p className="text-sm text-slate-900 font-medium mt-1">R$ {item.product.price.toFixed(2).replace(".", ",")}</p>
              </div>
              <div className="flex items-center gap-2 border border-black/10 rounded-none h-9">
                <button 
                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                  className="h-full px-3 text-sm font-semibold hover:bg-slate-50 border-r border-black/10"
                >
                  −
                </button>
                <span className="w-8 text-center text-xs font-bold text-slate-800">{item.quantity}</span>
                <button 
                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                  className="h-full px-3 text-sm font-semibold hover:bg-slate-50 border-l border-black/10"
                >
                  +
                </button>
              </div>
              <div className="text-center sm:text-right min-w-[100px]">
                <span className="font-bold text-slate-900 font-display text-base">
                  R$ {(item.product.price * item.quantity).toFixed(2).replace(".", ",")}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeItem(item.product.id)} className="text-slate-400 hover:text-rose-600 shrink-0 h-9 w-9">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-white border border-black/5 rounded-none space-y-6">
          <div className="flex justify-between items-center border-b border-black/5 pb-4">
            <span className="text-xs uppercase tracking-widest font-bold text-slate-400">Total do Pedido</span>
            <span className="text-2xl font-bold text-slate-900 font-display">
              R$ {totalPrice.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={clearCart} className="rounded-none border-black/10 text-xs uppercase tracking-widest font-bold h-12 text-slate-500 hover:text-black">Limpar Carrinho</Button>
            <Button onClick={handleFinalize} className="flex-1 rounded-none bg-primary text-primary-foreground hover:bg-moss-dark font-display text-xs uppercase tracking-[0.15em] font-bold h-12 border-none">
              <MessageCircle className="h-4.5 w-4.5 mr-2 shrink-0" /> Finalizar via WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
