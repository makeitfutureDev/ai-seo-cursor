import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Calendar,
  Settings,
  LogOut,
  Brain,
  FileText,
  Sword,
  Database,
  Plus,
  Edit2,
  Trash2,
  Eye,
  ChevronDown,
  Target,
  Globe
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import VisibilityChart from './VisibilityChart';
import SourcesPreview from './SourcesPreview';
import SourcesList from './SourcesList';
import PromptManagement from './PromptManagement';
import CompetitorAnalysis from './CompetitorAnalysis';
import CountdownTimer from './CountdownTimer';
import { withTimeout } from '../utils/helpers';
import { SupabaseQueryExecutor } from '../utils/supabaseUtils';

interface DashboardProps {
  language: 'en' | 'ro';
  onLanguageChange: (lang: 'en' | 'ro') => void;
  onShowProfile: () => void;
  appTitle: string;
}

const Dashboard: React.FC<DashboardProps> = ({ language, onLanguageChange, onShowProfile, appTitle }) => {
  // Initialize currentView from localStorage or default to 'dashboard'
  const [currentView, setCurrentView] = useState<'dashboard' | 'prompts' | 'competitors' | 'sources'>(() => {
    const savedDashboardView = localStorage.getItem('aioptimize_dashboard_view');
    if (savedDashboardView && ['dashboard', 'prompts', 'competitors', 'sources'].includes(savedDashboardView)) {
      console.log('🔄 Dashboard - Restoring saved dashboard view:', savedDashboardView);
      return savedDashboardView as 'dashboard' | 'prompts' | 'competitors' | 'sources';
    }
    return 'dashboard';
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | '7_days' | '14_days' | '30_days'>('30_days');
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const [userCompanies, setUserCompanies] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalResponses: 0,
    visibilityRate: 0,
    industryRank: 0,
    competitorsTracked: 0
  });
  const [recentPrompts, setRecentPrompts] = useState<any[]>([]);
  const [industryRankingData, setIndustryRankingData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState('');
  const [allCompaniesDailyVisibility, setAllCompaniesDailyVisibility] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // State for chart hover highlighting
  const [hoveredCompanyChartKey, setHoveredCompanyChartKey] = useState<string | null>(null);

  // Save dashboard view to localStorage whenever it changes
  useEffect(() => {
    console.log('🔄 Dashboard - currentView changed to:', currentView);
    localStorage.setItem('aioptimize_dashboard_view', currentView);
    console.log('💾 Dashboard - Saved dashboard view to localStorage:', currentView);
  }, [currentView]);

  // Add logging for companyData changes
  useEffect(() => {
    console.log('🏢 Dashboard companyData changed:', {
      companyData: companyData,
      companyId: companyData?.id,
      companyName: companyData?.name,
      hasCompanyData: !!companyData
    });
  }, [companyData]);

  useEffect(() => {
    initializeDashboard();
  }, []);

  useEffect(() => {
    if (companyData?.id) {
      fetchDashboardData();
    }
  }, [companyData, selectedPeriod]);

  // Effect to handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && companyData?.id) {
        console.log('📱 Tab became visible, checking if refresh needed...');
        
        // Check if connection is stale and refresh if needed
        if (SupabaseQueryExecutor.isConnectionStale()) {
          console.log('🔄 Connection is stale, refreshing data in background...');
          setIsRefreshing(true);
          fetchDashboardData().finally(() => setIsRefreshing(false));
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
  }, [companyData?.id]);

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

  const initializeDashboard = async () => {
    console.log('🏠 Dashboard.tsx - initializeDashboard called');
    try {
      const { data: { user } } = await SupabaseQueryExecutor.executeQuery(() => supabase.auth.getUser());
      console.log('👤 Dashboard.tsx - Got user:', {
        hasUser: !!user,
        userId: user?.id,
        email: user?.email
      });
      if (!user) return;

      setUser(user);

      // Get user profile
      const { data: profile } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single());

      console.log('👤 Dashboard.tsx - Got profile:', {
        hasProfile: !!profile,
        onboardingCompleted: profile?.onboarding_completed,
        firstName: profile?.first_name,
        lastName: profile?.last_name
      });
      setUserProfile(profile);

      // Get all user's companies
      const { data: companyUsers } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('company_users')
        .select(`
          company_id,
          companies (*)
        `)
        .eq('user_id', user.id));

      console.log('🏢 Dashboard.tsx - Got company users:', {
        hasCompanyUsers: !!companyUsers,
        companyCount: companyUsers?.length || 0,
        companies: companyUsers?.map(cu => cu.companies?.name) || []
      });
      if (companyUsers && companyUsers.length > 0) {
        const companies = companyUsers.map(cu => cu.companies).filter(Boolean);
        console.log('🏢 Dashboard.tsx - Setting companies:', companies.length);
        setUserCompanies(companies);
        setCompanyData(companies[0]); // Set first company as default
        console.log('🏢 Dashboard.tsx - Set default company:', companies[0]?.name);
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);
    } finally {
      console.log('🔄 Dashboard.tsx - initializeDashboard completed');
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    console.log('📊 Dashboard.tsx - fetchDashboardData called');
    console.log('📊 Dashboard.tsx - Current state:', {
      hasCompanyData: !!companyData,
      companyId: companyData?.id,
      companyName: companyData?.name,
      selectedPeriod
    });
    
    if (!companyData?.id) return;

    setLoading(true);
    setDashboardError('');

    try {
      // Create a timeout promise that rejects after 90 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Dashboard data fetch timed out after 5 minutes'));
        }, 300000);
      });

      // Create the main data fetching promise
      const dataFetchPromise = (async () => {
        console.log('📊 Dashboard.tsx - Starting data fetch for company:', companyData.id);
        const startDate = await getStartDate(selectedPeriod, companyData.id);
        console.log('📊 Dashboard.tsx - Calculated start date:', startDate);

        // Fetch responses for the period - using sources array
        console.log('📊 Dashboard.tsx - Fetching responses...');
        let responses, responsesError;
        try {
          const result = await SupabaseQueryExecutor.executeQuery(() => withTimeout(supabase
            .from('responses')
            .select('id, created_at, sources')
            .eq('company', companyData.id)
            .gte('created_at', startDate)));
          responses = result.data;
          responsesError = result.error;
        } catch (exception) {
          console.error('📊 Dashboard.tsx - Exception in responses query:', exception);
          responsesError = { message: `Exception: ${exception.message}` };
          responses = null;
        }

        console.log('📊 Dashboard.tsx - Responses fetch result:', {
          hasResponses: !!responses,
          responseCount: responses?.length || 0,
          error: responsesError
        });
        if (responsesError) {
          throw new Error(`Failed to fetch responses: ${responsesError.message}`);
        }

        // Fetch response analysis data
        const responseIds = responses?.map(r => r.id) || [];
        console.log('📊 Dashboard.tsx - Fetching analysis data for response IDs:', responseIds.length);
        console.log('📊 Dashboard.tsx - About to call supabase.from("response_analysis").select()...');
        let analysisData, analysisError;
        try {
          const result = await SupabaseQueryExecutor.executeQuery(() => withTimeout(supabase
            .from('response_analysis')
            .select('response, company_appears')
            .in('response', responseIds)));
          analysisData = result.data;
          analysisError = result.error;
        } catch (exception) {
          console.error('📊 Dashboard.tsx - Exception in analysis query:', exception);
          analysisError = { message: `Exception: ${exception.message}` };
          analysisData = null;
        }

        console.log('📊 Dashboard.tsx - Analysis data fetch result:', {
          hasAnalysisData: !!analysisData,
          analysisCount: analysisData?.length || 0,
          error: analysisError
        });
        if (analysisError) {
          throw new Error(`Failed to fetch analysis data: ${analysisError.message}`);
        }

        // Create a map of response ID to company_appears
        const responseAnalysisMap = new Map();
        analysisData?.forEach(analysis => {
          responseAnalysisMap.set(analysis.response, analysis.company_appears);
        });

        // Group responses by date and calculate daily visibility (same logic as VisibilityChart)
        const dailyData = new Map<string, { total: number; appears: number }>();

        responses?.forEach(response => {
          // Extract date using local timezone components
          const responseDate = new Date(response.created_at);
          const year = responseDate.getFullYear();
          const month = String(responseDate.getMonth() + 1).padStart(2, '0');
          const day = String(responseDate.getDate()).padStart(2, '0');
          const date = `${year}-${month}-${day}`; // Get YYYY-MM-DD in local timezone
          const companyAppears = responseAnalysisMap.get(response.id) || false;

          if (!dailyData.has(date)) {
            dailyData.set(date, { total: 0, appears: 0 });
          }

          const dayData = dailyData.get(date)!;
          dayData.total++;
          if (companyAppears) {
            dayData.appears++;
          }
        });

        // Calculate stats
        const totalResponses = responses?.length || 0;
        
        // Fetch all competitors for this company
        console.log('🏆 Dashboard.tsx - Fetching competitors...');
        console.log('🏆 Dashboard.tsx - About to call supabase.from("competitors").select()...');
        let competitors, competitorsError;
        try {
          const result = await SupabaseQueryExecutor.executeQuery(() => withTimeout(supabase
            .from('competitors')
            .select('id, name, website')
            .eq('company', companyData.id)
            .eq('approved', true)));
          competitors = result.data;
          competitorsError = result.error;
        } catch (exception) {
          console.error('🏆 Dashboard.tsx - Exception in competitors query:', exception);
          competitorsError = { message: `Exception: ${exception.message}` };
          competitors = null;
        }
        console.log('🏆 Dashboard.tsx - Competitors query result:', {
          competitors: competitors?.length || 0,
          competitorsError,
          hasCompetitors: !!competitors,
          errorMessage: competitorsError?.message,
          errorCode: competitorsError?.code
        });
        console.log('🏆 Dashboard.tsx - Competitors fetch result:', {
          hasCompetitors: !!competitors,
          competitorCount: competitors?.length || 0,
          error: competitorsError
        });
        if (competitorsError) {
          throw new Error(`Failed to fetch competitors: ${competitorsError.message}`);
        }

        // Filter out current company from competitors list (same logic as CompetitorAnalysis)
        let filteredCompetitors = competitors || [];
        if (companyData.domain) {
          const normalizedCompanyDomain = normalizeUrl(companyData.domain);
          
          filteredCompetitors = (competitors || []).filter(competitor => {
            if (!competitor.website) return true; // Keep competitors without websites
            
            const normalizedCompetitorUrl = normalizeUrl(competitor.website);
            const isCurrentCompany = normalizedCompetitorUrl === normalizedCompanyDomain;
            
            return !isCurrentCompany;
          });
        }

        // Fetch recent prompts
        console.log('📝 Dashboard.tsx - Fetching recent prompts...');
        console.log('📝 Dashboard.tsx - About to call supabase.from("prompts").select()...');
        let prompts, promptsError;
        try {
          const result = await SupabaseQueryExecutor.executeQuery(() => withTimeout(supabase
            .from('prompts')
            .select('*')
            .eq('company_id', companyData.id)
            .order('created_at', { ascending: false })
            .limit(5)));
          prompts = result.data;
          promptsError = result.error;
        } catch (exception) {
          console.error('📝 Dashboard.tsx - Exception in prompts query:', exception);
          promptsError = { message: `Exception: ${exception.message}` };
          prompts = null;
        }

        console.log('📝 Dashboard.tsx - Prompts query result:', {
          prompts: prompts?.length || 0,
          promptsError,
          hasPrompts: !!prompts,
          errorMessage: promptsError?.message,
          errorCode: promptsError?.code
        });
        console.log('📝 Dashboard.tsx - Prompts fetch result:', {
          hasPrompts: !!prompts,
          promptCount: prompts?.length || 0,
          error: promptsError
        });
        if (promptsError) {
          throw new Error(`Failed to fetch prompts: ${promptsError.message}`);
        }

        // Get visibility rate from industry ranking data (after it's calculated)
        const currentCompanyRanking = industryRankingData.find(item => item.isYou);
        const visibilityRate = currentCompanyRanking?.visibility || 0;

        setStats(prevStats => ({
          ...prevStats,
          totalResponses,
          competitorsTracked: filteredCompetitors.length,
          visibilityRate: 0,
          industryRank: currentCompanyRanking?.rank || 0
        }));

        setRecentPrompts(prompts || []);

        // Fetch industry ranking data
        const { rankingData, chartData } = await fetchIndustryRankingData(filteredCompetitors, companyData);
        
        // Update industry ranking data state
        setIndustryRankingData(rankingData);
        setAllCompaniesDailyVisibility(chartData);
        
        // Find current company's data from ranking results
        const currentCompanyDataFromRanking = rankingData.find(item => item.isYou);
        
        // Update all stats with comprehensive data
        console.log('📊 Dashboard.tsx - Setting final stats:', {
          totalResponses,
          competitorsTracked: filteredCompetitors.length,
          visibilityRate: currentCompanyDataFromRanking?.visibility || 0,
          industryRank: currentCompanyDataFromRanking?.rank || 0
        });
        setStats(prevStats => ({
          ...prevStats,
          totalResponses,
          competitorsTracked: filteredCompetitors.length,
          visibilityRate: currentCompanyDataFromRanking?.visibility || 0,
          industryRank: currentCompanyDataFromRanking?.rank || 0
        }));
      })();

      // Race between data fetching and timeout
      await Promise.race([dataFetchPromise, timeoutPromise]);

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      console.log('❌ Dashboard.tsx - Dashboard data fetch failed:', {
        errorMessage: error.message,
        errorType: error.constructor.name,
        companyId: companyData?.id
      });
      setDashboardError(error.message || 'Failed to load dashboard data');
    } finally {
      console.log('🔄 Dashboard.tsx - fetchDashboardData completed');
      setLoading(false);
    }
  };

  const normalizeUrl = (url: string): string => {
    if (!url) return '';
    
    let normalized = url.toLowerCase().trim();
    
    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, '');
    
    // Remove www.
    normalized = normalized.replace(/^www\./, '');
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    
    // Convert to lowercase
    return normalized.toLowerCase();
  };

  const fetchIndustryRankingData = async (competitors: any[], currentCompanyData: any) => {
    const rankingData: any[] = [];
    const allCompaniesDailyVisibilityArray: any[] = [];
    
    let currentCompanyCompetitorId: number | null = null;
    try {
      const { data: selfAsCompetitor, error: selfAsCompetitorError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('competitors')
        .select('id')
        .eq('company', currentCompanyData.id) // Company tracking itself
        .eq('name', currentCompanyData.name)
        .maybeSingle());

      if (!selfAsCompetitorError && selfAsCompetitor) {
        currentCompanyCompetitorId = selfAsCompetitor.id;
        console.log('Identified current company as competitor with ID:', currentCompanyCompetitorId);
      }
    } catch (err) {
      console.error('Error checking if current company is also a competitor:', err);
    }
    
    try {
      // Get the same start date used for other dashboard metrics
      const startDate = await getStartDate(selectedPeriod, companyData.id);
      
      // Fetch responses for the current company within the selected period
      console.log('📊 Dashboard.tsx - About to call supabase.from("responses").select()...');
      let responses, responsesError;
      try {
        const result = await SupabaseQueryExecutor.executeQuery(() => withTimeout(supabase
          .from('responses')
          .select('id, created_at')
          .eq('company', companyData.id)
          .gte('created_at', startDate)));
        responses = result.data;
        responsesError = result.error;
      } catch (exception) {
        console.error('📊 Dashboard.tsx - Exception in industry ranking responses query:', exception);
        responsesError = { message: `Exception: ${exception.message}` };
        responses = null;
      }

      console.log('📊 Dashboard.tsx - Responses query result:', {
        responses: responses?.length || 0,
        responsesError,
        hasResponses: !!responses,
        errorMessage: responsesError?.message,
        errorCode: responsesError?.code
      });
      if (responsesError || !responses) {
        return { rankingData: [], chartData: [] };
      }

      // Get response analysis data for these responses
      const responseIds = responses.map(r => r.id);
      console.log('📊 Dashboard.tsx - About to call supabase.from("response_analysis").select()...');
      let analysisData, analysisError;
      try {
        const result = await SupabaseQueryExecutor.executeQuery(() => withTimeout(supabase
          .from('response_analysis')
          .select('response, competitor, company_appears, position, sentiment')
          .in('response', responseIds)));
        analysisData = result.data;
        analysisError = result.error;
      } catch (exception) {
        console.error('📊 Dashboard.tsx - Exception in industry ranking analysis query:', exception);
        analysisError = { message: `Exception: ${exception.message}` };
        analysisData = null;
      }

      console.log('📊 Dashboard.tsx - Analysis query result:', {
        analysisData: analysisData?.length || 0,
        analysisError,
        hasAnalysisData: !!analysisData,
        errorMessage: analysisError?.message,
        errorCode: analysisError?.code
      });
      if (analysisError || !analysisData) {
        return { rankingData: [], chartData: [] };
      }

      // Create a map of response ID to date for daily calculations
      const responseToDateMap = new Map();
      responses.forEach(response => {
        const responseDate = new Date(response.created_at);
        const year = responseDate.getFullYear();
        const month = String(responseDate.getMonth() + 1).padStart(2, '0');
        const day = String(responseDate.getDate()).padStart(2, '0');
        const date = `${year}-${month}-${day}`;
        responseToDateMap.set(response.id, date);
      });

      // Group analysis data by company/competitor and by date
      const companyDailyDataMap = new Map();
      
      analysisData.forEach(analysis => {
        const date = responseToDateMap.get(analysis.response);
        if (!date) return;

        // Determine which company this analysis is for
        let entityId, entityType;
        if (analysis.competitor) {
          entityId = analysis.competitor;
          entityType = 'competitor';
        } else {
          // This is for the current company
          entityId = currentCompanyData.id;
          entityType = 'company';
        }

        if (!companyDailyDataMap.has(entityId)) {
          companyDailyDataMap.set(entityId, {
            entityType,
            dailyData: new Map(),
            positions: [],
            sentiments: []
          });
        }

        const entityData = companyDailyDataMap.get(entityId);
        
        if (!entityData.dailyData.has(date)) {
          entityData.dailyData.set(date, { total: 0, appears: 0 });
        }

        const dayData = entityData.dailyData.get(date);
        dayData.total++;
        
        if (analysis.company_appears) {
          dayData.appears++;
          if (analysis.position) {
            entityData.positions.push(analysis.position);
          }
        }
        
        if (analysis.sentiment) {
          entityData.sentiments.push(analysis.sentiment);
        }
      });

      // Fetch competitor names for display
      const competitorIds = Array.from(companyDailyDataMap.keys()).filter(id => id !== companyData.id);
      console.log('📊 Dashboard.tsx - About to call supabase.from("competitors").select() for names...');
      let competitorData, competitorError;
      try {
        const result = await SupabaseQueryExecutor.executeQuery(() => withTimeout(supabase
          .from('competitors')
          .select('id, name')
          .in('id', competitorIds)));
        competitorData = result.data;
        competitorError = result.error;
      } catch (exception) {
        console.error('📊 Dashboard.tsx - Exception in competitor names query:', exception);
        competitorError = { message: `Exception: ${exception.message}` };
        competitorData = null;
      }

      console.log('📊 Dashboard.tsx - Competitor names query result:', {
        competitorData: competitorData?.length || 0,
        competitorError,
        hasCompetitorData: !!competitorData,
        errorMessage: competitorError?.message,
        errorCode: competitorError?.code
      });

      const competitorNamesMap = new Map();
      if (!competitorError && competitorData) {
        competitorData.forEach(comp => {
          competitorNamesMap.set(comp.id, comp.name);
        });
      }

      // Calculate metrics for each entity (company + competitors)
      companyDailyDataMap.forEach((entityData, entityId) => {
        // Determine name and if it's the current company first
        let name, isYou;
        if (entityId === currentCompanyData.id || (currentCompanyCompetitorId !== null && entityId === currentCompanyCompetitorId)) {
          name = currentCompanyData.name;
          isYou = true;
        } else {
          name = competitorNamesMap.get(entityId) || `Unknown Competitor (${entityId})`;
          isYou = false;
        }

        // Calculate daily visibility rates and then average them (same as main dashboard metric)
        const dailyVisibilityRates = Array.from(entityData.dailyData.values()).map(dayData => 
          dayData.total > 0 ? (dayData.appears / dayData.total) * 100 : 0
        );
        
        const visibility = dailyVisibilityRates.length > 0 
          ? Math.round(dailyVisibilityRates.reduce((sum, rate) => sum + rate, 0) / dailyVisibilityRates.length)
          : 0;
        
        const avgPosition = entityData.positions.length > 0
          ? Math.round(entityData.positions.reduce((a, b) => a + b, 0) / entityData.positions.length)
          : null;
        
        const sentiment = getSentimentFromData(entityData.sentiments);

        // Create daily chart data for this entity
        const dailyChartData = Array.from(entityData.dailyData.entries()).map(([date, dayData]) => {
          const visibility = dayData.total > 0 ? Math.round((dayData.appears / dayData.total) * 100) : 0;
          return {
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            visibility
          };
        });

        // Sort by date
        dailyChartData.sort((a, b) => {
          const dateA = new Date(a.date + ', 2024');
          const dateB = new Date(b.date + ', 2024');
          return dateA.getTime() - dateB.getTime();
        });

        // Add to chart data array
        allCompaniesDailyVisibilityArray.push({
          name,
          isYou,
          data: dailyChartData
        });

        rankingData.push({
          name,
          visibility,
          position: avgPosition,
          sentiment,
          isYou
        });
      });

      // Sort by visibility (highest first) and assign ranks
      const sortedRankingData = rankingData
        .sort((a, b) => b.visibility - a.visibility)
        .map((company, index) => ({
          ...company,
          rank: index + 1
        }));

      return {
        rankingData: sortedRankingData,
        chartData: allCompaniesDailyVisibilityArray
      };

    } catch (error) {
      console.error('Error fetching industry ranking data:', error);
      return {
        rankingData: [],
        chartData: []
      };
    }
  };

  // Helper function to determine sentiment from sentiment data
  const getSentimentFromData = (sentiments: number[]): string | null => {
    if (sentiments.length === 0) {
      return null; // No sentiment data available
    }

    // Calculate average sentiment (0-100 scale: 0=negative, 100=positive)
    const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    
    // Define ranges: 0-33 negative, 34-66 neutral, 67-100 positive
    if (avgSentiment >= 67) return 'positive';
    if (avgSentiment >= 34) return 'neutral';
    return 'negative';
  };

  const getStartDate = async (period: 'today' | '7_days' | '14_days' | '30_days', companyId: string): Promise<string> => {
    const now = new Date();
    
    if (period === 'today') {
      try {
        // Find the most recent response for this company
        const { data: latestResponse, error } = await SupabaseQueryExecutor.executeQuery(() => supabase
          .from('responses')
          .select('created_at')
          .eq('company', companyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle());

        if (!error && latestResponse) {
          // Use the date of the latest response (start of that day in UTC)
          const latestDate = new Date(latestResponse.created_at);
          const startOfLatestDay = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate(), 0, 0, 0, 0);
          return startOfLatestDay.toISOString();
        }
      } catch (err) {
        console.error('Error finding latest response date:', err);
      }
      
      // Fallback to start of today (midnight local time)
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return startOfToday.toISOString();
    }
    
    const daysToSubtract = period === '7_days' ? 7 : period === '14_days' ? 14 : 30;
    // Calculate start date in local timezone
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    const localStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
    return localStartDate.toISOString();
  };

  const handleLogout = async () => {
    console.log('🚪 Dashboard.tsx - handleLogout called');
    try {
      await supabase.auth.signOut();
      console.log('✅ Dashboard.tsx - Logout successful, reloading page');
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
      console.log('❌ Dashboard.tsx - Logout failed:', error);
    }
  };

  const handlePromptClick = (promptId: string) => {
    setSelectedPromptId(promptId);
    setCurrentView('prompts');
  };

  const handlePromptResponsesModalClose = () => {
    setSelectedPromptId(null);
  };

  const onPromptsUpdated = () => {
    fetchDashboardData();
  };

  const onCompetitorsUpdated = () => {
    fetchDashboardData();
  };

  const handleCompanyChange = (companyId: string) => {
    console.log('🏢 Dashboard handleCompanyChange called with companyId:', companyId);
    console.log('🏢 Dashboard.tsx - Current userCompanies:', userCompanies.map(c => ({ id: c.id, name: c.name })));
    const selectedCompany = userCompanies.find(c => c.id === companyId);
    console.log('🏢 Found selected company:', selectedCompany);
    if (selectedCompany) {
      console.log('🏢 Setting companyData to:', selectedCompany);
      setCompanyData(selectedCompany);
    } else {
      console.log('❌ Dashboard.tsx - Company not found in userCompanies');
    }
  };

  const translations = {
    en: {
      dashboard: 'Dashboard',
      prompts: 'Prompts',
      competitors: 'Competitors',
      sources: 'Sources',
      overview: 'Overview',
      totalResponses: 'Total Responses',
      visibilityRate: 'Visibility Rate',
      industryRank: 'Industry Rank',
      competitorsTracked: 'Competitors Tracked',
      recentPrompts: 'Recent Prompts',
      viewAll: 'View All',
      lastAnalysis: 'Last Analysis',
      last7Days: 'Last 7 Days',
      last14Days: 'Last 14 Days',
      last30Days: 'Last 30 Days',
      logout: 'Logout',
      clickToView: 'Click to view responses',
      goal: 'Goal',
      addNewCompany: 'Add New Company',
      comingSoon: 'Coming Soon',
      industryRanking: 'Industry Ranking',
      brandsWithHighestVisibility: 'Brands with the highest visibility',
      averageSearchRank: 'Average search rank',
      noRankData: 'No rank data'
    },
    ro: {
      dashboard: 'Dashboard',
      prompts: 'Prompt-uri',
      competitors: 'Competitori',
      sources: 'Surse',
      overview: 'Prezentare Generală',
      totalResponses: 'Total Răspunsuri',
      visibilityRate: 'Rata de Vizibilitate',
      industryRank: 'Rang în Industrie',
      competitorsTracked: 'Competitori Urmăriți',
      recentPrompts: 'Prompt-uri Recente',
      viewAll: 'Vezi Toate',
      lastAnalysis: 'Ultima Analiză',
      last7Days: 'Ultimele 7 Zile',
      last14Days: 'Ultimele 14 Zile',
      last30Days: 'Ultimele 30 Zile',
      logout: 'Deconectare',
      clickToView: 'Click pentru a vedea răspunsurile',
      goal: 'Obiectiv',
      addNewCompany: 'Adaugă Companie Nouă',
      comingSoon: 'În Curând',
      industryRanking: 'Clasament Industrie',
      brandsWithHighestVisibility: 'Brandurile cu cea mai mare vizibilitate',
      averageSearchRank: 'Rang mediu în căutare',
      noRankData: 'Fără date de rang'
    }
  };

  const t = translations[language];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 flex relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500"></div>
              <span className="text-gray-900 font-medium">Loading...</span>
            </div>
          </div>
        </div>
      )}

      {/* Background Refresh Overlay */}
      {isRefreshing && (
        <div className="absolute inset-0 bg-white/20 backdrop-blur-sm z-40 pointer-events-none" />
      )}

      {/* Sidebar */}
      <div className="w-64 bg-white/10 backdrop-blur-lg border-r border-white/20 p-6">
        {/* Logo */}
        <div className="flex items-center space-x-2 mb-8">
          <Brain className="h-8 w-8 text-white" />
          <span className="text-xl font-bold text-white">AIOptimize</span>
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

        {/* Company Selector */}
        <div className="mb-6">
          <div className="relative">
            <select
              value={companyData?.id || ''}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/50 appearance-none"
            >
              {userCompanies.map(company => (
                <option key={company.id} value={company.id} className="text-gray-900">
                  {company.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/70 pointer-events-none" />
          </div>
          
          {/* Add New Company Button */}
          <button
            disabled
            className="w-full mt-3 flex items-center justify-center space-x-2 bg-white/10 border-2 border-dashed border-white/30 text-white/50 px-4 py-3 rounded-xl cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            <div className="text-center">
              <div className="text-sm font-medium">{t.addNewCompany}</div>
              <div className="text-xs">{t.comingSoon}</div>
            </div>
          </button>
        </div>

        {/* Navigation */}
        <nav className="space-y-2 mb-8">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
              currentView === 'dashboard' 
                ? 'bg-white/20 text-white' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            <span>{t.dashboard}</span>
          </button>

          <button
            onClick={() => setCurrentView('prompts')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
              currentView === 'prompts' 
                ? 'bg-white/20 text-white' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <MessageSquare className="h-5 w-5" />
            <span>{t.prompts}</span>
          </button>

          <button
            onClick={() => setCurrentView('competitors')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
              currentView === 'competitors' 
                ? 'bg-white/20 text-white' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Sword className="h-5 w-5" />
            <span>{t.competitors}</span>
          </button>

          <button
            onClick={() => setCurrentView('sources')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
              currentView === 'sources' 
                ? 'bg-white/20 text-white' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Globe className="h-5 w-5" />
            <span>{t.sources}</span>
          </button>
        </nav>

        {/* User Profile */}
        <div className="border-t border-white/20 pt-6">
          <div 
            className="flex items-center space-x-3 mb-4 p-3 -mx-3 rounded-xl cursor-pointer hover:bg-white/10 transition-all"
            onClick={onShowProfile}
          >
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-white font-medium">
                {userProfile?.first_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="text-white">
              <div className="text-sm font-medium">
                {userProfile?.first_name ? 
                  `${userProfile.first_name} ${userProfile.last_name || ''}`.trim() : 
                  user?.email
                }
              </div>
              <div className="text-xs text-white/70">{companyData?.name}</div>
            </div>
          </div>

          <CountdownTimer language={language} />

          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all mt-4"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm">{t.logout}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {currentView === 'dashboard' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">{t.overview}</h1>
                <p className="text-white/90 text-lg">
                  {companyData?.name} - AI Visibility Analytics
                </p>
              </div>

              {/* Date Filter */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value as any)}
                    className="bg-white/20 backdrop-blur-lg border border-white/30 rounded-xl px-4 pr-8 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/50 appearance-none"
                  >
                    <option value="today">{t.lastAnalysis}</option>
                    <option value="7_days">{t.last7Days}</option>
                    <option value="14_days">{t.last14Days}</option>
                    <option value="30_days">{t.last30Days}</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/70 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total Responses */}
              <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: '#fdedee' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">{t.totalResponses}</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalResponses}</p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              {/* Visibility Rate */}
              <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: '#fdedee' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">{t.visibilityRate}</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.visibilityRate}%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </div>

              {/* Industry Rank */}
              <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: '#fdedee' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">{t.industryRank}</p>
                    <p className="text-3xl font-bold text-gray-900">#{stats.industryRank || '-'}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-purple-500" />
                </div>
              </div>

              {/* Competitors Tracked */}
              <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: '#fdedee' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">{t.competitorsTracked}</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.competitorsTracked}</p>
                  </div>
                  <Users className="h-8 w-8 text-orange-500" />
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: '#fdedee' }}>
                <VisibilityChart 
                  companyId={companyData?.id} 
                  selectedPeriod={selectedPeriod}
                  language={language}
                  allCompaniesDailyVisibility={allCompaniesDailyVisibility}
                  hoveredCompanyChartKey={hoveredCompanyChartKey}
                />
              </div>
              <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: '#fdedee' }}>
                <div className="flex items-center mb-6">
                  <TrendingUp className="h-6 w-6 text-gray-900 mr-3" />
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{t.industryRanking}</h3>
                    <p className="text-gray-600 text-sm">{t.brandsWithHighestVisibility}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {/* Real industry ranking data */}
                  {industryRankingData.map((item) => (
                    <div 
                      key={item.rank} 
                      className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                      onMouseEnter={() => {
                        const chartKey = item.isYou ? `${item.name} (You)` : item.name;
                        setHoveredCompanyChartKey(chartKey);
                      }}
                      onMouseLeave={() => setHoveredCompanyChartKey(null)}
                    >
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 text-white font-bold ${
                          item.rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                          item.rank === 2 ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                          item.rank === 3 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
                          'bg-gradient-to-r from-pink-500 to-orange-400'
                        }`}>
                          <span className="text-sm">#{item.rank}</span>
                        </div>
                        <div>
                          <div className={`font-medium ${item.isYou ? 'text-pink-600' : 'text-gray-900'}`}>
                            {item.name} {item.isYou && '(You)'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {item.position !== null 
                              ? `${t.averageSearchRank} #${item.position}`
                              : t.noRankData
                            }
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {/* Sentiment with label */}
                        <div className="flex items-center space-x-2">
                          <div className={`w-4 h-4 rounded-full ${
                            item.sentiment === 'positive' ? 'bg-green-500' :
                            item.sentiment === 'negative' ? 'bg-red-500' :
                            item.sentiment === 'neutral' ? 'bg-gray-400' :
                            'bg-gray-300'
                          }`}></div>
                          <span className="text-xs text-gray-600 capitalize">
                            {item.sentiment !== null 
                              ? item.sentiment
                              : (language === 'en' ? 'No data' : 'Fără date')
                            }
                          </span>
                        </div>
                        {/* Visibility percentage */}
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">{item.visibility}%</div>
                          <div className="text-xs text-gray-500">Visibility</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Recent Prompts */}
              <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: '#fdedee' }}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">{t.recentPrompts}</h3>
                  <button
                    onClick={() => setCurrentView('prompts')}
                    className="text-blue-500 hover:text-blue-600 font-medium"
                  >
                    {t.viewAll}
                  </button>
                </div>
                <div className="space-y-3">
                  {recentPrompts.map((prompt, index) => (
                    <div 
                      key={prompt.id} 
                      onClick={() => handlePromptClick(prompt.id)}
                      className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-gray-900 font-medium mb-1">{prompt.prompt}</p>
                          <p className="text-gray-600 text-sm">{prompt.country}</p>
                        </div>
                        <Eye className="h-4 w-4 text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">{t.clickToView}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sources Preview */}
              <SourcesPreview 
                companyId={companyData?.id} 
                language={language}
                setCurrentView={setCurrentView}
              />
            </div>

            {/* Company Goal */}
            {companyData?.goal && (
              <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: '#fdedee' }}>
                <div className="flex items-center mb-4">
                  <Target className="h-6 w-6 text-gray-900 mr-3" />
                  <h3 className="text-2xl font-bold text-gray-900">{t.goal}</h3>
                </div>
                <p className="text-gray-700 leading-relaxed">{companyData.goal}</p>
              </div>
            )}
          </>
        )}

        {currentView === 'prompts' && (
          <PromptManagement
            companyId={companyData?.id}
            initialPrompts={[]}
            onComplete={onPromptsUpdated}
            language={language}
            isViewOnlyMode={true}
            showManagementControls={true}
            selectedPromptId={selectedPromptId}
            showAnalyzeResultsButton={false}
            onPromptResponsesModalClose={handlePromptResponsesModalClose}
            userCompanies={userCompanies}
            companyData={companyData}
          />
        )}

        {currentView === 'competitors' && (
          <CompetitorAnalysis
            companyId={companyData?.id}
            onComplete={onCompetitorsUpdated}
            language={language}
            showManagementControls={true}
            showAnalyzeResultsButton={false}
            onCompetitorsUpdated={onCompetitorsUpdated}
            isDashboardMode={true}
          />
        )}

        {currentView === 'sources' && (
          <SourcesList
            companyId={companyData?.id}
            language={language}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;