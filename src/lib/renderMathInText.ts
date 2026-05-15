// src/lib/renderMathInText.ts
import katex from 'katex';

export function renderMathInText(text: string): string {
  if (!text) return '';
  const blocks = text
    .split('\n\n')
    .map((block) => block.replace(/\n/g, ' '))
    .join('\n\n');
  const placeholders: string[] = [];
  let html = blocks.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      });
      const idx = placeholders.length;
      placeholders.push(rendered);
      return `%%DISPLAY_MATH_${idx}%%`;
    } catch {
      return `$$${math}$$`;
    }
  });
  html = html.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `$${math}$`;
    }
  });
  html = html
    .split('\n\n')
    .map((block) => `<p>${block}</p>`)
    .join('');
  placeholders.forEach((rendered, idx) => {
    html = html.replace(`%%DISPLAY_MATH_${idx}%%`, rendered);
  });
  return html;
}
