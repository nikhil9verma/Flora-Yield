import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TbPlant2 } from 'react-icons/tb';
import { FiUser, FiMail, FiLock, FiAlertCircle, FiLoader, FiCheckCircle } from 'react-icons/fi';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const strength = form.password.length === 0 ? 0 : form.password.length < 6 ? 1 : form.password.length < 10 ? 2 : 3;
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-500', 'bg-brand-500'][strength];
  const strengthLabel = ['', 'Weak', 'Moderate', 'Strong'][strength];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand-600/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-500/20 rounded-2xl mb-4 border border-brand-500/30">
            <TbPlant2 className="text-brand-400 text-3xl" />
          </div>
          <h1 className="text-3xl font-black gradient-text">Flora-Yield</h1>
          <p className="text-slate-400 text-sm mt-1">Join the agritech revolution</p>
        </div>

        <div className="glass-card p-8 rounded-2xl border border-white/10">
          <h2 className="text-xl font-bold text-white mb-1">Create your account</h2>
          <p className="text-slate-400 text-sm mb-6">Start making smarter farming decisions</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
              <FiAlertCircle className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input id="reg-name" type="text" name="name" value={form.name} onChange={handleChange} required placeholder="Rajan Sharma" className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/60 transition-all" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input id="reg-email" type="email" name="email" value={form.email} onChange={handleChange} required placeholder="farmer@example.com" className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/60 transition-all" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input id="reg-password" type="password" name="password" value={form.password} onChange={handleChange} required placeholder="Min. 6 characters" className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/60 transition-all" />
              </div>
              {form.password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${strengthColor}`} style={{ width: `${(strength / 3) * 100}%` }} />
                  </div>
                  <span className="text-xs text-slate-500">{strengthLabel}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input id="reg-confirm" type="password" name="confirm" value={form.confirm} onChange={handleChange} required placeholder="Repeat password" className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/60 transition-all" />
                {form.confirm && form.password === form.confirm && (
                  <FiCheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400" />
                )}
              </div>
            </div>

            <button id="reg-submit" type="submit" disabled={loading} className="w-full py-3 rounded-xl font-bold text-white bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-2">
              {loading ? <><FiLoader className="animate-spin" /> Creating account...</> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            Already registered?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
