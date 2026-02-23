"use client";

import { useRef, useState, useMemo } from "react";

const MAX_SUGGESTIONS = 8;

interface NotesFieldWithSuggestionsProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  rows?: number;
  id?: string;
}

export function NotesFieldWithSuggestions({
  value,
  onChange,
  onFocus,
  onBlur,
  suggestions,
  placeholder = "Notas...",
  className = "",
  rows = 2,
  id,
}: NotesFieldWithSuggestionsProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    const v = value.trim().toLowerCase();
    if (!v) return suggestions.slice(0, MAX_SUGGESTIONS);
    return suggestions
      .filter((s) => s.toLowerCase().includes(v))
      .slice(0, MAX_SUGGESTIONS);
  }, [value, suggestions]);

  const handleFocus = () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setShowSuggestions(true);
    onFocus?.();
  };

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => {
      setShowSuggestions(false);
      blurTimerRef.current = null;
      onBlur?.();
    }, 150);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  };

  return (
    <div className="relative w-full">
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {showSuggestions && filtered.length > 0 && (
        <ul
          className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded border border-gray-200 bg-white py-1 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.map((s, i) => (
            <li key={`${i}-${s.slice(0, 30)}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-100"
                onMouseDown={() => handleSelectSuggestion(s)}
              >
                {s.length > 80 ? s.slice(0, 80) + "…" : s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
