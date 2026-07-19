import type { MapElement, ProjectData } from './types';
export const uid = () => crypto.randomUUID();
export const elementLabel = (index: number) => String.fromCharCode(65 + (index % 26));
export function compilePrompt(globalPrompt: string, elements: MapElement[]) {
  const lines = [
    'Use the attached annotated image as a strict composition reference.',
    globalPrompt.trim() ? `Overall direction: ${globalPrompt.trim()}` : '',
    '',
    ...elements.map((e) => {
      const placement = e.type === 'pin'
        ? `point at x=${Math.round(e.x * 100)}%, y=${Math.round(e.y * 100)}%`
        : `region x=${Math.round(e.x * 100)}%, y=${Math.round(e.y * 100)}%, width=${Math.round((e.width ?? 0) * 100)}%, height=${Math.round((e.height ?? 0) * 100)}%`;
      return `${e.label}: ${e.prompt || 'Place the intended element here.'}\nPlacement: ${placement}\nConstraint: ${e.strength}; overflow ${e.allowOverflow ? 'allowed' : 'not allowed'}; aspect ratio ${e.preserveAspectRatio ? 'preserved' : 'flexible'}.`;
    }),
    '',
    'Do not significantly move exact or near elements outside their assigned positions. Preserve the supplied background unless explicitly instructed otherwise.'
  ];
  return lines.filter((line, i, arr) => line !== '' || arr[i - 1] !== '').join('\n');
}
export function downloadText(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
export function makeProject(name: string, globalPrompt: string, elements: MapElement[], imageName?: string): ProjectData {
  return { version: 1, name, globalPrompt, elements, imageName };
}
