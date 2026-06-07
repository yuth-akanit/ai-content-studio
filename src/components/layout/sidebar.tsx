'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Sparkles,
  Library,
  FolderKanban,
  Settings,
  MessageSquare,
  Clapperboard,
  RadioTower,
  Video,
} from 'lucide-react';
import { THAI_UI_LABELS } from '@/lib/constants/thai-labels';

const navItems = [
  { href: '/dashboard', label: THAI_UI_LABELS.dashboard, icon: LayoutDashboard },
  { href: '/profile', label: THAI_UI_LABELS.business_profile, icon: Building2 },
  { href: '/generate', label: THAI_UI_LABELS.ai_creator, icon: Sparkles },
  { href: '/chat', label: THAI_UI_LABELS.ai_chat, icon: MessageSquare },
  { href: '/library', label: THAI_UI_LABELS.content_library, icon: Library },
  { href: '/campaigns', label: THAI_UI_LABELS.campaign_workspace, icon: FolderKanban },
  { href: '/campaigns/short-form', label: 'Short-form', icon: Clapperboard },
  { href: '/product-video', label: 'Product Video', icon: Video },
  { href: '/short-video-distribution', label: 'Short Video Preview', icon: RadioTower },
  { href: '/settings', label: THAI_UI_LABELS.settings, icon: Settings },
];

export function Sidebar({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();

  return (
    <>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-[19rem] max-w-[86vw] rounded-r-[2rem] border-r border-white/70 bg-white/90 shadow-[28px_0_60px_-35px_rgba(15,23,42,0.6)] backdrop-blur-2xl transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto lg:w-72 lg:max-w-none lg:rounded-none lg:border-slate-200/70 lg:bg-white/72',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-5 py-5 border-b border-slate-200/70">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-extrabold tracking-tight text-slate-950">AI Content Studio</h1>
                <p className="text-[10px] font-medium text-slate-500">Service Business</p>
              </div>
            </Link>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition-all active:scale-[0.98]',
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                      : 'text-slate-600 hover:bg-white/75 hover:text-slate-950',
                  )}
                >
                  <item.icon className={cn('h-4.5 w-4.5', isActive ? 'text-white' : 'text-slate-400')} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-slate-200/70 px-4 py-4">
            <div className="rounded-2xl bg-slate-950/5 px-3 py-2.5 text-center">
              <p className="text-[10px] font-semibold text-slate-500">
                AI Content Studio v1.0
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
