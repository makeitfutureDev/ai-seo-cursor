import React, { useState, useEffect } from 'react';
import { User, Mail, ArrowLeft, Save, Camera, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/helpers';
import { SupabaseQueryExecutor } from '../utils/supabaseUtils';

interface ProfilePageProps {
  user: any;
  userProfile: any;
  language: 'en' | 'ro';
  onLanguageChange: (lang: 'en' | 'ro') => void;
  onBack: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  userProfile,
  language,
  onLanguageChange,
  onBack
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (userProfile) {
      setFirstName(userProfile.first_name || '');
      setLastName(userProfile.last_name || '');
    }
  }, [userProfile]);

  const translations = {
    en: {
      title: 'Profile Settings',
      subtitle: 'Manage your personal information',
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      profilePicture: 'Profile Picture',
      editPicture: 'Edit Picture',
      saveChanges: 'Save Changes',
      backToDashboard: 'Back to Dashboard',
      saving: 'Saving...',
      successMessage: 'Profile updated successfully!',
      firstNamePlaceholder: 'Enter your first name',
      lastNamePlaceholder: 'Enter your last name',
      comingSoon: 'Coming Soon'
    },
    ro: {
      title: 'Setări Profil',
      subtitle: 'Gestionează informațiile personale',
      firstName: 'Prenume',
      lastName: 'Nume',
      email: 'Email',
      profilePicture: 'Poză de Profil',
      editPicture: 'Editează Poza',
      saveChanges: 'Salvează Modificările',
      backToDashboard: 'Înapoi la Dashboard',
      saving: 'Se salvează...',
      successMessage: 'Profilul a fost actualizat cu succes!',
      firstNamePlaceholder: 'Introdu prenumele',
      lastNamePlaceholder: 'Introdu numele',
      comingSoon: 'În Curând'
    }
  };

  const t = translations[language];

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const { error: updateError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('user_profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id));

      if (updateError) {
        setError('Failed to update profile: ' + updateError.message);
      } else {
        setSuccessMessage(t.successMessage);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    const first = firstName || userProfile?.first_name || '';
    const last = lastName || userProfile?.last_name || '';
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    } else if (first) {
      return first.charAt(0).toUpperCase();
    } else if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={onBack}
            className="text-white hover:text-white/80 mr-4 p-2 rounded-full hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{t.title}</h1>
            <p className="text-white/90 text-lg">{t.subtitle}</p>
          </div>
        </div>

        {/* Language Toggle */}
        <div className="mb-6">
          <div className="flex items-center bg-white/20 rounded-full p-1 w-fit">
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
        </div>

        {/* Profile Form */}
        <div className="rounded-2xl p-8 shadow-lg" style={{ backgroundColor: '#fdedee' }}>
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-green-600 text-sm">{successMessage}</p>
            </div>
          )}

          <form onSubmit={handleSaveChanges} className="space-y-6">
            {/* Profile Picture Section */}
            <div className="text-center mb-8">
              <div className="relative inline-block">
                <div className="w-24 h-24 bg-gradient-to-r from-pink-500 to-orange-400 rounded-full flex items-center justify-center mb-4">
                  <span className="text-white text-2xl font-bold">
                    {getInitials()}
                  </span>
                </div>
                <button
                  type="button"
                  disabled
                  className="absolute bottom-0 right-0 bg-gray-400 text-white p-2 rounded-full shadow-lg cursor-not-allowed opacity-50"
                  title={t.comingSoon}
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{t.profilePicture}</h3>
              <p className="text-gray-600 text-sm">{t.comingSoon}</p>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.firstName}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={t.firstNamePlaceholder}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.lastName}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={t.lastNamePlaceholder}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.email}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="email"
                  value={user?.email || ''}
                  readOnly
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-pink-500 to-orange-400 text-white py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-orange-500 transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t.saving}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    {t.saveChanges}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onBack}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all flex items-center justify-center"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                {t.backToDashboard}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;