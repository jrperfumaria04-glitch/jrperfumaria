import { useStoreConfig } from "@/contexts/StoreConfigContext";
import { MapPin, Mail, Phone, Instagram, Facebook } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { formatWhatsAppNumber } from "@/lib/utils";

const Footer = () => {
  const { config } = useStoreConfig();
  const { footer } = config;

  const address = footer.address || "Av. Brasil, 1200 - Centro, Passo Fundo - RS";
  
  // Convert standard Google Maps links into embed format so they don't break in iframe
  const getEmbedMapUrl = (rawUrl: string, fallbackAddress: string) => {
    const url = rawUrl || `https://www.google.com/maps?q=-28.16343879699707,-51.93328857421875&z=17&hl=pt-PT`;
    
    if (url.includes("output=embed") || url.includes("/embed") || url.includes("embed?pb=")) {
      return url;
    }

    if (url.includes("google.com/maps") || url.includes("maps.google.com")) {
      try {
        const urlObj = new URL(url);
        const q = urlObj.searchParams.get("q");
        const z = urlObj.searchParams.get("z") || "17";
        const hl = urlObj.searchParams.get("hl") || "pt-PT";
        
        if (q) {
          return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=&z=${z}&ie=UTF8&iwloc=&output=embed&hl=${hl}`;
        }
      } catch (e) {
        console.error("Failed to parse map URL query parameters, appending embed option:", e);
      }
      
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}output=embed`;
    }

    return `https://maps.google.com/maps?q=${encodeURIComponent(fallbackAddress)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  };

  const mapUrl = getEmbedMapUrl(footer.mapEmbedUrl || "", address);

  return (
    <footer className="mt-16">
      {/* Information Section - White Background like Header */}
      <div className="bg-white dark:bg-card border-t border-black/5 py-12 text-slate-800 dark:text-slate-200">
        <div className="container mx-auto px-4 sm:px-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10">
            {/* Brand */}
            <div className="space-y-4 lg:col-span-3">
              <div className="flex items-center">
                <img 
                  src={config.logoUrl && config.logoUrl !== "default" ? config.logoUrl : logoImg} 
                  alt={config.storeName} 
                  className="h-10 sm:h-12 w-auto object-contain" 
                />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                {footer.description}
              </p>
              <div className="flex gap-2 pt-2">
                {footer.instagramUrl !== "none" && (
                  <a 
                    href={footer.instagramUrl || "https://instagram.com/jrperfumaria"} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 w-9 rounded-none bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-primary dark:bg-white/5 dark:border-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors border border-slate-200/50"
                  >
                    <Instagram className="h-4 w-4" />
                  </a>
                )}
                {footer.facebookUrl !== "none" && (
                  <a 
                    href={footer.facebookUrl || "https://facebook.com/jrperfumaria"} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 w-9 rounded-none bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-primary dark:bg-white/5 dark:border-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors border border-slate-200/50"
                  >
                    <Facebook className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Links */}
            <div className="lg:col-span-2">
              <h4 className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-900 dark:text-slate-100 mb-4">
                Navegação
              </h4>
              <ul className="space-y-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <li><a href="/" className="hover:text-primary dark:hover:text-white transition-colors">Início</a></li>
                <li><a href="/" className="hover:text-primary dark:hover:text-white transition-colors">Promoções</a></li>
                <li><a href="/" className="hover:text-primary dark:hover:text-white transition-colors">Lançamentos</a></li>
                <li><a href="/login" className="hover:text-primary dark:hover:text-white transition-colors">Minha Conta</a></li>
              </ul>
            </div>

            {/* Categories */}
            <div className="lg:col-span-2">
              <h4 className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-900 dark:text-slate-100 mb-4">
                Categorias
              </h4>
              <ul className="space-y-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                {config.categories.slice(0, 5).map((cat) => (
                  <li key={cat.id}>
                    <a href="/" className="hover:text-primary dark:hover:text-white transition-colors">{cat.name}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div className="lg:col-span-2">
              <h4 className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-900 dark:text-slate-100 mb-4">
                Contato
              </h4>
              <ul className="space-y-3 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                  {formatWhatsAppNumber(config.whatsappNumber)}
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="break-all">{footer.email}</span>
                </li>
                {address && (
                  <li className="flex items-start gap-2 pt-2 border-t border-black/5 dark:border-white/5 mt-2">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="normal-case leading-relaxed font-medium text-[11px] text-slate-600 dark:text-slate-400">
                      {address}
                    </span>
                  </li>
                )}
              </ul>
            </div>

            {/* Map Column */}
            <div className="lg:col-span-3 space-y-4">
              <h4 className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" /> Como Chegar
              </h4>
              <div className="w-full h-36 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-muted relative shadow-inner">
                <iframe
                  title="Localização da Loja"
                  src={mapUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright Bar - Dark (As it was: bg-promo-bar) */}
      <div className="bg-promo-bar text-white py-6 border-t border-black/5">
        <div className="container mx-auto px-4 sm:px-12 text-center text-[10px] uppercase tracking-widest text-slate-400 font-bold">
          {footer.copyright}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
