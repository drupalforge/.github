# Public assets

Everything in this directory is public. Keep confidential files and editable
design sources elsewhere. Prefer SVG for logos; add raster copies only when a
specific consumer needs them.

## Brand

- [Brand guidelines](brand/README.md): name, logo use, color, and typography.
- [Boilerplate](brand/boilerplate.md): approved descriptions and links.
- [Press kit](brand/press-kit.md): key facts, logo downloads, and contacts.

### Logos

| File | Composition |
| --- | --- |
| [`brand/logo/drupalforge-horizontal.svg`](brand/logo/drupalforge-horizontal.svg) | Horizontal logo |
| [`brand/logo/drupalforge-vertical-one-line-text.svg`](brand/logo/drupalforge-vertical-one-line-text.svg) | Vertical logo with one-line text |
| [`brand/logo/drupalforge-vertical-stacked-text.svg`](brand/logo/drupalforge-vertical-stacked-text.svg) | Vertical logo with stacked text |
| [`brand/logo/drupalforge-mark.svg`](brand/logo/drupalforge-mark.svg) | Mark only |

Use the supplied colors and proportions; don't recolor or distort the artwork.
See the [brand guidelines](brand/README.md#logo) for usage rules.

## Organization

Group assets by purpose. Add these directories when they have content:

- `social/` for social preview and share graphics.
- `icons/` for reusable organization-wide icons.
- `docs/` for screenshots and diagrams shared by organization documentation.

GitHub workflow-template icons must stay alongside their templates in
`workflow-templates/`.

## Referencing assets

For use in other repositories, use the raw URL on the `main` branch, for
example:

```text
https://raw.githubusercontent.com/drupalforge/.github/main/assets/brand/logo/drupalforge-horizontal.svg
```

Treat paths as public interfaces: before renaming or removing an asset, find and
update its references in consumer repositories.
