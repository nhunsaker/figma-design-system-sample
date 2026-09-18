/** Vite's ?raw import, used to diff against contract/golden/ without a loader of our own. */
declare module '*?raw' {
  const content: string
  export default content
}
