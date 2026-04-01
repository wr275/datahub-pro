import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'

// N08: Lazy-load all non-critical pages to reduce initial bundle size
const HubHome = React.lazy(() => import('./pages/HubHome'))
const ExecutiveDashboard = React.lazy(() => import('./pages/ExecutiveDashboard'))
const DashboardBuilder = React.lazy(() => import('./pages/DashboardBuilder'))
const DataBlending = React.lazy(() => import('./pages/DataBlending'))
const DataTable = React.lazy(() => import('./pages/DataTable'))
const KPIDashboard = React.lazy(() => import('./pages/KPIDashboard'))
const DataSummary = React.lazy(() => import('./pages/DataSummary'))
const DataQualityReport = React.lazy(() => import('./pages/DataQualityReport'))
const DataCleaner = React.lazy(() => import('./pages/DataCleaner'))
const AdvancedFilter = React.lazy(() => import('./pages/AdvancedFilter'))
const ValueFrequency = React.lazy(() => import('./pages/ValueFrequency'))
const ConnectData = React.lazy(() => import('./pages/ConnectData'))
const DataPipelines = React.lazy(() => import('./pages/DataPipelines'))
const BudgetActuals = React.lazy(() => import('./pages/BudgetActuals'))
const PivotTable = React.lazy(() => import('./pages/PivotTable'))
const WhatIf = React.lazy(() => import('./pages/WhatIf'))
const AnomalyDetection = React.lazy(() => import('./pages/AnomalyDetection'))
const PeriodComparison = React.lazy(() => import('./pages/PeriodComparison'))
const VarianceAnalysis = React.lazy(() => import('./pages/VarianceAnalysis'))
const RegressionAnalysis = React.lazy(() => import('./pages/RegressionAnalysis'))
const CorrelationMatrix = React.lazy(() => import('./pages/CorrelationMatrix'))
const CohortAnalysis = React.lazy(() => import('./pages/CohortAnalysis'))
const ChurnRiskAnalysis = React.lazy(() => import('./pages/ChurnRiskAnalysis'))
const TrendAnalysis = React.lazy(() => import('./pages/TrendAnalysis'))
const RFMAnalysis = React.lazy(() => import('./pages/RFMAnalysis'))
const ParetoAnalysis = React.lazy(() => import('./pages/ParetoAnalysis'))
const CustomerSegmentation = React.lazy(() => import('./pages/CustomerSegmentation'))
const Forecasting = React.lazy(() => import('./pages/Forecasting'))
const GoalTracker = React.lazy(() => import('./pages/GoalTracker'))
const BreakEvenCalculator = React.lazy(() => import('./pages/BreakEvenCalculator'))
const RollingAverage = React.lazy(() => import('./pages/RollingAverage'))
const BarChartPage = React.lazy(() => import('./pages/BarChartPage'))
const LineChartPage = React.lazy(() => import('./pages/LineChartPage'))
const PieChartPage = React.lazy(() => import('./pages/PieChartPage'))
const HeatmapPage = React.lazy(() => import('./pages/HeatmapPage'))
const WaterfallChart = React.lazy(() => import('./pages/WaterfallChart'))
const ScatterPlot = React.lazy(() => import('./pages/ScatterPlot'))
const ComboChart = React.lazy(() => import('./pages/ComboChart'))
const FunnelChart = React.lazy(() => import('./pages/FunnelChart'))
const BoxPlot = React.lazy(() => import('./pages/BoxPlot'))
const NPVAnalysis = React.lazy(() => import('./pages/NPVAnalysis'))
const FormulaEngine = React.lazy(() => import('./pages/FormulaEngine'))
const ExcelFunctions = React.lazy(() => import('./pages/ExcelFunctions'))
const FormulaBuilder = React.lazy(() => import('./pages/FormulaBuilder'))
const AskYourData = React.lazy(() => import('./pages/AskYourData'))
const AutoReport = React.lazy(() => import('./pages/AutoReport'))
const AINarrative = React.lazy(() => import('./pages/AINarrative'))
const ConditionalFormat = React.lazy(() => import('./pages/ConditionalFormat'))
const AIInsights = React.lazy(() => import('./pages/AIInsights'))
const ScheduledReports = React.lazy(() => import('./pages/ScheduledReports'))
const Integrations = React.lazy(() => import('./pages/Integrations'))
const SharePoint = React.lazy(() => import('./pages/SharePoint'))
const WorkspaceRoles = React.lazy(() => import('./pages/WorkspaceRoles'))
const AuditLog = React.lazy(() => import('./pages/AuditLog'))
const AISettings = React.lazy(() => import('./pages/AISettings'))
const Analytics = React.lazy(() => import('./pages/Analytics'))
const Files = React.lazy(() => import('./pages/Files'))
const Trends = React.lazy(() => import('./pages/Trends'))
const Billing = React.lazy(() => import('./pages/Billing'))
const Team = React.lazy(() => import('./pages/Team'))
const Settings = React.lazy(() => import('./pages/Settings'))
const CalculatedFields = React.lazy(() => import('./pages/CalculatedFields'))

// HOME

// DATA

// ANALYSIS

// FORECASTING

// VISUALISATION

// FINANCE

// AI & FORMULAS

// OPERATIONS

// LEGACY

// ── F18: Error boundary to prevent unhandled render crashes ──────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24, background: '#f8f9fa' }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h2 style={{ color: '#0c1446', margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#4a5280', maxWidth: 400, textAlign: 'center' }}>
            An unexpected error occurred. Please refresh the page or contact support if the problem persists.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 24px', background: '#e91e8c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            Refresh page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}


function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading...</div>
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/hub" replace /> : children
}

function P({ children }) {
  return <PrivateRoute><Layout>{children}</Layout></PrivateRoute>
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <Suspense fallback={<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#4a5280',fontSize:16}}>Loading…</div>}>
        <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* HOME */}
        <Route path="/hub" element={<P><HubHome /></P>} />
        <Route path="/executive-dashboard" element={<P><ExecutiveDashboard /></P>} />
        <Route path="/dashboard-builder" element={<P><DashboardBuilder /></P>} />

        {/* DATA */}
        <Route path="/data-blending" element={<P><DataBlending /></P>} />
        <Route path="/data-table" element={<P><DataTable /></P>} />
        <Route path="/kpi-dashboard" element={<P><KPIDashboard /></P>} />
        <Route path="/data-summary" element={<P><DataSummary /></P>} />
        <Route path="/data-quality" element={<P><DataQualityReport /></P>} />
        <Route path="/data-cleaner" element={<P><DataCleaner /></P>} />
        <Route path="/advanced-filter" element={<P><AdvancedFilter /></P>} />
        <Route path="/value-frequency" element={<P><ValueFrequency /></P>} />
        <Route path="/connect-data" element={<P><ConnectData /></P>} />
        <Route path="/budget-actuals" element={<PrivateRoute><BudgetActuals /></PrivateRoute>} />
        <Route path="/calculated-fields" element={<PrivateRoute><CalculatedFields /></PrivateRoute>} />
        <Route path="/data-pipelines" element={<P><DataPipelines /></P>} />

        {/* ANALYSIS */}
        <Route path="/pivot-table" element={<P><PivotTable /></P>} />
        <Route path="/what-if" element={<P><WhatIf /></P>} />
        <Route path="/anomaly-detection" element={<P><AnomalyDetection /></P>} />
        <Route path="/period-comparison" element={<P><PeriodComparison /></P>} />
        <Route path="/variance-analysis" element={<P><VarianceAnalysis /></P>} />
        <Route path="/regression" element={<P><RegressionAnalysis /></P>} />
        <Route path="/correlation" element={<P><CorrelationMatrix /></P>} />
        <Route path="/cohort-analysis" element={<P><CohortAnalysis /></P>} />
        <Route path="/churn-risk" element={<P><ChurnRiskAnalysis /></P>} />
        <Route path="/trend-analysis" element={<P><TrendAnalysis /></P>} />
        <Route path="/rfm" element={<P><RFMAnalysis /></P>} />
        <Route path="/pareto" element={<P><ParetoAnalysis /></P>} />
        <Route path="/segmentation" element={<P><CustomerSegmentation /></P>} />

        {/* FORECASTING */}
        <Route path="/forecasting" element={<P><Forecasting /></P>} />
        <Route path="/goal-tracker" element={<P><GoalTracker /></P>} />
        <Route path="/break-even" element={<P><BreakEvenCalculator /></P>} />
        <Route path="/rolling-average" element={<P><RollingAverage /></P>} />

        {/* VISUALISATION */}
        <Route path="/bar-chart" element={<P><BarChartPage /></P>} />
        <Route path="/line-chart" element={<P><LineChartPage /></P>} />
        <Route path="/pie-chart" element={<P><PieChartPage /></P>} />
        <Route path="/heatmap" element={<P><HeatmapPage /></P>} />
        <Route path="/waterfall" element={<P><WaterfallChart /></P>} />
        <Route path="/scatter-plot" element={<P><ScatterPlot /></P>} />
        <Route path="/combo-chart" element={<P><ComboChart /></P>} />
        <Route path="/funnel-chart" element={<P><FunnelChart /></P>} />
        <Route path="/box-plot" element={<P><BoxPlot /></P>} />

        {/* FINANCE */}
        <Route path="/npv" element={<P><NPVAnalysis /></P>} />

        {/* AI & FORMULAS */}
        <Route path="/formula-engine" element={<P><FormulaEngine /></P>} />
        <Route path="/excel-functions" element={<P><ExcelFunctions /></P>} />
        <Route path="/formula-builder" element={<P><FormulaBuilder /></P>} />
        <Route path="/ask-your-data" element={<P><AskYourData /></P>} />
        <Route path="/auto-report" element={<P><AutoReport /></P>} />
        <Route path="/ai-narrative" element={<P><AINarrative /></P>} />
        <Route path="/conditional-format" element={<P><ConditionalFormat /></P>} />
        <Route path="/ai-insights" element={<P><AIInsights /></P>} />

        {/* OPERATIONS */}
        <Route path="/scheduled-reports" element={<P><ScheduledReports /></P>} />
        <Route path="/integrations" element={<P><Integrations /></P>} />
        <Route path="/sharepoint"   element={<P><SharePoint /></P>} />
        <Route path="/workspace-roles" element={<P><WorkspaceRoles /></P>} />
        <Route path="/audit-log" element={<P><AuditLog /></P>} />
        <Route path="/ai-settings" element={<P><AISettings /></P>} />

        {/* LEGACY ROUTES */}
        <Route path="/dashboard" element={<P><HubHome /></P>} />
        <Route path="/files" element={<P><Files /></P>} />
        <Route path="/analytics/:fileId?" element={<P><Analytics /></P>} />
        <Route path="/trends" element={<P><Trends /></P>} />
        <Route path="/billing" element={<P><Billing /></P>} />
        <Route path="/team" element={<P><Team /></P>} />
        <Route path="/settings" element={<P><Settings /></P>} />

        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
    </ErrorBoundary>
  )
}
