# Next Play - Athlete Interview Command Center

Coaching and analysis tool for athlete interviews. Analyzes transcripts and provides coaching feedback.

## Features

- **Rep View**: Paste transcripts → get coaching feedback with form fields
- **Admin Dashboard**: View all submissions, filter by rep/date/grade
- **Collapsible Transcript**: Toggle to show/hide original transcript side-by-side
- **Trends Report**: Analyze patterns across calls, filter by rep and date range
- **Download Selected**: Export submissions for pattern analysis
- **Edit Instructions**: Customize the coaching system prompt
- **Objection Handling**: Build a library of objection responses

## Quick Setup (15 minutes)

### Step 1: Supabase (Free)

1. Go to [supabase.com](https://supabase.com) → Create account → New project
2. Wait for project to spin up (~2 min)
3. Go to **SQL Editor** (left sidebar)
4. Paste the contents of `supabase-schema.sql` → Click **Run**
5. Go to **Settings** → **API** (left sidebar)
6. Copy these values:
   - **Project URL** → you'll need this
   - **anon public** key → you'll need this

### Step 2: GitHub

1. Create a new repository on GitHub
2. Upload all these files to it (or use git push)

### Step 3: Vercel (Free)

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **Add New** → **Project**
3. Import your GitHub repo
4. Before deploying, add **Environment Variables**:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key from Supabase |
| `NEXT_PUBLIC_ADMIN_PASSWORD` | Whatever you want (default: nextplay) |

5. Click **Deploy**

Your app will be live at `your-project.vercel.app` in about 60 seconds.

## Local Development

```bash
npm install
cp .env.example .env.local
# Fill in your values in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## File Structure

```
nextplay-app/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts    # Transcript analysis endpoint
│   │   └── trends/route.ts     # Trends analysis endpoint
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                # Main app (copy from artifact)
├── lib/
│   ├── supabase.ts             # Database client
│   └── system-prompt.ts        # Default coaching prompt
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
├── README.md
└── supabase-schema.sql
```

## Important: page.tsx

The `app/page.tsx` file needs to be created from the working Claude artifact. 

**To create it:**
1. Copy the full content from `nextplay-coaching-app.jsx` (the artifact)
2. Make these changes for Next.js:
   - Change `window.storage` calls to use the Supabase client
   - Change direct Anthropic API calls to use `/api/analyze` and `/api/trends`
   - Add TypeScript types

The artifact contains all the UI logic for:
- Rep submission form
- Admin dashboard with 4 tabs
- Collapsible transcript view
- Trends report generation
- Rep name normalization

## Admin Password

Default password is `nextplay`. Change it by setting `NEXT_PUBLIC_ADMIN_PASSWORD` in Vercel.

## Costs

- **Vercel Hobby**: Free
- **Supabase Free Tier**: Free (500MB database)
- **Anthropic API**: ~$0.01-0.02 per transcript analysis
