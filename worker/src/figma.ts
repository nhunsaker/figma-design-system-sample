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

export interface FrameRead {
  nodeId: string
  name: string
  pageName: string
  fileKey: string
  fileName: string
  components: string[]
  unknownComponents: string[]
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
  children?: Node[]
}

export class FigmaClient {
  constructor(
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
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
    const unknown = new Set<string>()
    const text: string[] = []

    const visit = (node: Node): void => {
      if (node.type === 'INSTANCE') {
        const key = meta[node.componentId ?? '']?.key ?? ''
        const name = packComponents[key]
        if (name) known.add(name)
        else unknown.add(meta[node.componentId ?? '']?.name ?? node.name ?? 'unnamed')
      }
      if (node.type === 'TEXT' && node.characters) text.push(node.characters)
      for (const child of node.children ?? []) visit(child)
    }
    visit(entry.document)

    return {
      nodeId,
      name: entry.document?.name ?? 'unnamed frame',
      pageName: await this.pageOf(fileKey, nodeId),
      fileKey,
      fileName: data.name ?? '',
      components: [...known].sort(),
      unknownComponents: [...unknown].sort(),
      text,
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
