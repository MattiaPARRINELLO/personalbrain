import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn("text-[13px] leading-relaxed text-[var(--text-1)]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-[var(--text-1)]">{children}</strong>,
        em: ({ children }) => <em className="italic text-[var(--text-2)]">{children}</em>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            {children}
          </a>
        ),
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          return isInline ? (
            <code
              className="px-1 py-0.5 rounded bg-[var(--surface-3)] text-[var(--accent)] font-mono text-[11px]"
              {...props}
            >
              {children}
            </code>
          ) : (
            <pre className="my-3 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-1)] overflow-x-auto">
              <code
                className="font-mono text-[11px] leading-relaxed text-[var(--text-1)]"
                {...props}
              >
                {children}
              </code>
            </pre>
          );
        },
        ul: ({ children }) => <ul className="mb-3 pl-4 list-disc marker:text-[var(--text-3)]">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 pl-4 list-decimal marker:text-[var(--text-3)]">{children}</ol>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        h1: ({ children }) => <h1 className="text-[15px] font-semibold mb-2 mt-4 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-[14px] font-semibold mb-2 mt-4 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-[13px] font-semibold mb-2 mt-3 first:mt-0">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[var(--accent)] pl-3 my-3 text-[var(--text-2)] italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-4 border-[var(--border-1)]" />,
      }}
    >
      {children}
      </ReactMarkdown>
    </div>
  );
}
