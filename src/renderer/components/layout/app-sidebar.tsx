import { LayoutDashboard, ListTodo, Settings } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

import { SidebarBrand } from '@/components/layout/sidebar/SidebarBrand';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

const navItems = [
  { to: '/workbench', icon: LayoutDashboard, label: '工作台' },
  { to: '/tasks', icon: ListTodo, label: '任务列表' },
  { to: '/settings', icon: Settings, label: '设置' },
] as const;

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarBrand />

      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === item.to}
                tooltip={item.label}
              >
                <NavLink to={item.to}>
                  <item.icon />
                  <span>{item.label}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
