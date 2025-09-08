import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, Globe, Mail, Lock, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import Header from './components/Header';
import Footer from './components/Footer';
import SignupPage from './components/SignupPage';
import TermsAndConditionsPage from './components/TermsAndConditionsPage';
import OnboardingPage from './components/OnboardingPage';
import Dashboard from './components/Dashboard';
import ProfilePage from './components/ProfilePage';
import { SupabaseQueryExecutor } from './utils/supabaseUtils';

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'signup' | 'onboarding' | 'dashboard' | 'profile' | 'terms'>('landing');
  const [language, setLanguage] = useState<'en' | 'ro'>('en');
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);

  // Add logging for currentView changes
  useEffect(() => {
    console.log('🔄 App.tsx - currentView changed to:', currentView);
    // Save currentView to localStorage for persistence across refreshes
    if (currentView !== 'landing') {
      localStorage.setItem('aioptimize_current_view', currentView);
      console.log('💾 App.tsx - Saved currentView to localStorage:', currentView);
    } else {
      // Clear saved view when on landing page
      localStorage.removeItem('aioptimize_current_view');
      console.log('🗑️ App.tsx - Cleared currentView from localStorage');
    }
  }, [currentView]);

  // Add logging for user state changes
  useEffect(() => {
    console.log('👤 App.tsx - user state changed:', {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email
    });
  }, [user]);

  // Add logging for userProfile state changes
  useEffect(() => {
    console.log('👤 App.tsx - userProfile state changed:', {
      hasUserProfile: !!userProfile,
      onboardingCompleted: userProfile?.onboarding_completed,
      firstName: userProfile?.first_name,
      lastName: userProfile?.last_name
    });
  }, [userProfile]);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      console.log('🔍 App.tsx - checkUser called');
      const { data: { session } } = await SupabaseQueryExecutor.executeQuery(() => supabase.auth.getSession());
      console.log('🔍 App.tsx - Session data:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        expiresAt: session?.expires_at,
        accessToken: session?.access_token ? 'Present' : 'Missing'
      });
      
      if (session?.user) {
        console.log('✅ App.tsx - User found, setting user state');
        setUser(session.user);
        await checkUserProfile(session.user.id);
      } else {
        console.log('❌ App.tsx - No user found, resetting state');
        setUser(null);
        setUserProfile(null);
        // Clear saved view when no user is found
        localStorage.removeItem('aioptimize_current_view');
        localStorage.removeItem('aioptimize_dashboard_view');
        setCurrentView('landing');
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      console.log('🔄 App.tsx - checkUser completed, setting loading to false');
      setLoading(false);
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 App.tsx - Auth state change:', {
        event,
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id
      });
      
      if (session?.user) {
        console.log('✅ App.tsx - Auth change: User found, setting user state');
        setUser(session.user);
        await checkUserProfile(session.user.id);
      } else {
        console.log('❌ App.tsx - Auth change: No user found, resetting state');
        setUser(null);
        setUserProfile(null);
        // Clear saved view when user logs out
        localStorage.removeItem('aioptimize_current_view');
        localStorage.removeItem('aioptimize_dashboard_view');
        setCurrentView('landing');
      }
    });
  };

  const checkUserProfile = async (userId: string) => {
    try {
      console.log('👤 App.tsx - checkUserProfile called for userId:', userId);
      console.log('👤 App.tsx - Current userProfile state:', {
        hasUserProfile: !!userProfile,
        onboardingCompleted: userProfile?.onboarding_completed
      });
      
      // If userProfile already exists and onboarding is completed, don't override with potentially stale database data
      if (userProfile && userProfile.onboarding_completed) {
        console.log('✅ Onboarding already completed in state, skipping database check');
        console.log('🚀 App.tsx - Setting currentView to dashboard');
        // Try to restore the last view from localStorage, default to dashboard
        const savedView = localStorage.getItem('aioptimize_current_view');
        if (savedView && (savedView === 'dashboard' || savedView === 'profile')) {
          console.log('🔄 Restoring saved view:', savedView);
          setCurrentView(savedView as 'dashboard' | 'profile');
        } else {
          setCurrentView('dashboard');
        }
        return;
      }

      console.log('🔍 Checking user profile for:', userId);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('👤 Profile data:', data);
      console.log('❌ Profile error:', error);

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create one
        console.log('📝 Creating new profile...');
        const { data: user } = await SupabaseQueryExecutor.executeQuery(() => supabase.auth.getUser());
        console.log('👤 App.tsx - Got user for profile creation:', {
          hasUser: !!user.user,
          userId: user.user?.id,
          email: user.user?.email
        });
        if (user.user) {
          const { data: newProfile } = await SupabaseQueryExecutor.executeQuery(() => supabase
            .from('user_profiles')
            .insert({
              id: user.user.id,
              email: user.user.email || '',
              onboarding_completed: false
            })
            .select()
            .single());
          
          if (newProfile) {
            console.log('✅ New profile created:', newProfile);
            setUserProfile(newProfile);
            console.log('🚀 App.tsx - Setting currentView to onboarding');
            setCurrentView('onboarding');
          }
        }
      } else if (data) {
        console.log('📊 Onboarding completed:', data.onboarding_completed);
        setUserProfile(data);
        if (data.onboarding_completed) {
          console.log('🚀 App.tsx - Setting currentView to dashboard');
          // Try to restore the last view from localStorage, default to dashboard
          const savedView = localStorage.getItem('aioptimize_current_view');
          console.log('🔄 App.tsx - Attempting to restore saved view (auth change):', savedView);
          console.log('🔄 App.tsx - Attempting to restore saved view:', savedView);
          if (savedView && (savedView === 'dashboard' || savedView === 'profile')) {
            console.log('🔄 Restoring saved view:', savedView);
            setCurrentView(savedView as 'dashboard' | 'profile');
          } else {
            console.log('🔄 App.tsx - No valid saved view (auth change), defaulting to dashboard');
            console.log('🔄 App.tsx - No valid saved view, defaulting to dashboard');
            setCurrentView('dashboard');
          }
        } else {
          console.log('🚀 App.tsx - Setting currentView to onboarding');
          setCurrentView('onboarding');
        }
      }
    } catch (error) {
      console.error('Error checking profile:', error);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single());

      if (data) {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔐 App.tsx - handleLogin called');
    
    if (!loginData.email || !loginData.password) {
      setLoginError('Please enter both email and password');
      return;
    }

    setLoginLoading(true);
    setLoginError('');
    console.log('🔐 App.tsx - Attempting login for email:', loginData.email);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) {
        console.log('❌ App.tsx - Login error:', error.message);
        setLoginError(error.message);
      } else {
        console.log('✅ App.tsx - Login successful');
        setLoginData({ email: '', password: '' });
        // Don't set currentView here, let the auth state change handle it
      }
    } catch (err) {
      console.log('❌ App.tsx - Unexpected login error:', err);
      setLoginError('An unexpected error occurred');
    } finally {
      setLoginLoading(false);
    }
  };

  const translations = {
    en: {
      appTitle: 'AI Visibility Monitoring',
      nav: {
        scope: 'Scope',
        functionalities: 'Key Features',
        benefits: 'Benefits',
        login: 'Login',
        getStarted: 'Get Started'
      },
      hero: {
        title: 'Market Intelligence in the AI Era',
        subtitle: 'Analyze and improve your brand presence in ChatGPT, Claude and other AI models.',
        description: 'Find out where and how your brand appears in ChatGPT, Claude and Gemini responses. AI monitoring, competitive analysis and automatic alerting for a decisive advantage.',
        cta: 'Start Optimizing',
        watchDemo: 'Watch Demo'
      },
      scope: {
        title: 'Platform Purpose',
        subtitle: 'The purpose of this tool is to provide companies with a complete solution for:',
        items: [
          'Automatic monitoring of brand and competitors in LLM responses (ChatGPT in the first phase)',
          'Calculating key metrics such as Visibility Score, Share of Voice and Sentiment',
          'Identifying opportunities and risks when competitors gain visibility',
          'Real-time notification when major changes occur in brand presence',
          'Delivering data in interactive dashboards that support rapid decision making'
        ]
      },
      functionalities: {
        title: 'Key Features on Homepage',
        items: [
          'Real-time visibility in AI responses',
          'Automatic alerting when brand score drops',
          'Comparative analysis between brand and competitors',
          'Data export for reports and presentations',
          'Advanced filtering by period, sources and type of mention'
        ]
      },
      benefits: {
        title: 'Benefits for Users',
        items: [
          'You understand exactly where and how AI mentions you',
          'You react quickly when competitors overtake you',
          'You optimize your marketing strategy based on real data',
          'You measure the impact of campaigns on visibility in the AI ecosystem'
        ]
      },
      features: {
        title: 'Why AI Visibility Matters',
        subtitle: 'Traditional SEO is evolving. AI search is the future.',
        feature1: {
          title: 'AI-First Optimization',
          description: 'Optimize your content specifically for AI language models and search assistants.'
        },
        feature2: {
          title: 'Real-Time Monitoring',
          description: 'Track how often your business appears in AI-generated responses across platforms.'
        },
        feature3: {
          title: 'Competitive Intelligence',
          description: 'See how you stack up against competitors in AI search results.'
        }
      },
      login: {
        title: 'Welcome Back',
        subtitle: 'Sign in to your account',
        emailPlaceholder: 'you@domain.com',
        passwordPlaceholder: 'Enter your password',
        signIn: 'Sign In',
        noAccount: "Don't have an account?",
        signUp: 'Sign up here',
        or: 'or continue with'
      },
      footer: {
        termsAndConditions: 'Terms and Conditions'
      }
    },
    ro: {
      appTitle: 'Monitorizare Vizibilitate AI',
      nav: {
        scope: 'Scop',
        functionalities: 'Funcționalități Cheie',
        benefits: 'Beneficii',
        login: 'Conectare',
        getStarted: 'Începe'
      },
      hero: {
        title: 'Inteligență de piață în era AI',
        subtitle: 'Analizează și îmbunătățește prezența brandului în ChatGPT, Claude și alte modele AI.',
        description: 'Află unde și cum îți apare brandul în răspunsurile ChatGPT, Claude și Gemini. Monitorizare AI, analiză competitivă și alertare automată pentru un avantaj decisiv.',
        cta: 'Începe Optimizarea',
        watchDemo: 'Vezi Demo'
      },
      scope: {
        title: 'Scopul platformei',
        subtitle: 'Scopul acestui tool este să ofere companiilor o soluție completă pentru:',
        items: [
          'Monitorizarea automată a brandului și competitorilor în răspunsurile LLM.(Chatgpt in prima etapa)',
          'Calcularea metricilor cheie precum Visibility Score, Share of Voice și Sentiment.',
          'Identificarea oportunităților și riscurilor atunci când competitorii câștigă vizibilitate.',
          'Notificarea în timp real atunci când apar schimbări majore în prezența brandului.',
          'Livrarea datelor în dashboard-uri interactive care sprijină luarea deciziilor rapide.'
        ]
      },
      functionalities: {
        title: 'Funcționalități cheie pe homepage',
        items: [
          'Vizibilitate în timp real în răspunsurile AI.',
          'Alertare automată când scade scorul brandului.',
          'Analiză comparativă între brand și competitori.',
          'Export de date pentru rapoarte și prezentări.',
          'Filtrare avansată pe perioadă, surse și tip de mențiune.'
        ]
      },
      benefits: {
        title: 'Beneficii pentru utilizatori',
        items: [
          'Înțelegi exact unde și cum te menționează AI-ul.',
          'Reacționezi rapid când competitorii te depășesc.',
          'Optimizezi strategia de marketing bazată pe date reale.',
          'Măsori impactul campaniilor asupra vizibilității în ecosistemul AI.'
        ]
      },
      features: {
        title: 'De Ce Contează Vizibilitatea AI',
        subtitle: 'SEO-ul tradițional evoluează. Căutarea AI este viitorul.',
        feature1: {
          title: 'Optimizare AI-First',
          description: 'Optimizează conținutul specific pentru modelele de limbaj AI și asistenții de căutare.'
        },
        feature2: {
          title: 'Monitorizare în Timp Real',
          description: 'Urmărește cât de des afacerea ta apare în răspunsurile generate de AI pe toate platformele.'
        },
        feature3: {
          title: 'Inteligență Competitivă',
          description: 'Vezi cum te poziționezi față de competitori în rezultatele căutării AI.'
        }
      },
      login: {
        title: 'Bine ai revenit',
        subtitle: 'Conectează-te la contul tău',
        emailPlaceholder: 'tu@domeniu.com',
        passwordPlaceholder: 'Introdu parola',
        signIn: 'Conectare',
        noAccount: 'Nu ai cont?',
        signUp: 'Înregistrează-te aici',
        or: 'sau continuă cu'
      },
      footer: {
        termsAndConditions: 'Termeni și Condiții'
      }
    }
  };

  const t = translations[language];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (currentView === 'signup') {
    // Don't return here - let it fall through to render the landing page with signup modal overlay
  }

  if (currentView === 'onboarding' && user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 flex flex-col">
        <Header
          user={user}
          userProfile={userProfile}
          language={language}
          onLanguageChange={setLanguage}
          onShowLogin={() => setCurrentView('login')}
          onShowSignup={() => setCurrentView('signup')}
        />
        <OnboardingPage
          onComplete={async () => {
            console.log('🎯 OnboardingPage onComplete called');
            setCurrentView('dashboard');
            // Immediately update userProfile state to reflect completed onboarding
            setUserProfile(prev => prev ? { ...prev, onboarding_completed: true } : prev);
          }}
          language={language}
          setCompanyData={setCompanyData}
        />
        <Footer />
      </div>
    );
  }

  if (currentView === 'dashboard' && user && userProfile) {
    return (
      <Dashboard
        user={user}
        userProfile={userProfile}
        language={language}
        onLanguageChange={setLanguage}
        onShowProfile={() => setCurrentView('profile')}
        appTitle={t.appTitle}
      />
    );
  }

  if (currentView === 'profile' && user && userProfile) {
    return (
      <ProfilePage
        user={user}
        userProfile={userProfile}
        language={language}
        onLanguageChange={setLanguage}
        onBack={() => setCurrentView('dashboard')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 flex flex-col">
      <Header
        user={user}
        userProfile={userProfile}
        language={language}
        appTitle={t.appTitle}
        appTitle={t.appTitle}
        onLanguageChange={setLanguage}
        onShowLogin={() => setCurrentView('login')}
        onShowSignup={() => setCurrentView('signup')}
      />

      {/* Hero Section */}
      <div className="relative z-10 px-6 pt-10 pb-20 flex-1">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            {t.hero.title}
          </h1>
          <h2 className="text-xl md:text-2xl text-white/90 mb-4 font-medium">
            {t.hero.subtitle}
          </h2>
          <p className="text-lg text-white/80 mb-12 max-w-2xl mx-auto leading-relaxed">
            {t.hero.description}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              onClick={() => setCurrentView('signup')}
              className="bg-white text-gray-900 px-8 py-4 rounded-full font-semibold text-lg hover:bg-white/90 transition-all transform hover:scale-105 shadow-2xl"
            >
              {t.hero.cta}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Links for Landing Page */}
      <div className="relative z-10 px-6 pb-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex flex-wrap justify-center gap-8 text-white/90">
            <a href="#scope" className="hover:text-white transition-colors font-medium">
              {t.nav.scope}
            </a>
            <a href="#functionalities" className="hover:text-white transition-colors font-medium">
              {t.nav.functionalities}
            </a>
            <a href="#benefits" className="hover:text-white transition-colors font-medium">
              {t.nav.benefits}
            </a>
          </div>
        </div>
      </div>

      {/* Scope Section */}
      <div id="scope" className="relative z-10 px-6 py-16 bg-white/10 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {t.scope.title}
            </h2>
            <p className="text-xl text-white/90 max-w-2xl mx-auto mb-8">
              {t.scope.subtitle}
            </p>
          </div>

          <div className="space-y-6">
            {t.scope.items.map((item, index) => (
              <div key={index} className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 hover:bg-white/25 transition-all">
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-orange-400 rounded-full flex items-center justify-center mr-4 mt-1 flex-shrink-0">
                    <span className="text-white font-bold text-sm">{index + 1}</span>
                  </div>
                  <p className="text-white/90 leading-relaxed text-lg">{item}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Functionalities Section */}
      <div id="functionalities" className="relative z-10 px-6 py-16 bg-white/5 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {t.functionalities.title}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.functionalities.items.map((item, index) => (
              <div key={index} className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 hover:bg-white/25 transition-all">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white font-bold">✓</span>
                  </div>
                </div>
                <p className="text-white/90 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div id="benefits" className="relative z-10 px-6 py-16 bg-white/10 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {t.benefits.title}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {t.benefits.items.map((item, index) => (
              <div key={index} className="bg-white/20 backdrop-blur-lg rounded-2xl p-8 hover:bg-white/25 transition-all">
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center mr-4 mt-1 flex-shrink-0">
                    <span className="text-white font-bold text-lg">★</span>
                  </div>
                  <p className="text-white/90 leading-relaxed text-lg">{item}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Original Features Section - kept for reference */}
      <div id="features" className="relative z-10 px-6 py-16 bg-white/10 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {t.features.title}
            </h2>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              {t.features.subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-8 hover:bg-white/25 transition-all">
              <Search className="h-12 w-12 text-white mb-6" />
              <h3 className="text-2xl font-bold text-white mb-4">{t.features.feature1.title}</h3>
              <p className="text-white/90 leading-relaxed">{t.features.feature1.description}</p>
            </div>

            <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-8 hover:bg-white/25 transition-all">
              <TrendingUp className="h-12 w-12 text-white mb-6" />
              <h3 className="text-2xl font-bold text-white mb-4">{t.features.feature2.title}</h3>
              <p className="text-white/90 leading-relaxed">{t.features.feature2.description}</p>
            </div>

            <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-8 hover:bg-white/25 transition-all">
              <Globe className="h-12 w-12 text-white mb-6" />
              <h3 className="text-2xl font-bold text-white mb-4">{t.features.feature3.title}</h3>
              <p className="text-white/90 leading-relaxed">{t.features.feature3.description}</p>
            </div>
          </div>
        </div>
      </div>

      <Footer 
        onShowTerms={() => setCurrentView('terms')} 
        language={language}
        translations={t.footer}
      />

      {/* Signup Modal */}
      {currentView === 'signup' && (
        <SignupPage
          onBack={() => setCurrentView('landing')}
          onShowLogin={() => setCurrentView('login')}
          language={language}
        />
      )}

      {/* Login Modal */}
      {currentView === 'login' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{t.login.title}</h2>
                <p className="text-gray-600">{t.login.subtitle}</p>
              </div>
              <button
                onClick={() => setCurrentView('landing')}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {loginError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{loginError}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder={t.login.emailPlaceholder}
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
                    value={loginData.password}
                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder={t.login.passwordPlaceholder}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-orange-500 transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loginLoading ? 'Signing in...' : t.login.signIn}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                {t.login.noAccount}{' '}
                <button
                  onClick={() => setCurrentView('signup')}
                  className="text-pink-500 hover:text-pink-600 font-semibold"
                >
                  {t.login.signUp}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Terms and Conditions Modal */}
      {currentView === 'terms' && (
        <TermsAndConditionsPage
          language={language}
          onClose={() => setCurrentView('landing')}
        />
      )}
    </div>
  );
}

export default App;