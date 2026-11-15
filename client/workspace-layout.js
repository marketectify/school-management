export const layoutOptions = [
  { id: 'default', label: 'Default', icon: 'panel' },
  { id: 'mini', label: 'Mini', icon: 'panelCompact' },
  { id: 'rtl', label: 'RTL', icon: 'rtl' },
  { id: 'boxed', label: 'Box', icon: 'boxed' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
];

export function isLayout(value) {
  return layoutOptions.some(option => option.id === value);
}
