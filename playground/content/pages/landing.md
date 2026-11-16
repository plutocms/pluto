---
title: Landing
status: published
description: A page made with every block of the landing kit.
---

:::::block-section{anchor="top" image="/images/landing-hero.svg" overlay="#0f172a" overlay-opacity="55" color="#ffffff" padding="2xl" min-height="60vh" valign="center" align="center"}
::::block-columns{valign="center"}
:::block-column{width="70"}
::block-heading{level="1" size="3xl"}
Build a page in minutes
::

::block-text{size="xl"}
Pluto **blocks** give you sections, columns and widgets. Write them as plain text, or edit them in the visual editor.
::

::block-button{label="Get started" link="/admin" size="lg" icon="i-lucide-rocket"}
::

::block-button{label="Read the docs" link="https://pluto.vulmix.dev/docs" variant="outline" color="#ffffff" target="_blank"}
::
:::

:::block-column{width="30"}
::block-icon{icon="i-lucide-sparkles" size="2xl" align="center" label="Sparkles"}
::
:::
::::
:::::

:::::block-section{bg="surface" padding="xl" anchor="features"}
::block-heading{level="2" align="center"}
Everything you need
::

::block-spacer{size="md"}
::

::::block-columns{gap="lg"}
:::block-column{padding="md" bg="background" radius="lg" shadow="sm"}
::block-icon-box{icon="i-lucide-zap" title="Fast" color="primary"}
Pages load as plain HTML. Nothing extra runs in the browser.
::
:::

:::block-column{padding="md" bg="background" radius="lg" shadow="sm"}
::block-icon-box{icon="i-lucide-palette" title="Themed" color="accent"}
Set your colors and fonts once in the app config.
::
:::

:::block-column{padding="md" bg="background" radius="lg" shadow="sm"}
::block-icon-box{icon="i-lucide-accessibility" title="Accessible" color="secondary"}
Real headings, real links, and text alternatives for images.
::
:::
::::
:::::

:::::::block-section{padding="xl"}
::::::block-columns{gap="lg" valign="center"}
:::::block-column{width="50"}
:::block-image-box{src="/images/hello-world.svg" alt="A dark card with the words Hello, world" title="Made for editors" radius="lg"}
Change a heading, swap an image, move a block. The preview shows the page as visitors see it.
:::
:::::

:::::block-column{width="50"}
::block-heading{level="2"}
Why teams pick blocks
::

:::block-icon-list{icon="i-lucide-check" color="primary"}
::block-icon-list-item{text="No code to write"}
::

::block-icon-list-item{icon="i-lucide-shield-check"}
Sanitized on the server
::

::block-icon-list-item{text="Works in light and dark mode" link="/"}
::
:::

::block-divider{width="40%" thickness="2" color="primary" spacing="md"}
::

::::block-columns{gap="md"}
:::block-column
::block-counter{value="120" suffix="+" title="Pages built"}
::
:::

:::block-column
::block-counter{value="99" suffix="%" title="Happy editors"}
::
:::
::::
:::::
::::::
:::::::

:::block-section{bg="surface" padding="xl"}
::block-heading{level="2" align="center"}
See it in action
::

::block-video{url="https://www.youtube.com/watch?v=jNQXAC9IVRw" title="The first video on YouTube" width="80%" ratio="16:9" align="center"}
::
:::

::::block-section{padding="xl" anchor="faq"}
::block-heading{level="2"}
Questions
::

:::block-accordion{single}
::block-accordion-item{title="Do I need to know how to code?" open}
No. Pick a block, fill in its fields, and publish.
::

::block-accordion-item{title="Can I change the colors?"}
Yes. Set `plutoBlocksTheme` in `app.config.ts`, or set the CSS variables.
::
:::
::::

:::block-section{bg="primary" color="#ffffff" padding="xl"}
::block-testimonial{name="Ana Souza" role="Founder, Studio Lume" image="/images/hello-world.svg" align="center"}
The new landing page took one afternoon, and we never opened a code editor.
::
:::

::::block-section{padding="xl"}
::block-heading{level="2" align="center"}
Gallery
::

:::block-gallery{columns="3" gap="sm" ratio="4:3"}
::block-image{src="/images/hello-world.svg" alt="Hello card, first view" radius="md"}
::

::block-image{src="/images/landing-hero.svg" alt="A dark gradient" radius="md" caption="The hero background"}
::

::block-image{src="/images/hello-world.svg" alt="Hello card, second view" radius="md" link="/"}
::
:::
::::

::::block-section{bg="surface" padding="lg" align="center"}
::block-text{align="center" color="muted"}
Follow the project
::

:::block-social-icons{shape="circle" align="center"}
::block-social-link{network="github" url="https://github.com/plutocms"}
::

::block-social-link{network="website" url="https://pluto.vulmix.dev" label="Pluto website"}
::

::block-social-link{network="rss" url="/feed.xml"}
::
:::
::::
