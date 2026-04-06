'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Sparkles,
  Library,
  Menu,
} from 'lucide-react';
import { THAI_UI_LABELS } from '@/lib/constants/thai-labels';

const navItems = [
  { href: '/dashboard', label: 'หน้าแรก', icon: LayoutDashboard },
  { href: '/generate', label: 'สร้าง AI', icon: Sparkles },
  { href: '/library', label: THAI_UI_LABELS.content_library, icon: Library },
];

export function BottomNav({ onMenuToggle }: { onMenuToggle: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100 lg:hidden pb-safe">
      <div className="grid grid-cols-4 h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 transition-colors',
                isActive ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive ? 'fill-blue-600/5' : '')} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 bg-blue-600 rounded-full" />
              )}
            </Link>
          );
        })}
        
        {/* Menu Toggle for other items */}
        <button
          onClick={onMenuToggle}
          className="flex flex-col items-center justify-center gap-1 text-gray-500 active:text-blue-600 transition-colors"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">เมนู</span>
        </button>
      </div>
    </nav>
  );
}
