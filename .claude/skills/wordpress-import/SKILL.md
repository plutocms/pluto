# WordPress import

`@plutocms/wordpress` (`packages/tools/wordpress`) is a Node CLI. It imports the Elementor landing
pages of a WordPress site into a Pluto Git CMS project. Each page becomes `content/pages/<path>.md`
with a body of `@plutocms/blocks` blocks (see the blocks-kit skill, "MDC rules for an importer"). It
also imports the WordPress menus (`content/menus/<handle>.md`) and the Elementor footer
(`content/areas/footer.md`). See "Menus", "The footer area" and "The header" below.
The bin is `pluto-wordpress`. It is plain TypeScript, built with tsdown, with no Nuxt. It is not a
layer.

The goal is the same look, not a pixel copy. Arbitrary values round to the scale of the kit. The
report lists each change.

```text
pluto-wordpress import <file.xml|page.json> [--out <dir>] [--dry-run] [--no-media] [--force]
```

## Files

- `src/cli.ts`: `main(argv)`. Reads the options with `node:util` `parseArgs` and prints the summary.
- `src/import.ts`: `runImport(options)`. The whole pipeline (the order is below).
- `src/wxr.ts`: `readWxr(xml)`. Uses `fast-xml-parser`. Gives the posts with their meta.
- `src/php.ts`: `unserialize(text)`. A PHP unserialize for the kit settings.
- `src/theme.ts`: `kitFromPost`, `isKit`, `readSettings`, `themeSnippet`, `cleanTheme`.
- `src/convert.ts`: `convertElements(ctx, elements)`. The layout: containers, legacy sections and
  columns.
- `src/widgets.ts`: `widgetNodes(ctx, element)`. One handler for each widget.
- `src/values.ts`: colors, the scale, lengths, links, images, fonts. Every rounding goes through
  `snapSpace`, `snapFontSize`, `radiusOf` or `shadowOf`.
- `src/icons.ts`: `mapIcon` (Font Awesome to Lucide) and `networkOf` (social networks).
- `src/html.ts`: `htmlToMarkdown`, `htmlToInline`, `escapeInline`, `stripTags`. Uses `turndown`.
- `src/mdc.ts`: `serializeBlocks(nodes)`. Writes the MDC and counts the colons.
- `src/media.ts`: `importMedia(images, options)`. Downloads the images and writes the files.
- `src/pages.ts`: paths, description, publish date, `rewriteMedia`.
- `src/menus.ts`: `readMenus(wxr, paths, imported, headerMenu)` (the menu trees and the `main` choice) and
  `menuNodes(tree)` (the `menu-item` blocks).
- `src/templates.ts`: `templateKind(post)` (header or footer), `widgetCounts`, `navMenuOf` (the header and
  footer templates).
- `src/files.ts`: the frontmatter file format (the same as the Git CMS, with the `yaml` package).
- `src/report.ts`: `buildReport(input)`. The text of `pluto-import-report.md`.
- `src/types.ts`: `BlockNode`, `ConvertContext`, `PageReport`, `Kit`.
- Tests in `test/`: synthetic files only (`fixtures.ts`), no network. `output.test.ts` parses the
  generated pages with `parseBlocks` of core and checks the names and the props against the
  `Block*.vue` files of the blocks layer.

## The pipeline

1. **Read the input.** A file that starts with `{` is an Elementor page JSON (`{ content, title,
type }`). Any other file is a WXR.
2. **WXR.**
   - The kit is the `elementor_library` post with `_elementor_template_type = kit`. Its
     `_elementor_page_settings` is PHP-serialized.
   - A `page` post with `_elementor_data` is imported. A trashed or auto-draft page is skipped.
   - The footer becomes the footer area, the header goes in the report, and the `nav_menu` terms and
     `nav_menu_item` posts become menus (see below). `fast-xml-parser` reads the attributes of
     `<category domain="nav_menu" nicename>`, which say the menu of an item.
   - Saved templates, other footers, Elementor posts of other types, and pages that are not built
     with Elementor are listed in the report, not imported.
   - An `attachment` gives the URL and the alt text of an image by its id.
3. **Paths.** The slug of the page, with the slugs of its parents (`about/team`). The front page
   (`wp:page_on_front` of the channel, else the page with the slug `home`) is `home`. A second page
   with the same path gets `-<id>`.
4. **Decide.** For each page, before it is converted: a file with the same `wordpress.id` is
   skipped, a file that is not from this page is a conflict (not written), unless `--force`.
5. **Convert** each page that will be written, into block nodes, with a report for the page.
6. **Media.** The images of the pages that will be written, unless `--no-media` or `--dry-run`.
7. **Menus and footer.** Decide and convert the same way: a file with the same `wordpress.id` is
   skipped, another file is a conflict, unless `--force`. The footer images join the media step.
8. **Write** the pages, the footer, the menus, `pluto-import/theme.json` (when the file has a kit) and
   the report.

`--dry-run` converts and reports, and writes nothing. It downloads nothing. It prints the plan, the
report and the theme snippet.

## The page file

```md
---
title: Home
status: published
description: The home page.
publishedAt: 2024-01-25T13:34:11.000Z
wordpress:
  id: 277
  link: https://old-site.example/
---

:::::block-section{...}
```

- `status`: `publish` is `published`. Any other status (draft, pending, private, future) is
  `draft`. An Elementor page JSON has no status, so it is `draft`.
- `layout: full`: every imported page has no title and uses the full width (the page type field `layout`).
- `description`: the SEO plugin meta (Yoast, Rank Math, All in One SEO), else the excerpt.
- `publishedAt`: the GMT date, for a published page.
- No `slug`: the path of the file is the id (see the git-cms skill, "The page type").

## Mapping

### Layout

| Elementor                                                                                                | Block                                                      |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| top-level `container` or `section`                                                                       | `block-section`                                            |
| a row (`flex_direction` row) with more than one child                                                    | `block-columns`, one `block-column` for each child         |
| a column-direction container                                                                             | its widgets, directly in the parent                        |
| a column-direction container with a background, a shadow, a radius, a border or padding of 12 px or more | `block-columns` with one `block-column` that has the style |
| a legacy `section` with more than one `column`                                                           | `block-columns`, one `block-column` for each column        |
| a legacy `section` with one column                                                                       | the widgets of the column, directly in the parent          |
| an inner `section` in a column                                                                           | `block-columns` in the column                              |
| a widget at the top level                                                                                | a `block-section` with `padding="none"` that holds it      |

Section props: `anchor` (`_element_id`), `bg`, `image`, `overlay`, `overlay-opacity`, `padding`
(the vertical padding), `min-height`, `width` (`full` for `content_width: full` or a full width
layout), `max-width` (a boxed width other than 1140 px), `align` and `valign`. A top-level section with no `bg` and no `image` gets `bg="background"`: the Elementor page sits on the body background of the kit. A section with no
padding gets `padding="none"`, because the default of the block is `lg`.

- **Background.** `classic` gives `bg` and `image`. A gradient keeps its first color (a note in the
  report). An overlay image with no background image becomes the section image, and the background
  color becomes the overlay (`overlay-opacity` is `100 - opacity * 100`). An overlay color over an
  image gives `overlay` and `overlay-opacity`.
- **Section text color.** When every heading, text and counter that sets a color sets the same one, and the section has a dark background (relative luminance below 0.4), or an image whose overlay is dark or missing, the color moves to the section (`color`) and leaves the blocks. A placeholder then inherits it (`src/section-color.ts`).
- **Row props.** `gap` (`flex_gap`), `valign` (`flex_align_items`), `wrap` false when `flex_wrap` is
  `nowrap`, `stack="never"` when `flex_direction_mobile` is `row`. Columns stack by default.
- **Column props.** `width` (`width`, in percent, or px; legacy: `_inline_size`, else
  `_column_size`), `padding`, `bg`, `radius`, `shadow`, `align`, `valign`. A column background image
  is not kept (a count in the report).
- **Alignment.** `flex_align_items` of a column-direction container gives `align`. Its
  `flex_justify_content` gives `valign`. Legacy: `content_position` gives `valign`.
- **Legacy gap.** `gap` names (`no`, `narrow`, `default`, `extended`, `wide`, `wider`) are 0, 10, 20,
  30, 40 and 60 px between columns, rounded to the scale.
- **Hidden.** An element with `hide_desktop` is skipped (counted in the report).

### Widgets

| Elementor                  | Block                           | Notes                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heading`                  | `block-heading`                 | `level` from `header_size` (default `h2`), `align`, `color`, `size`. `div`, `span` and `p` give a `block-text`. The title is inline Markdown. A `link` wraps the text.                                                                                   |
| `text-editor`              | `block-text`                    | HTML to Markdown. A table or an embed stays as HTML. `size`, `align`, `color`.                                                                                                                                                                           |
| `image`                    | `block-image`                   | `src`, `alt`, `caption`, `width` (else the pixel width of `image_size`: thumbnail 150, medium 300, medium_large 768, large 1024, custom from its dimension, full none), `radius`, `align`, `link`. The placeholder image and an empty image are skipped. |
| `button`                   | `block-button`                  | `label`, `link`, `target`, `size`, `align` (`justify` gives `full`), `color`, `icon`. A border with no fill gives `variant="outline"`.                                                                                                                   |
| `icon`                     | `block-icon`                    | `icon`, `size`, `color`, `align`, `link`. The default size is 50 px.                                                                                                                                                                                     |
| `icon-list`                | `block-icon-list` + items       | The most common icon is the icon of the list. An item keeps its own icon when it differs. `view: inline` gives `layout="inline"`.                                                                                                                        |
| `icon-box`                 | `block-icon-box`                | `title`, `level` (default 3), `position`, `align`, `color`. The description is the rich slot.                                                                                                                                                            |
| `image-box`                | `block-image-box`               | `src`, `alt` (else the title), `title`, `level`, `position`, `radius`.                                                                                                                                                                                   |
| `accordion`                | `block-accordion` + items       | `single` (one open item).                                                                                                                                                                                                                                |
| `toggle`                   | `block-accordion` + items       | Many items can be open.                                                                                                                                                                                                                                  |
| `testimonial`              | `block-testimonial`             | `name`, `role`, `image`, `align` (`center`).                                                                                                                                                                                                             |
| `counter`                  | `block-counter`                 | `value` is `ending_number` (a thousands separator is removed), `prefix`, `suffix`, `title`. A value that is not a number gives a placeholder.                                                                                                            |
| `social-icons`             | `block-social-icons` + links    | The network comes from the icon class. A network that the kit has not gives `network="website"`, the default icon, and a report line.                                                                                                                    |
| `image-gallery`, `gallery` | `block-gallery` + `block-image` | `columns` (1 to 6).                                                                                                                                                                                                                                      |
| `video`                    | `block-video`                   | `url`, `ratio`. Only YouTube and Vimeo embed. Another source renders as a link (a note).                                                                                                                                                                 |
| `divider`                  | `block-divider`                 | `line`, `color`, `thickness`, `width`, `align`, `spacing`.                                                                                                                                                                                               |
| `spacer`                   | `block-spacer`                  | `size` is the exact length in px (the block takes a length, so there is no rounding). The default is 50 px.                                                                                                                                              |
| `html`                     | raw HTML                        | Blank lines inside are removed, so the HTML stays one block. `<style>` and `<script>` blocks are dropped (report note: CSS/JS from an HTML widget was not imported). The renderer removes iframes and forms (a report line).                             |
| `shortcode`                | a placeholder `block-text`      | `Not imported: the shortcode ...`. A report line.                                                                                                                                                                                                        |
| `navigation-menu`, `nav-menu` | `block-icon-list` + items    | The `menu` setting is the slug of a menu in the export. The list has the top-level items as links, with the icon `i-lucide-chevron-right`. Sub-items are left out (a note). A menu that is not in the export gives a placeholder, like any unknown widget. |
| `site-logo`, `theme-site-logo` | `block-image`               | The image of `custom_image`, else the logo attachment of the export (`_wp_attachment_context` `custom-logo`), else a `block-heading` with the site title (a note). It links to `/`. |
| `site-title`, `theme-site-title` | `block-heading`           | The title of the WXR channel. `level` from `header_size` (default 2). |
| `copyright`                | `block-text`                    | The Header Footer Elementor widget. `[hfe_current_year]` and `[hfe_site_title]` are filled in. Another shortcode stays and is reported. |
| `menu-anchor`              | nothing                         | Counted as an unknown widget.                                                                                                                                                                                                                            |
| any other widget           | a placeholder `block-text`      | `Not imported: the Elementor widget "name"`. Pro widgets and add-on widgets too. A report line.                                                                                                                                                          |

A shortcode in the text of a `text-editor` stays in the text, and the report lists it.

## Menus

The targets are in core (see the content-model skill, "Menus and areas"): `content/menus/<handle>.md`
with the frontmatter `title` and `wordpress: { id }` (the id of the `nav_menu` term), and a body of
`menu-item` blocks only (`label`, `link`, `target`). A child item is inside its parent. The colons are
counted by `serializeBlocks`.

- **Read.** The menu of an item is its `<category domain="nav_menu">`. Items sort by `menu_order`, then id.
  `_menu_item_menu_item_parent` nests. A menu with no item is not imported.
- **Label.** The item title, else the title of the linked page, post or term. An item with no label is
  dropped (a report line). Its children move up.
- **Link.**
  - `post_type` + `page`: the importer path of the page (`home` is `/`, a child is `about/team`). A page
    that is in the export but not imported (it is not built with Elementor) still gets its path, and a
    report line says the link leads nowhere. A page that is not in the export: no link, a report line.
  - `post_type` + `post`: `/posts/<slug>`, the post route of the blog template. The importer does not
    import posts, so the report says so.
  - `custom`: the URL, as a path when it points to the site of the export (`localUrl`). `#` or empty: no link.
  - `taxonomy`: Pluto has no page for an archive. The label is the term name. The URL stays when the export
    has one (it usually has not). Always a report line.
  - `target` is `_blank` when `_menu_item_target` is.
- **The handle.** WordPress keeps the theme locations outside the export, so a heuristic picks `main`:
  the first menu whose slug or name has `primary`, `main`, `header` or `menu-1` (in that order of words),
  else the menu of the navigation widget of the header (its `menu` setting), else the largest menu. A
  menu with no item cannot be `main`. The other menus keep the slugified name (a clash gets `-2`). The
  report says the choice and its reason, and, when the header widget uses another menu, how to swap the
  files.

## The footer area

`content/areas/footer.md`, frontmatter `title: Footer` and `wordpress: { id }` (the id of the template post).

- **Find.** An `elementor-hf` post with `ehf_template_type` that has `footer` (but not `before`; with no type,
  the title decides), or an `elementor_library` post with `_elementor_template_type: footer`. The first
  one with readable `_elementor_data` wins. The others go in the "Not imported" list.
- **Convert.** `convertElements`, the same as a page, with `ctx.site` set (the site title, the logo, the year
  from `now`, and the menus by slug and by name). The page converter gets `ctx.site` too, so a navigation
  widget in a page works the same.
- **Navigation menu.** A `block-icon-list` with the top-level items. The kit has no navigation block. An
  icon list has links, a vertical or an inline layout and no bullet that must be a check (the icon is
  `i-lucide-chevron-right`). A list copies the menu at import time. The other choice, a placeholder, loses
  the links and gains nothing.

## The header

Not imported: a header layout is the job of the template. The report has a "Header" section: the menu of
its navigation widget (and the handle it has now), and the count of its widgets by type. The header can be
an `elementor-hf` post or a theme builder template.

### Icons

`mapIcon` reads a Font Awesome class (`fas fa-star`, `fab fa-facebook-f`, `fa-solid fa-star`) and
gives `i-lucide-<name>` from a table of about 250 common names (`src/icons.ts`). A test checks that
every target exists in the Lucide icon set. An unknown name, or an uploaded SVG icon, gives
`i-lucide-circle` and a line in the report.

## Values

- **Colors.** A `__globals__` reference (`globals/colors?id=primary`, or the variable
  `var(--e-global-color-primary)`) to one of `primary`, `secondary`, `text`, `accent` becomes the
  token. A reference to a custom color becomes its hex, from the kit. A literal color stays exact
  (hex, `rgb()`, `rgba()`, `hsl()`, `hsla()`). Anything else is dropped.
- **Space** (`padding`, `gap`): px, em and rem round to the nearest step of `none` 0, `xs` 8, `sm` 16,
  `md` 24, `lg` 48, `xl` 80 and `2xl` 128 px. A tie goes to the smaller step. A section padding is
  the average of the top and the bottom. A column padding is the average of the four sides. A
  different unit (`%`, `vw`) is not read.
- **Heading size**: px rounds to the nearest of `sm` 18, `md` 24, `lg` 36, `xl` 48, `2xl` 64 and `3xl` 88
  px, or to the default size of the level (h1 60, h2 40, h3 28, h4 20, h5 and h6 16 px). The
  default size needs no `size` prop. A tie goes to the default.
- **Text size**: `sm` 14, the default 16, `lg` 18, `xl` 22 px.
- **Icon size**: `sm` 16, `md` 24, `lg` 32, `xl` 48, `2xl` 72 px.
- **Radius**: `none` 0, `sm` 4, `md` 8, `lg` 16, `xl` 24 px. 100 px or more, or 40 % or more, is
  `full`.
- **Shadow**: the blur of `box_shadow_box_shadow` gives `sm` (5 px or less), `md` (24 px or less) or
  `lg`.
- **Lengths** (`width`, `min-height`, `max-width`, a spacer) keep their value, because the blocks
  take a length. Only `px`, `rem`, `em`, `%`, `vh`, `vw` and the other units of the kit pass.
- **Links.** A link to a page of the old site (the same origin, not under `wp-content`, `wp-admin`
  or `wp-includes`) becomes a path (`/about`), because the new pages keep their slugs. The same
  rule applies to the links in a text. `mailto:`, `tel:` and `#anchor` stay. An Elementor action
  (`#elementor-action...`) is dropped.
- **Fonts.** A font family that matches the kit heading or body font needs no prop. Another family
  is not kept on a block (a line in the report), but it goes in the list of fonts. Weight, case,
  line height and letter spacing are counted as ignored.
- **Responsive values** (`_tablet`, `_mobile`, `_laptop`, `_widescreen`, `_mobile_extra`,
  `_tablet_extra`, and `hide_tablet`, `hide_mobile`) are dropped, and counted. The exception is
  `flex_direction_mobile`, which sets `stack` of a row.
- **Ignored styles** are counted for each page: margins and widget padding, filters and animations,
  borders, a shadow or a radius on a section, a gap between stacked blocks, the horizontal spacing
  of a row, an icon frame, dynamic values, and a column background image.
- **Text.** The text of a prop is on one line. A double quote in it uses single quotes around the
  value. A slot that starts with `---` gets `***`, and a slot line that starts with `::` gets a
  backslash, so a text cannot open a block. A zero-width space and a non-breaking space are cleaned.

## The theme

`kitFromPost` reads the kit. It gives:

- `colors`: `primary`, `secondary`, `text` and `accent` from `system_colors`, and `background` from `body_background_color` (else `#ffffff`). A custom color is kept
  by its id for the references.
- `fonts.heading`: the family of `system_typography` `primary`. `fonts.body`: `text`, else `secondary`.
  The stack is `"Family", serif` or `"Family", sans-serif` (a short list of serif names decides).
- The list of font families with their weights.

The CLI writes `pluto-import/theme.json` and prints the snippet for `app.config.ts`
(`plutoBlocksTheme`, see the blocks-kit skill). It does not edit `app.config.ts`. A file with no kit
has no theme. The block tokens still work, with the defaults of the blocks layer.

## Media

- Only `http:` and `https:` image URLs are downloaded: the images of the pages that will be written.
  Relative URLs are made absolute with the site URL of the WXR. A remote URL in the Markdown of a
  text is replaced too.
- **Checks.** A timeout of 15 s, a limit of 20 MB (the `content-length` header and the real count of
  bytes), a response `content-type` that starts with `image/`, and the real type from the first
  bytes: JPEG, PNG, WebP, AVIF or GIF. An SVG is refused, because the media library does not allow
  it. An image that fails keeps its remote URL and gets a line in the report.
- **A host that does not answer** (two network errors or timeouts) is skipped for the rest of the
  run.
- **The file and the record** are the same as the GitHub media driver writes (see the media skill):
  `public/media/<yyyy>/<mm>/<slug>-<5 hex>.<ext>` and `content/media/<id>.md` with `name`, `file`,
  `url`, `mimeType`, `size`, `width`, `height`, `alt`, `createdAt`. The five characters are the start
  of the SHA-1 of the source URL, so a name is stable. The id is the file name without the extension.
  The alt text is the alt of the Elementor image, else the alt of the attachment.
- **Re-run.** `pluto-import/media.json` maps a source URL to the id and the URL. An image with an
  entry and an existing record is reused.
- **The value in a page** is the URL path (`/media/2026/11/team-a1b2c.jpg`), which is what a
  `media` prop of a block holds.
- The file is saved as downloaded. The tool does not strip the metadata of an image (core does it
  for an upload in the admin).

## The report

`pluto-import-report.md` (printed in a dry run):

- the counts: pages imported, skipped, not written, and images downloaded, reused, failed;
- for each page: placeholders, unknown widgets, shortcodes, raw HTML widgets, rounded values, dropped
  responsive values, ignored styles, icons with no match, add-on prefixes (`eael_`, `ha_`,
  `premium_`, `uael_`, `jet_`), images with no alt, and notes;
- a "Menus" section (the counts, the `main` menu and why, each menu with its items that have no Pluto
  equivalent), a "Footer area" section (like a page) and a "Header" section;
- what was not imported, grouped: other footers, saved templates, Elementor posts of other types,
  pages that are not built with Elementor;
- the images that were not downloaded, with the reason;
- the theme snippet;
- the Google fonts, with a `@nuxt/fonts` snippet (`families`, `provider: 'google'`, `weights`).

## Not in this version

- Headers, forms, redirects, posts, terms, users.
- A `block-nav` block for the kit: a navigation widget is an icon list until then.
- A page that is not built with Elementor.
- A public URL as the input.
- A Supabase target (it will be an admin wizard that writes through the content adapter).
- Per-breakpoint values.

## Tests

`bun run --cwd packages/tools/wordpress test` runs Vitest: `php`, `wxr`, `theme`, `values`, `icons`,
`widgets`, `layout`, `mdc`, `media` (a fake `fetch`), `writer` (dry run, re-run, `--force`, media,
JSON input), `menus` (the trees, the `main` choice, the footer from both template kinds, the header,
re-runs, the dry run, and `parseBlocks` on every menu and area) and `output` (the generated pages parse with core, and use only the blocks and the props
of the kit). `typecheck` is `tsc --noEmit`. No test uses the network, and no sample site is in the
repo.
