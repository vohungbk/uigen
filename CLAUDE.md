# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run start        # Start production server

# Database
npm run setup        # Install deps + generate Prisma client + run migrations
npm run db:reset     # Reset database (destructive)
npx prisma studio    # Open Prisma database GUI

# Quality
npm run lint         # ESLint
npm test             # Run all Vitest tests
npm test -- --watch  # Watch mode
npm test -- src/path/to/file.test.ts  # Single test file
```

## Environment

Copy `.env.example` to `.env`. `ANTHROPIC_API_KEY` is optional — without it the app uses `MockLanguageModel` which returns static component templates. `JWT_SECRET` is required for auth sessions.

Node.js ≥18 required. `node-compat.cjs` (loaded via `NODE_OPTIONS`) patches `globalThis.localStorage/sessionStorage` to be undefined on the server side (Node 25+ compatibility).

## Architecture

UIGen is an AI-powered React component generator. Users describe components in chat; Claude modifies a virtual file system; a sandboxed iframe renders the result live.

### Three-panel layout (`src/app/main-content.tsx`)
- **Left (35%)**: Chat interface
- **Right (65%)**: Resizable split — Preview iframe | Code editor + file tree

### Data flow
```
Chat input → ChatProvider (Vercel AI SDK useChat)
    → POST /api/chat/route.ts
    → streamText with Claude (or MockLanguageModel)
    → Tools: str_replace_editor + file_manager act on VirtualFileSystem
    → FileSystemProvider state updates
    → PreviewFrame re-renders (Babel JSX transpilation → srcdoc iframe)
```

### Key abstractions

**VirtualFileSystem** (`src/lib/file-system.ts`) — in-memory only, no disk I/O. All file operations during a session live here. Serialized to/from JSON for database persistence.

**Tools** (`src/lib/tools/`) — two Zod-validated tools Claude calls to edit files:
- `str_replace_editor`: create/view/str_replace/insert
- `file_manager`: rename/delete

**Contexts** (`src/lib/contexts/`) — React contexts wrapping the file system and chat state. `ChatProvider` handles tool-call results and routes them back to `FileSystemProvider`.

**PreviewFrame** (`src/components/preview/PreviewFrame.tsx`) — generates a self-contained `srcdoc` with Babel transpilation, an import map (mapping bare specifiers to esm.sh CDN URLs), and sandboxed iframe rendering.

**JSX transformer** (`src/lib/transform/jsx-transformer.ts`) — Babel standalone in-browser. Strips CSS imports, tracks missing imports, handles TSX/JSX.

**Auth** (`src/lib/auth.ts`, `src/actions/index.ts`) — JWT sessions (HS256, 7-day expiry) in httpOnly cookies. Server actions for signUp/signIn/getUser. Projects support optional `userId` so anonymous work persists per-project before sign-up.

**Language model** (`src/lib/provider.ts`) — uses `claude-haiku-4-5-20251001` when `ANTHROPIC_API_KEY` is set; falls back to `MockLanguageModel` otherwise. System prompt is in `src/lib/prompts/generation.tsx`.

### Database (Prisma + SQLite)
```
User     { id, email, password, projects[] }
Project  { id, name, userId?, messages (JSON), data (JSON) }
```

Schema at `prisma/schema.prisma`. SQLite file at `prisma/dev.db`.
