import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { ArrowLeft, Settings, Image, Tag, Package, Boxes, Award } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminBanners from "@/components/admin/AdminBanners";
import AdminCategories from "@/components/admin/AdminCategories";
import AdminProducts from "@/components/admin/AdminProducts";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminStock from "@/components/admin/AdminStock";
import AdminBrands from "@/components/admin/AdminBrands";

const Admin = () => {
  const { user } = useAuth();

  if (!user?.isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar à loja
        </Link>

        <h1 className="font-display text-3xl font-bold text-foreground mb-8">Painel Administrativo</h1>

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="products" className="gap-1.5">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="stock" className="gap-1.5">
              <Boxes className="h-4 w-4" />
              <span className="hidden sm:inline">Estoque</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Categorias</span>
            </TabsTrigger>
            <TabsTrigger value="brands" className="gap-1.5">
              <Award className="h-4 w-4" />
              <span className="hidden sm:inline">Marcas</span>
            </TabsTrigger>
            <TabsTrigger value="banners" className="gap-1.5">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Banners</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <AdminProducts />
          </TabsContent>
          <TabsContent value="stock">
            <AdminStock />
          </TabsContent>
          <TabsContent value="categories">
            <AdminCategories />
          </TabsContent>
          <TabsContent value="brands">
            <AdminBrands />
          </TabsContent>
          <TabsContent value="banners">
            <AdminBanners />
          </TabsContent>
          <TabsContent value="settings">
            <AdminSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
