'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { Toaster } from 'sonner';
import { Sparkles } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-white lg:bg-gray-50 overflow-hidden font-sans">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-bold tracking-tight">AI Content Studio</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200" />
        </header>

        <main className="flex-1 overflow-auto pb-24 lg:pb-0">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      <BottomNav onMenuToggle={() => setSidebarOpen(true)} />
      <Toaster position="top-right" richColors />
    </div>
  );
}
