# Astro Starter Kit: Minimal

## GitHub Pages deployment

This site's production URL is **https://franciscovillacis.github.io/**, matching
the Git remote `franciscovillacis/franciscovillacis.github.io`. The local folder
and npm package name (`fvillacis.github.io`) do not determine the published URL.

Keep `site` in `astro.config.mjs` set to `https://franciscovillacis.github.io`.
This is a GitHub Pages user site, so it is served at `/` without a repository
`base` path. The portrait, styles, `/research/`, and `/cv.pdf` use this root.

In the repository's **Settings → Pages**, the source must be **GitHub Actions**.
The workflow in `.github/workflows/deploy.yml` builds and uploads the Astro
output, then deploys it on pushes to `main` or manual workflow runs. Deployment
runs are serialized to avoid overlapping deployments.

Before publishing, run `npm run build` and use `npm run preview` to check the
production output. No separate lint, test, or type-check script is configured.
For development, use `npm run dev -- --background`; manage it with
`npm run astro -- dev status`, `npm run astro -- dev logs`, and
`npm run astro -- dev stop`.

Deployment reference: [Astro's GitHub Pages guide](https://docs.astro.build/en/guides/deploy/github/).

## Math rendering

The direct `katex` dependency supplies the stylesheet and fonts. The npm
`overrides` entry keeps the Markdown math renderer on that same version.
Update them together to avoid incorrect superscript and subscript sizing.

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
