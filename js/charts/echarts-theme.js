/**
 * ECharts Theme Configuration & Dark/Light Design Tokens
 */
import { state } from '../state.js';

export const EChartsTheme = {
  getTokens() {
    const isDark = state.get('theme') === 'dark';

    return {
      isDark,
      backgroundColor: 'transparent',
      textColor: isDark ? '#94a3b8' : '#64748b',
      titleColor: isDark ? '#f8fafc' : '#0f172a',
      axisLineColor: isDark ? '#334155' : '#e2e8f0',
      splitLineColor: isDark ? '#1e293b' : '#f1f5f9',
      tooltipBg: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      tooltipBorder: isDark ? '#334155' : '#cbd5e1',
      tooltipText: isDark ? '#f8fafc' : '#0f172a',

      // Semantic Color Palettes
      palette: [
        '#6366f1', // Indigo
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ec4899', // Pink
        '#3b82f6', // Blue
        '#8b5cf6', // Purple
        '#14b8a6', // Teal
        '#f97316', // Orange
        '#06b6d4', // Cyan
        '#84cc16'  // Lime
      ],

      incomeColor: '#10b981',
      expenseColor: '#f43f5e',
      netSavingsColor: '#6366f1',
      assetColor: '#10b981',
      liabilityColor: '#f43f5e',
      netWorthColor: '#38bdf8'
    };
  }
};
