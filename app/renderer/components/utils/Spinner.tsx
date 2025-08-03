import React from "react";

const Spinner: React.FC<{
  className?: string;
  "data-testid"?: string;
  size?: number;
}> = ({ className = "", "data-testid": testId, size = 20 }) => (
  <svg
    className={`animate-spin text-white ${className}`}
    data-testid={testId}
    fill="none"
    height={size}
    style={{ display: "inline-block", verticalAlign: "middle" }}
    viewBox="0 0 24 24"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      fill="currentColor"
    />
  </svg>
);

export default Spinner;
