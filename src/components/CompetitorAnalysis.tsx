import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Globe, 
  Loader2, 
  CheckCircle, 
  Users,
  Building,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/helpers';
import { SupabaseQueryExecutor } from '../utils/supabaseUtils';

interface Competitor {
  id: number;
  name: string;
  website?: string;
  approved: boolean;
  created_at: string;
}

interface CompetitorAnalysisProps {
  companyId: string;
  onComplete: () => void;
  language: 'en' | 'ro';
  showManagementControls?: boolean;
  showAnalyzeResultsButton?: boolean;
  onAnalyzeResults?: () => void;
  isAnalysisLoading?: boolean;
  analysisError?: string;
  onCompetitorsUpdated?: () => void;
  isDashboardMode?: boolean;
}

const CompetitorAnalysis: React.FC<CompetitorAnalysisProps> = ({
  companyId,
  onComplete,
  language,
  showManagementControls = false,
  showAnalyzeResultsButton = false,
  onAnalyzeResults,
  isAnalysisLoading = false,
  analysisError = '',
  onCompetitorsUpdated,
  isDashboardMode = false,
}) => {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newCompetitorName, setNewCompetitorName] = useState('');
  const [newCompetitorWebsite, setNewCompetitorWebsite] = useState('');
  const [addingCompetitor, setAddingCompetitor] = useState(false);
  const [addCompetitorError, setAddCompetitorError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [competitorToDelete, setCompetitorToDelete] = useState<Competitor | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);
  const [editCompetitorName, setEditCompetitorName] = useState('');
  const [editCompetitorWebsite, setEditCompetitorWebsite] = useState('');
  const [currentCompany, setCurrentCompany] = useState<{ name: string; domain: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const normalizeUrl = (url: string): string => {
    if (!url) return '';
    
    let normalized = url.toLowerCase().trim();
    
    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, '');
    
    // Remove www.
    normalized = normalized.replace(/^www\./, '');
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    
    return normalized;
  };

  useEffect(() => {
    console.log('🔍 CompetitorAnalysis useEffect triggered:', {
      companyId,
      isAnalysisLoading,
      shouldFetch: !!(companyId && !isAnalysisLoading)
    });
    
    if (companyId && !isAnalysisLoading) {
      fetchCompetitors();
    }
  }, [companyId, isAnalysisLoading]);

  // Effect to handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && companyId && !isAnalysisLoading) {
        console.log('📱 Tab became visible, checking if refresh needed...');
        
        // Check if connection is stale and refresh if needed
        if (SupabaseQueryExecutor.isConnectionStale()) {
          console.log('🔄 Connection is stale, refreshing data in background...');
          setIsRefreshing(true);
          fetchCompetitors().finally(() => setIsRefreshing(false));
        }
        
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
  }, [companyId, isAnalysisLoading]);

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

  const fetchCompetitors = async () => {
    console.log('🔍 CompetitorAnalysis fetchCompetitors called for companyId:', companyId);
    setLoading(true);
    setError('');

    try {
      console.log('🏢 Fetching current company details...');
      // First, fetch current company details
      console.log('🏢 CompetitorAnalysis - About to call supabase.from("companies").select()...');
      let companyData, companyError;
      try {
        const result = await SupabaseQueryExecutor.executeQuery(() => supabase
          .from('companies')
          .select('name, domain')
          .eq('id', companyId)
          .single());
        companyData = result.data;
        companyError = result.error;
      } catch (exception) {
        console.error('🏢 CompetitorAnalysis - Exception in company query:', exception);
        companyError = { message: `Exception: ${exception.message}` };
        companyData = null;
      }

      console.log('🏢 CompetitorAnalysis - Company query result:', {
        companyData,
        companyError,
        hasCompanyData: !!companyData,
        errorMessage: companyError?.message,
        errorCode: companyError?.code
      });
      console.log('🏢 Company data fetch result:', { companyData, error: companyError });
      console.log('🏢 Company data fetch result:', { companyData, error: companyError });
      console.log('🏢 Company data fetch result:', { companyData, error: companyError });

      if (companyError || !companyData) {
        console.error('Error fetching company data:', companyError);
        setError('Failed to load company information');
        setLoading(false);
        return;
      }

      setCurrentCompany(companyData);
      console.log('Current company data:', companyData);

      console.log('🏆 Fetching all competitors for company...');
      // Fetch all competitors for this company
      console.log('🏆 CompetitorAnalysis - About to call supabase.from("competitors").select()...');
      let data, fetchError;
      try {
        const result = await SupabaseQueryExecutor.executeQuery(() => supabase
          .from('competitors')
          .select('*')
          .eq('company', companyId)
          .order('created_at', { ascending: false }));
        data = result.data;
        fetchError = result.error;
      } catch (exception) {
        console.error('🏆 CompetitorAnalysis - Exception in competitors query:', exception);
        fetchError = { message: `Exception: ${exception.message}` };
        data = null;
      }

      console.log('🏆 CompetitorAnalysis - Competitors query result:', {
        data: data?.length || 0,
        fetchError,
        hasData: !!data,
        errorMessage: fetchError?.message,
        errorCode: fetchError?.code
      });
      console.log('🏆 All competitors fetch result:', { 
        data: data?.length || 0, 
        error: fetchError,
        rawData: data
      });
      console.log('🏆 All competitors fetch result:', { 
        data: data?.length || 0, 
        error: fetchError,
        rawData: data
      });
      console.log('🏆 All competitors fetch result:', { 
        data: data?.length || 0, 
        error: fetchError 
      });

      if (fetchError) {
        console.error('❌ Error fetching competitors:', fetchError);
        throw new Error(fetchError.message);
      }

      console.log('🔍 Processing competitors data...');
      // Find and filter out the current company from the competitors list
      let selfTrackingCompetitorId: number | null = null;
      
      // Look for a competitor entry that matches the current company
      if (data && companyData) {
        const normalizedCompanyDomain = normalizeUrl(companyData.domain || '');
        const normalizedCompanyName = companyData.name.toLowerCase().trim();
        
        console.log('Filtering criteria:', {
          normalizedCompanyDomain,
          normalizedCompanyName
        });
        
        for (const competitor of data) {
          console.log('Checking competitor:', {
            id: competitor.id,
            name: competitor.name,
            website: competitor.website,
            normalizedName: competitor.name?.toLowerCase().trim(),
            normalizedWebsite: normalizeUrl(competitor.website || '')
          });
          
          // Check for name match
          const nameMatch = competitor.name && 
            competitor.name.toLowerCase().trim() === normalizedCompanyName;
          
          // Check for domain match
          const domainMatch = competitor.website && normalizedCompanyDomain &&
            normalizeUrl(competitor.website) === normalizedCompanyDomain;
          
          console.log('Match results:', { nameMatch, domainMatch });
          
          if (nameMatch || domainMatch) {
            selfTrackingCompetitorId = competitor.id;
            console.log('Found self-tracking competitor with ID:', selfTrackingCompetitorId);
            break;
          }
        }
      }
      
      console.log('🔄 Filtering out self-tracking competitor...');
      // Filter out the self-tracking competitor
      const filteredCompetitors = (data || []).filter(competitor => 
        competitor.id !== selfTrackingCompetitorId
      );
      
      console.log('Filtered competitors count:', filteredCompetitors.length, 'out of', data?.length || 0);
      
      console.log('📊 Sorting competitors...');
      // Sort competitors: pending (approved: false) first, then approved
      const sortedCompetitors = filteredCompetitors.sort((a, b) => {
        // First, sort by approval status (pending first)
        if (a.approved !== b.approved) {
          return a.approved ? 1 : -1; // false (pending) comes before true (approved)
        }
        // Within same approval status, sort by created_at descending (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      console.log('✅ Final sorted competitors:', sortedCompetitors.length);
      setCompetitors(sortedCompetitors);
      
      console.log('✅ fetchCompetitors completed successfully');
    } catch (err: any) {
      console.error('Error fetching competitors:', err);
      setError(err.message || 'Failed to load competitors');
    } finally {
      console.log('🔄 Setting loading to false');
      console.log('🔄 CompetitorAnalysis fetchCompetitors finally block - setting loading to false');
      setLoading(false);
    }
  };

  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCompetitorName.trim()) {
      setAddCompetitorError('Competitor name is required');
      return;
    }

    setAddingCompetitor(true);
    setAddCompetitorError('');

    try {
      // Format website URL if provided
      let formattedWebsite = '';
      if (newCompetitorWebsite.trim()) {
        let website = newCompetitorWebsite.trim();
        if (!website.startsWith('http://') && !website.startsWith('https://')) {
          website = `https://${website}`;
        }
        formattedWebsite = website;
      }

      const { error } = await supabase
        .from('competitors')
        .insert({
          name: newCompetitorName.trim(),
          website: formattedWebsite || null,
          company: companyId,
          approved: true // Auto-approve manually added competitors
        });

      if (error) {
        throw new Error(error.message);
      }

      setNewCompetitorName('');
      setNewCompetitorWebsite('');
      setShowAddModal(false);
      setCurrentPage(1); // Reset to first page
      await fetchCompetitors();
      
      if (onCompetitorsUpdated) {
        onCompetitorsUpdated();
      }
    } catch (err: any) {
      setAddCompetitorError(`Failed to add competitor: ${err.message}`);
    } finally {
      setAddingCompetitor(false);
    }
  };

  const handleApproveCompetitor = async (competitorId: number) => {
    setLoading(true);
    setError('');

    try {
      const { error } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('competitors')
        .update({ approved: true })
        .eq('id', competitorId));

      if (error) {
        throw new Error(error.message);
      }

      setCurrentPage(1); // Reset to first page
      await fetchCompetitors();
      
      if (onCompetitorsUpdated) {
        onCompetitorsUpdated();
      }
    } catch (err: any) {
      setError(`Failed to approve competitor: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompetitor = (competitor: Competitor) => {
    setCompetitorToDelete(competitor);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!competitorToDelete) return;
    
    setLoading(true);
    setError('');
    
    try {
      const { error } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('competitors')
        .delete()
        .eq('id', competitorToDelete.id));

      if (error) {
        throw new Error(error.message);
      }

      await fetchCompetitors();
      setCurrentPage(1); // Reset to first page
      setShowDeleteConfirm(false);
      setCompetitorToDelete(null);
      
      if (onCompetitorsUpdated) {
        onCompetitorsUpdated();
      }
    } catch (err: any) {
      setError(`Failed to delete competitor: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCompetitor = (competitor: Competitor) => {
    setEditingCompetitor(competitor);
    setEditCompetitorName(competitor.name);
    setEditCompetitorWebsite(competitor.website || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompetitor) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Format website URL if provided
      let formattedWebsite = '';
      if (editCompetitorWebsite.trim()) {
        let website = editCompetitorWebsite.trim();
        if (!website.startsWith('http://') && !website.startsWith('https://')) {
          website = `https://${website}`;
        }
        formattedWebsite = website;
      }

      const { error } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('competitors')
        .update({ 
          name: editCompetitorName.trim(), 
          website: formattedWebsite || null
        })
        .eq('id', editingCompetitor.id));

      if (error) {
        throw new Error(error.message);
      }

      await fetchCompetitors();
      setCurrentPage(1); // Reset to first page
      setShowEditModal(false);
      setEditingCompetitor(null);
      
      if (onCompetitorsUpdated) {
        onCompetitorsUpdated();
      }
    } catch (err: any) {
      setError(`Failed to update competitor: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getDomainFromUrl = (url: string): string => {
    if (!url) return '';
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const getInitialFromName = (name: string): string => {
    return name.charAt(0).toUpperCase();
  };

  const translations = {
    en: {
      title: 'Competitor Analysis',
      subtitle: 'Manage your competitors for AI visibility tracking',
      loading: 'Loading competitors...',
      addCompetitor: 'Add Competitor',
      competitorName: 'Competitor Name',
      competitorWebsite: 'Website (optional)',
      noCompetitors: 'No competitors found. Add some competitors to track.',
      namePlaceholder: 'e.g., Apple, Google, Microsoft',
      websitePlaceholder: 'e.g., apple.com',
      actions: 'Actions',
      status: 'Status',
      approved: 'Approved',
      pending: 'Pending',
      website: 'Website',
      name: 'Name',
      confirmDeleteTitle: 'Confirm Delete',
      confirmDeleteMessage: 'Are you sure you want to delete this competitor? This action cannot be undone.',
      delete: 'Delete',
      cancel: 'Cancel',
      editCompetitorTitle: 'Edit Competitor',
      saveChanges: 'Save Changes',
      addNewCompetitor: 'Add New Competitor',
      competitorsFound: 'competitors found',
      approveAll: 'Approve All & Analyze',
      analyzeResults: 'Analyze Results',
      analyzing: 'Analyzing...',
      competitorNameRequired: 'Competitor name is required',
      approve: 'Approve',
      page: 'Page',
      of: 'of',
      previous: 'Previous',
      next: 'Next'
    },
    ro: {
      title: 'Analiza Competitorilor',
      subtitle: 'Gestionează competitorii pentru urmărirea vizibilității AI',
      loading: 'Se încarcă competitorii...',
      addCompetitor: 'Adaugă Competitor',
      competitorName: 'Numele Competitorului',
      competitorWebsite: 'Website (opțional)',
      noCompetitors: 'Nu s-au găsit competitori. Adaugă competitori pentru urmărire.',
      namePlaceholder: 'ex: Apple, Google, Microsoft',
      websitePlaceholder: 'ex: apple.com',
      actions: 'Acțiuni',
      status: 'Status',
      approved: 'Aprobat',
      pending: 'În Așteptare',
      website: 'Website',
      name: 'Nume',
      confirmDeleteTitle: 'Confirmă Ștergerea',
      confirmDeleteMessage: 'Ești sigur că vrei să ștergi acest competitor? Această acțiune nu poate fi anulată.',
      delete: 'Șterge',
      cancel: 'Anulează',
      editCompetitorTitle: 'Editează Competitor',
      saveChanges: 'Salvează Modificările',
      addNewCompetitor: 'Adaugă Competitor Nou',
      competitorsFound: 'competitori găsiți',
      approveAll: 'Aprobă Toți și Analizează',
      analyzeResults: 'Analizează Rezultatele',
      analyzing: 'Se analizează...',
      competitorNameRequired: 'Numele competitorului este obligatoriu',
      approve: 'Aprobă',
      page: 'Pagina',
      of: 'din',
      previous: 'Anterior',
      next: 'Următorul'
    }
  };

  const t = translations[language];

  const approvedCompetitors = competitors.filter(c => c.approved);
  
  // Calculate pagination
  const totalPages = Math.ceil(competitors.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCompetitors = isDashboardMode ? competitors.slice(startIndex, endIndex) : competitors;
  
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };
  
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="flex-1 p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
            <p className="text-white text-lg">{t.subtitle}</p>
          </div>
          <div className="text-white font-medium">
            {competitors.length} {t.competitorsFound}
          </div>
        </div>
      </div>

      {showManagementControls && (
        <div className="mb-8">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-pink-500 to-orange-400 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-orange-500 transition-all transform hover:scale-[1.02] shadow-lg flex items-center"
          >
            <Plus className="mr-2 h-5 w-5" />
            {t.addNewCompetitor}
          </button>
        </div>
      )}

      {/* Analysis Error Display */}
      {analysisError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm">{analysisError}</p>
        </div>
      )}

      {/* Competitors Table */}
      <div>
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="mx-auto w-8 h-8 text-white animate-spin mb-4" />
            <p className="text-white/90">{t.loading}</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-300">{error}</p>
          </div>
        ) : competitors.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto w-12 h-12 text-white/50 mb-4" />
            <p className="text-white/90">{t.noCompetitors}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
           {/* Subtle overlay when refreshing in background */}
           <div className="relative">
             {isRefreshing && (
               <div className="absolute inset-0 bg-white/50 z-10 pointer-events-none" />
             )}
            <table className="w-full border-separate border-spacing-y-2">
              <thead className="bg-gray-900 rounded-t-xl">
                <tr>
                  <th className="py-4 px-6 text-left text-xs font-medium text-white uppercase tracking-wider rounded-tl-xl">
                    {t.name}
                  </th>
                  <th className="py-4 px-6 text-left text-xs font-medium text-white uppercase tracking-wider">
                    {t.website}
                  </th>
                  <th className="py-4 px-6 text-left text-xs font-medium text-white uppercase tracking-wider">
                    {t.status}
                  </th>
                  {showManagementControls && (
                    <th className="py-4 px-6 text-left text-xs font-medium text-white uppercase tracking-wider rounded-tr-xl">
                      {t.actions}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedCompetitors.map((competitor) => (
                  <tr key={competitor.id} className="bg-white rounded-xl shadow-sm">
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-4">
                          <span className="text-white font-bold text-sm">
                            {getInitialFromName(competitor.name)}
                          </span>
                        </div>
                        <div>
                          <p className="text-gray-900 font-medium">{competitor.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {competitor.website ? (
                        <a
                          href={competitor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-500 hover:text-blue-600 transition-colors"
                        >
                          <span className="mr-1">{getDomainFromUrl(competitor.website)}</span>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {competitor.approved ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {t.approved}
                        </span>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            {t.pending}
                          </span>
                          <button
                            onClick={() => handleApproveCompetitor(competitor.id)}
                            disabled={loading}
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t.approve}
                          </button>
                        </div>
                      )}
                    </td>
                    {showManagementControls && (
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <Edit2
                            className="h-5 w-5 text-blue-500 hover:text-blue-700 cursor-pointer transition-colors"
                            onClick={() => handleEditCompetitor(competitor)}
                          />
                          <Trash2
                            className="h-5 w-5 text-red-500 hover:text-red-700 cursor-pointer transition-colors"
                            onClick={() => handleDeleteCompetitor(competitor)}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
           </div>
          </div>
        )}
      </div>

      {/* Pagination Controls - Only show in dashboard mode */}
      {isDashboardMode && competitors.length > ITEMS_PER_PAGE && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-white text-sm">
            Showing {startIndex + 1}-{Math.min(endIndex, competitors.length)} of {competitors.length} competitors
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="flex items-center space-x-2 px-4 py-2 bg-white/20 border border-white/30 rounded-lg hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
            >
              <span>{t.previous}</span>
            </button>
            
            <div className="flex items-center space-x-2">
              <span className="text-white text-sm">
                {t.page} {currentPage} {t.of} {totalPages}
              </span>
            </div>
            
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center space-x-2 px-4 py-2 bg-white/20 border border-white/30 rounded-lg hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
            >
              <span>{t.next}</span>
            </button>
          </div>
        </div>
      )}

      {/* Analyze Results Button */}
      {showAnalyzeResultsButton && approvedCompetitors.length > 0 && (
        <div className="mt-8 text-center">
          <button
            onClick={onAnalyzeResults}
            disabled={loading || isAnalysisLoading}
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
                {t.analyzeResults}
              </>
            )}
          </button>
        </div>
      )}

      {/* Add Competitor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{t.addNewCompetitor}</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddCompetitorError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {addCompetitorError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{addCompetitorError}</p>
              </div>
            )}

            <form onSubmit={handleAddCompetitor} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.competitorName}
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    value={newCompetitorName}
                    onChange={(e) => setNewCompetitorName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.competitorWebsite}
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    value={newCompetitorWebsite}
                    onChange={(e) => setNewCompetitorWebsite(e.target.value)}
                    placeholder={t.websitePlaceholder}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setAddCompetitorError('');
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={addingCompetitor}
                  className="bg-gradient-to-r from-pink-500 to-orange-400 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-orange-500 transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingCompetitor ? (
                    <div className="flex items-center">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Adding...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Plus className="mr-2 h-5 w-5" />
                      {t.addCompetitor}
                    </div>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && competitorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{t.confirmDeleteTitle}</h2>
              <button 
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setCompetitorToDelete(null);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
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
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setCompetitorToDelete(null);
                  setError('');
                }}
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

      {/* Edit Competitor Modal */}
      {showEditModal && editingCompetitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{t.editCompetitorTitle}</h2>
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCompetitor(null);
                  setError('');
                }}
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

            <form onSubmit={handleSaveEdit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.competitorName}
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    value={editCompetitorName}
                    onChange={(e) => setEditCompetitorName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.competitorWebsite}
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    value={editCompetitorWebsite}
                    onChange={(e) => setEditCompetitorWebsite(e.target.value)}
                    placeholder={t.websitePlaceholder}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCompetitor(null);
                    setError('');
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

export default CompetitorAnalysis;