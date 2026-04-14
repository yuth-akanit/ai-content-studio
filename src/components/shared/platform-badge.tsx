import { Badge } from '@/components/ui/badge';
import { Platform, PLATFORM_LABELS } from '@/types/database';
import { cn } from '@/lib/utils';

const platformColors: Record<Platform, string> = {
  facebook: 'bg-blue-100 text-blue-700 border-blue-200',
  instagram: 'bg-pink-100 text-pink-700 border-pink-200',
  line_oa: 'bg-green-100 text-green-700 border-green-200',
  line_voom: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  tiktok: 'bg-gray-900 text-white border-gray-900',
  google_business: 'bg-amber-100 text-amber-700 border-amber-200',
  website: 'bg-purple-100 text-purple-700 border-purple-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200',
};

interface PlatformBadgeProps {
  platform: Platform;
  className?: string;
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  return (
    <Badge variant="outline" className={cn(platformColors[platform], className)}>
      {PLATFORM_LABELS[platform]}
    </Badge>
  );
}
