import { useState, useMemo } from "react";
import { useStoreConfig } from "@/contexts/StoreConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Printer, Plus, Minus, AlertTriangle, Calendar, Check, Save } from "lucide-react";
import { toast } from "sonner";
import { Product } from "@/types/store";

const formatToBrazilianDateMask = (value: string) => {
  const clean = value.replace(/\D/g, "");
  if (clean.length <= 2) return clean;
  if (clean.length <= 4) return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 8)}`;
};

const isoToBrDate = (isoStr?: string): string => {
  if (!isoStr) return "";
  if (isoStr.includes("/")) return isoStr;
  const parts = isoStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoStr;
};

const brToIsoDate = (brStr?: string): string => {
  if (!brStr) return "";
  const parts = brStr.split("/");
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    if (y.length === 4) {
      return `${y}-${m}-${d}`;
    }
  }
  return brStr;
};

const AdminStock = () => {
  const { config, updateProduct } = useStoreConfig();
  const [searchTerm, setSearchTerm] = useState("");
  const [daysFilter, setDaysFilter] = useState("30"); // "all", "expired", "15", "30", "60", "90"
  
  // Local state to track modified quantities/skus/expiration dates before saving
  const [editStates, setEditStates] = useState<Record<string, { stock: string; sku: string; expirationDate: string }>>({});

  const handleLocalChange = (productId: string, field: "stock" | "sku" | "expirationDate", value: string) => {
    const product = config.products.find(p => p.id === productId);
    if (!product) return;

    setEditStates(prev => {
      const current = prev[productId] || {
        stock: (product.stock !== undefined ? product.stock : "").toString(),
        sku: product.sku || "",
        expirationDate: product.expirationDate || "",
      };
      return {
        ...prev,
        [productId]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  const handleIncrement = (productId: string) => {
    const product = config.products.find(p => p.id === productId);
    if (!product) return;

    const currentEdit = editStates[productId] || {
      stock: (product.stock !== undefined ? product.stock : "0").toString(),
      sku: product.sku || "",
      expirationDate: product.expirationDate || "",
    };

    const currentStockNum = parseInt(currentEdit.stock) || 0;
    const newStock = Math.max(0, currentStockNum + 1).toString();
    handleLocalChange(productId, "stock", newStock);
  };

  const handleDecrement = (productId: string) => {
    const product = config.products.find(p => p.id === productId);
    if (!product) return;

    const currentEdit = editStates[productId] || {
      stock: (product.stock !== undefined ? product.stock : "0").toString(),
      sku: product.sku || "",
      expirationDate: product.expirationDate || "",
    };

    const currentStockNum = parseInt(currentEdit.stock) || 0;
    const newStock = Math.max(0, currentStockNum - 1).toString();
    handleLocalChange(productId, "stock", newStock);
  };

  const handleSaveProductStock = (productId: string) => {
    const local = editStates[productId];
    if (!local) return;

    const updates: Partial<Product> = {};
    if (local.stock !== "") {
      updates.stock = parseInt(local.stock) || 0;
    } else {
      updates.stock = undefined;
    }
    updates.sku = local.sku || undefined;

    let expDate = local.expirationDate || undefined;
    if (expDate) {
      if (expDate.includes("/")) {
        toast.error("Insira a data de validade completa no formato DD/MM/AAAA.");
        return;
      }
      const parsedDate = new Date(expDate + "T12:00:00");
      if (isNaN(parsedDate.getTime())) {
        toast.error("Data de validade inválida. Use o formato DD/MM/AAAA.");
        return;
      }
    }
    updates.expirationDate = expDate;

    updateProduct(productId, updates);
    toast.success("Informações de estoque atualizadas!");
    
    // Remove from edit states since it's saved
    setEditStates(prev => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  // Expiration calculation helper
  const getExpirationStatus = (expDateStr?: string) => {
    if (!expDateStr) return { status: "none", daysLeft: null, label: "Sem validade" };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expDate = new Date(expDateStr + "T12:00:00");
    const diffTime = expDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return { status: "expired", daysLeft, label: `Vencido há ${Math.abs(daysLeft)} dias` };
    } else if (daysLeft === 0) {
      return { status: "today", daysLeft, label: "Vence hoje!" };
    } else if (daysLeft <= 15) {
      return { status: "warning-urgent", daysLeft, label: `Vence em ${daysLeft} dias` };
    } else if (daysLeft <= 30) {
      return { status: "warning-near", daysLeft, label: `Vence em ${daysLeft} dias` };
    } else {
      return { status: "ok", daysLeft, label: `Vence em ${daysLeft} dias` };
    }
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return config.products.filter(product => {
      // 1. Search filter
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;

      // 2. Expiration Days filter
      if (daysFilter === "all") return true;

      const { status, daysLeft } = getExpirationStatus(product.expirationDate);

      if (daysFilter === "expired") {
        return status === "expired" || status === "today";
      }

      const limitDays = parseInt(daysFilter);
      if (!isNaN(limitDays)) {
        if (daysLeft === null) return false; // ignore items without expiry if filtered by expiry
        return daysLeft >= 0 && daysLeft <= limitDays;
      }

      return true;
    });
  }, [config.products, searchTerm, daysFilter]);

  // Handle report printing
  const handlePrint = () => {
    // Generate styled print window
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Por favor, permita pop-ups para imprimir o relatório.");
      return;
    }

    const titleMap: Record<string, string> = {
      all: "Todos os Produtos no Estoque",
      expired: "Produtos Vencidos",
      "15": "Produtos a Vencer em até 15 Dias",
      "30": "Produtos a Vencer em até 30 Dias",
      "60": "Produtos a Vencer em até 60 Dias",
      "90": "Produtos a Vencer em até 90 Dias",
    };

    const filterTitle = titleMap[daysFilter] || "Relatório de Validades";
    const todayStr = new Date().toLocaleDateString("pt-BR");

    const rowsHtml = filteredProducts.map((p, idx) => {
      const exp = getExpirationStatus(p.expirationDate);
      const catObj = config.categories.find(c => c.slug === p.category);
      const categoryName = catObj ? catObj.name : p.category;
      
      let valStyle = "";
      if (exp.status === "expired") valStyle = "color: #ef4444; font-weight: bold;";
      else if (exp.status === "warning-urgent") valStyle = "color: #f97316; font-weight: bold;";

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${p.sku || "-"}</td>
          <td><strong>${p.name}</strong></td>
          <td>${categoryName}</td>
          <td style="text-align: center;">${p.stock !== undefined ? p.stock + " un" : "Não definido"}</td>
          <td style="text-align: center; ${valStyle}">
            ${p.expirationDate ? new Date(p.expirationDate + "T12:00:00").toLocaleDateString("pt-BR") : "-"}
          </td>
          <td>${exp.label}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Validade e Estoque</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #333;
              margin: 30px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
              margin-bottom: 25px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .header p {
              margin: 5px 0 0 0;
              color: #666;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: left;
              font-size: 13px;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .footer {
              text-align: center;
              font-size: 11px;
              color: #777;
              border-top: 1px solid #ddd;
              padding-top: 15px;
              margin-top: 50px;
            }
            @media print {
              body { margin: 15px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${config.storeName}</h1>
              <p>Relatório de Controle de Estoque e Validade</p>
            </div>
            <div style="text-align: right;">
              <p><strong>Filtro:</strong> ${filterTitle}</p>
              <p><strong>Gerado em:</strong> ${todayStr}</p>
            </div>
          </div>

          <h2 style="font-size: 18px; margin-bottom: 15px; color: #1e293b;">${filterTitle} (${filteredProducts.length} itens encontrados)</h2>

          ${filteredProducts.length === 0 ? `
            <p style="text-align: center; padding: 40px; border: 1px dashed #ccc; background: #fafafa; border-radius: 4px;">
              Nenhum produto atende aos critérios deste filtro.
            </p>
          ` : `
            <table>
              <thead>
                <tr>
                  <th style="width: 5%">#</th>
                  <th style="width: 12%">SKU / Cód.</th>
                  <th style="width: 35%">Nome do Produto</th>
                  <th style="width: 15%">Categoria</th>
                  <th style="width: 10%; text-align: center;">Qtd</th>
                  <th style="width: 12%; text-align: center;">Validade</th>
                  <th style="width: 11%">Situação</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          `}

          <div class="footer">
            <p>Gerado automaticamente pelo Painel Administrativo de ${config.storeName} - © ${new Date().getFullYear()}</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
              // Optionally close window after print dialog closes
              // setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Introduction & Search controls */}
      <div className="bg-card p-5 rounded-lg border space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Controle de Estoque e Validades</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitore a quantidade de produtos em estoque, controle as datas de vencimento e gere relatórios prontos para impressão.
            </p>
          </div>
          
          <Button variant="hero" onClick={handlePrint} className="gap-2 self-start md:self-auto shrink-0">
            <Printer className="h-4 w-4" />
            Imprimir Relatório
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {/* Search bar */}
          <div className="space-y-1.5">
            <Label htmlFor="stock-search">Buscar por Nome ou SKU</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="stock-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ex: perfume masculino"
                className="pl-9"
              />
            </div>
          </div>

          {/* Expiration warning Filter */}
          <div className="space-y-1.5 col-span-1 sm:col-span-1 md:col-span-2">
            <Label htmlFor="expiry-filter">Filtrar Vencimento (Próximos Dias)</Label>
            <Select value={daysFilter} onValueChange={setDaysFilter}>
              <SelectTrigger id="expiry-filter">
                <SelectValue placeholder="Selecione o filtro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Exibir Todos os Produtos</SelectItem>
                <SelectItem value="expired" className="text-red-500 font-semibold">❌ Apenas Vencidos / Vencendo Hoje</SelectItem>
                <SelectItem value="15">⚠️ Vencendo nos próximos 15 dias</SelectItem>
                <SelectItem value="30">⚠️ Vencendo nos próximos 30 dias</SelectItem>
                <SelectItem value="60">📅 Vencendo nos próximos 60 dias</SelectItem>
                <SelectItem value="90">📅 Vencendo nos próximos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Products stock editor list */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-sm font-medium text-muted-foreground">
            Mostrando {filteredProducts.length} de {config.products.length} produtos
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-card border border-dashed rounded-lg">
            <p className="text-muted-foreground">Nenhum produto encontrado com os filtros atuais.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredProducts.map((p) => {
              const local = editStates[p.id] || {
                stock: (p.stock !== undefined ? p.stock : "").toString(),
                sku: p.sku || "",
                expirationDate: p.expirationDate || "",
              };

              const hasChanges = 
                local.sku !== (p.sku || "") ||
                local.stock !== (p.stock !== undefined ? p.stock : "").toString() ||
                local.expirationDate !== (p.expirationDate || "");

              const exp = getExpirationStatus(p.expirationDate);

              return (
                <div 
                  key={p.id} 
                  className={`flex flex-col md:flex-row gap-4 p-4 bg-card rounded-lg border items-start md:items-center transition-all ${
                    exp.status === "expired" 
                      ? "border-red-300 dark:border-red-900 bg-red-50/10 dark:bg-red-950/5" 
                      : exp.status === "warning-urgent" 
                      ? "border-orange-300 dark:border-orange-900 bg-orange-50/10" 
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {/* Basic product info */}
                  <div className="flex gap-3 items-center w-full md:w-1/3 min-w-0">
                    <img src={p.image} alt={p.name} className="h-12 w-12 rounded object-cover shrink-0 border" />
                    <div className="min-w-0">
                      <h4 className="font-semibold text-foreground truncate text-sm" title={p.name}>
                        {p.name}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {config.categories.find(c => c.slug === p.category)?.name || p.category} • R$ {p.price.toFixed(2).replace(".", ",")}
                      </p>
                      
                      {/* Expiration date status badge */}
                      {p.expirationDate ? (
                        <div className="flex flex-col gap-1 mt-1">
                          <span className={`inline-flex items-center gap-1 self-start px-1.5 py-0.5 text-[10px] rounded font-bold uppercase tracking-wide ${
                            exp.status === "expired" 
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400" 
                              : exp.status === "today"
                              ? "bg-red-500 text-white"
                              : exp.status.startsWith("warning")
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-400"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                          }`}>
                            <Calendar className="h-3 w-3" />
                            {exp.label}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            Validade: <span className="font-semibold text-foreground">{new Date(p.expirationDate + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 text-[10px] rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-medium uppercase tracking-wide">
                          Sem validade cadastrada
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stock updater & fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:flex-1 md:items-center">
                    {/* SKU input */}
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">SKU / Cód</Label>
                      <Input
                        value={local.sku}
                        onChange={(e) => handleLocalChange(p.id, "sku", e.target.value)}
                        placeholder="Sem código"
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    {/* Stock counter */}
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Qtd Estoque</Label>
                      <div className="flex items-center">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 rounded-r-none shrink-0" 
                          onClick={() => handleDecrement(p.id)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={local.stock}
                          onChange={(e) => handleLocalChange(p.id, "stock", e.target.value)}
                          placeholder="0"
                          className="h-8 text-center rounded-none border-x-0 font-medium text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 rounded-l-none shrink-0" 
                          onClick={() => handleIncrement(p.id)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Expiration date */}
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Data de Validade (DD/MM/AAAA)</Label>
                      <Input
                        type="text"
                        placeholder="Ex: 31/12/2026"
                        maxLength={10}
                        value={isoToBrDate(local.expirationDate)}
                        onChange={(e) => {
                          const masked = formatToBrazilianDateMask(e.target.value);
                          const iso = brToIsoDate(masked);
                          handleLocalChange(p.id, "expirationDate", iso || masked);
                        }}
                        className="h-8 text-xs px-2"
                      />
                    </div>
                  </div>

                  {/* Actions (Save changes) */}
                  <div className="flex md:flex-col justify-end w-full md:w-auto pt-2 md:pt-0 shrink-0">
                    <Button
                      size="sm"
                      variant={hasChanges ? "hero" : "outline"}
                      disabled={!hasChanges}
                      onClick={() => handleSaveProductStock(p.id)}
                      className="gap-1.5 h-8 w-full md:w-28 text-xs font-semibold"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Salvar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminStock;
