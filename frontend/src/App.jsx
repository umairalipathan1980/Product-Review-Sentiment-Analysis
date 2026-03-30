'use client'

import { useState } from 'react'

import { DashboardLayout } from './components/layout/DashboardLayout'
import { AnalyticsDashboard } from './views/AnalyticsDashboard'
import { PipelineTools } from './views/PipelineTools'
import { ReviewExplorer } from './views/ReviewExplorer'
import { AspectBenchmark } from './views/AspectBenchmark'
import { DocumentationPage } from './views/DocumentationPage'
import DataQA from './views/DataQA'

function renderView(view) {
  if (view === 'pipeline') return <PipelineTools />
  if (view === 'explorer') return <ReviewExplorer />
  if (view === 'ask-data') return <DataQA />
  if (view === 'benchmark') return <AspectBenchmark />
  if (view === 'documentation') return <DocumentationPage />
  return <AnalyticsDashboard />
}

export default function App() {
  const [currentView, setCurrentView] = useState('analytics')

  return (
    <DashboardLayout currentView={currentView} onViewChange={setCurrentView}>
      {renderView(currentView)}
    </DashboardLayout>
  )
}




