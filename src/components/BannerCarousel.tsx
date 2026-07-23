import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoreConfig } from "@/contexts/StoreConfigContext";

const BannerCarousel = () => {
  const { config } = useStoreConfig();
  const [deviceType, setDeviceType] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType("mobile");
      } else if (width < 1024) {
        setDeviceType("tablet");
      } else {
        setDeviceType("desktop");
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const banners = config.banners.filter((b) => {
    if (!b.active) return false;
    if (!b.device || b.device === "all") return true;
    return b.device === deviceType;
  });

  useEffect(() => {
    setCurrent(0);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const activeBanner = banners[current] || banners[0];
  if (!activeBanner) return null;

  const prev = () => setCurrent((c) => (c - 1 + banners.length) % banners.length);
  const next = () => setCurrent((c) => (c + 1) % banners.length);

  return (
    <div className="relative w-full h-[240px] sm:h-[360px] lg:h-[480px] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeBanner.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 bg-black"
        >
          <img
            src={activeBanner.image}
            alt={activeBanner.title}
            className="h-full w-full object-cover"
            style={{ opacity: (activeBanner.opacity ?? 100) / 100 }}
          />
          {/* Side background overlay / gradient under text */}
          <div 
            className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent pointer-events-none" 
            style={{ opacity: (activeBanner.overlayOpacity ?? 60) / 100 }}
          />
          <div className="absolute inset-0 flex items-center">
            <div className="container mx-auto px-6 sm:px-12">
              {(activeBanner.title || activeBanner.subtitle || activeBanner.cta) && (
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="max-w-md space-y-4 bg-background/85 dark:bg-background/90 backdrop-blur-md p-6 sm:p-8 rounded-lg border border-border/10 shadow-2xl"
                >
                  <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] uppercase font-bold tracking-widest rounded-none">
                    Lançamento Exclusivo
                  </span>
                  {activeBanner.title && (
                    <h2 className="font-display text-2xl sm:text-3xl font-light text-foreground leading-tight tracking-tight">
                      {activeBanner.title.includes(" ") ? (
                        <>
                          {activeBanner.title.split(" ").slice(0, -1).join(" ")}{" "}
                          <span className="font-bold italic">{activeBanner.title.split(" ").slice(-1)[0]}</span>
                        </>
                      ) : (
                        <span className="font-bold">{activeBanner.title}</span>
                      )}
                    </h2>
                  )}
                  {activeBanner.subtitle && (
                    <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                      {activeBanner.subtitle}
                    </p>
                  )}
                  {activeBanner.cta && (
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-moss-dark font-display font-bold text-xs uppercase tracking-[0.2em] rounded-none px-8 h-12 mt-2 w-full sm:w-auto"
                    >
                      {activeBanner.cta}
                      <ChevronRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-card/20 p-2.5 backdrop-blur-sm hover:bg-card/40 transition"
          >
            <ChevronLeft className="h-5 w-5 text-card" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-card/20 p-2.5 backdrop-blur-sm hover:bg-card/40 transition"
          >
            <ChevronRight className="h-5 w-5 text-card" />
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === current ? "w-8 bg-card" : "w-2.5 bg-card/40"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BannerCarousel;
