import { Badge, type BadgeProps } from '@/components/ui/badge';

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  completed: 'success',
  processing: 'info',
  queued: 'warning',
  failed: 'destructive'
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>{status}</Badge>;
}
