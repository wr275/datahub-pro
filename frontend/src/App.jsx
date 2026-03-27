import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
// HOME
import HubHome from './pages/HubHome'
import ExecutiveDashboard from './pages/ExecutiveDashboard'
import DashboardBuilder from './pages/DashboardBuilder'
import DashboardsList from './pages/DashboardsList'
import SharedDashboard from './pages/SharedDashboard'
// DATA
import DataBlending from './pages/DataBlending'
import DataTable from './pages/DataTable'
import KPIDashboard from './pages/KPIDashboard'
import DataSummary from './pages/DataSummary'
import DataQualityReport from './pages/DataQualityReport'
import DataCleaner from './pages/DataCleaner'
import AdvancedFilter from './pages/AdvancedFilter'
import ValueFrequency from './pages/ValueFrequency'
// ANALYSIS
import PivotTable from './pages/PivotTable'
import WhatIf from './pages/WhatIf'
import AnomalyDetection from './pages/AnomalyDetection'
import PeriodComparison from './pages/PeriodComparison'
import VarianceAnalysis from './pages/VarianceAnalysis'
import RegressionAnalysis from './pages/RegressionAnalysis'
import CorrelationMatrix from './pages/CorrelationMatrix'
import CohortAnalysis from './pages/CohortAnalysis'
import TrendAnalysis from './pages/TrendAnalysis'
import RFMAnalysis from './pages/RFMAnalysis'
import ParetoAnalysis from './pages/ParetoAnalysis'
import CustomerSegmentation from './pages/CustomerSegmentation'
// FORECASTING
import Forecasting from './pages/Forecasting'
import GoalTracker from './pages/GoalTracker'
import BreakEvenCalculator from './pages/BreakEvenCalculator'
import RollingAverage from './pages/RollingAverage'
// VISUALISATION
import BarChartPage from './pages/BarChartPage'
import LineChartPage from './pages/LineChartPage'
import PieChartPage from './pages/PieChartPage'
import HeatmapPage from './pages/HeatmapPage'
import WaterfallChart from './pages/WaterfallChart'
import ScatterPlot from './pages/ScatterPlot'
import ComboChart from './pages/ComboChart'
import FunnelChart from './pages/FunnelChart'
import BoxPlot from './pages/BoxPlot'
// FINANCE
import NPVAnalysis from './pages/NPVAnalysis'
// AI & FORMULAS
import FormulaEngine from './pages/FormulaEngine'
import ExcelFunctions from './pages/ExcelFunctions'
import FormulaBuilder from './pages/FormulaBuilder'
import AskYourData from './pages/AskYourData'
import AutoReport from './pages/AutoReport'
import AINarrative from './pages/AINarrative'
import ConditionalFormat from './pages/ConditionalFormat'
import AIInsights from './pages/AIInsights'
// OPERATIONS
import ScheduledReports from './pages/ScheduledReports'
import Integrations from './pages/Integrations'
import WorkspaceRoles from './pages/WorkspaceRoles'
import AuditLog from './pages/AuditLog'
import AISettings from './pages/AISettings'
// LEGACY
import Analytics from './pages/Analytics'
import Files from './pages/Files'
import Trends from './pages/Trends'
import Billing from './pages/Billing'
import Team from './pages/Team'
import Settings from './pages/Settings'
import ConnectData from './pages/ConnectData'
import DataPipelines from './pages/DataPipelines'

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
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* PUBLIC â shareable dashboards (no auth required) */}
        <Route path="/share/:token" element={<SharedDashboard />} />

        {/* HOME */}
        <Route path="/hub" element={<P><HubHome /></P>} />
        <Route path="/executive-dashboard" element={<P><ExecutiveDashboard /></P>} />
        <Route path="/dashboard-builder" element={<P><DashboardBuilder /></P>} />
        <Route path="/dashboards" element={<P><DashboardsList /></P>} />

        {/* DATA */}
        <Route path="/data-blending" element={<P><DataBlending /></P>} />
        <Route path="/data-table" element={<P><DataTable /></P>} />
        <Route path="/kpi-dashboard" element={<P><KPIDashboard /></P>} />
        <Route path="/data-summary" element={<P><DataSummary /></P>} />
        <Route path="/data-quality" element={<P><DataQualityReport /></P>} />
        <Route path="/data-cleaner" element={<P><DataCleaner /></P>} />
        <Route path="/advanced-filter" element={<P><AdvancedFilter /></P>} />
        <Route path="/value-frequency" element={<P><ValueFrequency /></P>} />

        {/* ANALYSIS */}
        <Route path="/pivot-table" element={<P><PivotTable /></P>} />
        <Route path="/what-if" element={<P><WhatIf /></P>} />
        <Route path="/anomaly-detection" element={<P><AnomalyDetection /></P>} />
        <Route path="/period-comparison" element={<P><PeriodComparison /></P>} />
        <Route path="/variance-analysis" element={<P><VarianceAnalysis /></P>} />
        <Route path="/regression" element={<P><RegressionAnalysis /></P>} />
        <Route path="/correlation" element={<P><CorrelationMatrix /></P>} />
        <Route path="/cohort-analysis" element={<P><CohortAnalysis /></P>} />
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

        <Route path="/connect-data" element={<ConnectData />} />
        <Route path="/data-pipelines" element={<DataPipelines />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
