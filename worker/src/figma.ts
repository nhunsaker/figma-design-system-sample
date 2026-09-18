/**
 * The Figma side: read a frame, and pin things back onto it.
 *
 * A port of bridge/src/bridge/figma.py, kept in the same shape so the two can be read side by
 * side. The three facts that decide the design are unchanged, because they are facts about
 * Figma rather than about either runtime:
 *
 * REST cannot create or change a node. Not a frame, not a layer, not a text run. So this
 * credential, whatever scopes it carries, cannot damage a designer's file. The worst it can do
 * is leave a link and a comment.
 *
 * REST cannot set a frame's dev status either. Marking a frame completed stays a person's click,
 * which is the right place for it.
 *
 * A frame names components by Figma component key, and the pack names them by code import. The
 * key map joins the two, and what it cannot join is reported as unmapped rather than guessed at.
 */
const API = 'https://api.figma.com'

/** Figma reports fractional sizes. Round, and treat a missing or zero value as unknown. */
const round = (value: number | undefined): number | null =>
  typeof value === 'number' && value > 0 ? Math.round(value) : null

/**
 * A component in the frame that the key map could not place.
 *
 * Carries the size the design gave it, so a placeholder can reserve the same space rather than
 * collapsing the layout around a hole. `null` where Figma did not report one.
 */
export interface UnmappedComponent {
  name: string
  width: number | null
  height: number | null
  radius: number | null
}

export interface FrameRead {
  /**
   * How the frame is arranged, top to bottom, already rendered as markdown list lines.
   *
   * The component list is a SET, sorted, so it says what the frame needs and nothing about where
   * anything sits. An agent handed only that has to invent an arrangement, and it did: it put a
   * placeholder above the figures the design puts it below. The tree is walked in order anyway,
   * so the ordering existed and was being thrown away.
   */
  outline: string[]
  nodeId: string
  name: string
  pageName: string
  fileKey: string
  fileName: string
  components: string[]
  unknownComponents: UnmappedComponent[]
  text: string[]
}

/** The link a person opens. Figma writes 41-207 in a URL and 41:207 in the API. */
export function frameUrl(fileKey: string, nodeId: string): string {
  return `https://www.figma.com/design/${fileKey}/?node-id=${nodeId.replace(':', '-')}`
}

interface Node {
  id?: string
  name?: string
  type?: string
  characters?: string
  componentId?: string
  layoutMode?: string
  cornerRadius?: number
  absoluteBoundingBox?: { width?: number; height?: number }
  children?: Node[]
}

/** A quoted, shortened line of copy. Long strings make an outline unreadable. */
const quoted = (text: string): string => `"${text.length > 60 ? `${text.slice(0, 57)}...` : text}"`

/**
 * The frame's arrangement, in document order, as markdown list lines.
 *
 * Instances are opaque. The walk does not descend into one, mapped or not, because what is inside
 * a component is the component's business and listing it invites an agent to rebuild it.
 *
 * A frame that lays its children out becomes a level and says which way it runs. A frame that does
 * not is transparent: it nests nothing and its children are emitted where it sat, because a
 * grouping with no layout is a drawing convenience rather than structure.
 *
 * Adjacent identical entries collapse to `x N`. Three figures in a row is one fact, not three.
 */
function outlineOf(
  root: Node,
  meta: Record<string, { key?: string; name?: string }>,
  packComponents: Record<string, string>,
  depth = 0,
): string[] {
  if (depth > 3) return []
  const lines: string[] = []
  const pad = '  '.repeat(depth)

  const entries: string[] = []
  const nested: Record<number, string[]> = {}

  for (const child of root.children ?? []) {
    if (child.type === 'TEXT' && child.characters) {
      entries.push(`${pad}- ${quoted(child.characters)}`)
      continue
    }
    if (child.type === 'INSTANCE') {
      const key = meta[child.componentId ?? '']?.key ?? ''
      const mapped = packComponents[key]
      const name = mapped ?? meta[child.componentId ?? '']?.name ?? child.name ?? 'unnamed'
      entries.push(`${pad}- ${mapped ? `\`${name}\`` : `**${name}**`}`)
      continue
    }
    if (child.children?.length) {
      const inner = child.layoutMode === 'HORIZONTAL' || child.layoutMode === 'VERTICAL'
      const label = child.layoutMode === 'HORIZONTAL' ? 'a row of:' : 'a column of:'
      if (inner) {
        entries.push(`${pad}- ${label}`)
        nested[entries.length - 1] = outlineOf(child, meta, packComponents, depth + 1)
      } else {
        // Transparent. A grouping with no layout is a drawing convenience, not structure.
        for (const line of outlineOf(child, meta, packComponents, depth)) entries.push(line)
      }
    }
  }

  // Collapse runs of the same entry. Three of a thing in a row is one fact.
  let index = 0
  while (index < entries.length) {
    let run = 1
    while (
      index + run < entries.length &&
      entries[index + run] === entries[index] &&
      nested[index] === undefined &&
      nested[index + run] === undefined
    ) {
      run += 1
    }
    lines.push(run > 1 ? `${entries[index]} x ${run}` : entries[index])
    for (const line of nested[index] ?? []) lines.push(line)
    index += run
  }
  return lines
}

export class FigmaClient {
  constructor(
    private readonly token: string,
    /**
     * Wrapped, not `= fetch`. Stored as a property and called as `this.fetcher(...)`, the global
     * `fetch` receives this client as its `this`, and workerd refuses that with "Illegal
     * invocation". Node tolerates it, so the whole suite passed and the deployed Worker threw a
     * 500 on the first real webhook. The arrow keeps the call a plain global call.
     */
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { 'X-Figma-Token': this.token, ...extra }
  }

  private async get(path: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(API + path)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    const response = await this.fetcher(url.toString(), { headers: this.headers() })
    if (!response.ok) throw new Error(`Figma GET ${path} -> ${response.status}`)
    return response.json()
  }

  private async post(path: string, payload: unknown): Promise<any> {
    const response = await this.fetcher(API + path, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error(`Figma POST ${path} -> ${response.status}`)
    return response.json()
  }

  /**
   * Read one frame and resolve what it is made of against the pack.
   *
   * `packComponents` maps a Figma component key to a pack component name. A component in the
   * frame that is not in that map goes into `unknownComponents`, because an agent told the wrong
   * component name confidently is worse than one told the truth vaguely.
   */
  async readFrame(
    fileKey: string,
    nodeId: string,
    packComponents: Record<string, string>,
  ): Promise<FrameRead> {
    const data = await this.get(`/v1/files/${fileKey}/nodes`, { ids: nodeId, depth: '8' })
    const entry = data?.nodes?.[nodeId]
    if (!entry) throw new Error(`node ${nodeId} is not in file ${fileKey}`)

    const meta: Record<string, { key?: string; name?: string }> = entry.components ?? {}
    const known = new Set<string>()
    const unknown = new Map<string, UnmappedComponent>()
    const text: string[] = []

    const visit = (node: Node): void => {
      if (node.type === 'INSTANCE') {
        const key = meta[node.componentId ?? '']?.key ?? ''
        const name = packComponents[key]
        if (name) {
          known.add(name)
        } else {
          const missing = meta[node.componentId ?? '']?.name ?? node.name ?? 'unnamed'
          if (!unknown.has(missing)) {
            unknown.set(missing, {
              name: missing,
              width: round(node.absoluteBoundingBox?.width),
              height: round(node.absoluteBoundingBox?.height),
              radius: round(node.cornerRadius),
            })
          }
          // Stop here. Text inside a component that will not be built is copy with nowhere to
          // go, and the issue tells the agent to use the words it is given exactly. Handing it
          // an orphaned caption produced exactly that: a stray line where the component should
          // have been. Text inside a MAPPED instance is still wanted, because that is a
          // button's label.
          return
        }
      }
      if (node.type === 'TEXT' && node.characters) text.push(node.characters)
      for (const child of node.children ?? []) visit(child)
    }
    visit(entry.document)

    const outline = outlineOf(entry.document, meta, packComponents)

    return {
      nodeId,
      name: entry.document?.name ?? 'unnamed frame',
      pageName: await this.pageOf(fileKey, nodeId),
      fileKey,
      fileName: data.name ?? '',
      components: [...known].sort(),
      // Plain codepoint order, matching Python's sorted(). localeCompare would not, and the two
      // runtimes are diffed byte for byte.
      unknownComponents: [...unknown.values()].sort((a, b) =>
        a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
      ),
      text,
      outline,
    }
  }

  /** The page a node sits on. One shallow read, and a miss is not worth failing the request for. */
  private async pageOf(fileKey: string, nodeId: string): Promise<string> {
    try {
      const tree = await this.get(`/v1/files/${fileKey}`, { depth: '2' })
      for (const page of tree?.document?.children ?? []) {
        for (const child of page.children ?? []) {
          if (child.id === nodeId) return page.name ?? ''
        }
      }
    } catch {
      return ''
    }
    return ''
  }

  /**
   * A rendered PNG of the frame, as a temporary URL Figma hosts.
   *
   * The URL expires. The issue carries it anyway, because a reviewer reads the issue within
   * hours and the alternative is this service storing and serving images, which is a different
   * and much larger thing to run.
   */
  async image(fileKey: string, nodeId: string, scale = 2): Promise<string | null> {
    const data = await this.get(`/v1/images/${fileKey}`, {
      ids: nodeId,
      format: 'png',
      scale: String(scale),
    })
    return data?.images?.[nodeId] ?? null
  }

  /** Pin a link to a frame, where it shows in Dev Mode next to the design. */
  async pinDevResource(fileKey: string, nodeId: string, name: string, url: string): Promise<void> {
    await this.post('/v1/dev_resources', {
      dev_resources: [{ name, url, file_key: fileKey, node_id: nodeId }],
    })
  }

  /** Leave a comment attached to a frame. */
  async comment(fileKey: string, nodeId: string, message: string): Promise<void> {
    await this.post(`/v1/files/${fileKey}/comments`, {
      message,
      comment_pin_corner: 'top-left',
      client_meta: { node_id: nodeId, node_offset: { x: 0, y: 0 } },
    })
  }
}
