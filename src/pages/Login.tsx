import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showConfigError, setShowConfigError] = useState<"email-password" | "google" | null>(null);
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setShowConfigError(null);
    try {
      const result = await loginWithGoogle();
      if (result.success) {
        toast.success("Login com Google concluído!");
        navigate("/");
      } else {
        if (result.code === "auth/operation-not-allowed") {
          setShowConfigError("google");
          toast.error("O login com Google não está ativado no projeto Firebase.");
        } else {
          toast.error(result.error || "Erro ao fazer login com Google.");
        }
      }
    } catch (err) {
      toast.error("Erro no processo de login com Google.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfigError(null);
    try {
      if (isRegister) {
        const result = await register(email, password);
        if (result.success) {
          toast.success("Cadastro realizado com sucesso!");
          navigate("/");
        } else {
          if (result.code === "auth/operation-not-allowed") {
            setShowConfigError("email-password");
            toast.error("O cadastro por Email/Senha não está ativado no Firebase.");
          } else {
            toast.error(result.error || "Erro ao cadastrar. Verifique os dados.");
          }
        }
      } else {
        const result = await login(email, password);
        if (result.success) {
          toast.success("Login realizado com sucesso!");
          navigate("/");
        } else {
          if (result.code === "auth/operation-not-allowed") {
            setShowConfigError("email-password");
            toast.error("O login por Email/Senha não está ativado no Firebase.");
          } else {
            toast.error(result.error || "Email ou senha inválidos.");
          }
        }
      }
    } catch (err) {
      toast.error("Ocorreu um erro no processo de autenticação.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] px-4">
      <div className="w-full max-w-md space-y-6">
        <Link to="/" className="inline-flex items-center text-xs uppercase tracking-widest font-bold text-slate-400 hover:text-black transition">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
        </Link>

        <div className="text-center">
          <div className="text-2xl font-bold tracking-tighter uppercase italic text-foreground font-display">
            JR <span className="font-light not-italic text-slate-400">Perfumaria</span>
          </div>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mt-3">
            {isRegister ? "Crie sua conta" : "Acesse sua conta"}
          </p>
        </div>

        {showConfigError && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-none space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider font-display">
                  Configuração de Autenticação Necessária
                </h3>
                <p className="text-[11px] text-amber-700 mt-1 leading-normal">
                  O provedor de {showConfigError === "email-password" ? "E-mail/Senha" : "Google Login"} não está ativado no seu projeto Firebase. Ative-o manualmente no console para liberar o acesso.
                </p>
              </div>
            </div>
            <div className="text-[11px] text-amber-900 bg-white/70 p-3 rounded-none border border-amber-100 space-y-1">
              <p className="font-bold uppercase tracking-wider text-[9px] text-amber-700">Como ativar no Firebase Console:</p>
              <ol className="list-decimal pl-4 space-y-1 text-amber-800 font-sans text-[10.5px]">
                <li>Acesse o <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-amber-950">Firebase Console</a></li>
                <li>Selecione o seu projeto correspondente</li>
                <li>No menu lateral, clique em <strong className="font-bold">Authentication</strong></li>
                <li>Acesse a aba <strong className="font-bold">Sign-in method</strong></li>
                <li>Clique em <strong className="font-bold">Adicionar novo provedor</strong></li>
                <li>Selecione <strong className="font-bold">{showConfigError === "email-password" ? "E-mail/senha" : "Google"}</strong>, ative e salve</li>
              </ol>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-8 rounded-none border border-black/5 shadow-none pb-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="rounded-none border-black/10 bg-slate-50 focus-visible:ring-black h-10 text-sm"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-none border-black/10 bg-slate-50 focus-visible:ring-black h-10 text-sm"
              required
              minLength={4}
            />
          </div>
          <Button type="submit" className="w-full rounded-none bg-primary text-primary-foreground hover:bg-moss-dark font-display text-xs uppercase tracking-widest font-bold h-11 border-none pt-0.5">
            {isRegister ? "Cadastrar" : "Entrar"}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-black/5" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
              <span className="bg-white px-2 text-slate-400">Ou</span>
            </div>
          </div>

          <Button 
            type="button" 
            onClick={handleGoogleLogin} 
            variant="outline" 
            className="w-full rounded-none border border-black/10 text-slate-800 hover:bg-slate-50 font-display text-xs uppercase tracking-widest font-bold h-11"
          >
            Entrar com Google
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400">
          {isRegister ? "Já tem uma conta?" : "Não tem uma conta?"}{" "}
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-black font-bold uppercase tracking-wider text-xs ml-1 hover:opacity-80 transition-opacity"
          >
            {isRegister ? "Fazer login" : "Cadastre-se"}
          </button>
        </p>

        <p className="text-center text-[10px] uppercase tracking-widest text-slate-400 bg-slate-50 border border-black/5 p-3 rounded-none">
          Acesso Admin de Teste:<br />
          <span className="font-bold text-slate-700">admin@jr.com</span> / <span className="font-bold text-slate-700">admin123</span>
        </p>
      </div>
    </div>
  );
};

export default Login;
