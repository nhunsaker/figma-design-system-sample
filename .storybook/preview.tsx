import type { Preview } from '@storybook/react-vite'
import { DesignSystem } from '../src/components/DesignSystem'
import './storybook.css'

/**
 * Every story renders inside DesignSystem, the same root the application uses. A story that
 * looked right in a canvas the application does not have is a story that proved nothing.
 *
 * The brand is a toolbar control rather than a build flag, because one bundle carries every
 * brand and the class picks one. A designer switching Harbor to Ember here is doing exactly what
 * a running page does.
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
    (Story, context) => (
      <DesignSystem brand={context.globals.brand as 'harbor' | 'ember'}>
        <Story />
      </DesignSystem>
    ),
  ],
  parameters: {
    a11y: { test: 'error' },
    layout: 'centered',
  },
}

export default preview
