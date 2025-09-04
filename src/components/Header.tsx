import React from 'react';
import { Brain, User, LogOut, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CountdownTimer from './CountdownTimer';

interface HeaderProps {
  user: any;
  userProfile: any;
  language: 'en' | 'ro';
  onLanguageChange: (lang: 'en' | 'ro') => void;
  onShowLogin: () => void;
  onShowSignup: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  user, 
  userProfile, 
  language, 
  onLanguageChange, 
  onShowLogin, 
  onShowSignup 
}) => {
  const translations = {
    en: {
      login: 'Login',
      signup: 'Sign Up',
      logout: 'Logout',
      profile: 'Profile'
    },
    ro: {
      login: 'Conectare',
      signup: 'Înregistrare',
      logout: 'Deconectare',
      profile: 'Profil'
    }
  };

  const t = translations[language];

  const handleLogout = async () => {
    try {
      console.log('Starting logout process...');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Logout error:', error);
        return;
      }
      
      console.log('Logout completed');
      
      // Force immediate state reset
      window.location.reload();
    } catch (err) {
      console.error('Unexpected logout error:', err);
    }
  };

  return (
    <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Brain className="h-8 w-8 text-white" />
            <span className="text-xl font-bold text-white">AIOptimize</span>
          </div>

          {/* Right side - Language toggle and Auth */}
          <div className="flex items-center space-x-4">
            {/* User Profile or Auth Buttons */}
            {user ? (
              <div className="flex items-center space-x-4">
                {/* User Profile Info */}
                <div className="flex items-center space-x-3 bg-white/20 rounded-full px-4 py-2">
                  <User className="h-5 w-5 text-white" />
                  <div className="text-white">
                    <div className="text-sm font-medium">
                      {userProfile?.first_name ? 
                        `${userProfile.first_name} ${userProfile.last_name || ''}`.trim() : 
                        userProfile?.email || user.email
                      }
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm font-medium">{t.logout}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                {/* Language Toggle - Only show when not authenticated */}
                <div className="flex items-center bg-white/20 rounded-full p-1">
                  <button
                    onClick={() => onLanguageChange('en')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                      language === 'en' 
                        ? 'bg-white text-gray-900' 
                        : 'text-white hover:bg-white/10'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => onLanguageChange('ro')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                      language === 'ro' 
                        ? 'bg-white text-gray-900' 
                        : 'text-white hover:bg-white/10'
                    }`}
                  >
                    RO
                  </button>
                </div>

                {/* Login Button */}
                <button
                  onClick={onShowLogin}
                  className="flex items-center space-x-2 text-white/90 hover:text-white transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="text-sm font-medium">{t.login}</span>
                </button>

                {/* Sign Up Button */}
                <button 
                  onClick={onShowSignup}
                  className="bg-white text-gray-900 px-4 py-2 rounded-full font-medium hover:bg-white/90 transition-colors text-sm"
                >
                  {t.signup}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;