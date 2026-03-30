import { BarChart3, BookOpen, Bot, Radar, Search, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'analytics', label: 'Analytics Dashboard', icon: BarChart3 },
  { id: 'benchmark', label: 'Aspect Benchmark', icon: Radar },
  { id: 'explorer', label: 'Review Explorer', icon: Search },
  { id: 'ask-data', label: 'Ask Agent', icon: Bot },
  { id: 'pipeline', label: 'Sentiment Analysis', icon: Settings },
  { id: 'documentation', label: 'Documentation', icon: BookOpen }
]

export function Sidebar({ currentView, currentMeta, onViewChange, isMobileOpen, onMobileClose }) {
  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[rgba(148,163,184,0.34)] backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`fixed inset-y-3 left-3 z-50 flex w-[292px] flex-col overflow-hidden rounded-[30px] border border-stone-200/90 bg-[rgba(255,252,247,0.92)] text-slate-900 shadow-[0_28px_80px_rgba(148,163,184,0.18)] backdrop-blur-xl transition-transform duration-300 ease-out lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-[112%]'
        }`}
      >

        <nav className="flex-1 space-y-1.5 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id

            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id)
                  onMobileClose()
                }}
                className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                  isActive
                    ? 'border-amber-200 bg-amber-50 text-slate-900 shadow-sm'
                    : 'border-transparent text-slate-600 hover:border-stone-200 hover:bg-white hover:text-slate-900'
                }`}
              >
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl transition-colors ${isActive ? 'bg-amber-100 text-dashboard-copper' : 'bg-stone-100 text-slate-500 group-hover:text-dashboard-copper'}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold leading-5">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="px-4 pb-4">
          <div className="rounded-[24px] border border-stone-200 bg-white/92 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-dashboard-copper/80">Current view</p>
            <p className="mt-3 font-serif text-2xl text-slate-900">{currentMeta.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{currentMeta.description}</p>
          </div>
        </div>
      </aside>
    </>
  )
}





