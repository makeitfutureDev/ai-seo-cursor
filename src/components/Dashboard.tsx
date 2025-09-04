\```typescript
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { SupabaseQueryExecutor } from '../utils/supabaseUtils';
import CountdownTimer from './CountdownTimer';
import VisibilityChart from './VisibilityChart';
import PromptVisibilityChart from './PromptVisibilityChart'; // Ensure this import is present
import ResponsesDisplay from './ResponsesDisplay';
import SourcesPreview from './SourcesPreview';
import CompetitorAnalysis from './CompetitorAnalysis';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Users,
  TrendingUp,
  Message\Square,
  Eye,
  Award,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  Database,
  Loader2,
  Globe,
} from 'lucide-react';

interface DashboardProps {
  language: 'en' | 'ro';
  onLanguageChange: (lang: 'en' | 'ro') => void;
  onShowProfile: () => void;
  appTitle: string;
  companyData: any;
  setCurrentView: (view: 'dashboard' | 'prompts' | 'competitors' | 'sources' | 'profile') => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  language,
  onLanguageChange,
  onShowProfile,
  appTitle,
  companyData,
  setCurrentView,
}) => {
  const companyId = companyData?.id;
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | '7_days' | '14_days' | '30_days'>('30_days');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [totalResponses, setTotalResponses] = useState(0);
  const [visibilityRate, setVisibilityRate] = useState(0);
  const [industryRank, setIndustryRank] = useState(0);
  const [competitorsTracked, setCompetitorsTracked] = useState(0);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingIndustryRank, setLoadingIndustryRank] = useState(true);
  const [industryRankData, setIndustryRankData] = useState<any[]>([]);
  const [allCompaniesDailyVisibility, setAllCompaniesDailyVisibility] = useState<any[]>([]);
  const [hoveredCompanyChartKey, setHoveredCompanyChartKey] = useState<string | null>(null);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [recentPrompts, setRecentPrompts] = useState<any[]>([]);

  const translations = {
    en: {
      dashboardTitle: 'Overview',
      dashboardSubtitle: 'AI Visibility Analytics',
      totalResponses: 'Total Responses',
      visibilityRate: 'Visibility Rate',
      industryRank: 'Industry Rank',
      competitorsTracked: 'Competitors Tracked',
      periodOptions: {
        today: 'Last 24 Hours',
        '7_days': 'Last 7 Days',
        '14_days': 'Last 14 Days',
        '30_days': 'Last 30 Days',
      },
      visibility: {
        title: 'Visibility',
        subtitle: 'Percentage of chats mentioning your brand',
        noData: 'No visibility data available',
        loading: 'Loading visibility data...',
      },
      industryRanking: {
        title: 'Industry Ranking',
        subtitle: 'Brands with the highest visibility',
        averageSearchRank: 'Average search rank',
        positive: 'Positive',
        neutral: 'Neutral',
        negative: 'Negative',
        noData: 'No industry ranking data available',
        loading: 'Loading industry ranking data...',
      },
      recentPrompts: {
        title: 'Recent Prompts',
        subtitle: 'Your latest monitored prompts',
        viewAll: 'View All',
        noPrompts: 'No recent prompts found',
        loading: 'Loading recent prompts...',
      },
    },
    ro: {
      dashboardTitle: 'Prezentare Generală',
      dashboardSubtitle: 'Analiză Vizibilitate AI',
      totalResponses: 'Răspunsuri Totale',
      visibilityRate: 'Rata de Vizibilitate',
      industryRank: 'Clasament Industrie',
      competitorsTracked: 'Competitori Urmăriți',
      periodOptions: {
        today: 'Ultimele 24 de Ore',
        '7_days': 'Ultimele 7 Zile',
        '14_days': 'Ultimele 14 Zile',
        '30_days': 'Ultimele 30 de Zile',
      },
      visibility: {
        title: 'Vizibilitate',
        subtitle: 'Procentul de conversații care menționează brandul tău',
        noData: 'Nu există date de vizibilitate disponibile',
        loading: 'Se încarcă datele de vizibilitate...',
      },
      industryRanking: {
        title: 'Clasament Industrie',
        subtitle: 'Brandurile cu cea mai mare vizibilitate',
        averageSearchRank: 'Poziție medie în căutări',
        positive: 'Pozitiv',
        neutral: 'Neutru',
        negative: 'Negativ',
        noData: 'Nu există date de clasament în industrie disponibile',
        loading: 'Se încarcă datele de clasament în industrie...',
      },
      recentPrompts: {
        title: 'Prompturi Recente',
        subtitle: 'Ultimele tale prompturi monitorizate',
        viewAll: 'Vezi Toate',
        noPrompts: 'Nu s-au găsit prompturi recente',
        loading: 'Se încarcă prompturile recente...',
      },
    },
  };

  const t = translations[language];

  // Effect to handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && companyId) {
        console.log('📱 Tab became visible, checking if refresh needed...');
        if (SupabaseQueryExecutor.isConnectionStale()) {
          console.log('🔄 Connection is stale, refreshing data in background...');
          fetchDashboardData(true);
        }
        SupabaseQueryExecutor.updateActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [companyId, selectedPeriod]);

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

  const getStartDate = useCallback(async (period: 'today' | '7_days' | '14_days' | '30_days', currentCompanyId: string): Promise<string> => {
    const now = new Date();
    if (period === 'today') {
      try {
        const { data: latestResponse, error } = await SupabaseQueryExecutor.executeQuery(() => supabase
          .from('responses')
          .select('created_at')
          .eq('company', currentCompanyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single());
        if (!error && latestResponse) {
          const latestDate = new Date(latestResponse.created_at);
          const startOfLatestDay = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate(), 0, 0, 0, 0);
          return startOfLatestDay.toISOString();
        }
      } catch (err) {
        console.error('Error finding latest response date:', err);
      }
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return startOfToday.toISOString();
    }
    const daysToSubtract = period === '7_days' ? 7 : period === '14_days' ? 14 : 30;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    const localStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
    return localStartDate.toISOString();
  }, []);

  const fetchDashboardData = useCallback(async (isBackgroundRefresh = false) => {
    if (!companyId) return;

    if (!isBackgroundRefresh) {
      setLoadingMetrics(true);
      setLoadingIndustryRank(true);
      setLoadingPrompts(true);
    }

    try {
      const startDate = await getStartDate(selectedPeriod, companyId);

      // Fetch total responses
      const { count: responsesCount, error: responsesCountError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('responses')
        .select('*', { count: 'exact' })
        .eq('company', companyId)
        .gte('created_at', startDate));

      if (!responsesCountError) {
        setTotalResponses(responsesCount || 0);
      }

      // Fetch competitors tracked
      const { count: competitorsCount, error: competitorsCountError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('competitors')
        .select('*', { count: 'exact' })
        .eq('company', comp