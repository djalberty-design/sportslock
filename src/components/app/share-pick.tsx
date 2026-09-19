import React, { useState, useRef, useEffect } from 'react';
import { Share2, Image as ImageIcon, Type, Check } from 'lucide-react';

export interface SharePickProps {
  selection: string;
  odds: string;
  probability: number;
  matchup: string;
  sport: string;
  className?: string;
}

export function SharePickButton({
  selection,
  odds,
  probability,
  matchup,
  sport,
  className = '',
}: SharePickProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = () => {
    setToast(true);
    setIsOpen(false);
    setTimeout(() => setToast(false), 2000);
  };

  const generateImage = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 315;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background gradient (obsidian to panel)
    const gradient = ctx.createLinearGradient(0, 0, 0, 315);
    gradient.addColorStop(0, '#09090b');
    gradient.addColorStop(1, '#18181b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 315);

    // Logo
    ctx.fillStyle = '#8b5cf6'; // primary (apex purple)
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('SportsLock AI', 40, 50);

    // Sport
    ctx.fillStyle = '#a1a1aa'; // muted
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(sport.toUpperCase(), 560, 50);

    // Matchup
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f4f4f5'; // ink
    ctx.font = '20px sans-serif';
    ctx.fillText(matchup, 40, 110);

    // Selection
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(selection, 40, 160);

    // Odds Badge
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.roundRect(40, 190, 80, 32, 16);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(odds, 80, 212);

    // Probability Bar
    const probColor = probability >= 60 ? '#10b981' : probability >= 50 ? '#f59e0b' : '#ef4444'; // neon green / amber / red
    
    // Bar Background
    ctx.fillStyle = '#27272a'; // line
    ctx.beginPath();
    ctx.roundRect(140, 196, 200, 20, 10);
    ctx.fill();

    // Bar Fill
    ctx.fillStyle = probColor;
    ctx.beginPath();
    ctx.roundRect(140, 196, 200 * (probability / 100), 20, 10);
    ctx.fill();

    // Probability Text
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f4f4f5';
    ctx.font = '14px sans-serif';
    ctx.fillText(`${probability}%`, 350, 211);

    // Tagline
    ctx.fillStyle = '#a1a1aa'; // muted
    ctx.font = '14px sans-serif';
    ctx.fillText('sportslock.app · Research-grade AI predictions', 40, 280);

    return canvas;
  };

  const copyImage = async () => {
    try {
      const canvas = await generateImage();
      if (!canvas) return;
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        showToast();
      });
    } catch (err) {
      console.error('Failed to copy image:', err);
    }
  };

  const copyText = async () => {
    try {
      const text = `SportsLock AI Pick: ${selection} ${odds} (${probability}%) | ${matchup} | sportslock.app`;
      await navigator.clipboard.writeText(text);
      showToast();
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100 focus:outline-none"
        aria-label="Share pick"
      >
        <Share2 className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-[#18181b] ring-1 ring-[#27272a] z-50 overflow-hidden">
          <div className="py-1">
            <button
              onClick={copyImage}
              className="flex items-center w-full px-4 py-2 text-sm text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
            >
              <ImageIcon className="w-4 h-4 mr-2 text-[#8b5cf6]" />
              Copy Image
            </button>
            <button
              onClick={copyText}
              className="flex items-center w-full px-4 py-2 text-sm text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
            >
              <Type className="w-4 h-4 mr-2 text-[#8b5cf6]" />
              Copy Text
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute right-0 bottom-full mb-2 bg-[#10b981] text-[#09090b] text-xs font-bold px-3 py-1 rounded shadow-lg flex items-center animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-3 h-3 mr-1" />
          Copied!
        </div>
      )}
    </div>
  );
}

export function ShareButton(props: SharePickProps) {
  // Alias for backward/wrapper compatibility if needed by the prompt
  return <SharePickButton {...props} />;
}
