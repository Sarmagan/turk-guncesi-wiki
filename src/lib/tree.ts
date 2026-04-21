import { getCollection, type CollectionEntry } from "astro:content";
import {
  CATEGORIES,
  CATEGORY_DISPLAY,
  type CategorySlug,
} from "../content.config";

export type WikiEntry = CollectionEntry<"wiki">;

/**
 * A node in the wiki tree. Some nodes are backed by an actual Markdown
 * entry (`entry !== undefined`); some are purely structural
 * (e.g. the root wiki node, or an intermediate folder that has no
 * article of its own).
 */
export interface WikiNode {
  /** Full path ID, e.g. "turk-tarihi/osmanli/ikinci-mehmed". Root is "". */
  id: string;
  /** Final path segment, e.g. "ikinci-mehmed". Root is "". */
  segment: string;
  /** Display title. Falls back to a humanised segment when no entry exists. */
  title: string;
  /** The content entry rendered at this path, if any. */
  entry?: WikiEntry;
  /** Parent node id. Root has parent = null. */
  parent: string | null;
  /** Depth in the tree. Root = 0, top-level category = 1, etc. */
  depth: number;
  /** Top-level category slug this node lives under (null only for root). */
  category: CategorySlug | null;
  /** Child node IDs, sorted alphabetically by title. */
  children: string[];
}

export interface WikiTree {
  /** All nodes, keyed by id. Includes the synthetic root with id "". */
  byId: Map<string, WikiNode>;
  /** Top-level category node IDs, in CATEGORIES order. */
  categoryIds: CategorySlug[];
  /** Every article entry in canonical order. */
  entries: WikiEntry[];
}

function humaniseSegment(seg: string): string {
  return seg
    .split("-")
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * Build the full wiki tree by scanning the `wiki` collection. Every
 * entry's id is a slash-separated path, e.g. `turk-tarihi/osmanli`.
 *
 * The tree we produce contains a node for every entry plus synthetic
 * nodes for any missing ancestors (shouldn't happen with the current
 * dataset, but handled defensively) and a single root node with id "".
 */
export async function buildWikiTree(): Promise<WikiTree> {
  const raw = await getCollection("wiki", (e) => !e.data.draft);

  const byId = new Map<string, WikiNode>();

  const ensureNode = (id: string): WikiNode => {
    const existing = byId.get(id);
    if (existing) return existing;

    const parts = id === "" ? [] : id.split("/");
    const segment = parts.length === 0 ? "" : parts[parts.length - 1];
    const parent =
      parts.length === 0
        ? null
        : parts.length === 1
          ? ""
          : parts.slice(0, -1).join("/");
    const category = (parts[0] ?? null) as CategorySlug | null;

    const node: WikiNode = {
      id,
      segment,
      title: segment === "" ? "Wiki" : humaniseSegment(segment),
      parent,
      depth: parts.length,
      category,
      children: [],
    };
    byId.set(id, node);
    return node;
  };

  ensureNode("");
  for (const cat of CATEGORIES) {
    const node = ensureNode(cat);
    node.title = CATEGORY_DISPLAY[cat];
  }

  for (const entry of raw) {
    const node = ensureNode(entry.id);
    node.entry = entry;
    node.title = entry.data.title;

    if (node.parent === null && entry.id !== "") {
      node.parent = "";
    }
  }

  for (const node of byId.values()) {
    if (node.parent !== null) {
      ensureNode(node.parent).children.push(node.id);
    }
  }

  const sortChildren = (ids: string[]) => {
    ids.sort((a, b) => {
      const na = byId.get(a)!.title;
      const nb = byId.get(b)!.title;
      return na.localeCompare(nb, "tr");
    });
  };
  for (const node of byId.values()) sortChildren(node.children);

  const root = byId.get("")!;
  const categoryIds = [...CATEGORIES].filter((c) => byId.has(c));

  root.children = [...categoryIds];

  const entries = raw
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id, "tr"));

  return { byId, categoryIds, entries };
}

/**
 * All descendant article nodes (transitively) under `id`, including the
 * node itself if it has an entry.
 */
export function descendantsOf(
  tree: WikiTree,
  id: string,
  includeSelf = false
): WikiNode[] {
  const out: WikiNode[] = [];
  const stack: string[] = includeSelf ? [id] : [...(tree.byId.get(id)?.children ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    const node = tree.byId.get(cur);
    if (!node) continue;
    if (node.entry) out.push(node);
    stack.push(...node.children);
  }
  out.sort((a, b) => a.id.localeCompare(b.id, "tr"));
  return out;
}

/**
 * Sibling navigation (prev/next) for a node: its siblings under the same
 * parent, in display order.
 */
export function siblingsOf(
  tree: WikiTree,
  id: string
): { prev: WikiNode | null; next: WikiNode | null } {
  const node = tree.byId.get(id);
  if (!node || node.parent === null) return { prev: null, next: null };
  const parent = tree.byId.get(node.parent);
  if (!parent) return { prev: null, next: null };
  const idx = parent.children.indexOf(id);
  const prev = idx > 0 ? tree.byId.get(parent.children[idx - 1]) ?? null : null;
  const next =
    idx >= 0 && idx < parent.children.length - 1
      ? tree.byId.get(parent.children[idx + 1]) ?? null
      : null;
  return { prev, next };
}

/** Ancestor chain from the root down to (but not including) the node itself. */
export function ancestorsOf(tree: WikiTree, id: string): WikiNode[] {
  const out: WikiNode[] = [];
  let cur = tree.byId.get(id);
  while (cur && cur.parent !== null) {
    const p = tree.byId.get(cur.parent);
    if (!p) break;
    out.unshift(p);
    cur = p;
  }
  return out;
}

/** Full directory listing (former `/wiki/`). */
export const DIZIN_PATH = "/dizin/";

/**
 * Public URL for a wiki node. Articles live at `/{category}/…` with no `/wiki/`
 * prefix; the synthetic tree root maps to {@link DIZIN_PATH}.
 */
export function urlFor(id: string): string {
  if (id === "") return DIZIN_PATH;
  return `/${id}/`;
}

/** True when the pathname is the directory page or any article/category URL. */
export function isWikiBrowsePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/dizin") return true;
  if (normalized.startsWith("/dizin/")) return true;
  for (const c of CATEGORIES) {
    const base = `/${c}`;
    if (normalized === base || normalized.startsWith(`${base}/`)) return true;
  }
  return false;
}

/** First segment in wiki breadcrumb trails (site home). */
export const wikiHomeCrumb = { href: "/", label: "Ana Sayfa" } as const;

/**
 * Resolve a node id to the canonical article id when `canonicalEntryId` is set
 * on the entry (possibly chained). Structural nodes without an entry return
 * unchanged.
 */
export function resolveCanonicalEntryId(
  entryByNodeId: Map<string, WikiEntry>,
  nodeId: string
): string {
  const seen = new Set<string>();
  let cur = nodeId;
  while (true) {
    if (seen.has(cur)) {
      throw new Error(`canonicalEntryId cycle involving "${nodeId}"`);
    }
    seen.add(cur);
    const e = entryByNodeId.get(cur);
    const next = e?.data.canonicalEntryId;
    if (!next) return cur;
    if (!entryByNodeId.has(next)) {
      throw new Error(
        `canonicalEntryId "${next}" has no matching entry (from "${nodeId}")`
      );
    }
    cur = next;
  }
}

export function resolveCanonicalNodeId(tree: WikiTree, nodeId: string): string {
  const entryByNodeId = new Map<string, WikiEntry>();
  for (const n of tree.byId.values()) {
    if (n.entry) entryByNodeId.set(n.id, n.entry);
  }
  return resolveCanonicalEntryId(entryByNodeId, nodeId);
}

/** Validate every declared alias chain (call once per build). */
export function assertValidCanonicalAliases(tree: WikiTree): void {
  for (const n of tree.byId.values()) {
    if (!n.entry?.data.canonicalEntryId) continue;
    const target = resolveCanonicalNodeId(tree, n.id);
    if (target === n.id) {
      throw new Error(
        `Entry "${n.id}" has canonicalEntryId that resolves to itself — pick another primary file`
      );
    }
  }
}
