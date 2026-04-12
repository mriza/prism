/**
 * PRISM Theme Configuration
 * 
 * Defines light and dark theme presets using Ant Design Design Tokens.
 * All component styles should reference these tokens, not hardcoded values.
 */

import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

// Re-export ThemeConfig for use in other modules
export type { ThemeConfig };

// ============================================
// Light Theme (Default)
// ============================================

export const lightTheme: ThemeConfig = {
  token: {
    // Colors
    colorPrimary: '#1677ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1677ff',
    
    // Layout
    colorBgLayout: '#f5f5f5',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgSpotlight: '#000000d9',
    
    // Borders
    colorBorder: '#d9d9d9',
    colorBorderSecondary: '#f0f0f0',
    
    // Text
    colorText: '#000000d9',
    colorTextSecondary: '#00000073',
    colorTextTertiary: '#00000040',
    colorTextQuaternary: '#00000026',
    
    // Font
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 20,
    
    // Font weights (using standard values)
    fontWeightStrong: 600,
    
    // Spacing
    paddingXS: 8,
    paddingSM: 12,
    padding: 16,
    paddingLG: 24,
    paddingXL: 32,
    
    // Border radius
    borderRadiusSM: 4,
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusXS: 2,
    
    // Shadows
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
    boxShadowSecondary: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
    boxShadowTertiary: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
    
    // Control heights
    controlHeightSM: 24,
    controlHeight: 32,
    controlHeightLG: 40,
  },
  components: {
    Layout: {
      bodyBg: '#f5f5f5',
      headerBg: '#ffffff',
      siderBg: '#001529',
      triggerBg: '#002140',
    },
    Menu: {
      itemBg: 'transparent',
      itemColor: '#00000073',
      itemSelectedBg: '#e6f4ff',
      itemSelectedColor: '#1677ff',
      itemHoverBg: '#f5f5f5',
      itemHoverColor: '#1677ff',
    },
    Card: {
      colorBgContainer: '#ffffff',
    },
    Table: {
      colorBgContainer: '#ffffff',
      headerBg: '#fafafa',
      rowHoverBg: '#f5f5f5',
    },
    Modal: {
      colorBgContainer: '#ffffff',
      colorBgElevated: '#ffffff',
      colorBgMask: '#00000073',
    },
    Drawer: {
      colorBgElevated: '#ffffff',
    },
    Dropdown: {
      colorBgElevated: '#ffffff',
    },
    Popover: {
      colorBgElevated: '#ffffff',
    },
    Tooltip: {
      colorBgSpotlight: '#000000d9',
    },
  },
};

// ============================================
// Dark Theme
// ============================================

export const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    // Colors - adjusted for dark theme
    colorPrimary: '#1668dc',
    colorSuccess: '#49aa19',
    colorWarning: '#d89614',
    colorError: '#dc4446',
    colorInfo: '#1668dc',
    
    // Layout - dark backgrounds
    colorBgLayout: '#0a0a0a',
    colorBgContainer: '#141414',
    colorBgElevated: '#1f1f1f',
    colorBgSpotlight: '#424242',
    
    // Borders - subtle for dark
    colorBorder: '#303030',
    colorBorderSecondary: '#1f1f1f',
    
    // Text - lighter for dark backgrounds
    colorText: '#ffffffd9',
    colorTextSecondary: '#ffffffa6',
    colorTextTertiary: '#ffffff73',
    colorTextQuaternary: '#ffffff40',
    
    // Shadows - adjusted for dark
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.1), 0 1px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px 0 rgba(0, 0, 0, 0.1)',
    boxShadowSecondary: '0 6px 16px 0 rgba(0, 0, 0, 0.3), 0 3px 6px -4px rgba(0, 0, 0, 0.4), 0 9px 28px 8px rgba(0, 0, 0, 0.2)',
    boxShadowTertiary: '0 1px 2px 0 rgba(0, 0, 0, 0.1), 0 1px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px 0 rgba(0, 0, 0, 0.1)',
  },
  components: {
    Layout: {
      bodyBg: '#0a0a0a',
      headerBg: '#141414',
      siderBg: '#001529',
      triggerBg: '#002140',
    },
    Menu: {
      itemBg: 'transparent',
      itemColor: '#ffffffa6',
      itemSelectedBg: '#1668dc26',
      itemSelectedColor: '#1668dc',
      itemHoverBg: '#ffffff14',
      itemHoverColor: '#1668dc',
    },
    Card: {
      colorBgContainer: '#141414',
    },
    Table: {
      colorBgContainer: '#141414',
      headerBg: '#1f1f1f',
      rowHoverBg: '#1f1f1f',
    },
    Modal: {
      colorBgContainer: '#141414',
      colorBgElevated: '#1f1f1f',
      colorBgMask: '#00000073',
    },
    Drawer: {
      colorBgElevated: '#141414',
    },
    Dropdown: {
      colorBgElevated: '#1f1f1f',
    },
    Popover: {
      colorBgElevated: '#1f1f1f',
    },
    Tooltip: {
      colorBgSpotlight: '#424242',
    },
    Input: {
      colorBgContainer: '#141414',
      activeBg: '#141414',
      hoverBg: '#1f1f1f',
    },
    Select: {
      colorBgContainer: '#141414',
      optionSelectedBg: '#1668dc26',
    },
  },
};

// ============================================
// Theme Presets Map
// ============================================

export const themePresets: Record<string, ThemeConfig> = {
  light: lightTheme,
  dark: darkTheme,
};

// ============================================
// Theme Type
// ============================================

export type ThemeMode = 'light' | 'dark';
