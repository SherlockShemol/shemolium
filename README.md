<img src="./public/favicon.png" width="50" height="50" alt="Shemolium Logo">

# Shemolium

A static blog built on top of Notion and Next.js, deployed on [Vercel](https://vercel.com).

Demo: [https://shemol.tech](https://shemol.tech)

## Features

- **Fast and responsive** - Quick page rendering with optimized static generation
- **Deploy instantly** - Deploy on Vercel in minutes with incremental regeneration
- **Fully functional** - Comments, full-width pages, quick search, tag filtering, RSS, and more
- **Easy customization** - Built with Tailwind CSS, supports English & Chinese interface
- **SEO friendly** - Pretty URLs and comprehensive SEO support

## Quick Start

1. Duplicate [this Notion template](https://craigary.notion.site/ee99f65a23ab44f8ac80270122ee8138) and share it to the public
2. Fork this project
3. Customize `blog.config.ts`
4. (Optional) Replace `favicon.png` and `favicon.dark.png` in `/public` folder with your own
5. Deploy on [Vercel](https://vercel.com) with the following environment variables:
   - `NOTION_PAGE_ID` (Required): The ID of your shared Notion page
   - `NOTION_ACCESS_TOKEN` (Optional): Token for private database access

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

## Technical Details

- **Framework**: Next.js with Incremental Static Regeneration
- **Page Rendering**: [react-notion-x](https://github.com/NotionX/react-notion-x)
- **Styling**: Tailwind CSS
- **Comments**: Gitalk, Cusdis, Utterances

## Acknowledgments

This project is based on [Nobelium](https://github.com/craigary/nobelium) by [Craig Hart](https://github.com/craigary). Special thanks to Craig and all the contributors of the original project for creating such an excellent Notion-based blog system.

## License

The MIT License.

Copyright (c) 2021-present, Craig Hart  
Copyright (c) 2024-present, Shemol
