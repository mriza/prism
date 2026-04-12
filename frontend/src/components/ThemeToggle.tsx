/**
 * Theme Toggle Button
 * 
 * A button component that toggles between light and dark themes.
 * Should be placed in the header or settings area.
 */

import { Switch, Tooltip, theme } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';

export function ThemeToggle() {
  const { theme: currentTheme, toggleTheme } = useTheme();
  const { token } = theme.useToken();

  return (
    <Tooltip title={currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}>
      <Switch
        checked={currentTheme === 'dark'}
        onChange={toggleTheme}
        checkedChildren={<MoonOutlined />}
        unCheckedChildren={<SunOutlined />}
        style={{
          backgroundColor: currentTheme === 'dark' ? token.colorPrimary : undefined,
        }}
        aria-label={currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      />
    </Tooltip>
  );
}

/**
 * Theme Toggle with Label
 * For use in settings pages
 */
export function ThemeToggleWithLabel() {
  const { theme: currentTheme, toggleTheme } = useTheme();
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: token.marginSM,
      }}
    >
      <SunOutlined style={{ color: token.colorTextSecondary }} />
      <Switch
        checked={currentTheme === 'dark'}
        onChange={toggleTheme}
        checkedChildren={<MoonOutlined />}
        unCheckedChildren={<SunOutlined />}
        style={{
          backgroundColor: currentTheme === 'dark' ? token.colorPrimary : undefined,
        }}
      />
      <MoonOutlined style={{ color: token.colorTextSecondary }} />
    </div>
  );
}
