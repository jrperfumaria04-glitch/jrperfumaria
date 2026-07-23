import { MessageCircle } from "lucide-react";
import { useStoreConfig } from "@/contexts/StoreConfigContext";

const WhatsAppFloat = () => {
  const { config } = useStoreConfig();

  const handleClick = () => {
    const message = encodeURIComponent("Olá! Vim pelo site da JR Perfumaria e gostaria de mais informações.");
    window.open(`https://wa.me/${config.whatsappNumber}?text=${message}`, "_blank");
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-full h-14 w-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group"
      aria-label="Fale pelo WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
      <span className="absolute right-full mr-3 bg-card text-foreground text-xs font-medium px-3 py-1.5 rounded-lg shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Compre pelo WhatsApp
      </span>
    </button>
  );
};

export default WhatsAppFloat;
