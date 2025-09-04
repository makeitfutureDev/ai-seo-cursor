import React from 'react';
import { X, FileText } from 'lucide-react';

interface TermsAndConditionsPageProps {
  language: 'en' | 'ro';
  onClose: () => void;
}

const TermsAndConditionsPage: React.FC<TermsAndConditionsPageProps> = ({ language, onClose }) => {
  const translations = {
    en: {
      title: 'Terms and Conditions of Use',
      lastUpdated: 'Last updated: August 14, 2025',
      close: 'Close',
      sections: {
        introduction: {
          title: '1. Introduction',
          content: 'These Terms and Conditions ("Terms") govern access to and use of the [Tool Name] platform ("Platform", "Service") operated by LIMITLESS SEO AGENCY SRL, with registered office at Str. Grigore Alexandrescu 59, Bucharest, hereinafter referred to as "Provider".\n\nBy accessing or using the Service, you agree to comply with these Terms. If you do not agree, please do not use the Platform.'
        },
        definitions: {
          title: '2. Definitions',
          content: 'User – any natural or legal person accessing the Service.\n\nAccount – the individual profile created by the User to access the Platform.\n\nSubscription – the pricing plan chosen for using the Service.\n\nData – information, content or materials uploaded or generated through the use of the Platform.'
        },
        eligibility: {
          title: '3. Eligibility',
          content: 'To use the Platform, you must be at least 18 years old and have full legal capacity. If you use the Service on behalf of a company, you declare that you have the authority to represent it.'
        },
        account: {
          title: '4. Account Creation',
          content: 'To access the functionalities, it is necessary to create an account. You are responsible for maintaining the confidentiality of authentication data and for all activities carried out through your account.'
        },
        usage: {
          title: '5. Service Usage',
          content: '5.1. License – The Provider grants a limited, non-exclusive and non-transferable license to use the Platform in accordance with these Terms.\n\n5.2. Restrictions – You are not allowed to:\n• copy, modify or distribute the Platform;\n• use the Service for illegal purposes;\n• attempt unauthorized access to systems or data.'
        },
        pricing: {
          title: '6. Pricing plans and payments',
          content: '6.1. Access to the Service is based on subscription, according to the selected plan.\n\n6.2. Payments are non-refundable, except in cases provided by law or the refund policy displayed on the site.'
        },
        intellectual: {
          title: '7. Intellectual Property',
          content: 'All rights to the Platform, including source code, design, logos and content, belong to the Provider. The User does not acquire any intellectual property rights over them.'
        },
        privacy: {
          title: '8. Confidentiality and data protection',
          content: 'The processing of personal data is carried out in accordance with the Privacy Policy available on the site.'
        },
        liability: {
          title: '9. Limitation of liability',
          content: 'The Provider does not guarantee that the Service will be available without interruptions or errors. We are not responsible for indirect losses, profit or data resulting from the use of the Platform.'
        },
        termination: {
          title: '10. Contract termination',
          content: 'The Provider reserves the right to suspend or close the User\'s account if they violate these Terms.'
        },
        modifications: {
          title: '11. Terms modifications',
          content: 'The Provider may modify the Terms, with prior notification of Users. Continued use of the Platform constitutes acceptance of the modifications.'
        },
        law: {
          title: '12. Applicable law and jurisdiction',
          content: 'These Terms are governed by Romanian law. Any dispute will be resolved by the competent courts of Romania.'
        }
      }
    },
    ro: {
      title: 'Termeni și Condiții de Utilizare',
      lastUpdated: 'Ultima actualizare: 14 august 2025',
      close: 'Închide',
      sections: {
        introduction: {
          title: '1. Introducere',
          content: 'Acești Termeni și Condiții ("Termenii") reglementează accesul și utilizarea platformei [Nume Tool] ("Platforma", "Serviciul") operată de LIMITLESS SEO AGENCY SRL, cu sediul social în Str. Grigore Alexandrescu 59, Bucuresti, denumită în continuare "Furnizor".\n\nPrin accesarea sau utilizarea Serviciului, sunteți de acord să respectați acești Termeni. Dacă nu sunteți de acord, vă rugăm să nu utilizați Platforma.'
        },
        definitions: {
          title: '2. Definiții',
          content: 'Utilizator – orice persoană fizică sau juridică ce accesează Serviciul.\n\nCont – profilul individual creat de Utilizator pentru accesarea Platformei.\n\nAbonament – planul tarifar ales pentru utilizarea Serviciului.\n\nDate – informații, conținut sau materiale încărcate ori generate prin utilizarea Platformei.'
        },
        eligibility: {
          title: '3. Eligibilitate',
          content: 'Pentru a utiliza Platforma, trebuie să aveți cel puțin 18 ani și capacitate deplină de exercițiu. Dacă utilizați Serviciul în numele unei companii, declarați că aveți autoritatea de a o reprezenta.'
        },
        account: {
          title: '4. Crearea contului',
          content: 'Pentru a accesa funcționalitățile, este necesar să creați un cont. Sunteți responsabil pentru menținerea confidențialității datelor de autentificare și pentru toate activitățile desfășurate prin contul dumneavoastră.'
        },
        usage: {
          title: '5. Utilizarea Serviciului',
          content: '5.1. Licență – Furnizorul acordă o licență limitată, neexclusivă și netransferabilă de utilizare a Platformei conform acestor Termeni.\n\n5.2. Restricții – Nu aveți voie să:\n• copiați, modificați sau distribuiți Platforma;\n• utilizați Serviciul în scopuri ilegale;\n• încercați accesarea neautorizată a sistemelor sau datelor.'
        },
        pricing: {
          title: '6. Planuri tarifare și plăți',
          content: '6.1. Accesul la Serviciu se face pe bază de abonament, conform planului selectat.\n\n6.2. Plățile sunt nerambursabile, cu excepția cazurilor prevăzute de lege sau de politica de rambursare afișată pe site.'
        },
        intellectual: {
          title: '7. Proprietate intelectuală',
          content: 'Toate drepturile asupra Platformei, inclusiv codul sursă, designul, logo-urile și conținutul, aparțin Furnizorului. Utilizatorul nu dobândește niciun drept de proprietate intelectuală asupra acestora.'
        },
        privacy: {
          title: '8. Confidențialitate și protecția datelor',
          content: 'Prelucrarea datelor cu caracter personal se face în conformitate cu Politica de Confidențialitate disponibilă pe site.'
        },
        liability: {
          title: '9. Limitarea răspunderii',
          content: 'Furnizorul nu garantează că Serviciul va fi disponibil fără întreruperi sau erori. Nu răspundem pentru pierderi indirecte, de profit sau date rezultate din utilizarea Platformei.'
        },
        termination: {
          title: '10. Încetarea contractului',
          content: 'Furnizorul își rezervă dreptul de a suspenda sau închide contul Utilizatorului dacă acesta încalcă acești Termeni.'
        },
        modifications: {
          title: '11. Modificări ale Termenilor',
          content: 'Furnizorul poate modifica Termenii, cu notificarea prealabilă a Utilizatorilor. Continuarea utilizării Platformei constituie acceptarea modificărilor.'
        },
        law: {
          title: '12. Legea aplicabilă și jurisdicția',
          content: 'Acești Termeni sunt guvernați de legea română. Orice litigiu va fi soluționat de instanțele competente din Romania.'
        }
      }
    }
  };

  const t = translations[language];

  const formatContent = (content: string) => {
    return content.split('\n').map((paragraph, index) => (
      <p key={index} className="mb-4 last:mb-0">
        {paragraph}
      </p>
    ));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl transform transition-all">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-pink-50 to-orange-50">
          <div className="flex items-center">
            <FileText className="h-6 w-6 text-pink-600 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t.title}</h2>
              <p className="text-sm text-gray-600">{t.lastUpdated}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-8">
            {Object.entries(t.sections).map(([key, section]) => (
              <div key={key} className="border-b border-gray-100 pb-6 last:border-b-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {section.title}
                </h3>
                <div className="text-gray-700 leading-relaxed">
                  {formatContent(section.content)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-pink-500 to-orange-400 text-white rounded-xl font-medium hover:from-pink-600 hover:to-orange-500 transition-all shadow-md hover:shadow-lg"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditionsPage;