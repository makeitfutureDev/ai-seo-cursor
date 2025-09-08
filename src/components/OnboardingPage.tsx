import React, { useState, useEffect, useRef } from 'react';
import { Building, Globe, Target, ArrowLeft, Loader2, CheckCircle, Lightbulb } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PromptManagement from './PromptManagement';
import CompetitorAnalysis from './CompetitorAnalysis';
import { SupabaseQueryExecutor } from '../utils/supabaseUtils';

interface OnboardingPageProps {
  onComplete: () => void;
  language: 'en' | 'ro';
  setCompanyData: (data: any) => void;
  isNewCompanyFlow?: boolean;
}

const OnboardingPage: React.FC<OnboardingPageProps> = ({ onComplete, language, setCompanyData, isNewCompanyFlow = false }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countries, setCountries] = useState<any[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [generatedPrompts, setGeneratedPrompts] = useState<any[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useState<string>('');
  
  // State to control which sub-step of Step 3 is active
  const [showCompetitorAnalysis, setShowCompetitorAnalysis] = useState(false);
  
  // State for analysis loading
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  
  // Polling refs for cleanup
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // User details editability state
  const [isFirstNameEditable, setIsFirstNameEditable] = useState(true);
  const [isLastNameEditable, setIsLastNameEditable] = useState(true);
  const [isSearchCountryEditable, setIsSearchCountryEditable] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    companyDomain: '',
    companyCountry: '',
    companyGoal: '',
    searchOptimizationCountry: ''
  });

  useEffect(() => {
    fetchCountries();
    if (!isNewCompanyFlow) {
      checkExistingData();
    } else {
      // For new company flow, only pre-fill user details
      fetchUserProfileData();
    }
    
    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  // Effect to handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 Tab became visible, updating activity...');
        
        // Update Supabase activity
        SupabaseQueryExecutor.updateActivity();
      }
    };

    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Effect to handle page focus (additional safety)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🎯 Window focused, updating activity...');
      SupabaseQueryExecutor.updateActivity();
    };

    const handleBlur = () => {
      console.log('😴 Window blurred...');
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const fetchCountries = async () => {
    try {
      const { data, error } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('countries')
        .select('*')
        .order('name'));
      
      if (error) {
        console.error('Error fetching countries:', error);
        setError('Failed to load countries');
      } else {
        setCountries(data || []);
      }
    } catch (err) {
      console.error('Error fetching countries:', err);
      setError('Failed to load countries');
    } finally {
      setLoadingCountries(false);
    }
  };

  const fetchUserProfileData = async () => {
    try {
      const { data: { user } } = await SupabaseQueryExecutor.executeQuery(() => supabase.auth.getUser());
      if (!user) return;

      // Fetch user profile to pre-fill personal details
      const { data: userProfile } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('user_profiles')
        .select('first_name, last_name, search_optimization_country')
        .eq('id', user.id)
        .single());

      if (userProfile) {
        console.log('👤 Pre-filling user profile data:', userProfile);
        
        // Pre-fill and disable fields that already have data
        if (userProfile.first_name) {
          setFormData(prev => ({ ...prev, firstName: userProfile.first_name }));
          setIsFirstNameEditable(false);
        }
        
        if (userProfile.last_name) {
          setFormData(prev => ({ ...prev, lastName: userProfile.last_name }));
          setIsLastNameEditable(false);
        }
        
        if (userProfile.search_optimization_country) {
          setFormData(prev => ({ ...prev, searchOptimizationCountry: userProfile.search_optimization_country }));
          setIsSearchCountryEditable(false);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile data:', error);
    }
  };

  const checkExistingData = async () => {
    try {
      const { data: { user } } = await SupabaseQueryExecutor.executeQuery(() => supabase.auth.getUser());
      if (!user) return;

      // Fetch user profile to pre-fill personal details
      const { data: userProfile } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('user_profiles')
        .select('first_name, last_name, search_optimization_country')
        .eq('id', user.id)
        .single());

      if (userProfile) {
        console.log('👤 Pre-filling user profile data:', userProfile);
        
        // Pre-fill and disable fields that already have data
        if (userProfile.first_name) {
          setFormData(prev => ({ ...prev, firstName: userProfile.first_name }));
          setIsFirstNameEditable(false);
        }
        
        if (userProfile.last_name) {
          setFormData(prev => ({ ...prev, lastName: userProfile.last_name }));
          setIsLastNameEditable(false);
        }
        
        if (userProfile.search_optimization_country) {
          setFormData(prev => ({ ...prev, searchOptimizationCountry: userProfile.search_optimization_country }));
          setIsSearchCountryEditable(false);
        }
      }

      // Check if user already has companies and prompts
      const { data: userCompanies } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('company_users')
        .select(`
          company_id,
          companies (
            id,
            name,
            domain,
            country,
            goal
          )
        `)
        .eq('user_id', user.id));

      if (userCompanies && userCompanies.length > 0) {
        const company = userCompanies[0].companies;
        if (company) {
          console.log('🏢 Existing company found:', company);
          setCurrentCompanyId(company.id);
          
          // Check for existing prompts
          const { data: existingPrompts } = await SupabaseQueryExecutor.executeQuery(() => supabase
            .from('prompts')
            .select('*')
            .eq('company_id', company.id));

          console.log('📝 Existing prompts:', existingPrompts?.length || 0);

          // Check for existing competitors
          const { data: existingCompetitors } = await SupabaseQueryExecutor.executeQuery(() => supabase
            .from('competitors')
            .select('*')
            .eq('company', company.id));

          console.log('🏆 Existing competitors:', existingCompetitors?.length || 0);

          if (existingPrompts && existingPrompts.length > 0) {
            console.log('✅ Prompts found, checking competitors...');
            setGeneratedPrompts(existingPrompts);
            
            if (existingCompetitors && existingCompetitors.length > 0) {
              console.log('✅ All data found, jumping to step 3');
              setShowCompetitorAnalysis(true);
              setStep(3);
            } else {
              console.log('⏭️ No competitors found, showing competitor analysis');
              setShowCompetitorAnalysis(false);
              setStep(3); // Still go to step 3 to allow adding competitors
            }
          } else if (company.goal) {
            console.log('🎯 Company goal found, jumping to step 2');
            setFormData(prev => ({
              ...prev,
              companyName: company.name,
              companyDomain: company.domain || '',
              companyCountry: company.country || '',
              companyGoal: company.goal || ''
            }));
            setStep(2);
          } else {
            console.log('📋 Company found but no goal, staying on step 1');
            setFormData(prev => ({
              ...prev,
              companyName: company.name,
              companyDomain: company.domain || '',
              companyCountry: company.country || ''
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error checking existing data:', error);
    }
  };

  const translations = {
    en: {
      step1: {
        title: 'Tell us about yourself',
        subtitle: 'Help us personalize your experience',
        firstName: 'First Name',
        lastName: 'Last Name',
        companyName: 'Company Name',
        companyDomain: 'Company Domain',
        companyCountry: 'Company Country',
        searchCountry: 'Search Optimization Country',
        firstNamePlaceholder: 'John',
        lastNamePlaceholder: 'Doe',
        companyNamePlaceholder: 'Acme Corp',
        companyDomainPlaceholder: 'acme.com',
        selectCountry: 'Select a country',
        continue: 'Continue',
        firstNameRequired: 'First name is required',
        companyNameRequired: 'Company name is required',
        companyDomainRequired: 'Company domain is required',
        companyDomainInvalid: 'Please enter a valid domain (e.g., example.com)',
        companyCountryRequired: 'Company country is required',
        searchCountryRequired: 'Search optimization country is required'
      },
      step2: {
        title: 'What\'s your main goal?',
        subtitle: 'This helps us generate better prompts for your business',
        goalPlaceholder: 'e.g., Increase brand awareness, Generate more leads, Improve customer engagement...',
        generatePrompts: 'Generate Prompts',
        goalRequired: 'Please describe your main goal'
      },
      step3: {
        title: 'Review Your Setup',
        subtitle: 'Manage your prompts and competitors'
      }
    },
    ro: {
      step1: {
        title: 'Spune-ne despre tine',
        subtitle: 'Ajută-ne să personalizăm experiența ta',
        firstName: 'Prenume',
        lastName: 'Nume',
        companyName: 'Numele Companiei',
        companyDomain: 'Domeniul Companiei',
        companyCountry: 'Țara Companiei',
        searchCountry: 'Țara pentru Optimizarea Căutării',
        firstNamePlaceholder: 'Ion',
        lastNamePlaceholder: 'Popescu',
        companyNamePlaceholder: 'Acme SRL',
        companyDomainPlaceholder: 'acme.ro',
        selectCountry: 'Selectează o țară',
        continue: 'Continuă',
        firstNameRequired: 'Prenumele este obligatoriu',
        companyNameRequired: 'Numele companiei este obligatoriu',
        companyDomainRequired: 'Domeniul companiei este obligatoriu',
        companyDomainInvalid: 'Te rugăm să introduci un domeniu valid (ex: exemplu.ro)',
        companyCountryRequired: 'Țara companiei este obligatorie',
        searchCountryRequired: 'Țara pentru optimizarea căutării este obligatorie'
      },
      step2: {
        title: 'Care este obiectivul tău principal?',
        subtitle: 'Aceasta ne ajută să generăm prompt-uri mai bune pentru afacerea ta',
        goalPlaceholder: 'ex: Creșterea notorietății brandului, Generarea mai multor lead-uri, Îmbunătățirea angajamentului clienților...',
        generatePrompts: 'Generează Prompt-uri',
        goalRequired: 'Te rugăm să descrii obiectivul tău principal'
      },
      step3: {
        title: 'Revizuiește Configurarea',
        subtitle: 'Gestionează prompt-urile și competitorii'
      }
    }
  };

  const t = translations[language];

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName.trim()) {
      setError(t.step1.firstNameRequired);
      return;
    }
    if (!formData.companyName.trim()) {
      setError(t.step1.companyNameRequired);
      return;
    }
    if (!formData.companyDomain.trim()) {
      setError(t.step1.companyDomainRequired);
      return;
    }

    // Validate and format company domain
    let validatedDomain = formData.companyDomain.trim();
    
    // Remove protocol if user included it
    validatedDomain = validatedDomain.replace(/^https?:\/\//, '');
    
    // Remove www. prefix if present
    validatedDomain = validatedDomain.replace(/^www\./, '');
    
    // Basic domain validation - check if it contains at least one dot and valid characters
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(validatedDomain)) {
      setError(t.step1.companyDomainInvalid);
      return;
    }
    
    // Add https:// prefix for storage
    const formattedDomain = `https://${validatedDomain}`;

    if (!formData.companyCountry) {
      setError(t.step1.companyCountryRequired);
      return;
    }
    if (!formData.searchOptimizationCountry) {
      setError(t.step1.searchCountryRequired);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get the auth token
      const authData = localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
      
      if (!authData) {
        setError('Authentication token not found - please refresh and try again');
        return;
      }
      
      const parsedAuth = JSON.parse(authData);
      const accessToken = parsedAuth?.access_token;
      
      if (!accessToken) {
        setError('Access token not found - please refresh and try again');
        return;
      }

      // Call the create company edge function
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-company`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: formData.companyName,
          companyDomain: formattedDomain,
          companyCountry: formData.companyCountry,
          firstName: formData.firstName,
          lastName: formData.lastName,
          searchOptimizationCountry: formData.searchOptimizationCountry
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Company created:', result);
        setCurrentCompanyId(result.company.id);
        setCompanyData(result.company);
        setStep(2);
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to create company');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyGoal.trim()) {
      setError(t.step2.goalRequired);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get the auth token
      const authData = localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
      
      if (!authData) {
        setError('Authentication token not found - please refresh and try again');
        return;
      }
      
      const parsedAuth = JSON.parse(authData);
      const accessToken = parsedAuth?.access_token;
      
      if (!accessToken) {
        setError('Access token not found - please refresh and try again');
        return;
      }

      // Call the generate prompts edge function
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-prompts`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: currentCompanyId,
          companyGoal: formData.companyGoal
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Prompts generated:', result);
        setGeneratedPrompts(result.prompts || []);
        setShowCompetitorAnalysis(false); // Always show PromptManagement first
        setStep(3);
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to generate prompts');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePromptManagementComplete = () => {
    // This will be called when user clicks "Continue to Analysis" in PromptManagement
    console.log('✅ Prompt management completed, starting analysis...');
    triggerPromptAnalysis(); // This initiates the first analysis (analyze-prompts)
  };

  const triggerPromptAnalysis = async () => { // This is the first analysis step
    setAnalysisLoading(true);
    setAnalysisError('');

    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }

    try {
      // Get the auth token
      const authData = localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
      
      if (!authData) {
        setAnalysisError('Authentication token not found - please refresh and try again');
        return;
      }
      
      const parsedAuth = JSON.parse(authData);
      const accessToken = parsedAuth?.access_token;
      
      if (!accessToken) {
        setAnalysisError('Access token not found - please refresh and try again');
        return;
      }

      // Call the analyze prompts edge function
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-prompts`;
      
      console.log('🔄 Calling analyze-prompts edge function...');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: currentCompanyId
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Analysis completed:', result);
        
        // Start polling for competitor data before transitioning
        console.log('🔄 Starting polling for competitor data...');
        startCompetitorDataPolling();
      } else {
        const result = await response.json();
        console.error('❌ Analysis failed:', result);
        setAnalysisError(result.error || 'Failed to analyze prompts');
        setAnalysisLoading(false);
      }
    } catch (err: any) {
      console.error('❌ Analysis error:', err);
      setAnalysisError('An unexpected error occurred during analysis');
      setAnalysisLoading(false);
    }
  };

  const startCompetitorDataPolling = () => {
    let pollCount = 0;
    const maxPolls = 60; // 60 polls * 5 seconds = 5 minutes max
    
    const pollForCompetitors = async () => {
      try {
        console.log(`🔍 Polling for competitors (attempt ${pollCount + 1}/${maxPolls})...`);
        
        // Check if competitors exist for this company
        const { data: competitors, error: competitorsError } = await SupabaseQueryExecutor.executeQuery(() => supabase
          .from('competitors')
          .select('id, name, approved')
          .eq('company', currentCompanyId));

        if (competitorsError) {
          console.error('❌ Error checking competitors:', competitorsError);
          pollCount++;
          
          if (pollCount >= maxPolls) {
            console.log('⏰ Competitor polling timeout reached');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            if (pollingTimeoutRef.current) {
              clearTimeout(pollingTimeoutRef.current);
              pollingTimeoutRef.current = null;
            }
            setAnalysisLoading(false);
            setAnalysisError('Failed to load competitor data. Please refresh and try again.');
          }
          return;
        }

        if (competitors && competitors.length > 0) {
          console.log('✅ Competitors found:', competitors.length, 'competitors');
          
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
          }
          
          // Transition to competitor analysis view
          console.log('🔄 Transitioning to competitor analysis view...');
          setShowCompetitorAnalysis(true);
          setAnalysisLoading(false);
        } else {
          console.log('⏳ No competitors found yet, continuing to poll...');
          pollCount++;
          
          if (pollCount >= maxPolls) {
            console.log('⏰ Competitor polling timeout reached');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            if (pollingTimeoutRef.current) {
              clearTimeout(pollingTimeoutRef.current);
              pollingTimeoutRef.current = null;
            }
            // Always transition to competitor analysis view even if no competitors found
            console.log('🔄 Transitioning to competitor analysis view after timeout...');
            setShowCompetitorAnalysis(true);
            setAnalysisLoading(false);
          }
        }
      } catch (error) {
        console.error('❌ Error in competitor polling:', error);
        pollCount++;
        
        if (pollCount >= maxPolls) {
          console.log('⏰ Competitor polling timeout reached due to errors');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
          }
          // Always transition to competitor analysis view even if no competitors found
          console.log('🔄 Transitioning to competitor analysis view after timeout...');
          // Always transition to competitor analysis view even on errors
          console.log('🔄 Transitioning to competitor analysis view after errors...');
          setShowCompetitorAnalysis(true);
          setAnalysisLoading(false);
        }
      }
    };

    // Start polling immediately
    pollForCompetitors();
    
    // Set up interval for subsequent polls
    pollingIntervalRef.current = setInterval(pollForCompetitors, 5000); // Poll every 5 seconds
    
    // Set overall timeout
    pollingTimeoutRef.current = setTimeout(() => {
      console.log('⏰ Overall competitor polling timeout reached');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setAnalysisLoading(false);
      // Always transition to competitor analysis view even on overall timeout
      console.log('🔄 Transitioning to competitor analysis view after overall timeout...');
      setShowCompetitorAnalysis(true);
    }, 400000); // 6 minutes 40 seconds total timeout (matches Supabase Pro plan limit)
  };

  const checkAnalysisCompletion = async (): Promise<boolean> => {
    try {
      console.log('🔍 Checking response analysis completion for company:', currentCompanyId);
      
      // Step 1: Get all approved competitor IDs for this company
      const { data: competitorsData, error: competitorsError } = await supabase
        .from('competitors')
        .select('id')
        .eq('company', currentCompanyId)
        .eq('approved', true);

      console.log('📊 Step 1 - Competitors query result:', { 
        data: competitorsData, 
        error: competitorsError,
        competitorCount: competitorsData?.length || 0
      });

      if (competitorsError) {
        console.error('❌ Error fetching competitors:', competitorsError);
        return false;
      }

      if (!competitorsData || competitorsData.length === 0) {
        console.log('⚠️ No approved competitors found for company, analysis cannot be complete');
        return false;
      }

      // Step 2: Get all response IDs for this company (respects RLS on responses table)
      const { data: responsesData, error: responsesError } = await supabase
        .from('responses')
        .select('id')
        .eq('company', currentCompanyId);

      console.log('📊 Step 2 - Responses query result:', { 
        data: responsesData, 
        error: responsesError,
        responseCount: responsesData?.length || 0
      });

      if (responsesError) {
        console.error('❌ Error fetching responses:', responsesError);
        return false;
      }

      if (!responsesData || responsesData.length === 0) {
        console.log('⚠️ No responses found for company, analysis cannot be complete');
        return false;
      }

      // Step 3: Check for analysis data using both competitor IDs and response IDs
      const competitorIds = competitorsData.map(c => c.id);
      const responseIds = responsesData.map(r => r.id);
      
      const { data: analysisData, error: analysisError } = await supabase
        .from('response_analysis')
        .select('id, response, competitor')
        .in('response', responseIds)
        .in('competitor', competitorIds);

      console.log('📊 Step 3 - Analysis query result:', { 
        data: analysisData, 
        error: analysisError,
        hasData: analysisData && analysisData.length > 0,
        analysisRecordCount: analysisData?.length || 0,
        responseIdsChecked: responseIds.length,
        competitorIdsChecked: competitorIds.length,
        firstAnalysisRecord: analysisData?.[0] || null
      });

      if (analysisError) {
        console.error('❌ Error checking analysis data:', analysisError);
        return false;
      }

      // If we found analysis records for any of the company's responses and competitors, consider analysis complete
      const isComplete = analysisData && analysisData.length > 0;
      console.log('✅ Response analysis completion status:', isComplete, 'with', analysisData?.length || 0, 'analysis records found for', responseIds.length, 'responses and', competitorIds.length, 'competitors');
      
      return isComplete;
    } catch (error) {
      console.error('❌ Error in checkAnalysisCompletion:', error);
      return false;
    }
  };

  const triggerResponseAnalysis = async () => { // Renamed for clarity - this is the second analysis step
    setAnalysisLoading(true);
    setAnalysisError('');

    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }

    try {
      // Get the auth token
      const authData = localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
      
      if (!authData) {
        setAnalysisError('Authentication token not found - please refresh and try again');
        return;
      }
      
      const parsedAuth = JSON.parse(authData);
      const accessToken = parsedAuth?.access_token;
      
      if (!accessToken) {
        setAnalysisError('Access token not found - please refresh and try again');
        return;
      }

      // Call the analyze responses edge function
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-responses`;
      
      console.log('🔄 Calling analyze-responses edge function...');
      const response = await fetch(apiUrl, { // This is the second analysis step
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: currentCompanyId
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Analysis triggered:', result);
        
        // Start polling for completion
        console.log('🔄 Starting polling for analysis completion...');
        
        pollingIntervalRef.current = setInterval(async () => {
          console.log('🔍 Checking analysis completion...');
          const isComplete = await checkAnalysisCompletion();
          
          if (isComplete) {
            console.log('✅ Analysis completed, stopping polling');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            if (pollingTimeoutRef.current) {
              clearTimeout(pollingTimeoutRef.current);
              pollingTimeoutRef.current = null;
            }
            
            // Mark onboarding as completed and then redirect
            await markOnboardingCompleted();
          }
        }, 5000); // Poll every 5 seconds
        
        // Set timeout to stop polling after 2 minutes
        pollingTimeoutRef.current = setTimeout(() => {
          console.log('⏰ Analysis polling timeout reached');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          // Auto-complete onboarding after 20 seconds
          markOnboardingCompleted();
        }, 20000); // 20 seconds timeout
        
      } else {
        const result = await response.json();
        console.error('❌ Analysis failed:', result);
        setAnalysisError(result.error || 'Failed to analyze prompts');
        setAnalysisLoading(false);
      }
    } catch (err: any) {
      console.error('❌ Analysis error:', err);
      setAnalysisError('An unexpected error occurred during analysis');
      setAnalysisLoading(false);
    }
  };

  const markOnboardingCompleted = async () => {
    try {
      console.log('🎯 Marking onboarding as completed...');
      
      const { data: { user } } = await SupabaseQueryExecutor.executeQuery(() => supabase.auth.getUser());
      if (!user) {
        console.error('❌ No user found for onboarding completion');
        setAnalysisError('User authentication error. Please refresh and try again.');
        return;
      }

      console.log('👤 User ID for profile update:', user.id);
      // Update user profile to mark onboarding as completed
      const { error: updateError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('user_profiles')
        .update({ 
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id));

      console.log('📊 Profile update result:', { error: updateError });
      if (updateError) {
        console.error('❌ Failed to mark onboarding as completed:', updateError);
        console.error('❌ Full update error object:', JSON.stringify(updateError, null, 2));
        setAnalysisError('Failed to complete onboarding setup. Please refresh and try again.');
        return;
      }

      console.log('✅ Onboarding marked as completed successfully');
      
      // Now proceed to dashboard
      console.log('🚀 Calling onComplete to redirect to dashboard...');
      onComplete();
      
    } catch (error) {
      console.error('❌ Error marking onboarding as completed:', error);
      setAnalysisError('An error occurred while completing onboarding. Please refresh and try again.');
    } finally {
      // Always reset loading state regardless of success or failure
      console.log('🔄 Resetting analysis loading state...');
      setAnalysisLoading(false);
    }
  };

  if (step === 3) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="text-center mb-8 px-6 pt-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t.step3.title}</h1>
          <p className="text-xl text-white/90">{t.step3.subtitle}</p>
        </div>

        {showCompetitorAnalysis ? (
          <CompetitorAnalysis
            companyId={currentCompanyId}
            onComplete={() => {}} // Empty function since we handle completion via polling
            language={language}
            showManagementControls={true}
            showAnalyzeResultsButton={true}
            onAnalyzeResults={triggerResponseAnalysis} // Pass the response analysis function here
            isAnalysisLoading={analysisLoading}
            analysisError={analysisError}
            isDashboardMode={false}
          />
        ) : (
          <PromptManagement
            companyId={currentCompanyId}
            initialPrompts={generatedPrompts}
            onComplete={handlePromptManagementComplete}
            language={language}
            isViewOnlyMode={false}
            showManagementControls={true}
            disablePromptClick={true}
            showAnalyzeResultsButton={!showCompetitorAnalysis}
            isAnalysisLoading={analysisLoading}
            analysisError={analysisError}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {step === 1 && (
          <>
            <div className="flex items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{t.step1.title}</h2>
                <p className="text-gray-600">{t.step1.subtitle}</p>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleStep1Submit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.step1.firstName}
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder={t.step1.firstNamePlaceholder}
                    className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all ${
                      !isFirstNameEditable ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                    disabled={!isFirstNameEditable}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.step1.lastName}
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder={t.step1.lastNamePlaceholder}
                    className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all ${
                      !isLastNameEditable ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                    disabled={!isLastNameEditable}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.step1.companyName}
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                    placeholder={t.step1.companyNamePlaceholder}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.step1.companyDomain}
                </label>
                <input
                  type="text"
                  value={formData.companyDomain}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyDomain: e.target.value }))}
                  placeholder={t.step1.companyDomainPlaceholder}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.step1.companyCountry}
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <select
                    value={formData.companyCountry}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyCountry: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all appearance-none bg-white"
                    required
                    disabled={loadingCountries}
                  >
                    <option value="">{loadingCountries ? 'Loading...' : t.step1.selectCountry}</option>
                    {countries.map(country => (
                      <option key={country.id} value={country.name}>{country.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.step1.searchCountry}
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <select
                    value={formData.searchOptimizationCountry}
                    onChange={(e) => setFormData(prev => ({ ...prev, searchOptimizationCountry: e.target.value }))}
                    className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all appearance-none ${
                      !isSearchCountryEditable ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                    }`}
                    required
                    disabled={loadingCountries || !isSearchCountryEditable}
                  >
                    <option value="">{loadingCountries ? 'Loading...' : t.step1.selectCountry}</option>
                    {countries.map(country => (
                      <option key={country.id} value={country.name}>{country.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-orange-500 transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating...
                  </div>
                ) : (
                  t.step1.continue
                )}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center mb-8">
              <button
                onClick={() => setStep(1)}
                className="text-gray-400 hover:text-gray-600 mr-4"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{t.step2.title}</h2>
                <p className="text-gray-600">{t.step2.subtitle}</p>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleStep2Submit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Target className="inline h-4 w-4 mr-1" />
                  {t.step2.title}
                </label>
                <textarea
                  value={formData.companyGoal}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyGoal: e.target.value }))}
                  placeholder={t.step2.goalPlaceholder}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-orange-500 transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    <Lightbulb className="mr-2 h-5 w-5" />
                    Generating...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Lightbulb className="mr-2 h-5 w-5" />
                    {t.step2.generatePrompts}
                  </div>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;