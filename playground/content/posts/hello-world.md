---
title: Hello, world
status: published
excerpt: The first post of the playground. It uses every format of the editor.
publishedAt: 2026-10-19T00:00:00.000Z
updatedAt: 2026-11-12T12:00:00.000Z
---

Welcome to your blog. Each post is a **Markdown file** in the `content/posts` folder of your GitHub repository, so the history of every post is in git.

This post uses every format of the editor. Open it in the admin to see how each part is made, then change it or delete it.

## Write in the admin

Open `/admin`, sign in with GitHub, and create a post. The toolbar has all the formats below. On an empty line, type / or click + for the same list.

### Text

Make text **bold**, _italic_, ~~struck through~~, or `inline code`. Add a [link to the Pluto docs](https://pluto.vulmix.dev/docs). In the editor, click a link to change its address or its text.

### Lists

- Drafts stay hidden on the site.
- Publish a post when it is ready.
  - Schedule it to publish it later.
  - Unpublish it to take it off the site.

1. Write the post.
2. Check it in the preview, next to the editor.
3. Publish it.

### Quotes

> Simple things should be simple, complex things should be possible.

### Code

Pick the language of a code block in its menu, at its top right. The editor colors the code.

```ts
export function greet(name: string): string {
  return `Hello, ${name}!`
}
```

#### Headings

A post has headings from level 2 to level 4: the title of the post is level 1. The outline of the editor lists them.

## Images and videos

![A dark card with the words Hello, world](/images/hello-world.svg)

Add an image with the image button of the toolbar. It goes to the media library of the site.

To show a video, paste its YouTube or Vimeo address alone on a line. The site shows the video with a play button:

https://www.youtube.com/watch?v=jNQXAC9IVRw

## Components

The boxes below are the Callout component of the site. In the editor, click the puzzle icon to add one, then click it to change its text.

::callout{type="tip" title="A tip" text="A callout can be a note, a tip or a warning. Each one has its own color."}
::

::callout{type="warning" title="Before you publish" text="Replace this post with your own, or set it back to a draft."}
::
