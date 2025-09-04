import React, { useState } from 'react';
import { Mail, Lock, X, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SignupPageProps {
  onBack: () => void;
  onShowLogin: () => void;
  language: 'en' | 'ro';
}

const SignupPage: React.FC<SignupPageProps> = ({ onBack, onShowLogin, language }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const translations = {
    en: {
      title: 'Create Your Account',
      subtitle: 'Start optimizing your business for AI search',
      emailPlaceholder: 'you@domain.com',
      passwordPlaceholder: 'Create a password',
      confirmPasswordPlaceholder: 'Confirm your password',
      signUp: 'Create Account',
      signUpLoading: 'Creating Account...',
      haveAccount: 'Already have an account?',
      signIn: 'Sign in here',
      confirmTitle: 'Check Your Email',
      confirmSubtitle: 'We sent you a confirmation link',
      confirmMessage: 'Please check your email and click the confirmation link to activate your account.',
      backToLogin: 'Back to Login',
      passwordMismatch: 'Passwords do not match',
      passwordTooShort: 'Password must be at least 6 characters',
      invalidEmail: 'Please enter a valid email address'
    },
    ro: {
      title: 'Creează-ți Contul',
      subtitle: 'Începe să-ți optimizezi afacerea pentru căutarea AI',
      emailPlaceholder: 'tu@domeniu.com',
      passwordPlaceholder: 'Creează o parolă',
      confirmPasswordPlaceholder: 'Confirmă parola',
      signUp: 'Creează Cont',
      signUpLoading: 'Se creează contul...',
      haveAccount: 'Ai deja cont?',
      signIn: 'Conectează-te aici',
      confirmTitle: 'Verifică-ți Emailul',
      confirmSubtitle: 'Ți-am trimis un link de confirmare',
      confirmMessage: 'Te rugăm să verifici emailul și să apeși pe linkul de confirmare pentru a-ți activa contul.',
      backToLogin: 'Înapoi la Conectare',
      passwordMismatch: 'Parolele nu se potrivesc',
      passwordTooShort: 'Parola trebuie să aibă cel puțin 6 caractere',
      invalidEmail: 'Te rugăm să introduci o adresă de email validă'
    }
  };

  const t = translations[language];

  const validateForm = () => {
    if (!email || !email.includes('@')) {
      setError(t.invalidEmail);
      return false;
    }
    if (password.length < 6) {
      setError(t.passwordTooShort);
      return false;
    }
    if (password !== confirmPassword) {
      setError(t.passwordMismatch);
      return false;
    }
    return true;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        setError(error.message);
      } else {
        setShowConfirmation(true);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (showConfirmation) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.confirmTitle}</h2>
            <p className="text-gray-600 mb-6">{t.confirmSubtitle}</p>
            <p className="text-gray-700 mb-8 leading-relaxed">{t.confirmMessage}</p>
            <button
              onClick={onShowLogin}
              className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-orange-500 transition-all transform hover:scale-[1.02] shadow-lg"
            >
              {t.backToLogin}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t.title}</h2>
            <p className="text-gray-600">{t.subtitle}</p>
          </div>
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-6">
          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.confirmPasswordPlaceholder}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-orange-500 transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t.signUpLoading : t.signUp}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            {t.haveAccount}{' '}
            <button
              onClick={onShowLogin}
              className="text-pink-500 hover:text-pink-600 font-semibold"
            >
              {t.signIn}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;