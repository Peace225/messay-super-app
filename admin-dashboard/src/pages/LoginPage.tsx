import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';
import logoMessay from '../assets/logo.png'; // ← ton logo local

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authService.login({ email, password });
      const userData = response.user || response.data?.user;
      if (userData) {
        login(userData);
        navigate('/', { replace: true });
      } else {
        throw new Error("Format invalide");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Impossible de joindre le serveur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.08] via-transparent to-violet-500/[0.05]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-orange-500/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)`, backgroundSize: '32px 32px' }} />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-orange-500 blur-3xl opacity-25 rounded-full" />
            <img src={logoMessay} alt="MESSAY" className="relative h-20 w-auto object-contain drop-shadow-2xl" />
          </div>
          <h1 className="text-[28px] font-black tracking-tight text-white">MESSAY<span className="text-orange-500">.</span></h1>
          <p className="text-white/40 text-[13px] mt-1">Admin Console • Abidjan</p>
        </div>

        <div className="relative overflow-hidden rounded-[32px] bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-[22px] font-bold text-white">Connexion sécurisée</h2>
              <p className="text-white/40 text-[13px] mt-1">Accédez à votre tableau de bord</p>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 flex gap-3">
                <Shield size={16} className="text-red-400 mt-0.5" />
                <p className="text-[13px] text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2">Email</label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-orange-400" size={18} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@messay.ci" className="w-full h-12 pl-11 pr-4 bg-white/[0.03] border border-white/10 rounded-2xl text-white placeholder-white/25 outline-none focus:border-orange-500/50 focus:bg-white/[0.05]" required />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2">Mot de passe</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-orange-400" size={18} />
                  <input type={showPassword?'text':'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full h-12 pl-11 pr-12 bg-white/[0.03] border border-white/10 rounded-2xl text-white placeholder-white/25 outline-none focus:border-orange-500/50 focus:bg-white/[0.05]" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                    {showPassword? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full h-12 mt-2 bg-white text-black font-bold rounded-2xl hover:bg-orange-500 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"/> : <><span>Se connecter</span><ArrowRight size={16}/></>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}