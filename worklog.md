---
Task ID: 1
Agent: main
Task: Clone and run barakacatalog project from GitHub

Work Log:
- Cloned https://github.com/barakabot/barakacatalog.git to /home/z/barakacatalog
- Analyzed project structure: Next.js 16 + Prisma/SQLite + Python price-service mini-service
- Copied all project files to /home/z/my-project (replacing existing project)
- Installed npm dependencies with `bun install`
- Created .env from .env.example
- Ran `prisma db push` to create SQLite database with all tables
- Installed Python dependencies (fastapi, uvicorn, aiosqlite, httpx, pydantic)
- Started Python price-service on port 3002 (uvicorn)
- Removed `output: "standalone"` from next.config.ts for dev stability
- Started Next.js dev server on port 3000

Stage Summary:
- Project: Baraka Product Catalog Management System (باراکا | کاتالوگ محصولات)
- Features: Product catalog, groups/categories, competitor price monitoring, admin dashboard, settings, proxy management, Excel import/export
- Mini-services: Python price-service (port 3002) for scraping Digikala, SnappShop, Torob
- Default admin password: admin123
- Database: SQLite at /home/z/my-project/db/custom.db
- All browser verification passed: login page, catalog home, admin panel all render correctly
