import { useState } from 'react'

import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const VIEW_META = {
  analytics: {
    eyebrow: 'Executive overview',
    title: 'Analytics Dashboard',
    description: 'Track sentiment, rating movement, and the product aspects that shape customer perception.'
  },
  benchmark: {
    eyebrow: 'Comparative analysis',
    title: 'Aspect Benchmark',
    description: 'Compare aspect-level strength across products, countries, and sources from one shared workspace.'
  },
  explorer: {
    eyebrow: 'Review audit',
    title: 'Review Explorer',
    description: 'Inspect individual reviews, extracted aspects, and supporting evidence behind the charts.'
  },
  'ask-data': {
    eyebrow: 'Guided analysis',
    title: 'Ask Agent',
    description: 'Use natural language to interrogate the current sentiment dataset and surface quick answers.'
  },
  pipeline: {
    eyebrow: 'Data preparation',
    title: 'Sentiment Analysis',
    description: 'Upload reviews, run enrichment, preview the resulting table, and download the current dataset.'
  },
  documentation: {
    eyebrow: 'Operating guide',
    title: 'Documentation',
    description: 'Review the product workflow, sentiment pipeline contract, and the purpose of each analysis page.'
  }
}

export function DashboardLayout({ currentView, onViewChange, children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const currentMeta = VIEW_META[currentView] || VIEW_META.analytics

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen((open) => !open)
  }

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-dashboard-sand text-slate-900">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(183,121,31,0.18),transparent_25%),radial-gradient(circle_at_90%_10%,rgba(15,23,42,0.08),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.3),rgba(255,255,255,0))]" />
      <TopBar currentMeta={currentMeta} onMobileMenuToggle={handleMobileMenuToggle} />

      <div className="relative mx-auto flex max-w-[1680px] gap-4 px-3 pb-4 pt-3 lg:gap-6 lg:px-6 lg:py-6">
        <Sidebar
          currentView={currentView}
          currentMeta={currentMeta}
          onViewChange={onViewChange}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={handleMobileMenuClose}
        />

        <main className="min-w-0 flex-1">
          <div className="glass-panel overflow-hidden rounded-[32px] px-4 py-4 sm:px-5 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

