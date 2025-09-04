import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Edit2, Trash2, Eye, ChevronDown, ArrowLeft, Loader2, CheckCircle, X, Globe
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import PromptResponsesModal from './PromptResponsesModal';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ro } from 'date-fns/locale';

interface Prompt {
  id: string;
  prompt: string;
  description?: string;
  country: string;
  company_id: string;
  created_at: string;
  updated_at?: string;
}

interface PromptMetric extends Prompt {
  responses_count: number;
  visibility: number;
  position: number | null;
  sentiment: string | null;
}

interface CompetitorOption {
  id: string;
  name: string;
  isYou: boolean;
}

interface PromptManagementProps {
  companyId: string;
  initialPrompts: Prompt[];
  onComplete: () => void;
  language: 'en' | 'ro';
  isViewOnlyMode?: boolean;
  showManagementControls?: boolean;
  selectedPromptId?: string | null;
  showAnalyzeResultsButton?: boolean;
  onPromptResponsesModalClose?: () => void;
  userCompanies?: any[];
  companyData?: any;
  disablePromptClick?: boolean;
  isAnalysisLoading?: boolean;
  analysisError?: string;
}

const PromptManagement: React.FC<PromptManagementProps> = ({
  companyId,
  initialPrompts,
  onComplete,
  language,
  isViewOnlyMode = false,
  showManagementControls = false,
  selectedPromptId: externalSelectedPromptId = null,
  showAnalyzeResultsButton = true,
  onPromptResponsesModalClose,
  userCompanies = [],
  companyData = null,
  disablePromptClick = false,
  isAnalysisLoading = false,
  analysisError = ''
}) => {
  const [prompts, setPrompts] = useState<PromptMetric[]>(() => {
    // Initialize with initialPrompts if available, converting to PromptMetric format
    return initialPrompts.map(prompt => ({
      ...prompt,
      responses_count: 0,
      visibility: 0,
      position: null,
      sentiment: null
    }));
  });
  const [newPromptText, setNewPromptText] = useState('');
  const [newPromptCountry, setNewPromptCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [addPromptError, setAddPromptError] = useState('');
  const [competitorOptions, setCompetitorOptions] = useState<CompetitorOption[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [error, setError] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  
  // New state for modals
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<PromptMetric | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptMetric | null>(null);
  const [editPromptText, setEditPromptText] = useState('');
  const [editPromptCountry, setEditPromptCountry] = useState('');
  const [countries, setCountries] = useState<any[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [showAddPromptModal, setShowAddPromptModal] = useState(false);
  const [totalApprovedCompetitorsCount, setTotalApprovedCompetitorsCount] = useState<number | null>(null);

  // State for sorting
  const [sortColumn, setSortColumn] = useState<keyof PromptMetric | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Polling interval ref for cleanup
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (companyId) {
      initializeData();
    }
  }, [companyId]);

  // Initialize all data sequentially
  const initializeData = async () => {
    console.log('🚀 PromptManagement initializeData started for companyId:', companyId);
    setLoadingMetrics(true);
    setError('');
    
    try {
      // Step 1: Fetch competitor options
      console.log('📊 Step 1: Fetching competitor options...');
      await fetchCompetitorOptions();
      
      // Step 2: Fetch total approved competitors count
      console.log('📊 Step 2: Fetching total approved competitors count...');
      await fetchTotalApprovedCompetitorsCount();
      
      console.log('✅ PromptManagement initialization completed successfully');
    } catch (error) {
      console.error('❌ Error during PromptManagement initialization:', error);
      setError('Failed to initialize data');
      setLoadingMetrics(false);
    } finally {
      console.log('🔄 PromptManagement initializeData finally block - setting loadingMetrics to false');
      console.log('🔄 PromptManagement initializeData finally block executed');
      setLoadingMetrics(false);
    }
  };

  // Separate useEffect for fetching prompt metrics - only runs when selectedEntityId is available
  useEffect(() => {
    console.log('🔍 PromptManagement useEffect for metrics triggered:', {
      companyId,
      selectedEntityId,
      totalApprovedCompetitorsCount,
      shouldFetch: !!(companyId && totalApprovedCompetitorsCount !== null)
    });
    
    if (companyId && totalApprovedCompetitorsCount !== null) {
      fetchAndAggregatePromptMetrics();
    }
  }, [companyId, selectedEntityId, totalApprovedCompetitorsCount]);

  // Separate useEffect for initial prompt display
  useEffect(() => {
    if (initialPrompts.length > 0) {
      setPrompts(initialPrompts.map(prompt => ({
        ...prompt,
        responses_count: 0,
        visibility: 0,
        position: null,
        sentiment: null
      })));
    }
  }, [initialPrompts]);

  // Fetch countries for edit modal
  useEffect(() => {
    const fetchCountries = async () => {
      setLoadingCountries(true);
      try {
        const { data, error } = await supabase
          .from('countries')
          .select('id, name, code, flag')
          .order('name');
        
        if (error) {
          console.error('Error fetching countries:', error);
        } else {
          setCountries(data || []);
        }
      } catch (err) {
        console.error('Error fetching countries:', err);
      } finally {
        setLoadingCountries(false);
      }
    };

    fetchCountries();
  }, []);

  // Handle external selectedPromptId changes
  useEffect(() => {
    if (externalSelectedPromptId) {
      setSelectedPromptId(externalSelectedPromptId);
    }
  }, [externalSelectedPromptId]);

  const fetchCompetitorOptions = async () => {
    console.log('🔍 PromptManagement fetchCompetitorOptions called for companyId:', companyId);
    
    try {
      if (!companyId) return;

      console.log('📊 Fetching current company data...');
      // Get current company data
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('name, domain')
        .eq('id', companyId)
        .single();

      console.log('📊 Company data fetch result:', { companyData, error: companyError });

      if (companyError || !companyData) {
        console.error('Error fetching company data:', companyError);
        setSelectedEntityId(companyId); // Fallback to company ID
        return;
      }

      console.log('🏆 Fetching competitors for company...');
      // Get all approved competitors for this company
      const { data, error: fetchError } = await supabase
        .from('competitors')
        .select('id, name, website, approved')
        .eq('company', companyId)
        .order('created_at', { ascending: false });

      console.log('🏆 Competitors fetch result:', { 
        data: data?.length || 0, 
        error: fetchError,
        rawData: data
      });

      if (fetchError) {
        console.error('Error fetching competitors:', fetchError);
        setSelectedEntityId(companyId); // Fallback to company ID
        return;
      }

      console.log('🔍 Checking if current company exists as competitor...');
      // Check if the current company exists as a competitor (self-tracking)
      let currentCompanyCompetitorId: string | null = null;
      try {
        const { data: selfAsCompetitor, error: selfAsCompetitorError } = await supabase
          .from('competitors')
          .select('id')
          .eq('company', companyId)
          .eq('name', companyData.name)
          .maybeSingle();

        console.log('🔍 Self as competitor check:', { selfAsCompetitor, error: selfAsCompetitorError });

        if (!selfAsCompetitorError && selfAsCompetitor) {
          currentCompanyCompetitorId = selfAsCompetitor.id.toString();
          console.log('✅ Found current company as competitor with ID:', currentCompanyCompetitorId);
        }
      } catch (err) {
        console.error('Error checking if current company is also a competitor:', err);
      }

      console.log('📋 Building competitor options...');
      // Create options array
      const options: CompetitorOption[] = [];

      // Add current company first if it exists as a competitor
      if (currentCompanyCompetitorId) {
        options.push({
          id: currentCompanyCompetitorId,
          name: companyData.name,
          isYou: true
        });
        console.log('➕ Added current company to options');
      }

      // Add other competitors
      data?.forEach(competitor => {
        if (competitor.id.toString() !== currentCompanyCompetitorId) {
          options.push({
            id: competitor.id.toString(),
            name: competitor.name,
            isYou: false
          });
        }
      });

      console.log('📋 Final competitor options:', options);
      setCompetitorOptions(options);
      
      console.log('🎯 Setting selectedEntityId...');
      // Auto-select logic with fallback to current company
      if (options.length > 0) {
        if (!selectedEntityId || !options.some(opt => opt.id === selectedEntityId)) {
          const newSelectedId = options[0].id;
          console.log('🎯 Auto-selecting entity:', newSelectedId);
          setSelectedEntityId(newSelectedId);
        }
      } else {
        // No competitors found, use current company ID as fallback
        console.log('⚠️ No competitor options found, using company ID as fallback:', companyId);
        setSelectedEntityId(companyId);
      }
      
      console.log('✅ fetchCompetitorOptions completed');
    } catch (error) {
      console.error('Error fetching competitor options:', error);
      // Fallback to company ID on error
      console.log('❌ Error in fetchCompetitorOptions, using company ID as fallback:', companyId);
      setSelectedEntityId(companyId);
    }
  };

  const fetchTotalApprovedCompetitorsCount = async () => {
    console.log('🔢 fetchTotalApprovedCompetitorsCount called for companyId:', companyId);
    
    try {
      if (!companyId) return;

      console.log('📊 Fetching company data for competitor count...');
      // Get current company data
      const { data: currentCompanyData, error: companyError } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();

      console.log('📊 Company data result:', { currentCompanyData, error: companyError });

      if (companyError || !currentCompanyData) {
        console.error('Error fetching company data:', companyError);
        setTotalApprovedCompetitorsCount(0);
        return;
      }

      console.log('🔍 Checking if company exists as competitor for count calculation...');
      // Check if the current company exists as a competitor (self-tracking)
      let currentCompanyCompetitorId: number | null = null;
      try {
        const { data: selfAsCompetitor, error: selfAsCompetitorError } = await supabase
          .from('competitors')
          .select('id')
          .eq('company', companyId)
          .eq('name', currentCompanyData.name)
          .maybeSingle();

        console.log('🔍 Self as competitor check result:', { selfAsCompetitor, error: selfAsCompetitorError });

        if (!selfAsCompetitorError && selfAsCompetitor) {
          currentCompanyCompetitorId = selfAsCompetitor.id;
          console.log('✅ Found company as competitor with ID:', currentCompanyCompetitorId);
        }
      } catch (err) {
        console.error('Error checking if current company is also a competitor:', err);
      }

      console.log('📊 Fetching total approved competitors count...');
      // Fetch total approved competitors count
      const { data, error } = await supabase
        .from('competitors')
        .select('id')
        .eq('company', companyId)
        .eq('approved', true);

      console.log('🏆 Competitors data fetch result:', {
        data: data?.length || 0, 
        error: error,
        rawData: data
      });

      if (error) {
        console.error('Error fetching total competitors count:', error);
        setTotalApprovedCompetitorsCount(0);
        return;
      }

      let count = data?.length || 0;
      // Check if the company itself is counted as a competitor and exclude it
      if (currentCompanyCompetitorId && data?.some(comp => comp.id === currentCompanyCompetitorId)) {
        count--;
        console.log('📊 Excluded company from competitor count, adjusted count:', count);
      }
      
      console.log('✅ Setting totalApprovedCompetitorsCount to:', count);
      setTotalApprovedCompetitorsCount(count);
    } catch (error) {
      console.error('Error fetching total approved competitors count:', error);
      setTotalApprovedCompetitorsCount(0);
    }
  };

  const fetchAndAggregatePromptMetrics = async () => {
    console.log('📊 fetchAndAggregatePromptMetrics called with:', {
      companyId,
      selectedEntityId,
      totalApprovedCompetitorsCount
    });
    
    setLoadingMetrics(true);
    setError('');

    try {
      if (!companyId) {
        console.log('❌ No companyId provided, skipping fetch');
        setPrompts([]);
        return;
      }

      console.log('📝 Fetching prompts for company...');
      // Fetch all prompts for this company
      const { data: promptsData, error: promptsError } = await supabase
        .from('prompts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      console.log('📝 Prompts fetch result:', { 
        promptsData: promptsData?.length || 0, 
        error: promptsError 
      });

      if (promptsError) {
        throw new Error(`Failed to fetch prompts: ${promptsError.message}`);
      }

      if (!promptsData || promptsData.length === 0) {
        console.log('📝 No prompts found for company');
        setPrompts([]);
        return;
      }

      console.log('💬 Fetching responses for prompts...');
      // Fetch all responses for these prompts
      const promptIds = promptsData.map(p => p.id);
      const { data: responsesData, error: responsesError } = await supabase
        .from('responses')
        .select('id, prompt, created_at')
        .in('prompt', promptIds)
        .eq('company', companyId);

      console.log('💬 Responses fetch result:', { 
        responsesData: responsesData?.length || 0, 
        error: responsesError 
      });

      if (responsesError) {
        throw new Error(`Failed to fetch responses: ${responsesError.message}`);
      }

      // Fetch response analysis data for the selected entity (if one is selected)
      const responseIds = responsesData?.map(r => r.id) || [];
      let analysisData: any[] = [];

      // Determine entity ID for query - use selectedEntityId or fallback to companyId  
      let entityIdForQuery: string = selectedEntityId || companyId;
      let competitorIdForQuery: number | null = null;
      
      console.log('🎯 Entity selection logic:', {
        selectedEntityId,
        companyId,
        entityIdForQuery,
        isViewOnlyMode,
        responseIdsCount: responseIds.length
      });
      
      if (responseIds.length > 0) {
        console.log('🔍 Processing entity ID for analysis query...');
        // Try to parse as competitor ID first
        const parsedId = parseInt(entityIdForQuery);
        if (!isNaN(parsedId)) {
          competitorIdForQuery = parsedId;
          console.log('✅ Using competitor ID for analysis:', competitorIdForQuery);
        } else {
          // If it's not a valid number, it might be the company ID
          // In this case, we need to find the company's competitor entry
          console.log('🔍 Entity ID is not a number, checking if it matches company ID...');
          if (entityIdForQuery === companyId) {
            // Try to find the company as a competitor
            try {
              console.log('🔍 Looking for company as competitor...');
              const { data: currentCompanyData } = await supabase
                .from('companies')
                .select('name')
                .eq('id', companyId)
                .single();
              
              console.log('📊 Company data for competitor lookup:', currentCompanyData);
              
              if (currentCompanyData) {
                const { data: selfAsCompetitor } = await supabase
                  .from('competitors')
                  .select('id')
                  .eq('company', companyId)
                  .eq('name', currentCompanyData.name)
                  .maybeSingle();
                
                console.log('🔍 Self as competitor result:', selfAsCompetitor);
                
                if (selfAsCompetitor) {
                  competitorIdForQuery = selfAsCompetitor.id;
                  console.log('✅ Found company as competitor with ID:', competitorIdForQuery);
                } else {
                  console.log('⚠️ Company not found as competitor, will skip analysis data');
                }
              }
            } catch (err) {
              console.error('Error finding company as competitor:', err);
            }
          }
        }
      } else {
        console.log('⚠️ No responses found, skipping analysis data fetch');
      }

      console.log('🔍 Final competitor ID for query:', competitorIdForQuery);

      if (responseIds.length > 0 && competitorIdForQuery !== null) {
        console.log('📈 Fetching analysis data...');
        const { data: analysis, error: analysisError } = await supabase
          .from('response_analysis')
          .select('response, competitor, company_appears, sentiment, position')
          .in('response', responseIds)
          .eq('competitor', competitorIdForQuery);

        console.log('📈 Analysis data fetch result:', { 
          analysis: analysis?.length || 0, 
          error: analysisError 
        });

        if (analysisError) {
          console.error('Error fetching analysis data:', analysisError);
        } else {
          analysisData = analysis || [];
        }
      } else {
        console.log('⚠️ Skipping analysis data fetch - no valid competitor ID or no responses');
      }

      console.log('🔄 Processing analysis data...');
      // Create a map of response ID to analysis data
      const responseAnalysisMap = new Map();
      analysisData.forEach(analysis => {
        if (!responseAnalysisMap.has(analysis.response)) {
          responseAnalysisMap.set(analysis.response, []);
        }
        responseAnalysisMap.get(analysis.response).push(analysis);
      });

      console.log('📊 Analysis map created with', responseAnalysisMap.size, 'entries');

      console.log('🔄 Calculating prompt metrics...');
      // Aggregate metrics for each prompt
      const promptMetrics: PromptMetric[] = promptsData.map(prompt => {
        const promptResponses = responsesData?.filter(r => r.prompt === prompt.id) || [];
        const responsesCount = promptResponses.length;

        let totalAppears = 0;
        let totalPosition = 0;
        let totalSentiment = 0;
        let validPositions = 0;
        let validSentiments = 0;

        // Calculate metrics if we have analysis data
        if (competitorIdForQuery !== null) {
          promptResponses.forEach(response => {
            const analysisEntries = responseAnalysisMap.get(response.id) || [];
            analysisEntries.forEach((analysis: any) => {
              if (analysis.company_appears) {
                totalAppears++;
              }
              
              // Handle position calculation with consistent logic
              let position = analysis.position;
              // If position is 0, null, or undefined, replace with total competitors count + 1 (last place)
              if (position === 0 || position === null || position === undefined) {
                position = (totalApprovedCompetitorsCount || 0) + 1;
              }
              totalPosition += position;
              validPositions++;
              
              if (analysis.sentiment !== null && analysis.sentiment !== undefined) {
                totalSentiment += analysis.sentiment;
                validSentiments++;
              }
            });
          });
        }

        const visibility = competitorIdForQuery !== null && responsesCount > 0 ? Math.round((totalAppears / responsesCount) * 100) : 0;
        const avgPosition = competitorIdForQuery !== null && validPositions > 0 ? Math.round(totalPosition / validPositions) : null;
        const avgSentiment = competitorIdForQuery !== null && validSentiments > 0 ? totalSentiment / validSentiments : null;

        let sentimentLabel = null;
        if (avgSentiment !== null) {
          if (avgSentiment >= 67) sentimentLabel = 'positive';
          else if (avgSentiment >= 34) sentimentLabel = 'neutral';
          else sentimentLabel = 'negative';
        }

        return {
          ...prompt,
          responses_count: responsesCount,
          visibility,
          position: avgPosition,
          sentiment: sentimentLabel
        };
      });

      console.log('✅ Prompt metrics calculated:', promptMetrics.length, 'prompts processed');
      setPrompts(promptMetrics);
    } catch (err: any) {
      console.error('Error fetching prompt metrics:', err);
      setError(err.message || 'Failed to load prompt metrics');
    } finally {
      console.log('🔄 Setting loadingMetrics to false');
      setLoadingMetrics(false);
    }
  };

  const handleAddPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPromptText.trim() || !newPromptCountry) {
      setAddPromptError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setAddPromptError('');

    try {
      const { error } = await supabase
        .from('prompts')
        .insert({
          prompt: newPromptText.trim(),
          description: `Generated prompt for company`,
          country: newPromptCountry,
          company_id: companyId
        });

      if (error) {
        throw new Error(error.message);
      }

      setNewPromptText('');
      setNewPromptCountry('');
      setShowAddPromptModal(false);
      await fetchAndAggregatePromptMetrics(); // Re-fetch data after adding
      setAddPromptError(''); // Clear any previous error
    } catch (err: any) {
      setAddPromptError(`Failed to add prompt: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrompt = (prompt: PromptMetric) => {
    setPromptToDelete(prompt);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!promptToDelete) return;
    
    setLoading(true);
    setError('');
    
    try {
      const { error } = await supabase
        .from('prompts')
        .delete()
        .eq('id', promptToDelete.id);

      if (error) {
        throw new Error(error.message);
      }

      await fetchAndAggregatePromptMetrics(); // Re-fetch data
      setShowDeleteConfirm(false);
      setPromptToDelete(null);
    } catch (err: any) {
      setError(`Failed to delete prompt: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setPromptToDelete(null);
    setError('');
  };

  const handleEditPrompt = (prompt: PromptMetric) => {
    setEditingPrompt(prompt);
    setEditPromptText(prompt.prompt);
    setEditPromptCountry(prompt.country);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrompt) return;
    
    setLoading(true);
    setError('');
    
    try {
      const { error } = await supabase
        .from('prompts')
        .update({ 
          prompt: editPromptText.trim(), 
          country: editPromptCountry 
        })
        .eq('id', editingPrompt.id);

      if (error) {
        throw new Error(error.message);
      }

      await fetchAndAggregatePromptMetrics(); // Re-fetch data
      setShowEditModal(false);
      setEditingPrompt(null);
    } catch (err: any) {
      setError(`Failed to update prompt: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingPrompt(null);
    setError('');
  };

  const handlePromptClick = (promptId: string) => {
    setSelectedPromptId(promptId);
  };

  const handlePromptResponsesModalClose = () => {
    setSelectedPromptId(null);
    if (onPromptResponsesModalClose) {
      onPromptResponsesModalClose();
    }
  };

  const handleSort = (column: keyof PromptMetric) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedPrompts = [...prompts].sort((a, b) => {
    if (!sortColumn) return 0;
    
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });

  const getCountryFlag = (countryName: string): string => {
    const country = countries.find(c => c.name === countryName);
    return country?.flag || '🌍';
  };

  const getInitialFromPrompt = (prompt: string): string => {
    return prompt.charAt(0).toUpperCase();
  };

  const translations = {
    en: {
      title: 'Prompt Management',
      subtitle: 'All prompts used for AI analysis',
      loading: 'Loading prompts...',
      addPrompt: 'Add Prompt',
      promptText: 'Prompt Text',
      country: 'Country',
      noPrompts: 'No prompts found for this company.',
      promptPlaceholder: 'Enter your prompt here...',
      selectCountry: 'Select a country',
      responses: 'Responses',
      visibility: 'Visibility',
      position: 'Position',
      sentiment: 'Sentiment',
      created: 'Created',
      viewResponses: 'View Responses',
      actions: 'Actions',
      confirmDeleteTitle: 'Confirm Delete',
      confirmDeleteMessage: 'Are you sure you want to delete this prompt? This action cannot be undone.',
      delete: 'Delete',
      cancel: 'Cancel',
      editPromptTitle: 'Edit Prompt',
      saveChanges: 'Save Changes',
      you: 'You',
      addNewPrompt: 'Add New Prompt',
      promptsFound: 'prompts found',
      continueAnalysis: 'Continue with the analysis',
      analyzing: 'Analyzing...',
      analysisInProgress: 'This process may take several minutes to complete. Please wait while we analyze your prompts and gather competitor data.'
    },
    ro: {
      title: 'Gestionarea Prompt-urilor',
      subtitle: 'Toate prompt-urile folosite pentru analiza AI',
      loading: 'Se încarcă prompt-urile...',
      addPrompt: 'Adaugă Prompt',
      promptText: 'Text Prompt',
      country: 'Țară',
      noPrompts: 'Nu s-au găsit prompt-uri pentru această companie.',
      promptPlaceholder: 'Introdu prompt-ul aici...',
      selectCountry: 'Selectează o țară',
      responses: 'Răspunsuri',
      visibility: 'Vizibilitate',
      position: 'Poziție',
      sentiment: 'Sentiment',
      created: 'Creat',
      viewResponses: 'Vezi Răspunsuri',
      actions: 'Acțiuni',
      confirmDeleteTitle: 'Confirmă Ștergerea',
      confirmDeleteMessage: 'Ești sigur că vrei să ștergi acest prompt? Această acțiune nu poate fi anulată.',
      delete: 'Șterge',
      cancel: 'Anulează',
      editPromptTitle: 'Editează Prompt',
      saveChanges: 'Salvează Modificările',
      you: 'Tu',
      addNewPrompt: 'Adaugă Prompt Nou',
      promptsFound: 'prompt-uri găsite',
      continueAnalysis: 'Continuă cu analiza',
      analyzing: 'Se analizează...',
      analysisInProgress: 'Acest proces poate dura câteva minute pentru a se finaliza. Te rugăm să aștepți în timp ce analizăm prompt-urile și colectăm datele despre competitori.'
    }
  };

  const t = translations[language];

  return (
    <div className="flex-1 p-8">
      {!isViewOnlyMode && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
              <p className="text-white text-lg">{t.subtitle}</p>
            </div>
            <div className="text-white font-medium">
              {sortedPrompts.length} {t.promptsFound}
            </div>
          </div>
        </div>
      )}

      {isViewOnlyMode && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
              <p className="text-white text-lg">{t.subtitle}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-white font-medium">
                {sortedPrompts.length} {t.promptsFound}
              </div>
              <div className="relative max-w-xs">
                <select
                  value={selectedEntityId || ''}
                  onChange={(e) => setSelectedEntityId(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 pr-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                >
                  {competitorOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.name} {option.isYou ? `(${t.you})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      )}

      {showManagementControls && (
        <div className="mb-8">
          <button
            onClick={() => setShowAddPromptModal(true)}
            className="bg-gradient-to-r from-pink-500 to-orange-400 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-orange-500 transition-all transform hover:scale-[1.02] shadow-lg flex items-center"
          >
            <Plus className="mr-2 h-5 w-5" />
            {t.addNewPrompt}
          </button>
        </div>
      )}

      {/* Prompts Table */}
      <div>
        {loadingMetrics ? (
          <div className="text-center py-12">
            <Loader2 className="mx-auto w-8 h-8 text-white animate-spin mb-4" />
            <p className="text-white/90">{t.loading}</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-300">{error}</p>
          </div>
        ) : sortedPrompts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/90">{t.noPrompts}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-2">
              <thead className="bg-gray-900 rounded-t-xl">
                <tr>
                  <th className="py-4 px-6 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer rounded-tl-xl" onClick={() => handleSort('prompt')}>
                    {t.promptText}
                    {sortColumn === 'prompt' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                  <th className="py-4 px-6 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer" onClick={() => handleSort('position')}>
                    {t.position}
                    {sortColumn === 'position' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                  <th className="py-4 px-6 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer" onClick={() => handleSort('sentiment')}>
                    {t.sentiment}
                    {sortColumn === 'sentiment' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                  <th className="py-4 px-6 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer" onClick={() => handleSort('visibility')}>
                    {t.visibility}
                    {sortColumn === 'visibility' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                  <th className="py-4 px-6 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer" onClick={() => handleSort('responses_count')}>
                    {t.responses}
                    {sortColumn === 'responses_count' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                  <th className="py-4 px-6 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer" onClick={() => handleSort('country')}>
                    {t.country}
                    {sortColumn === 'country' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                  <th className="py-4 px-6 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer" onClick={() => handleSort('created_at')}>
                    {t.created}
                    {sortColumn === 'created_at' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                  {showManagementControls && (
                    <th className="py-4 px-6 text-left text-xs font-medium text-white uppercase tracking-wider rounded-tr-xl">
                      {t.actions}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedPrompts.map((promptMetric) => (
                  <tr
                    key={promptMetric.id}
                    className={`${
                      disablePromptClick 
                        ? 'cursor-default bg-white rounded-xl shadow-sm' 
                        : 'cursor-pointer hover:bg-gray-50 transition-all hover:rounded-xl hover:shadow-lg bg-white rounded-xl shadow-sm'
                    }`}
                    onClick={disablePromptClick ? undefined : () => handlePromptClick(promptMetric.id)}
                  >
                    <td className="py-4 px-6">
                      <p className="text-gray-900 font-medium">{promptMetric.prompt}</p>
                    </td>
                    <td className="py-4 px-6 text-gray-700">
                      {promptMetric.position !== null && promptMetric.position > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          #{promptMetric.position}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {promptMetric.sentiment && (
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${
                            promptMetric.sentiment === 'positive' ? 'bg-green-500' :
                            promptMetric.sentiment === 'negative' ? 'bg-red-500' :
                            'bg-gray-400'
                          }`}></div>
                          <span className="text-sm text-gray-700 capitalize">{promptMetric.sentiment}</span>
                        </div>
                      )}
                      {!promptMetric.sentiment && <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <span className="text-lg font-bold text-gray-900">{promptMetric.visibility}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-700">
                      {promptMetric.responses_count}
                    </td>
                    <td className="py-4 px-6 text-gray-700">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getCountryFlag(promptMetric.country)}</span>
                        <span>{promptMetric.country}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-700">
                      {formatDistanceToNow(new Date(promptMetric.created_at), { addSuffix: true, locale: language === 'ro' ? ro : enUS })}
                    </td>
                    {showManagementControls && (
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <Edit2
                            className="h-5 w-5 text-blue-500 hover:text-blue-700 cursor-pointer transition-colors"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleEditPrompt(promptMetric); 
                            }}
                          />
                          <Trash2
                            className="h-5 w-5 text-red-500 hover:text-red-700 cursor-pointer transition-colors"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleDeletePrompt(promptMetric); 
                            }}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Analyze Prompts Button - shown during onboarding */}
      {showAnalyzeResultsButton && (
        <div className="mt-8 text-center">
          {analysisError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl max-w-2xl mx-auto">
              <p className="text-red-600 text-sm">{analysisError}</p>
            </div>
          )}
          <button
            onClick={onComplete}
            disabled={loading || sortedPrompts.length === 0 || isAnalysisLoading}
            className="bg-gradient-to-r from-pink-500 to-orange-400 text-white px-8 py-4 rounded-xl font-semibold hover:from-pink-600 hover:to-orange-500 transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center mx-auto"
          >
            {isAnalysisLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t.analyzing}
              </>
            ) : loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-5 w-5" />
                {t.continueAnalysis}
              </>
            )}
          </button>
          {isAnalysisLoading && (
            <p className="text-white/80 text-sm mt-4 max-w-2xl mx-auto text-center leading-relaxed">
              {t.analysisInProgress}
            </p>
          )}
        </div>
      )}

      {/* Add Prompt Modal */}
      {showAddPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{t.addNewPrompt}</h2>
              <button
                onClick={() => {
                  setShowAddPromptModal(false);
                  setAddPromptError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {addPromptError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{addPromptError}</p>
              </div>
            )}

            <form onSubmit={handleAddPrompt} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.promptText}
                </label>
                <textarea
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  placeholder={t.promptPlaceholder}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.country}
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <select
                    value={newPromptCountry}
                    onChange={(e) => setNewPromptCountry(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all appearance-none bg-white"
                    required
                    disabled={loadingCountries}
                  >
                    <option value="">{loadingCountries ? 'Loading...' : t.selectCountry}</option>
                    {countries.map(country => (
                      <option key={country.id} value={country.name}>
                        {country.flag} {country.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPromptModal(false);
                    setAddPromptError('');
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-pink-500 to-orange-400 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-orange-500 transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Adding...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Plus className="mr-2 h-5 w-5" />
                      {t.addPrompt}
                    </div>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prompt Responses Modal */}
      {selectedPromptId && (
        <PromptResponsesModal
          promptId={selectedPromptId}
          companyId={companyId}
          language={language}
          onClose={handlePromptResponsesModalClose}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && promptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{t.confirmDeleteTitle}</h2>
              <button onClick={handleCancelDelete} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <p className="text-gray-700 mb-8">{t.confirmDeleteMessage}</p>
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            <div className="flex justify-end space-x-4">
              <button
                onClick={handleCancelDelete}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={loading}
                className="px-6 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Deleting...' : t.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Prompt Modal */}
      {showEditModal && editingPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{t.editPromptTitle}</h2>
              <button onClick={handleCancelEdit} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.promptText}
                </label>
                <textarea
                  value={editPromptText}
                  onChange={(e) => setEditPromptText(e.target.value)}
                  placeholder={t.promptPlaceholder}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.country}
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <select
                    value={editPromptCountry}
                    onChange={(e) => setEditPromptCountry(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all appearance-none bg-white"
                    required
                    disabled={loadingCountries}
                  >
                    <option value="">{loadingCountries ? 'Loading...' : t.selectCountry}</option>
                    {countries.map(country => (
                      <option key={country.id} value={country.name}>
                        {country.flag} {country.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-pink-500 to-orange-400 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-orange-500 transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    t.saveChanges
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptManagement;