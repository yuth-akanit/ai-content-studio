'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { Toaster } from 'sonner';
import { AlertTriangle, Sparkles } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100svh] overflow-hidden bg-transparent font-sans text-slate-950">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Global Dev Mode Banner */}
        {process.env.NEXT_PUBLIC_DEV_MODE === 'true' && (
          <div className="z-40 flex shrink-0 select-none items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-1 sm:py-1.5 text-center text-[9px] sm:text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.22em] text-white shadow-sm">
            <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white/90 animate-pulse shrink-0" />
            <span>DEV MODE &bull; PREVIEW ONLY &bull; NO PUBLIC POSTING</span>
          </div>
        )}

        {/* Mobile Header */}
        <header className="premium-glass sticky top-0 z-30 mx-3 mt-3 flex h-14 items-center justify-between rounded-2xl px-3 shadow-sm lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="leading-tight">
              <span className="block text-[13px] font-extrabold tracking-tight text-slate-950">PAA Air Content Studio</span>
              <span className="block text-[10px] font-medium text-slate-500">สร้างคอนเทนต์ง่ายบนมือถือ</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="mobile-touch flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-slate-700 shadow-sm active:scale-95"
            aria-label="เปิดเมนู"
          >
            <Sparkles className="h-4 w-4 text-indigo-600" />
          </button>
        </header>

        <main className="flex-1 overflow-auto pb-28 lg:pb-0">
          <div className="mx-auto max-w-7xl px-3 py-5 sm:px-5 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      <BottomNav onMenuToggle={() => setSidebarOpen(true)} />
      <Toaster position="top-right" richColors />
    </div>
  );
}
