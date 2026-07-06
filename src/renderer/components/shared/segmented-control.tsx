import { cn } from '@/lib/utils';

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex w-full flex-wrap items-center gap-1 rounded-md border border-beige bg-cream-warm p-0.5 sm:w-fit">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
            value === option.value
              ? 'bg-charcoal text-cream'
              : 'text-brown-soft hover:text-charcoal',
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
