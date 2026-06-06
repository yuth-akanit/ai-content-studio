'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Sparkles,
  Library,
  Menu,
  MessageSquare,
} from 'lucide-react';
import { THAI_UI_LABELS } from '@/lib/constants/thai-labels';

const navItems = [
  { href: '/dashboard', label: 'หน้าแรก', icon: LayoutDashboard },
  { href: '/generate', label: 'สร้าง AI', icon: Sparkles },
  { href: '/chat', label: 'คุยกับ AI', icon: MessageSquare },
  { href: '/library', label: THAI_UI_LABELS.content_library, icon: Library },
];

export function BottomNav({ onMenuToggle }: { onMenuToggle: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 rounded-[1.65rem] border border-white/70 bg-white/88 shadow-[0_18px_45px_-22px_rgba(15,23,42,0.65)] backdrop-blur-2xl lg:hidden safe-bottom">
      <div className="grid h-[4.35rem] max-w-lg grid-cols-5 mx-auto px-1.5">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative mx-0.5 flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-all active:scale-95',
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-slate-500 hover:bg-slate-100/70 hover:text-slate-900'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive ? 'text-white' : '')} />
              <span className="text-[10px] font-bold leading-none">{item.label}</span>
              {isActive && (
                <div className="absolute -top-0.5 h-1 w-6 rounded-full bg-white/80" />
              )}
            </Link>
          );
        })}
        
        {/* Menu Toggle for other items */}
        <button
          onClick={onMenuToggle}
          className="mx-0.5 flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-slate-500 transition-all hover:bg-slate-100/70 hover:text-slate-900 active:scale-95"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">เมนู</span>
        </button>
      </div>
    </nav>
  );
}
