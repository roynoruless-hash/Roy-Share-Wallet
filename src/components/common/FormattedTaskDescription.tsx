import React from 'react';

interface FormattedTaskDescriptionProps {
  description: string;
  className?: string;
  cardStyle?: boolean;
}

interface TextBlock {
  type: 'general' | 'success' | 'warning';
  text: string;
}

export function parseDescriptionBlocks(rawText: string): TextBlock[] {
  if (!rawText) return [];

  const lines = rawText.split('\n');
  const blocks: TextBlock[] = [];
  let currentBlock: { type: 'general' | 'success' | 'warning'; lines: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    let lineType: 'general' | 'success' | 'warning' = 'general';
    if (trimmed.startsWith('✅') || trimmed.startsWith('🟢') || trimmed.startsWith('🎉')) {
      lineType = 'success';
    } else if (trimmed.startsWith('⚠️') || trimmed.startsWith('❌') || trimmed.startsWith('🚨') || trimmed.startsWith('❗')) {
      lineType = 'warning';
    }

    if (!currentBlock || currentBlock.type !== lineType) {
      if (currentBlock) {
        blocks.push({ type: currentBlock.type, text: currentBlock.lines.join('\n') });
      }
      currentBlock = { type: lineType, lines: [line] };
    } else {
      currentBlock.lines.push(line);
    }
  }

  if (currentBlock) {
    blocks.push({ type: currentBlock.type, text: currentBlock.lines.join('\n') });
  }

  return blocks;
}

export const FormattedTaskDescription: React.FC<FormattedTaskDescriptionProps> = ({
  description,
  className = '',
  cardStyle = false,
}) => {
  if (!description || !description.trim()) return null;

  const blocks = parseDescriptionBlocks(description);

  const content = (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'success') {
          return (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs sm:text-sm font-semibold whitespace-pre-wrap leading-relaxed shadow-sm flex items-start gap-2"
            >
              <div className="w-full whitespace-pre-wrap">{block.text}</div>
            </div>
          );
        }

        if (block.type === 'warning') {
          return (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs sm:text-sm font-semibold whitespace-pre-wrap leading-relaxed shadow-sm flex items-start gap-2"
            >
              <div className="w-full whitespace-pre-wrap">{block.text}</div>
            </div>
          );
        }

        return (
          <div
            key={idx}
            className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-normal"
          >
            {block.text}
          </div>
        );
      })}
    </div>
  );

  if (cardStyle) {
    return (
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400 pb-1.5 border-b border-slate-850">
          <span>📋 TASK DETAILS</span>
        </div>
        {content}
      </div>
    );
  }

  return content;
};
