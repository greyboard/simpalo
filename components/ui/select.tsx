"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue | undefined>(undefined);

export function Select({ value, onValueChange, disabled, children }: SelectProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) {
      throw new Error("SelectTrigger must be used within Select");
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => !props.disabled && context.setOpen(!context.open)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    );
  }
);
SelectTrigger.displayName = "SelectTrigger";

interface SelectValueProps {
  placeholder?: string;
  children?: React.ReactNode;
}

export function SelectValue({ placeholder, children }: SelectValueProps) {
  const context = React.useContext(SelectContext);
  if (!context) {
    throw new Error("SelectValue must be used within Select");
  }

  // Hooks must be called before any early returns
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (context.value) {
      // Use a small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        const selectContent = document.querySelector('[data-select-content]');
        if (selectContent) {
          const selectedItem = selectContent.querySelector(`[data-value="${context.value}"]`);
          if (selectedItem) {
            setSelectedLabel(selectedItem.textContent || null);
          }
        }
      }, 0);
      return () => clearTimeout(timer);
    } else {
      setSelectedLabel(null);
    }
  }, [context.value]);

  if (children) {
    return <>{children}</>;
  }

  if (context.value && selectedLabel) {
    return <span className="text-gray-900">{selectedLabel}</span>;
  }

  return <span className="text-gray-500">{placeholder}</span>;
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SelectContent({ children, className }: SelectContentProps) {
  const context = React.useContext(SelectContext);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!context) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        context.setOpen(false);
      }
    };

    if (context.open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [context]);

  if (!context?.open) return null;

  return (
    <div
      ref={contentRef}
      data-select-content
      className={cn(
        "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white text-gray-950 shadow-md",
        className
      )}
      style={{ top: "100%", marginTop: "4px", minWidth: "200px" }}
    >
      <div className="p-1">{children}</div>
    </div>
  );
}

interface SelectItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: React.ReactNode;
}

export const SelectItem = React.forwardRef<HTMLButtonElement, SelectItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) {
      throw new Error("SelectItem must be used within Select");
    }

    const isSelected = context.value === value;

    return (
      <button
        ref={ref}
        type="button"
        data-value={value}
        onClick={() => {
          context.onValueChange?.(value);
          context.setOpen(false);
        }}
        className={cn(
          "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none focus:bg-gray-100 focus:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 whitespace-nowrap",
          isSelected && "bg-gray-100 text-gray-900",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
SelectItem.displayName = "SelectItem";
