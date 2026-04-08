export const panel = {
  title: 'Sample Thread Summary',
  description: 'This sample plugin can be extended to render custom thread analytics and transformations.',
};

export function render(thread) {
  return `Sample plugin loaded for thread ${thread?.name || 'unknown'}.`;
}
