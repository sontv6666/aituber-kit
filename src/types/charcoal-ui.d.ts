/**
 * Do not augment `KnownIconType` with a string index signature: it widens
 * `keyof KnownIconType` to `string | number` and breaks `<pixiv-icon name={...} />`
 * typings shipped by `@charcoal-ui/icons`.
 */
