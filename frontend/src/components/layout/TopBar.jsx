import { Menu } from 'lucide-react'

export function TopBar({ currentMeta, onMobileMenuToggle }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-[rgba(248,244,236,0.86)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-[1680px] items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileMenuToggle}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img src="/logo.png" alt="Sentiment Analysis logo" className="h-10 w-auto object-contain" />
          <div className="min-w-0">
            <p className="section-kicker">{currentMeta.eyebrow}</p>
            <h1 className="truncate text-base font-semibold text-slate-900">{currentMeta.title}</h1>
          </div>
        </div>
        <div className="soft-pill max-w-[45%] truncate">Review intelligence</div>
      </div>
    </header>
  )
}
