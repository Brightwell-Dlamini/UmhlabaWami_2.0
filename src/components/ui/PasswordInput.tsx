import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Optional label rendered above the field */
  label?: string;
  /** Extra class on the outer wrapper */
  wrapperClassName?: string;
}

/**
 * Password field with show/hide toggle. Use everywhere a password is typed.
 */
export const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  className = '',
  wrapperClassName = '',
  id,
  ...rest
}) => {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? rest.name;

  return (
    <div className={wrapperClassName}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          {...rest}
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={`w-full pr-10 ${className}`}
          autoComplete={rest.autoComplete ?? 'current-password'}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          title={visible ? 'Hide password' : 'Show password'}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
