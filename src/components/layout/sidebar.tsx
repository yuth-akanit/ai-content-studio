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
  Menu,
  X,
  MessageSquare,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { THAI_UI_LABELS } from '@/lib/constants/thai-labels';

const navItems = [
  { href: '/dashboard', label: THAI_UI_LABELS.dashboard, icon: LayoutDashboard },
  { href: '/profile', label: THAI_UI_LABELS.business_profile, icon: Building2 },
  { href: '/generate', label: THAI_UI_LABELS.ai_creator, icon: Sparkles },
  { href: '/chat', label: THAI_UI_LABELS.ai_chat, icon: MessageSquare },
  { href: '/library', label: THAI_UI_LABELS.content_library, icon: Library },
  { href: '/campaigns', label: THAI_UI_LABELS.campaign_workspace, icon: FolderKanban },
  { href: '/settings', label: THAI_UI_LABELS.settings, icon: Settings },
];

export function Sidebar({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();

  return (
    <>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-6 py-5 border-b border-gray-100">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-900">AI Content Studio</h1>
                <p className="text-[10px] text-gray-500">Service Business</p>
              </div>
            </Link>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  <item.icon className={cn('h-4 w-4', isActive ? 'text-blue-600' : 'text-gray-400')} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 text-center">
              AI Content Studio v1.0
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
