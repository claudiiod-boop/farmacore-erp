/**
 * Design System Magnos Farma — FarmaCore ERP
 * Paleta de cores corporativa, métricas de layout e tokens visuais
 * Inspirado nos dashboards modernos de varejo e inteligência farmacêutica
 */

export const THEME = {
  colors: {
    // Sidebar & Superfícies Escuras
    sidebar: {
      bg: '#0F2042',
      hover: '#1B315B',
      active: '#00A8E8',
      text: '#E2E8F0',
      textMuted: '#94A3B8',
      border: '#1E293B',
    },
    // Marca & Cores Primárias
    brand: {
      navy: '#0F2042',
      blue: '#1B4965',
      cyan: '#00A8E8',
      emerald: '#10B981',
      teal: '#20C997',
    },
    // KPIs & Cards de Destaque
    kpi: {
      revenue: {
        bg: 'from-blue-500 to-blue-600',
        light: '#EFF6FF',
        border: '#BFDBFE',
        text: '#1D4ED8',
      },
      averageTicket: {
        bg: 'from-emerald-500 to-teal-600',
        light: '#ECFDF5',
        border: '#A7F3D0',
        text: '#047857',
      },
      salesCount: {
        bg: 'from-purple-500 to-indigo-600',
        light: '#F5F3FF',
        border: '#DDD6FE',
        text: '#6D28D9',
      },
      itemsSold: {
        bg: 'from-orange-500 to-amber-600',
        light: '#FFF7ED',
        border: '#FED7AA',
        text: '#C2410C',
      },
      customers: {
        bg: 'from-cyan-500 to-teal-500',
        light: '#ECFEFF',
        border: '#A5F3FC',
        text: '#0E7490',
      },
    },
    // Status e Alertas
    status: {
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#3B82F6',
    },
    // Superfície de Conteúdo
    surface: {
      bg: '#F8FAFC',
      card: '#FFFFFF',
      border: '#E2E8F0',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
    },
    // Balcão Operacional (InovaFarma Classic Action Bar)
    counter: {
      actionBar: '#31708F',
      totalLiquid: '#0284C7',
    },
  },
  typography: {
    fontFamily: 'Inter, Segoe UI, sans-serif',
  },
} as const;
