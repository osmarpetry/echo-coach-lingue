import React from 'react';
import PronunciationPopover from './PronunciationPopover';
import { type PronunciationLinks } from '../utils/pronunciationLinks';

interface MarkdownLineProps {
  content: string;
  className?: string;
  getPronunciationLinks?: (word: string) => PronunciationLinks | null;
}

export default function MarkdownLine({ content, className = '', getPronunciationLinks }: MarkdownLineProps) {
  // Code block delimiter line
  if (content.startsWith('```')) {
    return (
      <div className={`my-1 py-1 px-2 bg-muted/40 rounded text-muted-foreground font-mono text-sm opacity-60 ${className}`}>
        {content}
      </div>
    );
  }

  // Heading
  const headingMatch = content.match(/^(#{1,6})\s+(.*)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const sizeClass = ['text-2xl font-bold mt-3 mb-2', 'text-xl font-bold mt-3 mb-1', 'text-lg font-semibold mt-2 mb-1', 'text-base font-semibold mt-2 mb-1', 'text-sm font-semibold mt-2 mb-0.5', 'text-xs font-semibold mt-2 mb-0.5'][level - 1];
    return <div className={`${sizeClass} ${className}`}>{parseInline(headingMatch[2], getPronunciationLinks)}</div>;
  }

  // List item
  const listMatch = content.match(/^([-*]|\d+\.)\s+(.*)$/);
  if (listMatch) {
    return (
      <div className={`flex gap-2 my-1 pl-2 ${className}`}>
        <span className="text-muted-foreground min-w-[1.5em] select-none">{listMatch[1]}</span>
        <span>{parseInline(listMatch[2], getPronunciationLinks)}</span>
      </div>
    );
  }

  // Blockquote
  const quoteMatch = content.match(/^>\s?(.*)$/);
  if (quoteMatch) {
    return (
      <div className={`border-l-4 border-primary/40 pl-4 my-2 italic text-muted-foreground ${className}`}>
        {parseInline(quoteMatch[1], getPronunciationLinks)}
      </div>
    );
  }

  // Horizontal rule
  if (/^(---|___|\*\*\*)\s*$/.test(content.trim())) {
    return <hr className={`my-3 border-border/50 ${className}`} />;
  }

  // Empty line
  if (!content.trim()) {
    return <div className={`h-3 ${className}`} />;
  }

  // Paragraph
  return <div className={`my-1 ${className}`}>{parseInline(content, getPronunciationLinks)}</div>;
}

function parseInline(
  text: string,
  getPronunciationLinks?: (word: string) => PronunciationLinks | null
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let i = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^(`+)([\s\S]*?)\1/);
    if (codeMatch) {
      parts.push(
        <code key={i++} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
          {codeMatch[2]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([\s\S]*?)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={i++} className="font-semibold">{parseInline(boldMatch[1], getPronunciationLinks)}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic (but not bold)
    const italicMatch = remaining.match(/^\*([\s\S]*?)\*/);
    if (italicMatch) {
      parts.push(<em key={i++} className="italic">{parseInline(italicMatch[1], getPronunciationLinks)}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Strikethrough
    const strikeMatch = remaining.match(/^~~([\s\S]*?)~~/);
    if (strikeMatch) {
      parts.push(<del key={i++}>{parseInline(strikeMatch[1], getPronunciationLinks)}</del>);
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Link
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a
          key={i++}
          href={linkMatch[2]}
          className="text-primary underline hover:opacity-80"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    const nextMarkdownIndex = findNextInlineMarkdownIndex(remaining);
    const plainText = nextMarkdownIndex === -1 ? remaining : remaining.slice(0, nextMarkdownIndex);
    parts.push(
      <React.Fragment key={i++}>
        {renderPlainText(plainText, getPronunciationLinks)}
      </React.Fragment>
    );
    remaining = nextMarkdownIndex === -1 ? '' : remaining.slice(nextMarkdownIndex);
  }

  return <>{parts}</>;
}

function findNextInlineMarkdownIndex(text: string): number {
  const markers = ['`', '**', '*', '~~', '['];
  const indexes = markers
    .map((marker) => text.indexOf(marker))
    .filter((index) => index > 0);
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

function renderPlainText(
  text: string,
  getPronunciationLinks?: (word: string) => PronunciationLinks | null
): React.ReactNode {
  return tokenizePlainText(text).map((token, index) => {
    if (token.type !== 'word' || !getPronunciationLinks) {
      return <span key={index}>{token.text}</span>;
    }

    const links = getPronunciationLinks(token.text);
    if (!links) return <span key={index}>{token.text}</span>;

    return (
      <PronunciationPopover key={index} links={links}>
        {token.text}
      </PronunciationPopover>
    );
  });
}

function tokenizePlainText(text: string): { type: 'word' | 'separator'; text: string }[] {
  const chars = Array.from(text);
  const tokens: { type: 'word' | 'separator'; text: string }[] = [];
  let index = 0;

  while (index < chars.length) {
    const char = chars[index];

    if (!isWordChar(char)) {
      const start = index;
      index++;
      while (index < chars.length && !isWordChar(chars[index])) index++;
      tokens.push({ type: 'separator', text: chars.slice(start, index).join('') });
      continue;
    }

    const start = index;
    index++;
    while (index < chars.length) {
      const current = chars[index];
      const next = chars[index + 1];

      if (isWordChar(current)) {
        index++;
        continue;
      }

      if (isInternalWordConnector(current) && next && isWordChar(next)) {
        index++;
        continue;
      }

      break;
    }
    tokens.push({ type: 'word', text: chars.slice(start, index).join('') });
  }

  return tokens;
}

function isWordChar(char: string): boolean {
  return /[\p{L}\p{M}\p{N}]/u.test(char);
}

function isInternalWordConnector(char: string): boolean {
  return char === "'" || char === '’' || char === '-';
}
