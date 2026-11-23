import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Star } from "lucide-react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      type="button"
      className={`v2-button v2-button-${variant} ${className}`}
      {...props}
    />
  );
}
export function Card({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`v2-card ${className}`}>
      {(title || action) && (
        <div className="v2-card-heading">
          <div>
            {eyebrow && <span className="v2-eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "red" | "neutral";
}) {
  return <span className={`v2-badge v2-badge-${tone}`}>{children}</span>;
}
export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="v2-progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function Stars({
  value,
  onChange,
  label = "Đánh giá",
}: {
  value: number;
  onChange?: (n: number) => void;
  label?: string;
}) {
  return (
    <div
      className="v2-stars"
      role={onChange ? "group" : "img"}
      aria-label={`${label}: ${value}/5 sao`}
    >
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            type="button"
            key={n}
            aria-label={`${label} ${n} sao`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
          >
            <Star size={22} fill={n <= value ? "currentColor" : "none"} />
          </button>
        ) : (
          <Star
            size={16}
            key={n}
            fill={n <= Math.round(value) ? "currentColor" : "none"}
          />
        ),
      )}
    </div>
  );
}
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="v2-empty">
      {icon}
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}
export function RichDescription({ text }: { text: string }) {
  return (
    <div className="rich-description">
      {text.split(/\r?\n/).map((line, i) =>
        /^#{1,6}\s/.test(line) ? (
          <h3 key={i}>{line.replace(/^#{1,6}\s+/, "")}</h3>
        ) : /^[-*]\s/.test(line) ? (
          <p className="rich-list-item" key={i}>
            • {line.slice(2)}
          </p>
        ) : line.trim() ? (
          <p key={i}>{line}</p>
        ) : null,
      )}
    </div>
  );
}
