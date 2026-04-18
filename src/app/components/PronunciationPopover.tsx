import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { type PronunciationLinks } from '../utils/pronunciationLinks';

interface PronunciationPopoverProps {
  links: PronunciationLinks;
  children: React.ReactNode;
  className?: string;
  onTriggerClick?: () => void;
}

export default function PronunciationPopover({
  links,
  children,
  className = '',
  onTriggerClick,
}: PronunciationPopoverProps) {
  const handleTriggerClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onTriggerClick?.();
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.stopPropagation();
    onTriggerClick?.();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
          className={`inline-block origin-center rounded-md cursor-pointer outline-none transition-[background-color,box-shadow,transform] duration-150 hover:bg-primary/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/70 ${className}`}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 rounded-lg border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 shadow-xl backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 truncate text-sm font-medium text-foreground">{links.word}</div>
        <div className="grid gap-2">
          <PronunciationLink href={links.youglishUrl} label="YouGlish" />
          <PronunciationLink href={links.forvoUrl} label="Forvo" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PronunciationLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/60 px-3 py-2 text-sm text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
    >
      <span>{label}</span>
      <ExternalLink className="h-4 w-4 shrink-0" />
    </a>
  );
}
