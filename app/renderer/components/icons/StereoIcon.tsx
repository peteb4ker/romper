import React from "react";

interface StereoIconProps {
  className?: string;
  size?: number;
}

const StereoIcon: React.FC<StereoIconProps> = ({ className, size = 16 }) => (
  <svg
    className={className}
    fill="currentColor"
    height={size}
    viewBox="0 0 256 256"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="96"
      cy="128"
      fill="none"
      r="64"
      stroke="currentColor"
      strokeWidth="16"
    />
    <circle
      cx="160"
      cy="128"
      fill="none"
      r="64"
      stroke="currentColor"
      strokeWidth="16"
    />
  </svg>
);

export default StereoIcon;
