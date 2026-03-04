import type { IconProps } from "@phosphor-icons/react";

import React, { forwardRef } from "react";

export const DrumKit = forwardRef<SVGSVGElement, IconProps>(
  ({ className, color = "currentColor", size = 256, style, ...rest }, ref) => (
    <svg
      className={className}
      fill={color}
      height={size}
      ref={ref}
      style={style}
      viewBox="0 0 256 256"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path
        d="M48,160c0,17.67,35.82,32,80,32s80-14.33,80-32"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
      <line
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth="16"
        x1="48"
        x2="48"
        y1="120"
        y2="160"
      />
      <line
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth="16"
        x1="208"
        x2="208"
        y1="120"
        y2="160"
      />
      <ellipse
        cx="128"
        cy="120"
        fill="none"
        rx="80"
        ry="32"
        stroke={color}
        strokeWidth="16"
      />
      <line
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth="12"
        x1="72"
        x2="168"
        y1="64"
        y2="124"
      />
      <line
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth="12"
        x1="184"
        x2="88"
        y1="64"
        y2="124"
      />
      <circle cx="168" cy="124" r="6" />
      <circle cx="88" cy="124" r="6" />
    </svg>
  ),
);

DrumKit.displayName = "DrumKit";
