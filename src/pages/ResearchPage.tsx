import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  BookOpenText,
  ExternalLink,
  FilePlus2,
  FolderPlus,
  History,
  Link2,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { AssetIcon } from "@/components/data/AssetIcon"
import { EmptyState } from "@/components/data/states"
import { Page, PageHeader } from "@/components/layout/Page"
import { AssetPicker } from "@/components/portfolio/AssetPicker"
import { Markdown } from "@/components/research/Markdown"
import { Button } from "@/components/ui/button"
import {
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Segmented,
  Select,
  Textarea,
} from "@/components/ui/controls"
import { Input } from "@/components/ui/input"
import { NameDialog } from "@/components/ui/name-dialog"
import { useQuotes } from "@/hooks/queries"
import { useNow, usePageTitle } from "@/hooks/use-ui"
import { formatAge, formatDate } from "@/lib/format"
import { plainText } from "@/lib/markdown"
import { cn } from "@/lib/utils"
import { safeHttpUrl, type Note } from "@/lib/workspace"
import { researchActions, useResearch } from "@/stores"

const KIND_LABEL = {
  note: "Note",
  article: "Saved article",
  comparison: "Comparison",
} as const

function NoteEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const { collections } = useResearch()
  const now = useNow(30_000)
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [mode, setMode] = useState<"write" | "preview">(
    note.body && note.kind !== "note" ? "preview" : "write"
  )
  const [tagText, setTagText] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [adding, setAdding] = useState(false)
  const { assets } = useQuotes(note.assetIds)

  // Debounced autosave; revisions are snapshotted by the store at most every 10 minutes.
  const timer = useRef<number | null>(null)
  useEffect(() => {
    if (title === note.title && body === note.body) return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(
      () => researchActions.updateNote(note.id, { title, body }),
      400
    )
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [title, body, note.id, note.title, note.body])

  const addTag = () => {
    const t = tagText.trim().toLowerCase().replace(/^#/, "")
    if (t && !note.tags.includes(t))
      researchActions.updateNote(note.id, { tags: [...note.tags, t] })
    setTagText("")
  }
  const addLink = () => {
    const url = safeHttpUrl(linkUrl.trim())
    if (!url) {
      toast.error("Enter a full web address starting with http:// or https://")
      return
    }
    researchActions.updateNote(note.id, {
      links: [...note.links, { url, title: "" }],
    })
    setLinkUrl("")
  }
  const remove = () => {
    const removed = researchActions.removeNote(note.id)
    onBack()
    if (removed)
      toast("Note deleted", {
        action: {
          label: "Undo",
          onClick: () => researchActions.restoreNote(removed),
        },
      })
  }

  return (
    <article className="flex min-h-0 flex-col" aria-label="Note editor">
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-3 py-2">
        <Button
          size="icon-sm"
          variant="ghost"
          className="lg:hidden"
          aria-label="Back to notes"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <Badge>{KIND_LABEL[note.kind]}</Badge>
        <span className="text-[0.6875rem] text-ink-3">
          Saved {formatAge(note.updatedAt, now)} · created{" "}
          {formatDate(note.createdAt)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Segmented
            label="Editor mode"
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: "write", label: "Write" },
              { value: "preview", label: "Preview" },
            ]}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            onClick={() =>
              researchActions.updateNote(note.id, { pinned: !note.pinned })
            }
          >
            {note.pinned ? (
              <PinOff aria-hidden="true" />
            ) : (
              <Pin aria-hidden="true" />
            )}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Revision history (${note.revisions.length})`}
              >
                <History aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
              <p className="mb-1 text-xs font-semibold">Revision history</p>
              {note.revisions.length === 0 ? (
                <p className="text-xs text-ink-3">
                  Earlier versions are kept automatically, at most one every 10
                  minutes while you edit.
                </p>
              ) : (
                <ul className="max-h-60 space-y-1 overflow-y-auto text-xs">
                  {[...note.revisions].reverse().map((r) => (
                    <li
                      key={r.at}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-ink-2">
                        {formatDate(r.at)}{" "}
                        {new Date(r.at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        · {r.title || "Untitled"}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-accent hover:underline"
                        onClick={() => {
                          researchActions.restoreRevision(note.id, r.at)
                          setTitle(r.title)
                          setBody(r.body)
                          toast(
                            "Revision restored; the version you replaced is kept in history"
                          )
                        }}
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PopoverContent>
          </Popover>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Delete note"
            onClick={remove}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <label htmlFor="note-title" className="sr-only">
          Title
        </label>
        <input
          id="note-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled note"
          maxLength={300}
          className="doc w-full bg-transparent text-2xl font-semibold text-ink outline-none placeholder:text-ink-3"
        />
        {note.source && (
          <p className="mt-1 text-xs text-ink-3">
            From{" "}
            <a
              href={note.source.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:underline"
            >
              {note.source.name}{" "}
              <ExternalLink className="inline size-3" aria-hidden="true" />
            </a>
            {note.source.publishedAt
              ? ` · published ${formatDate(note.source.publishedAt)}`
              : ""}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          {note.assetIds.map((id) => {
            const a = assets.get(id)
            return (
              <span
                key={id}
                className="inline-flex h-6 items-center gap-1 rounded-full border border-rule-strong pr-1 pl-1.5"
              >
                <AssetIcon src={a?.image} symbol={a?.symbol ?? "?"} size={14} />
                <Link
                  to={`/markets/${id}`}
                  className="text-ink hover:underline"
                >
                  {a?.symbol ?? id}
                </Link>
                <button
                  type="button"
                  aria-label={`Unlink ${a?.name ?? id}`}
                  className="inline-flex size-4 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2"
                  onClick={() =>
                    researchActions.updateNote(note.id, {
                      assetIds: note.assetIds.filter((x) => x !== id),
                    })
                  }
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            )
          })}
          <Popover open={adding} onOpenChange={setAdding}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-rule-strong px-2 text-ink-3 hover:text-ink"
              >
                <Plus className="size-3" aria-hidden="true" /> Link asset
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-2">
              <AssetPicker
                inputId="note-asset"
                value={null}
                suggestedIds={[]}
                onChange={(a) => {
                  if (a) {
                    researchActions.updateNote(note.id, {
                      assetIds: [...new Set([...note.assetIds, a.id])],
                    })
                    setAdding(false)
                  }
                }}
              />
            </PopoverContent>
          </Popover>
          <span className="mx-1 h-4 w-px bg-rule" aria-hidden="true" />
          {note.tags.map((t) => (
            <span
              key={t}
              className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-2 pr-1 pl-2 text-ink-2"
            >
              #{t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                className="inline-flex size-4 items-center justify-center rounded-full hover:bg-rule"
                onClick={() =>
                  researchActions.updateNote(note.id, {
                    tags: note.tags.filter((x) => x !== t),
                  })
                }
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            aria-label="Add tag"
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault()
                addTag()
              }
            }}
            onBlur={addTag}
            placeholder="+ tag"
            className="h-6 w-20 rounded-full bg-transparent px-2 text-ink-2 outline-none placeholder:text-ink-3 focus:bg-surface-2"
          />
          <Select
            aria-label="Collection"
            value={note.collectionId ?? ""}
            onChange={(e) =>
              researchActions.updateNote(note.id, {
                collectionId: e.target.value || null,
              })
            }
            className="ml-auto w-40"
          >
            <option value="">No collection</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-3">
          {mode === "write" ? (
            <>
              <label htmlFor="note-body" className="sr-only">
                Note
              </label>
              <Textarea
                id="note-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={18}
                placeholder={
                  "Write your research. Markdown works: # headings, - lists, **bold**, [links](https://…), | tables |"
                }
                className="doc min-h-[40svh] border-0 bg-transparent px-0 text-[0.9375rem] leading-7 focus-visible:outline-none"
              />
            </>
          ) : body.trim() ? (
            <Markdown source={body} className="doc" />
          ) : (
            <p className="text-ink-3">Nothing written yet.</p>
          )}
        </div>

        <section
          className="mt-6 border-t border-rule pt-3"
          aria-labelledby="note-links"
        >
          <h3 id="note-links" className="eyebrow mb-1.5">
            Links
          </h3>
          <ul className="space-y-1 text-[0.8125rem]">
            {note.links.map((l, i) => (
              <li key={`${l.url}-${i}`} className="flex items-center gap-2">
                <Link2
                  className="size-3.5 shrink-0 text-ink-3"
                  aria-hidden="true"
                />
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="truncate text-accent hover:underline"
                >
                  {l.title || l.url}
                </a>
                <button
                  type="button"
                  aria-label={`Remove link ${l.url}`}
                  className="ml-auto text-ink-3 hover:text-ink"
                  onClick={() =>
                    researchActions.updateNote(note.id, {
                      links: note.links.filter((_, j) => j !== i),
                    })
                  }
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addLink()
            }}
            className="mt-2 flex gap-2"
          >
            <Input
              aria-label="Add a link"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
              className="h-8"
            />
            <Button size="sm" type="submit">
              Add
            </Button>
          </form>
        </section>
      </div>
    </article>
  )
}

export default function ResearchPage() {
  usePageTitle("Research")
  const [params, setParams] = useSearchParams()
  const { notes, collections } = useResearch()
  const now = useNow(60_000)
  const [query, setQuery] = useState("")
  const [creatingCollection, setCreatingCollection] = useState(false)
  const selectedId = params.get("note")
  const collection = params.get("c")
  const tag = params.get("tag")
  const kind = params.get("kind")

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const tags = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of notes) for (const t of n.tags) m.set(t, (m.get(t) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [notes])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      notes
        .filter(
          (n) =>
            (!collection || n.collectionId === collection) &&
            (!tag || n.tags.includes(tag)) &&
            (!kind || n.kind === kind)
        )
        .filter(
          (n) =>
            !q ||
            n.title.toLowerCase().includes(q) ||
            n.body.toLowerCase().includes(q) ||
            n.tags.some((t) => t.includes(q))
        )
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt
        ),
    [notes, collection, tag, kind, q]
  )
  const selected = notes.find((n) => n.id === selectedId) ?? null

  const newNote = () => {
    const n = researchActions.createNote({
      collectionId: collection,
      tags: tag ? [tag] : [],
    })
    setParam({ note: n.id })
  }

  return (
    <Page className="flex flex-col">
      <PageHeader
        title="Research"
        description="Notes, saved articles and comparisons, linked to assets and organised by collection and tag. Stored in this browser."
        actions={
          <>
            <Button size="sm" onClick={() => setCreatingCollection(true)}>
              <FolderPlus aria-hidden="true" /> Collection
            </Button>
            <Button size="sm" variant="primary" onClick={newNote}>
              <FilePlus2 aria-hidden="true" /> New note
            </Button>
          </>
        }
      />

      {notes.length === 0 ? (
        <EmptyState
          title="No research yet"
          action={
            <>
              <Button variant="primary" size="sm" onClick={newNote}>
                Write a note
              </Button>
              <Button size="sm" asChild>
                <Link to="/news">Save an article from News</Link>
              </Button>
            </>
          }
        >
          Keep notes about assets, narratives and ideas. Save news articles and
          comparisons here, tag them, and find them again from anywhere with
          search.
        </EmptyState>
      ) : (
        <div className="grid min-h-[70svh] overflow-hidden rounded-md border border-rule bg-surface lg:grid-cols-[200px_320px_minmax(0,1fr)]">
          <nav
            aria-label="Research filters"
            className={cn(
              "border-b border-rule p-2 text-[0.8125rem] lg:border-r lg:border-b-0",
              selected && "hidden lg:block"
            )}
          >
            <ul className="space-y-0.5">
              {[
                {
                  label: "All notes",
                  active: !collection && !tag && !kind,
                  on: () => setParam({ c: null, tag: null, kind: null }),
                  count: notes.length,
                },
                {
                  label: "Saved articles",
                  active: kind === "article",
                  on: () => setParam({ kind: "article", c: null, tag: null }),
                  count: notes.filter((n) => n.kind === "article").length,
                },
                {
                  label: "Comparisons",
                  active: kind === "comparison",
                  on: () =>
                    setParam({ kind: "comparison", c: null, tag: null }),
                  count: notes.filter((n) => n.kind === "comparison").length,
                },
              ].map((f) => (
                <li key={f.label}>
                  <button
                    type="button"
                    aria-pressed={f.active}
                    onClick={f.on}
                    className={cn(
                      "flex w-full items-center rounded px-2 py-1 text-left",
                      f.active
                        ? "bg-surface-2 text-ink"
                        : "text-ink-2 hover:bg-surface-2/60"
                    )}
                  >
                    <span className="flex-1">{f.label}</span>
                    <span className="num text-xs text-ink-3">{f.count}</span>
                  </button>
                </li>
              ))}
            </ul>
            {collections.length > 0 && (
              <p className="eyebrow mt-3 mb-1 px-2">Collections</p>
            )}
            <ul className="space-y-0.5">
              {collections.map((c) => (
                <li key={c.id} className="group flex items-center">
                  <button
                    type="button"
                    aria-pressed={collection === c.id}
                    onClick={() => setParam({ c: c.id, tag: null, kind: null })}
                    className={cn(
                      "flex flex-1 items-center rounded px-2 py-1 text-left",
                      collection === c.id
                        ? "bg-surface-2 text-ink"
                        : "text-ink-2 hover:bg-surface-2/60"
                    )}
                  >
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="num text-xs text-ink-3">
                      {notes.filter((n) => n.collectionId === c.id).length}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete collection ${c.name} (notes are kept)`}
                    className="ml-0.5 rounded p-1 text-ink-3 opacity-0 group-hover:opacity-100 hover:text-ink focus:opacity-100"
                    onClick={() => {
                      researchActions.removeCollection(c.id)
                      if (collection === c.id) setParam({ c: null })
                    }}
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {tags.length > 0 && <p className="eyebrow mt-3 mb-1 px-2">Tags</p>}
            <div className="flex flex-wrap gap-1 px-1">
              {tags.slice(0, 30).map(([t, n]) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tag === t}
                  onClick={() =>
                    setParam({ tag: tag === t ? null : t, c: null, kind: null })
                  }
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    tag === t
                      ? "bg-accent text-accent-ink"
                      : "bg-surface-2 text-ink-2 hover:text-ink"
                  )}
                >
                  #{t} <span className="num opacity-70">{n}</span>
                </button>
              ))}
            </div>
          </nav>

          <div
            className={cn(
              "flex min-h-0 flex-col border-b border-rule lg:border-r lg:border-b-0",
              selected && "hidden lg:flex"
            )}
          >
            <div className="relative border-b border-rule p-2">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-3"
                aria-hidden="true"
              />
              <Input
                type="search"
                aria-label="Search research"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes"
                className="h-8 pl-8"
              />
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Notes">
              {filtered.length === 0 && (
                <li className="p-4 text-[0.8125rem] text-ink-3">
                  No notes match.
                </li>
              )}
              {filtered.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => setParam({ note: n.id })}
                    aria-current={n.id === selectedId ? "true" : undefined}
                    className={cn(
                      "block w-full border-b border-rule px-3 py-2 text-left",
                      n.id === selectedId
                        ? "bg-accent-soft"
                        : "hover:bg-surface-2/60"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {n.pinned && (
                        <Pin
                          className="size-3 text-accent"
                          aria-label="Pinned"
                        />
                      )}
                      {n.kind !== "note" && (
                        <BookOpenText
                          className="size-3 text-ink-3"
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate text-[0.8125rem] font-medium text-ink">
                        {n.title || "Untitled note"}
                      </span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-ink-3">
                      {plainText(n.body).slice(0, 160) || "Empty"}
                    </span>
                    <span className="mt-0.5 block text-[0.6875rem] text-ink-3">
                      {formatAge(n.updatedAt, now)}
                      {n.tags.length
                        ? ` · ${n.tags.map((t) => `#${t}`).join(" ")}`
                        : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={cn("min-h-0", !selected && "hidden lg:block")}>
            {selected ? (
              <NoteEditor
                key={selected.id}
                note={selected}
                onBack={() => setParam({ note: null })}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-[0.8125rem] text-ink-3">
                Select a note or create a new one.
              </div>
            )}
          </div>
        </div>
      )}

      <NameDialog
        open={creatingCollection}
        onOpenChange={setCreatingCollection}
        title="New collection"
        description="Group notes by theme, sector or project."
        onSubmit={(name) => {
          const c = researchActions.createCollection(name)
          setParam({ c: c.id, tag: null, kind: null })
        }}
      />
    </Page>
  )
}
