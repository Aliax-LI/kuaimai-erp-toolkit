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
    <div className="flex w-fit items-center gap-1 rounded-lg bg-cream-warm p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
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
