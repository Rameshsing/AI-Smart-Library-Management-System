import React from 'react';

interface BrandLogoProps {
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  inverted?: boolean;
}

export function BrandLogo({ onClick, inverted = false }: BrandLogoProps) {
  return (
    <a
      href="/"
      onClick={onClick}
      className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563EB] rounded-md"
    >
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${
          inverted
            ? 'bg-white/10 border-white/20 text-white'
            : 'bg-[#142B4A] border-[#142B4A] text-white'
        }`}
        aria-hidden="true"
      >
        {/* Custom book + AI node geometric mark */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 6.5C4 5.39543 4.89543 4.5 6 4.5H10.5C11.3284 4.5 12 5.17157 12 6V19C12 18.1716 11.3284 17.5 10.5 17.5H6C4.89543 17.5 4 16.6046 4 15.5V6.5Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path
            d="M20 6.5C20 5.39543 19.1046 4.5 18 4.5H13.5C12.6716 4.5 12 5.17157 12 6V19C12 18.1716 12.6716 17.5 13.5 17.5H18C19.1046 17.5 20 16.6046 20 15.5V6.5Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="9.5" r="1.35" fill="#60A5FA" />
          <circle cx="8" cy="11" r="1.15" fill="#93C5FD" />
          <path
            d="M12 6V13.5M14.8 10L12 11.5M9.1 11L12 11.5"
            stroke="#93C5FD"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span
        className={`font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0 ${
          inverted ? 'text-white' : 'text-[#142B4A]'
        }`}
      >
        AI Smart Library
      </span>
    </a>
  );
}
