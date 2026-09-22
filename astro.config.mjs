import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export default defineConfig({
  // The Git remote is franciscovillacis/franciscovillacis.github.io.
  // This is a user site served at /, so no repository base path is needed.
  site: "https://franciscovillacis.github.io",

  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
});
