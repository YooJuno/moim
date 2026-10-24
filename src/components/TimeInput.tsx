import type { InputHTMLAttributes } from 'react';
import { Clock3 } from 'lucide-react';
import './time-input.css';

interface TimeInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'step'> {
  value: string;
  onChange: (value: string) => void;
  stepMinutes?: 1 | 60;
  allowMidnight?: boolean;
}

export function normalizeTimeInput(value: string, allowMidnight = false): string | null {
  const text = value.trim();
  let hour: number, minute: number;
  if (/^\d{1,2}:\d{1,2}$/.test(text)) {
    [hour, minute] = text.split(':').map(Number);
  } else if (/^\d{1,4}$/.test(text)) {
    hour = Number(text.length > 2 ? text.slice(0, -2) : text);
    minute = text.length > 2 ? Number(text.slice(-2)) : 0;
  } else {
    return null;
  }
  if (minute > 59 || hour > 23 && !(allowMidnight && hour === 24 && minute === 0)) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Text input keeps HH:MM consistent even on browsers configured for a 12-hour clock. */
export function TimeInput({ value, onChange, stepMinutes = 1, allowMidnight = false, className = '', onBlur, ...props }: TimeInputProps) {
  const minutes = stepMinutes === 60 ? '00' : '[0-5][0-9]';
  const pattern = `(?:[01][0-9]|2[0-3]):${minutes}${allowMidnight ? '|24:00' : ''}`;
  return <div className="time-input-control">
    <input {...props} className={`time-input ${className}`} type="text" inputMode="numeric" autoComplete="off" placeholder="00:00"
      maxLength={5} pattern={pattern} data-step-minutes={stepMinutes} value={value}
      onChange={event => {
        let text = event.target.value.replace(/[^0-9:]/g, '').slice(0, 5);
        if (/^\d{4}$/.test(text)) text = `${text.slice(0, 2)}:${text.slice(2)}`;
        onChange(text);
      }}
      onBlur={event => {
        const normalized = normalizeTimeInput(event.target.value, allowMidnight);
        if (normalized && normalized !== value) onChange(normalized);
        onBlur?.(event);
      }}/>
    <Clock3 size={16} aria-hidden="true"/>
  </div>;
}
