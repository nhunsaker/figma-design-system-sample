import type { Preview } from '@storybook/react-vite'
import '../design-system/tokens.harbor.css'
import '../design-system/tokens.ember.css'
import '../design-system/tokens.components.css'
import './storybook.css'

/**
 * The brand is a class on the document, never a build flag. One bundle carries every brand and
 * the class picks one, so switching brand is something a designer does in the toolbar rather
 * than something an engineer does in a pipeline.
 *
 * There is no default brand. A page with no brand class gets no tokens and looks obviously
 * broken, which is the correct outcome: a system with a fallback brand has a brand nobody chose.
 */
const preview: Preview = {
  globalTypes: {
    brand: {
      description: 'Brand',
      defaultValue: 'harbor',
      toolbar: {
        title: 'Brand',
        items: [
          { value: 'harbor', title: 'Harbor' },
          { value: 'ember', title: 'Ember' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      document.documentElement.className = `brand-${context.globals.brand}`
      return Story()
    },
  ],
  parameters: {
    a11y: { test: 'error' },
    layout: 'centered',
  },
}

export default preview
