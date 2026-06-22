import {
  LayoutDashboard,
  Briefcase,
  CalendarRange,
  Users,
  FileText,
  Package,
  Receipt,
  BarChart3,
  Settings,
  Smartphone,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleKey } from '@/lib/roles'

export type NavItem = {
  key: ModuleKey
  label: string
  href: string
  icon: LucideIcon
  enabled: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, enabled: true },
  { key: 'jobs', label: 'Jobs', href: '/jobs', icon: Briefcase, enabled: true },
  { key: 'dispatch', label: 'Dispatch', href: '/dispatch', icon: CalendarRange, enabled: true },
  { key: 'customers', label: 'Customers', href: '/customers', icon: Users, enabled: true },
  { key: 'estimates', label: 'Estimates', href: '/estimates', icon: FileText, enabled: true },
  { key: 'catalog', label: 'Catalog', href: '/catalog', icon: Package, enabled: true },
  { key: 'invoicing', label: 'Invoicing', href: '/invoicing', icon: Receipt, enabled: false },
  { key: 'reports', label: 'Reports', href: '/reports', icon: BarChart3, enabled: false },
  { key: 'settings', label: 'Settings', href: '/settings', icon: Settings, enabled: true },
  { key: 'field_view', label: 'Field View', href: '/tech/jobs', icon: Smartphone, enabled: true },
]
