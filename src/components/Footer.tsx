import React from 'react';

interface FooterProps {
  onShowTerms?: () => void;
  language?: 'en' | 'ro';
  translations?: {
    termsAndConditions: string;
  };
}

const Footer: React.FC<FooterProps> = ({ onShowTerms, language = 'en', translations }) => {
  return (
    <footer className="bg-white/10 backdrop-blur-lg border-t border-white/20">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-white/80 text-sm">
            © 2025 {language === 'ro' ? 'Monitorizare Vizibilitate AI' : 'AI Visibility Monitoring'}. All rights reserved.
          </p>
          {onShowTerms && (
            <div className="mt-2 md:mt-0">
              <button
                onClick={onShowTerms}
                className="text-white/80 hover:text-white text-sm underline transition-colors"
              >
                {translations?.termsAndConditions || 'Terms and Conditions'}
              </button>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;