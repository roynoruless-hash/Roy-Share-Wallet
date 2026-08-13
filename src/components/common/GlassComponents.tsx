import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/* ==========================================================================
   GLASS CARD
   ========================================================================== */
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
  id?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hoverable = false,
  onClick,
  id,
}) => {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`glass-card rounded-2xl p-4 sm:p-6 transition-all duration-300 ${
        hoverable ? 'glass-card-hover cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

/* ==========================================================================
   STAT CARD
   ========================================================================== */
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconColor?: string;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  badge?: string;
  id?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-sky-400',
  trend,
  trendType = 'neutral',
  badge,
  id,
}) => {
  return (
    <GlassCard id={id} className="relative overflow-hidden group">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-baseline gap-2">
            <span>{value}</span>
            {badge && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-400 font-medium">{subtitle}</p>}
          {trend && (
            <p
              className={`text-xs font-bold flex items-center gap-1 ${
                trendType === 'up'
                  ? 'text-emerald-400'
                  : trendType === 'down'
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {trend}
            </p>
          )}
        </div>

        <div className={`p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 ${iconColor} group-hover:scale-110 transition-transform duration-300 shadow-inner`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>
    </GlassCard>
  );
};

/* ==========================================================================
   GLASS BADGE
   ========================================================================== */
interface GlassBadgeProps {
  children: React.ReactNode;
  variant?: 'emerald' | 'rose' | 'amber' | 'sky' | 'indigo' | 'purple' | 'slate';
  size?: 'sm' | 'md';
  className?: string;
}

export const GlassBadge: React.FC<GlassBadgeProps> = ({
  children,
  variant = 'sky',
  size = 'md',
  className = '',
}) => {
  const variantStyles = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/25',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
    slate: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 font-bold tracking-wide',
    md: 'text-xs px-2.5 py-1 font-bold tracking-wide',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};

/* ==========================================================================
   GLASS BUTTON
   ========================================================================== */
interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ElementType;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon: Icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

  const variantStyles = {
    primary:
      'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/20 border border-sky-400/30',
    secondary:
      'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 shadow-md',
    danger:
      'bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white shadow-lg shadow-rose-600/20 border border-rose-500/30',
    success:
      'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 border border-emerald-400/30',
    ghost: 'bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white',
  };

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-xs sm:text-sm px-4 py-2.5 gap-2',
    lg: 'text-sm sm:text-base px-6 py-3.5 gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      <span>{children}</span>
    </button>
  );
};

/* ==========================================================================
   GLASS INPUT
   ========================================================================== */
interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ElementType;
  label?: string;
  error?: string;
}

export const GlassInput: React.FC<GlassInputProps> = ({
  icon: Icon,
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && <label htmlFor={id} className="block text-xs font-semibold text-slate-300">{label}</label>}
      <div className="relative w-full">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={id}
          className={`glass-input w-full rounded-xl py-2.5 px-3.5 text-xs sm:text-sm placeholder-slate-500 ${
            Icon ? 'pl-10' : ''
          } ${error ? 'border-rose-500 focus:ring-rose-500' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
    </div>
  );
};

/* ==========================================================================
   GLASS MODAL
   ========================================================================== */
interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const GlassModal: React.FC<GlassModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
}) => {
  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div
        className={`w-full ${widthClasses[maxWidth]} glass-modal rounded-2xl p-5 sm:p-6 my-8 space-y-4 border border-slate-800 shadow-2xl relative max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 pb-3 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-1">{children}</div>
      </div>
    </div>
  );
};

/* ==========================================================================
   SKELETON PLACEHOLDERS
   ========================================================================== */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`glass-card rounded-2xl p-5 space-y-3 ${className}`}>
      <div className="h-4 w-1/3 rounded-lg animate-shimmer"></div>
      <div className="h-8 w-2/3 rounded-lg animate-shimmer"></div>
      <div className="h-3 w-1/2 rounded-lg animate-shimmer"></div>
    </div>
  );
};

export const SkeletonUserCard: React.FC = () => {
  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl animate-shimmer shrink-0"></div>
        <div className="space-y-2 flex-1">
          <div className="h-4 w-3/4 rounded-md animate-shimmer"></div>
          <div className="h-3 w-1/2 rounded-md animate-shimmer"></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
        <div className="h-8 rounded-xl animate-shimmer"></div>
        <div className="h-8 rounded-xl animate-shimmer"></div>
      </div>
    </div>
  );
};

/* ==========================================================================
   EMPTY STATE
   ========================================================================== */
interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ElementType;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
}) => {
  return (
    <GlassCard className="text-center py-12 px-6 flex flex-col items-center justify-center space-y-3">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center justify-center text-slate-500 mb-1">
          <Icon className="w-7 h-7" />
        </div>
      )}
      <h4 className="text-base font-bold text-slate-200">{title}</h4>
      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <GlassButton variant="secondary" size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </GlassButton>
      )}
    </GlassCard>
  );
};

/* ==========================================================================
   ERROR STATE
   ========================================================================== */
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <GlassCard className="border-rose-500/30 bg-rose-950/20 text-center py-8 px-6 flex flex-col items-center justify-center space-y-3">
      <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-bold text-rose-300">Something went wrong</h4>
      <p className="text-xs text-slate-400 max-w-md">{message}</p>
      {onRetry && (
        <GlassButton variant="danger" size="sm" onClick={onRetry} icon={RefreshCw}>
          Retry Operation
        </GlassButton>
      )}
    </GlassCard>
  );
};
