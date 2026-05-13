import React from 'react';
import {
  CircleDot,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Sun,
  UserCheck
} from 'lucide-react';
import { navItems, pageMeta } from '../app/navigation.jsx';
import { Button } from './ui/index.js';
import { Switch } from './ui/Switch.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './shadcn/dropdown-menu.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './shadcn/tooltip.jsx';

export function Sidebar({ view, setView, settings, currentUser, collapsed, onToggleCollapsed }) {
  const items = navItems.filter(([, , , , role]) => !role || currentUser?.role === role);
  return (
    <aside className={collapsed ? 'sidebar collapsed' : 'sidebar'}>
      <div className="brand">
        <span className="brand-logo-frame">
          <img className="brand-logo" src="/ura-logo.png" alt="Logo URA" />
        </span>
        <div className="brand-copy">
          <strong>URA Atendimento</strong>
          <small>{settings?.instanceId || 'Instancia nao configurada'}</small>
        </div>
        <div className="sidebar-actions">
          <Button variant="ghost" iconOnly className="sidebar-toggle" type="button" onClick={onToggleCollapsed} title="Alternar menu">
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </Button>
        </div>
      </div>

      <TooltipProvider delayDuration={200}>
      <nav className="side-nav" aria-label="Principal">
        {items.map(([key, Icon, label, description]) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <Button variant="ghost" className={view === key ? 'active' : ''} onClick={() => setView(key)} title={label}>
                <Icon size={18} />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
      </nav>
      </TooltipProvider>

      <div className="sidebar-footer">
        <small>CAS Internet</small>
        <strong>{settings?.baseUrl || 'W-API nao configurada'}</strong>
      </div>
    </aside>
  );
}

export function Header({
  view,
  status,
  connected,
  loading,
  themePreference,
  resolvedTheme,
  accentColor,
  pushEnabled,
  currentUser,
  onRefreshStatus,
  onCycleTheme,
  onAccentChange,
  onTogglePushNotifications,
  onLogout
}) {
  const [title, description] = pageMeta[view] || pageMeta.inbox;
  return (
    <header className="topbar">
      <div className="page-title">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="topbar-actions">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="user-pill" type="button"><UserCheck size={16} />{currentUser?.name}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{currentUser?.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="accent-menu-label"><Palette size={14} /> Cor do tema</DropdownMenuLabel>
            <div className="accent-picker" aria-label="Cor do tema">
              {['green', 'blue', 'red', 'orange', 'purple', 'pink'].map((color) => (
                <button
                  key={color}
                  type="button"
                  className={accentColor === color ? 'accent-dot active' : 'accent-dot'}
                  data-accent-option={color}
                  onClick={() => onAccentChange?.(color)}
                  title={color}
                />
              ))}
            </div>
            <DropdownMenuSeparator />
            <div className="user-menu-switch">
              <Switch
                label="Push no dispositivo"
                help="Recebe notificacoes quando novas mensagens entram no atendimento."
                checked={pushEnabled}
                onChange={(event) => onTogglePushNotifications?.(event.target.checked)}
              />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onLogout}><LogOut size={16} />Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {currentUser?.role === 'admin' && <StatusPill connected={connected} loading={loading} onRefreshStatus={onRefreshStatus} />}
        <ThemeButton themePreference={themePreference} resolvedTheme={resolvedTheme} onCycleTheme={onCycleTheme} />
      </div>
      {status?.status && <small className="status-note">Status bruto: {String(status.status)}</small>}
    </header>
  );
}

function StatusPill({ connected, loading, onRefreshStatus }) {
  return (
    <Button variant="outline" className={connected ? 'status-pill connected' : 'status-pill'} onClick={onRefreshStatus} title="Atualizar status">
      {loading ? <Loader2 className="spin" size={17} /> : <CircleDot size={17} />}
      <span>{connected ? 'Conectado' : 'Verificar'}</span>
    </Button>
  );
}

function ThemeButton({ themePreference, resolvedTheme, onCycleTheme }) {
  const Icon = themePreference === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const label = themePreference === 'system' ? 'Sistema' : resolvedTheme === 'dark' ? 'Escuro' : 'Claro';
  return (
    <Button variant="outline" className="theme-button" onClick={onCycleTheme} title="Alternar tema">
      <Icon size={17} />
      <span>{label}</span>
    </Button>
  );
}

export function MobileNav({ view, setView, currentUser }) {
  const items = navItems.filter(([, , , , role]) => !role || currentUser?.role === role);
  return (
    <nav className="mobile-nav" aria-label="Principal mobile">
      {items.map(([key, Icon, label]) => (
        <Button key={key} variant="ghost" className={view === key ? 'active' : ''} onClick={() => setView(key)} title={label}>
          <Icon size={20} />
          <span>{label}</span>
        </Button>
      ))}
    </nav>
  );
}
