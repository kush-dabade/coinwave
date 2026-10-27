import { Fragment } from "react"

import { parseMarkdown, type Inline } from "@/lib/markdown"
import { cn } from "@/lib/utils"

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "text":
            return <Fragment key={i}>{n.text}</Fragment>
          case "strong":
            return (
              <strong key={i} className="font-semibold text-ink">
                <Inlines nodes={n.children} />
              </strong>
            )
          case "em":
            return (
              <em key={i}>
                <Inlines nodes={n.children} />
              </em>
            )
          case "code":
            return (
              <code
                key={i}
                className="mono rounded bg-surface-2 px-1 py-0.5 text-[0.85em]"
              >
                {n.text}
              </code>
            )
          case "link":
            return (
              <a
                key={i}
                href={n.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent underline underline-offset-2"
              >
                <Inlines nodes={n.children} />
              </a>
            )
        }
      })}
    </>
  )
}

/** Renders the safe Markdown subset (see lib/markdown) as React elements. */
export function Markdown({
  source,
  className,
}: {
  source: string
  className?: string
}) {
  const blocks = parseMarkdown(source)
  return (
    <div
      className={cn(
        "space-y-3 text-[0.9375rem] leading-7 text-ink-2",
        className
      )}
    >
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            const cls =
              b.level === 1
                ? "text-xl"
                : b.level === 2
                  ? "text-lg"
                  : "text-base"
            const Tag = `h${b.level + 1}` as "h2" | "h3" | "h4"
            return (
              <Tag key={i} className={cn("doc font-semibold text-ink", cls)}>
                <Inlines nodes={b.children} />
              </Tag>
            )
          }
          case "paragraph":
            return (
              <p key={i}>
                <Inlines nodes={b.children} />
              </p>
            )
          case "quote":
            return (
              <blockquote
                key={i}
                className="border-l-2 border-rule-strong pl-3 text-ink-3 italic"
              >
                <Inlines nodes={b.children} />
              </blockquote>
            )
          case "code":
            return (
              <pre
                key={i}
                className="mono overflow-x-auto rounded-md bg-surface-2 p-3 text-xs leading-5 text-ink"
              >
                {b.text}
              </pre>
            )
          case "rule":
            return <hr key={i} className="border-rule" />
          case "list": {
            const List = b.ordered ? "ol" : "ul"
            return (
              <List
                key={i}
                className={cn(
                  "space-y-1 pl-5",
                  b.ordered ? "list-decimal" : "list-disc"
                )}
              >
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inlines nodes={item} />
                  </li>
                ))}
              </List>
            )
          }
          case "table":
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full border-collapse text-[0.8125rem]">
                  <thead>
                    <tr>
                      {b.header.map((c, j) => (
                        <th
                          key={j}
                          scope="col"
                          className="border-b border-rule-strong px-2 py-1 text-left font-semibold text-ink"
                        >
                          <Inlines nodes={c} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-rule">
                        {r.map((c, k) => (
                          <td key={k} className="num px-2 py-1">
                            <Inlines nodes={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      })}
    </div>
  )
}
