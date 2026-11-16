# @plutocms/wordpress

A command line tool for [Pluto](https://pluto.vulmix.dev). It imports the Elementor landing pages, the menus and the footer of a
WordPress site into a Pluto Git CMS project. Each page becomes a Pluto page that is made of the
blocks of [`@plutocms/blocks`](../../layers/addons/blocks/README.md).

Version 1 does these things:

- It reads a WordPress export (a WXR file) or one Elementor page JSON.
- It turns each Elementor page into `content/pages/<path>.md`.
- It turns each WordPress menu into `content/menus/<handle>.md`. The primary menu is `main`.
- It turns the Elementor footer into `content/areas/footer.md`.
- It builds the theme of the site (colors and fonts) from the Elementor kit.
- It downloads the images into the media library of the project.
- It writes a report of what it changed, rounded or could not import.

The goal is the same look, not a pixel copy. Arbitrary values round to the scale of the kit, and the
report lists each change.

## Use

You need Node 20 or newer. You do not need to install it.

```bash
npx @plutocms/wordpress import export.xml --out ./my-pluto-project
```

```text
pluto-wordpress import <file.xml|page.json> [--out <dir>] [--dry-run] [--no-media] [--force]
```

| Option        | What it does                                                 |
| ------------- | ------------------------------------------------------------ |
| `--out <dir>` | The Pluto project folder. The default is the current folder. |
| `--dry-run`   | Writes nothing. Prints the plan and the report.              |
| `--no-media`  | Keeps the remote image URLs. Downloads nothing.              |
| `--force`     | Writes a file again, even when it is already there.          |

Start with `--dry-run`. Read the report. Then run it again without the option.

### Get the file

- **A WXR file** has the pages, the kit, the headers, the footers and the media list. In WordPress,
  open **Tools > Export**, choose **All content**, and download the file.
- **An Elementor page JSON** has one page. In Elementor, open **Templates > Saved Templates**, and
  choose **Export** on the page.

### What it writes

```text
content/pages/<path>.md         one file for each page (about/team for a child page)
content/menus/<handle>.md       one file for each menu (main, quick-links)
content/areas/footer.md         the footer, as blocks
content/media/<id>.md           one record for each image
public/media/<yyyy>/<mm>/<file> the image files
pluto-import/theme.json         the theme, from the kit
pluto-import/media.json         the source URL of each image, for a re-run
pluto-import-report.md          the report
```

The tool does not change your `app.config.ts`. It prints the theme as a snippet. Paste it there:

```ts
export default defineAppConfig({
  plutoBlocksTheme: {
    colors: {
      primary: '#EF5777',
      secondary: '#51C9C0',
      text: '#222F3E',
      accent: '#222F3E',
    },
    fonts: {
      heading: '"Playfair Display", serif',
      body: '"Work Sans", sans-serif',
    },
  },
})
```

Your project needs the page type (`plutoPages`), the menu and area types (`plutoMenus` and `plutoAreas`, for the
menus and the footer) and `@plutocms/blocks`. See the
[blocks layer](../../layers/addons/blocks/README.md).

## What it maps

| Elementor                              | Pluto block                                                |
| -------------------------------------- | ---------------------------------------------------------- |
| top-level container or section         | `block-section`                                            |
| a row of containers, or legacy columns | `block-columns` with `block-column`                        |
| a column-direction container           | its widgets, inside the parent                             |
| heading                                | `block-heading`                                            |
| text editor                            | `block-text` (HTML becomes Markdown)                       |
| image                                  | `block-image`                                              |
| button                                 | `block-button`                                             |
| icon, icon list, icon box              | `block-icon`, `block-icon-list`, `block-icon-box`          |
| image box                              | `block-image-box`                                          |
| accordion, toggle                      | `block-accordion`                                          |
| testimonial, counter, social icons     | `block-testimonial`, `block-counter`, `block-social-icons` |
| image gallery, gallery                 | `block-gallery`                                            |
| video                                  | `block-video`                                              |
| divider, spacer                        | `block-divider`, `block-spacer`                            |
| HTML                                   | raw HTML in the page                                       |
| navigation menu                        | `block-icon-list` of the top-level items of its menu       |
| site logo, site title                  | `block-image`, `block-heading`                             |
| copyright (Header Footer Elementor)    | `block-text`                                               |
| shortcode, and any other widget        | a placeholder text block, and a line in the report         |

Font Awesome icons become Lucide icons. Colors from the kit become tokens (`primary`, `secondary`,
`text`, `accent`). A literal color stays exact. Sizes round to the scale of the blocks. Tablet and
phone values are dropped. The report counts them.

The full rules are in the skill
[`.claude/skills/wordpress-import/SKILL.md`](../../../.claude/skills/wordpress-import/SKILL.md).

## Menus and the footer

**Menus.** Each WordPress menu becomes `content/menus/<handle>.md`. The body is nested `menu-item` blocks in the
order of the menu. A page item links to the new path of the page (`/about`, and `/` for the front page). A custom
link to the old site becomes a path. Another URL stays. A post item links to `/posts/<slug>`. A taxonomy item
(a category or a tag archive) has no page in Pluto, so the report lists it.

WordPress does not put the theme locations in the export, so the tool guesses the `main` menu. It takes the first
menu whose slug or name has `primary`, `main`, `header` or `menu-1`. If there is none, it takes the menu of the
navigation widget of the header, and then the largest menu. The report says which menu it took and why. Every other
menu keeps its name as the handle (`Quick Links` is `quick-links`).

**The footer.** A "Header Footer Elementor" footer, or an Elementor Pro theme builder footer, becomes
`content/areas/footer.md`, made of blocks like a page. Inside it:

- a navigation menu widget becomes a `block-icon-list` with the top-level items of its menu, as links. The kit has
  no navigation block, and an icon list is the nearest block with links. The sub-items are left out, and the list is
  a copy: it does not follow later changes of the menu. A menu that is not in the export keeps a placeholder;
- a site logo becomes a `block-image`, or a `block-heading` with the site title when there is no image;
- a site title becomes a `block-heading`;
- a copyright widget becomes a `block-text`, with the year and the site title in place of the shortcodes.

**The header** is not imported. A header layout is the job of the template. The report says which menu its
navigation widget uses, and lists its other widgets.

## What it does not do yet

- It does not import headers, forms, redirects, posts or users. It lists the headers and the templates in the
  report.
- It does not import pages that are not built with Elementor.
- It does not strip the metadata of an image. Core strips it when a person uploads a file.
- It writes to a Git CMS project. A Supabase site imports through the admin later.

## Develop

```bash
bun run --cwd packages/tools/wordpress test
bun run --cwd packages/tools/wordpress typecheck
bun run --cwd packages/tools/wordpress build
```

The tests use synthetic files. They do not use the network. The sample sites that people share on the
web have no license, so no test uses one.
