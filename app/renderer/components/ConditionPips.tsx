import React from "react";

import {
  describeCondition,
  type TriggerCondition,
} from "./hooks/shared/stepPatternConstants";

interface ConditionPipsProps {
  className?: string;
  condition: Exclude<TriggerCondition, null>;
  "data-testid"?: string;
}

/**
 * An A:B trigger condition drawn as B dots with dot A filled: ●○○○ is 1:4,
 * "plays on loop 1 of every 4". Inherits the text color.
 */
const ConditionPips: React.FC<ConditionPipsProps> = ({
  className = "",
  condition,
  "data-testid": testId,
}) => {
  const [a, b] = condition.split(":").map(Number);
  return (
    <span
      aria-label={describeCondition(condition)}
      className={`inline-flex items-center gap-[2px] ${className}`}
      data-condition={condition}
      data-testid={testId}
      role="img"
    >
      {Array.from({ length: b }, (_, i) => (
        <span
          className={`block w-[5px] h-[5px] rounded-full ${i + 1 === a ? "bg-current" : "border border-current opacity-60"}`}
          key={i}
        />
      ))}
    </span>
  );
};

export default ConditionPips;
