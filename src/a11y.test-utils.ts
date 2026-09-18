import axe from 'axe-core'

/**
 * Run the accessibility rules that jsdom can actually answer: roles, names, relationships,
 * required attributes. Colour contrast and target size need real layout and real paint, so they
 * are checked in the browser by the Storybook run in continuous integration, not here.
 *
 * The split is deliberate and worth saying out loud. A unit test that claims to check contrast
 * in jsdom is checking nothing, and a green check that looked at nothing is the failure this
 * whole repository is arranged against.
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    resultTypes: ['violations'],
    rules: {
      'color-contrast': { enabled: false },
      'target-size': { enabled: false },
    },
  })
  if (results.violations.length > 0) {
    const detail = results.violations
      .map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.html).join('\n  ')}`)
      .join('\n')
    throw new Error(`accessibility violations\n${detail}`)
  }
}
