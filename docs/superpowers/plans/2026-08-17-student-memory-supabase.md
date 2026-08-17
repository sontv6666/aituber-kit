# Student Memory & Profile (Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist conversation history and a rich student profile to Supabase, and inject a rebuilt "student memory" block into the system prompt every turn so the AI teacher (Cô Mây) remembers who the student is across long conversations and sessions.

**Architecture:** A new isolated module `src/features/memory/` holds pure logic (identity, memory-block builder, extraction merge) plus thin Supabase I/O wrappers and a Zustand store. Three integration points: `handlers.ts` (inject memory block into the model messages), `home.ts` (persist each message), and `index.tsx` (bootstrap on mount). The feature self-disables when Supabase env vars are absent — no regression to current localStorage behavior.

**Tech Stack:** Next.js 14 + React 18, TypeScript strict, Zustand 4, `@supabase/supabase-js` ^2.46.2 (already installed), Jest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-17-student-memory-supabase-design.md`

## Global Constraints

- Node.js 20+, npm 10+. Do NOT upgrade any package version (`.cursorrules`).
- Language files: update ONLY `locales/ja/translation.json`; never edit en/ko/zh/etc (CLAUDE.md).
- Tests live under `src/__tests__/**`, mirroring source path; `testMatch: **/__tests__/**/*.test.[jt]s?(x)`.
- All Supabase and AI calls MUST be wrapped in try/catch and never interrupt chat. Missing env → feature disables silently.
- Do not change existing UI/UX without cause; add the profile panel following the existing settings-panel pattern.
- Client Supabase env var names: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (do NOT reuse the server-only `SUPABASE_SERVICE_ROLE_KEY` in browser code).
- Run `npm run lint:fix && npm run format && npm run build` before final completion.

---

## Shared Types (defined in Task 2, consumed everywhere)

File `src/features/memory/types.ts`:

```ts
export type MemoryCategory =
  | 'identity'
  | 'preference'
  | 'progress'
  | 'personal'
  | 'misc'

export interface StudentProfile {
  id: string
  display_name: string | null
  preferred_name: string | null
  address_form: string | null
  grade_level: string | null
  current_topic: string | null
  progress_notes: string | null
  interests: string[] | null
  strengths: string | null
  weaknesses: string | null
  memory_summary: string | null
  last_active: string | null
}

export interface MemoryFact {
  id?: string
  student_id: string
  category: MemoryCategory
  key: string
  value: string
  confidence: number
  source_message_id?: string | null
}

export interface ExtractionResult {
  display_name?: string
  preferred_name?: string
  address_form?: string
  grade_level?: string
  current_topic?: string
  progress_notes?: string
  interests?: string[]
  strengths?: string
  weaknesses?: string
  memory_summary?: string
  facts?: Array<{
    category: MemoryCategory
    key: string
    value: string
    confidence?: number
  }>
}

export function emptyProfile(id: string): StudentProfile {
  return {
    id,
    display_name: null,
    preferred_name: null,
    address_form: null,
    grade_level: null,
    current_topic: null,
    progress_notes: null,
    interests: null,
    strengths: null,
    weaknesses: null,
    memory_summary: null,
    last_active: null,
  }
}
```

---

## Task 1: Supabase schema + env example

**Files:**
- Create: `supabase/schema.sql`
- Modify: `.env.example` (append Supabase client section)

**Interfaces:**
- Consumes: nothing.
- Produces: three tables (`students`, `messages`, `memory_facts`) matching the `StudentProfile`/`MemoryFact` shapes; env var names used by later tasks.

- [ ] **Step 1: Write the schema SQL**

Create `supabase/schema.sql`:

```sql
-- Student memory & profile schema for AITuberKit (Cô Mây)
-- Run once in the Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.students (
  id uuid primary key,
  display_name text,
  preferred_name text,
  address_form text,
  grade_level text,
  current_topic text,
  progress_notes text,
  interests text[],
  strengths text,
  weaknesses text,
  memory_summary text,
  last_active timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  role text not null,
  content text,
  emotion text,
  created_at timestamptz not null default now()
);
create index if not exists messages_student_created_idx
  on public.messages (student_id, created_at);

create table if not exists public.memory_facts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  category text not null,
  key text not null,
  value text not null,
  confidence real not null default 0.7,
  source_message_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, category, key)
);
create index if not exists memory_facts_student_idx
  on public.memory_facts (student_id);

-- Light RLS: device-based identity, no auth. Anon may read/write.
-- (Accepted trade-off for demo/internal use; student_id is a random uuid.)
alter table public.students enable row level security;
alter table public.messages enable row level security;
alter table public.memory_facts enable row level security;

create policy "anon full access students" on public.students
  for all to anon using (true) with check (true);
create policy "anon full access messages" on public.messages
  for all to anon using (true) with check (true);
create policy "anon full access memory_facts" on public.memory_facts
  for all to anon using (true) with check (true);
```

- [ ] **Step 2: Append env vars**

Add to the end of `.env.example`:

```
# --- Student memory & profile (Supabase, browser client) ---
# Bộ nhớ & hồ sơ học sinh cho AI cô giáo.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# Số tin nhắn giữa 2 lần AI tự trích xuất bộ nhớ (mặc định 6).
NEXT_PUBLIC_MEMORY_EXTRACT_EVERY_N=6
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql .env.example
git commit -m "feat(memory): add Supabase schema and env vars for student memory"
```

---

## Task 2: Shared types + student identity (pure, TDD)

**Files:**
- Create: `src/features/memory/types.ts`
- Create: `src/features/memory/studentIdentity.ts`
- Test: `src/__tests__/features/memory/studentIdentity.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `types.ts` — all shared types (see "Shared Types" section above).
  - `getOrCreateStudentId(): string` — returns existing localStorage `aituber-student-id` or creates a new uuid and stores it. Returns `''` when `window` is undefined (SSR).

- [ ] **Step 1: Create the types file**

Create `src/features/memory/types.ts` with the exact contents from the "Shared Types" section above.

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/features/memory/studentIdentity.test.ts`:

```ts
import { getOrCreateStudentId } from '@/features/memory/studentIdentity'

describe('getOrCreateStudentId', () => {
  beforeEach(() => localStorage.clear())

  it('creates and stores an id when none exists', () => {
    expect(localStorage.getItem('aituber-student-id')).toBeNull()
    const id = getOrCreateStudentId()
    expect(id).toMatch(/[0-9a-f-]{36}/)
    expect(localStorage.getItem('aituber-student-id')).toBe(id)
  })

  it('returns the same id on subsequent calls', () => {
    const first = getOrCreateStudentId()
    const second = getOrCreateStudentId()
    expect(second).toBe(first)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/__tests__/features/memory/studentIdentity.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write minimal implementation**

Create `src/features/memory/studentIdentity.ts`:

```ts
const STORAGE_KEY = 'aituber-student-id'

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getOrCreateStudentId(): string {
  if (typeof window === 'undefined') return ''
  const existing = window.localStorage.getItem(STORAGE_KEY)
  if (existing) return existing
  const id = uuid()
  window.localStorage.setItem(STORAGE_KEY, id)
  return id
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/features/memory/studentIdentity.test.ts`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/memory/types.ts src/features/memory/studentIdentity.ts src/__tests__/features/memory/studentIdentity.test.ts
git commit -m "feat(memory): add shared types and device-based student identity"
```

---

## Task 3: Supabase browser client (feature-detected)

**Files:**
- Create: `src/features/memory/supabaseClient.ts`
- Test: `src/__tests__/features/memory/supabaseClient.test.ts`

**Interfaces:**
- Consumes: `@supabase/supabase-js`.
- Produces: `getSupabaseClient(): SupabaseClient | null` — returns a memoized client when both env vars are set, else `null`. `isMemoryEnabled(): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/features/memory/supabaseClient.test.ts`:

```ts
describe('getSupabaseClient', () => {
  const OLD = process.env
  afterEach(() => {
    process.env = OLD
    jest.resetModules()
  })

  it('returns null when env vars are missing', () => {
    jest.resetModules()
    process.env = { ...OLD }
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const { getSupabaseClient, isMemoryEnabled } =
      require('@/features/memory/supabaseClient')
    expect(getSupabaseClient()).toBeNull()
    expect(isMemoryEnabled()).toBe(false)
  })

  it('returns a client when env vars are present', () => {
    jest.resetModules()
    process.env = {
      ...OLD,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    }
    const { getSupabaseClient, isMemoryEnabled } =
      require('@/features/memory/supabaseClient')
    expect(getSupabaseClient()).not.toBeNull()
    expect(isMemoryEnabled()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/features/memory/supabaseClient.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/memory/supabaseClient.ts`:

```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function isMemoryEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isMemoryEnabled()) return null
  if (cached) return cached
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    { auth: { persistSession: false } }
  )
  return cached
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/features/memory/supabaseClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/memory/supabaseClient.ts src/__tests__/features/memory/supabaseClient.test.ts
git commit -m "feat(memory): add feature-detected Supabase browser client"
```

---

## Task 4: Memory block builder (pure, TDD)

**Files:**
- Create: `src/features/memory/memoryInjector.ts`
- Test: `src/__tests__/features/memory/memoryInjector.test.ts`

**Interfaces:**
- Consumes: `StudentProfile`, `MemoryFact` from `types.ts`.
- Produces: `buildMemoryBlock(profile: StudentProfile | null, facts: MemoryFact[]): string` — returns a Vietnamese system-prompt block, or `''` when there is nothing to say.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/features/memory/memoryInjector.test.ts`:

```ts
import { buildMemoryBlock } from '@/features/memory/memoryInjector'
import { emptyProfile } from '@/features/memory/types'

describe('buildMemoryBlock', () => {
  it('returns empty string when profile is null and no facts', () => {
    expect(buildMemoryBlock(null, [])).toBe('')
  })

  it('returns empty string when profile is entirely empty', () => {
    expect(buildMemoryBlock(emptyProfile('id-1'), [])).toBe('')
  })

  it('includes filled profile fields and facts', () => {
    const profile = {
      ...emptyProfile('id-1'),
      preferred_name: 'Bơ',
      address_form: 'cô - con',
      grade_level: 'lớp 5',
      current_topic: 'phân số',
      interests: ['bóng đá', 'vẽ'],
    }
    const block = buildMemoryBlock(profile, [
      {
        student_id: 'id-1',
        category: 'progress',
        key: 'đã học',
        value: 'phép nhân phân số',
        confidence: 0.9,
      },
    ])
    expect(block).toContain('Bơ')
    expect(block).toContain('cô - con')
    expect(block).toContain('lớp 5')
    expect(block).toContain('phân số')
    expect(block).toContain('bóng đá')
    expect(block).toContain('phép nhân phân số')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/features/memory/memoryInjector.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/memory/memoryInjector.ts`:

```ts
import { StudentProfile, MemoryFact } from './types'

export function buildMemoryBlock(
  profile: StudentProfile | null,
  facts: MemoryFact[]
): string {
  const lines: string[] = []

  if (profile) {
    const name = profile.preferred_name || profile.display_name
    if (name) lines.push(`- Tên/biệt danh: ${name}`)
    if (profile.address_form) lines.push(`- Cách xưng hô: ${profile.address_form}`)
    if (profile.grade_level) lines.push(`- Lớp/trình độ: ${profile.grade_level}`)
    if (profile.current_topic) lines.push(`- Đang học: ${profile.current_topic}`)
    if (profile.progress_notes)
      lines.push(`- Học tới đâu: ${profile.progress_notes}`)
    if (profile.interests && profile.interests.length)
      lines.push(`- Sở thích: ${profile.interests.join(', ')}`)
    if (profile.strengths) lines.push(`- Điểm mạnh: ${profile.strengths}`)
    if (profile.weaknesses) lines.push(`- Hay sai/điểm yếu: ${profile.weaknesses}`)
  }

  for (const f of facts) {
    lines.push(`- [${f.category}] ${f.key}: ${f.value}`)
  }

  if (!lines.length) return ''

  const summary = profile?.memory_summary
    ? `\nTóm tắt các buổi trước: ${profile.memory_summary}`
    : ''

  return (
    '📌 HỒ SƠ HỌC SINH (hãy nhớ và dùng khi trò chuyện, xưng hô đúng, ' +
    'nhắc lại điều đã biết một cách tự nhiên):\n' +
    lines.join('\n') +
    summary
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/features/memory/memoryInjector.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/memory/memoryInjector.ts src/__tests__/features/memory/memoryInjector.test.ts
git commit -m "feat(memory): add memory-block builder for system prompt injection"
```

---

## Task 5: Extraction merge logic (pure, TDD)

**Files:**
- Create: `src/features/memory/mergeExtraction.ts`
- Test: `src/__tests__/features/memory/mergeExtraction.test.ts`

**Interfaces:**
- Consumes: `StudentProfile`, `MemoryFact`, `ExtractionResult` from `types.ts`.
- Produces: `mergeExtraction(current: StudentProfile, extraction: ExtractionResult): { profile: StudentProfile; facts: MemoryFact[] }` — merges non-empty extracted fields onto the profile (never overwrites an existing value with empty), and maps `extraction.facts` to `MemoryFact[]` stamped with `current.id`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/features/memory/mergeExtraction.test.ts`:

```ts
import { mergeExtraction } from '@/features/memory/mergeExtraction'
import { emptyProfile } from '@/features/memory/types'

describe('mergeExtraction', () => {
  it('fills empty profile fields from extraction', () => {
    const { profile } = mergeExtraction(emptyProfile('id-1'), {
      preferred_name: 'Bơ',
      grade_level: 'lớp 5',
      interests: ['bóng đá'],
    })
    expect(profile.preferred_name).toBe('Bơ')
    expect(profile.grade_level).toBe('lớp 5')
    expect(profile.interests).toEqual(['bóng đá'])
  })

  it('does not overwrite an existing value with an empty one', () => {
    const current = { ...emptyProfile('id-1'), preferred_name: 'Bơ' }
    const { profile } = mergeExtraction(current, { preferred_name: '' })
    expect(profile.preferred_name).toBe('Bơ')
  })

  it('maps facts and stamps student_id and default confidence', () => {
    const { facts } = mergeExtraction(emptyProfile('id-1'), {
      facts: [{ category: 'preference', key: 'môn thích', value: 'Toán' }],
    })
    expect(facts).toHaveLength(1)
    expect(facts[0].student_id).toBe('id-1')
    expect(facts[0].confidence).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/features/memory/mergeExtraction.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/memory/mergeExtraction.ts`:

```ts
import {
  StudentProfile,
  MemoryFact,
  ExtractionResult,
} from './types'

function pick(existing: string | null, incoming?: string): string | null {
  const trimmed = (incoming ?? '').trim()
  return trimmed ? trimmed : existing
}

export function mergeExtraction(
  current: StudentProfile,
  extraction: ExtractionResult
): { profile: StudentProfile; facts: MemoryFact[] } {
  const profile: StudentProfile = {
    ...current,
    display_name: pick(current.display_name, extraction.display_name),
    preferred_name: pick(current.preferred_name, extraction.preferred_name),
    address_form: pick(current.address_form, extraction.address_form),
    grade_level: pick(current.grade_level, extraction.grade_level),
    current_topic: pick(current.current_topic, extraction.current_topic),
    progress_notes: pick(current.progress_notes, extraction.progress_notes),
    strengths: pick(current.strengths, extraction.strengths),
    weaknesses: pick(current.weaknesses, extraction.weaknesses),
    memory_summary: pick(current.memory_summary, extraction.memory_summary),
    interests:
      extraction.interests && extraction.interests.length
        ? Array.from(
            new Set([...(current.interests ?? []), ...extraction.interests])
          )
        : current.interests,
  }

  const facts: MemoryFact[] = (extraction.facts ?? [])
    .filter((f) => f && f.key && f.value)
    .map((f) => ({
      student_id: current.id,
      category: f.category,
      key: f.key.trim(),
      value: f.value.trim(),
      confidence: typeof f.confidence === 'number' ? f.confidence : 0.7,
    }))

  return { profile, facts }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/features/memory/mergeExtraction.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/memory/mergeExtraction.ts src/__tests__/features/memory/mergeExtraction.test.ts
git commit -m "feat(memory): add extraction merge logic"
```

---

## Task 6: Supabase I/O wrappers (profile, facts, messages)

**Files:**
- Create: `src/features/memory/repository.ts`
- Test: `src/__tests__/features/memory/repository.test.ts`

**Interfaces:**
- Consumes: `getSupabaseClient` (Task 3); types (Task 2).
- Produces (all return safely — no throw — and no-op when client is null):
  - `ensureStudentRow(id: string): Promise<void>`
  - `loadProfile(id: string): Promise<StudentProfile | null>`
  - `upsertProfile(profile: StudentProfile): Promise<void>`
  - `loadFacts(id: string): Promise<MemoryFact[]>`
  - `upsertFacts(facts: MemoryFact[]): Promise<void>`
  - `persistMessage(studentId: string, role: string, content: string, emotion?: string | null): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/features/memory/repository.test.ts`. It mocks the client module so no network happens:

```ts
const upsertMock = jest.fn().mockResolvedValue({ error: null })
const insertMock = jest.fn().mockResolvedValue({ error: null })
const selectResult = { data: null, error: null }

jest.mock('@/features/memory/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      upsert: upsertMock,
      insert: insertMock,
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(selectResult),
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }),
}))

import {
  upsertProfile,
  persistMessage,
} from '@/features/memory/repository'
import { emptyProfile } from '@/features/memory/types'

describe('repository', () => {
  beforeEach(() => {
    upsertMock.mockClear()
    insertMock.mockClear()
  })

  it('upsertProfile calls upsert', async () => {
    await upsertProfile(emptyProfile('id-1'))
    expect(upsertMock).toHaveBeenCalledTimes(1)
  })

  it('persistMessage calls insert', async () => {
    await persistMessage('id-1', 'user', 'xin chào')
    expect(insertMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/features/memory/repository.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/memory/repository.ts`:

```ts
import { getSupabaseClient } from './supabaseClient'
import { StudentProfile, MemoryFact } from './types'

export async function ensureStudentRow(id: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client || !id) return
  try {
    await client
      .from('students')
      .upsert({ id, last_active: new Date().toISOString() }, { onConflict: 'id' })
  } catch (e) {
    console.warn('ensureStudentRow failed', e)
  }
}

export async function loadProfile(id: string): Promise<StudentProfile | null> {
  const client = getSupabaseClient()
  if (!client || !id) return null
  try {
    const { data } = await client
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    return (data as StudentProfile) ?? null
  } catch (e) {
    console.warn('loadProfile failed', e)
    return null
  }
}

export async function upsertProfile(profile: StudentProfile): Promise<void> {
  const client = getSupabaseClient()
  if (!client || !profile.id) return
  try {
    await client
      .from('students')
      .upsert(
        { ...profile, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
  } catch (e) {
    console.warn('upsertProfile failed', e)
  }
}

export async function loadFacts(id: string): Promise<MemoryFact[]> {
  const client = getSupabaseClient()
  if (!client || !id) return []
  try {
    const { data } = await client
      .from('memory_facts')
      .select('*')
      .eq('student_id', id)
      .order('updated_at', { ascending: false })
    return (data as MemoryFact[]) ?? []
  } catch (e) {
    console.warn('loadFacts failed', e)
    return []
  }
}

export async function upsertFacts(facts: MemoryFact[]): Promise<void> {
  const client = getSupabaseClient()
  if (!client || !facts.length) return
  try {
    await client
      .from('memory_facts')
      .upsert(
        facts.map((f) => ({ ...f, updated_at: new Date().toISOString() })),
        { onConflict: 'student_id,category,key' }
      )
  } catch (e) {
    console.warn('upsertFacts failed', e)
  }
}

export async function persistMessage(
  studentId: string,
  role: string,
  content: string,
  emotion?: string | null
): Promise<void> {
  const client = getSupabaseClient()
  if (!client || !studentId) return
  try {
    await client
      .from('messages')
      .insert({ student_id: studentId, role, content, emotion: emotion ?? null })
  } catch (e) {
    console.warn('persistMessage failed', e)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/features/memory/repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/memory/repository.ts src/__tests__/features/memory/repository.test.ts
git commit -m "feat(memory): add Supabase repository for profile, facts, messages"
```

---

## Task 7: Memory Zustand store

**Files:**
- Create: `src/features/memory/memoryStore.ts`
- Test: `src/__tests__/features/memory/memoryStore.test.ts`

**Interfaces:**
- Consumes: identity (Task 2), repository (Task 6), types (Task 2).
- Produces: `useMemoryStore` (Zustand). State: `{ studentId: string, profile: StudentProfile | null, facts: MemoryFact[], ready: boolean, messagesSinceExtract: number }`. Actions:
  - `bootstrap(): Promise<void>` — set studentId, ensureStudentRow, load profile (or `emptyProfile`) + facts, set `ready`.
  - `applyMerge(profile: StudentProfile, facts: MemoryFact[]): void` — replace profile, merge facts by `category|key`, reset `messagesSinceExtract` to 0.
  - `noteMessage(): void` — increment `messagesSinceExtract`.
  - `setProfile(patch: Partial<StudentProfile>): void` — shallow-merge into profile (for the manual form).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/features/memory/memoryStore.test.ts`:

```ts
jest.mock('@/features/memory/repository', () => ({
  ensureStudentRow: jest.fn().mockResolvedValue(undefined),
  loadProfile: jest.fn().mockResolvedValue(null),
  loadFacts: jest.fn().mockResolvedValue([]),
  upsertProfile: jest.fn().mockResolvedValue(undefined),
  upsertFacts: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/features/memory/studentIdentity', () => ({
  getOrCreateStudentId: () => 'id-1',
}))

import { useMemoryStore } from '@/features/memory/memoryStore'
import { emptyProfile } from '@/features/memory/types'

describe('memoryStore', () => {
  it('noteMessage increments the counter', () => {
    useMemoryStore.setState({ messagesSinceExtract: 0 })
    useMemoryStore.getState().noteMessage()
    expect(useMemoryStore.getState().messagesSinceExtract).toBe(1)
  })

  it('applyMerge replaces profile and resets counter', () => {
    useMemoryStore.setState({ messagesSinceExtract: 5 })
    const p = { ...emptyProfile('id-1'), preferred_name: 'Bơ' }
    useMemoryStore.getState().applyMerge(p, [])
    expect(useMemoryStore.getState().profile?.preferred_name).toBe('Bơ')
    expect(useMemoryStore.getState().messagesSinceExtract).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/features/memory/memoryStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/memory/memoryStore.ts`:

```ts
import { create } from 'zustand'
import { StudentProfile, MemoryFact, emptyProfile } from './types'
import { getOrCreateStudentId } from './studentIdentity'
import {
  ensureStudentRow,
  loadProfile,
  loadFacts,
  upsertProfile,
} from './repository'

interface MemoryState {
  studentId: string
  profile: StudentProfile | null
  facts: MemoryFact[]
  ready: boolean
  messagesSinceExtract: number
  bootstrap: () => Promise<void>
  applyMerge: (profile: StudentProfile, facts: MemoryFact[]) => void
  noteMessage: () => void
  setProfile: (patch: Partial<StudentProfile>) => void
}

function mergeFactLists(a: MemoryFact[], b: MemoryFact[]): MemoryFact[] {
  const map = new Map<string, MemoryFact>()
  for (const f of [...a, ...b]) map.set(`${f.category}|${f.key}`, f)
  return Array.from(map.values())
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  studentId: '',
  profile: null,
  facts: [],
  ready: false,
  messagesSinceExtract: 0,

  bootstrap: async () => {
    const studentId = getOrCreateStudentId()
    if (!studentId) return
    await ensureStudentRow(studentId)
    const [loaded, facts] = await Promise.all([
      loadProfile(studentId),
      loadFacts(studentId),
    ])
    set({
      studentId,
      profile: loaded ?? emptyProfile(studentId),
      facts,
      ready: true,
    })
  },

  applyMerge: (profile, facts) =>
    set((s) => ({
      profile,
      facts: mergeFactLists(s.facts, facts),
      messagesSinceExtract: 0,
    })),

  noteMessage: () =>
    set((s) => ({ messagesSinceExtract: s.messagesSinceExtract + 1 })),

  setProfile: (patch) =>
    set((s) => {
      const next = { ...(s.profile ?? emptyProfile(s.studentId)), ...patch }
      void upsertProfile(next)
      return { profile: next }
    }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/features/memory/memoryStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/memory/memoryStore.ts src/__tests__/features/memory/memoryStore.test.ts
git commit -m "feat(memory): add memory Zustand store with bootstrap and merge"
```

---

## Task 8: Inject memory block into the model messages

**Files:**
- Modify: `src/features/chat/handlers.ts` (the `const messages: Message[] = [...]` array, ~line 892)
- Test: `src/__tests__/features/memory/memoryInjector.integration.test.ts`

**Interfaces:**
- Consumes: `buildMemoryBlock` (Task 4), `useMemoryStore` (Task 7).
- Produces: a system message with the memory block inserted right after `systemPrompt` when the block is non-empty.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/features/memory/memoryInjector.integration.test.ts`:

```ts
import { buildMemoryBlock } from '@/features/memory/memoryInjector'
import { emptyProfile } from '@/features/memory/types'

// Guards the contract handlers.ts relies on: a non-empty profile yields a
// block that starts with the memory header so it is recognizable as system context.
it('produces an injectable system block for a known student', () => {
  const block = buildMemoryBlock(
    { ...emptyProfile('id-1'), preferred_name: 'Bơ' },
    []
  )
  expect(block.startsWith('📌 HỒ SƠ HỌC SINH')).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx jest src/__tests__/features/memory/memoryInjector.integration.test.ts`
Expected: PASS (validates the contract before wiring).

- [ ] **Step 3: Add the import to handlers.ts**

At the top of `src/features/chat/handlers.ts`, near the other `@/features` imports, add:

```ts
import { buildMemoryBlock } from '@/features/memory/memoryInjector'
import { useMemoryStore } from '@/features/memory/memoryStore'
```

- [ ] **Step 4: Build and insert the memory block**

In `src/features/chat/handlers.ts`, immediately BEFORE the `const messages: Message[] = [` array (~line 892), add:

```ts
    const memoryState = useMemoryStore.getState()
    const memoryBlock = buildMemoryBlock(
      memoryState.profile,
      memoryState.facts
    )
    const memoryMessages: Message[] = memoryBlock
      ? [{ role: 'system', content: memoryBlock }]
      : []
```

Then change the `messages` array so the memory block sits right after `systemPrompt`:

```ts
    const messages: Message[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...memoryMessages,
      ...continuityMessages,
      ...messageSelectors.getProcessedMessages(
        currentChatLog,
        ss.includeTimestampInUserMessage
      ),
    ]
```

- [ ] **Step 5: Verify build and full test suite**

Run: `npx tsc --noEmit` (or `npm run build`) and `npx jest src/__tests__/features/memory`
Expected: no type errors; all memory tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat/handlers.ts src/__tests__/features/memory/memoryInjector.integration.test.ts
git commit -m "feat(memory): inject student memory block into model context"
```

---

## Task 9: Persist each message to Supabase

**Files:**
- Modify: `src/features/stores/home.ts` (the `upsertMessage` action, ~lines 95-110 and the save block ~lines 255-285)

**Interfaces:**
- Consumes: `persistMessage` (Task 6), `useMemoryStore` (Task 7).
- Produces: every new message appended to `chatLog` is also inserted into Supabase `messages`, and `noteMessage()` is called so the extractor knows how many messages have accrued.

- [ ] **Step 1: Add imports to home.ts**

At the top of `src/features/stores/home.ts`, add:

```ts
import { persistMessage } from '@/features/memory/repository'
import { useMemoryStore } from '@/features/memory/memoryStore'
```

- [ ] **Step 2: Persist inside upsertMessage**

In the `upsertMessage` action of `src/features/stores/home.ts`, after the new/updated `chatLog` is computed and set (right before the `return` of the state update or immediately after `set(...)`), add a fire-and-forget persist for genuinely new messages. Add this block at the end of `upsertMessage`, using the resolved `messageId`, `message.role`, and text content:

```ts
        const studentId = useMemoryStore.getState().studentId
        const textContent =
          typeof message.content === 'string'
            ? message.content
            : Array.isArray(message.content)
              ? (message.content[0]?.text ?? '')
              : ''
        if (studentId && existingMessageIndex === -1 && textContent) {
          void persistMessage(
            studentId,
            message.role ?? 'user',
            textContent,
            (message as any).emotion ?? null
          )
          useMemoryStore.getState().noteMessage()
        }
```

Note: `existingMessageIndex` is already computed earlier in `upsertMessage` (it distinguishes new vs. updated messages). Reuse it — only insert to Supabase for new messages (`=== -1`).

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Manual smoke check (documented, no automated test)**

With Supabase env set and schema applied: send a chat message, then confirm a row appears in the `messages` table for your `student_id`. Without env set: chat still works, no rows, no errors in console.

- [ ] **Step 5: Commit**

```bash
git add src/features/stores/home.ts
git commit -m "feat(memory): persist each chat message to Supabase"
```

---

## Task 10: Auto-extraction (AI learns the student)

**Files:**
- Create: `src/features/memory/memoryExtractor.ts`
- Test: `src/__tests__/features/memory/memoryExtractor.test.ts`
- Modify: `src/features/chat/handlers.ts` (fire extraction after a completed assistant turn)

**Interfaces:**
- Consumes: `getVercelAIChatResponse` from `@/features/chat/vercelAIChat` (returns `{ text: string }`); `mergeExtraction` (Task 5); `repository.upsertProfile`, `repository.upsertFacts` (Task 6); `useMemoryStore` (Task 7); `Message` type.
- Produces:
  - `parseExtraction(text: string): ExtractionResult | null` — tolerant JSON parse (strips ```json fences, returns null on failure).
  - `maybeExtract(recentMessages: Message[]): Promise<void>` — runs only when memory enabled, `studentId` present, and `messagesSinceExtract >= threshold`; calls the model, merges, persists, and applies to the store.

- [ ] **Step 1: Write the failing test (parseExtraction)**

Create `src/__tests__/features/memory/memoryExtractor.test.ts`:

```ts
import { parseExtraction } from '@/features/memory/memoryExtractor'

describe('parseExtraction', () => {
  it('parses a plain JSON object', () => {
    const r = parseExtraction('{"preferred_name":"Bơ"}')
    expect(r?.preferred_name).toBe('Bơ')
  })

  it('parses JSON wrapped in a ```json fence', () => {
    const r = parseExtraction('```json\n{"grade_level":"lớp 5"}\n```')
    expect(r?.grade_level).toBe('lớp 5')
  })

  it('returns null for non-JSON', () => {
    expect(parseExtraction('không có gì')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/features/memory/memoryExtractor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/memory/memoryExtractor.ts`:

```ts
import { Message } from '@/features/messages/messages'
import { getVercelAIChatResponse } from '@/features/chat/vercelAIChat'
import { ExtractionResult, emptyProfile } from './types'
import { mergeExtraction } from './mergeExtraction'
import { upsertProfile, upsertFacts } from './repository'
import { useMemoryStore } from './memoryStore'
import { isMemoryEnabled } from './supabaseClient'

const EXTRACT_PROMPT = `Bạn là trợ lý trích xuất thông tin học sinh cho một gia sư AI.
Đọc đoạn hội thoại và trả về DUY NHẤT một JSON (không giải thích) với các khóa tùy có:
display_name, preferred_name (thích được gọi là), address_form (cách xưng hô, vd "cô - con"),
grade_level (lớp), current_topic (đang học gì), progress_notes (học tới đâu),
interests (mảng sở thích), strengths (điểm mạnh), weaknesses (hay sai gì),
memory_summary (tóm tắt ngắn buổi học), facts (mảng {category,key,value} với
category ∈ identity|preference|progress|personal|misc).
CHỈ ghi điều chắc chắn từ hội thoại; bỏ khóa nếu không rõ. Không bịa.`

export function parseExtraction(text: string): ExtractionResult | null {
  if (!text) return null
  let raw = text.trim()
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as ExtractionResult
  } catch {
    return null
  }
}

function threshold(): number {
  const n = Number(process.env.NEXT_PUBLIC_MEMORY_EXTRACT_EVERY_N)
  return Number.isFinite(n) && n > 0 ? n : 6
}

export async function maybeExtract(recentMessages: Message[]): Promise<void> {
  if (!isMemoryEnabled()) return
  const store = useMemoryStore.getState()
  if (!store.studentId) return
  if (store.messagesSinceExtract < threshold()) return

  try {
    const transcript = recentMessages
      .slice(-12)
      .map((m) => {
        const c =
          typeof m.content === 'string'
            ? m.content
            : Array.isArray(m.content)
              ? (m.content[0]?.text ?? '')
              : ''
        return `${m.role}: ${c}`
      })
      .join('\n')

    const { text } = await getVercelAIChatResponse([
      { role: 'system', content: EXTRACT_PROMPT },
      { role: 'user', content: transcript },
    ])

    const extraction = parseExtraction(text)
    if (!extraction) return

    const current = store.profile ?? emptyProfile(store.studentId)
    const { profile, facts } = mergeExtraction(current, extraction)
    await Promise.all([upsertProfile(profile), upsertFacts(facts)])
    useMemoryStore.getState().applyMerge(profile, facts)
  } catch (e) {
    console.warn('maybeExtract failed', e)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/features/memory/memoryExtractor.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Fire extraction after an assistant turn in handlers.ts**

In `src/features/chat/handlers.ts`, add the import near the others:

```ts
import { maybeExtract } from '@/features/memory/memoryExtractor'
```

Then, in the same function where `await processAIResponse(messages)` is called (~line 915), replace the try block so extraction fires after a successful response (non-blocking):

```ts
    try {
      await processAIResponse(messages)
      void maybeExtract(homeStore.getState().chatLog)
    } catch (e) {
      console.error(e)
      homeStore.setState({ chatProcessing: false })
    }
```

- [ ] **Step 6: Verify build + memory tests**

Run: `npx tsc --noEmit && npx jest src/__tests__/features/memory`
Expected: no type errors; all pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/memory/memoryExtractor.ts src/__tests__/features/memory/memoryExtractor.test.ts src/features/chat/handlers.ts
git commit -m "feat(memory): auto-extract student profile after assistant turns"
```

---

## Task 11: Student profile settings panel + ja i18n

**Files:**
- Create: `src/components/settings/studentProfile.tsx`
- Modify: `src/components/settings/index.tsx` (register the `studentProfile` tab)
- Modify: `locales/ja/translation.json` (add keys)

**Interfaces:**
- Consumes: `useMemoryStore` (Task 7).
- Produces: a settings tab that reads `profile`/`facts` from `useMemoryStore` and edits fields via `setProfile`.

- [ ] **Step 1: Create the panel component**

Create `src/components/settings/studentProfile.tsx`. Follow the existing panel style (a series of labeled inputs). Minimal working version:

```tsx
import { useTranslation } from 'react-i18next'
import { useMemoryStore } from '@/features/memory/memoryStore'

const StudentProfile = () => {
  const { t } = useTranslation()
  const profile = useMemoryStore((s) => s.profile)
  const facts = useMemoryStore((s) => s.facts)
  const setProfile = useMemoryStore((s) => s.setProfile)

  const field = (
    key:
      | 'display_name'
      | 'preferred_name'
      | 'address_form'
      | 'grade_level'
      | 'current_topic'
      | 'progress_notes',
    label: string
  ) => (
    <div className="mb-16">
      <div className="mb-8 font-bold">{label}</div>
      <input
        className="text-ellipsis px-16 py-8 w-full bg-white hover:bg-white-hover rounded-8"
        type="text"
        value={profile?.[key] ?? ''}
        onChange={(e) => setProfile({ [key]: e.target.value })}
      />
    </div>
  )

  return (
    <div className="mt-16">
      <div className="mb-16 typography-20 font-bold">
        {t('StudentProfile.Title')}
      </div>
      {field('display_name', t('StudentProfile.DisplayName'))}
      {field('preferred_name', t('StudentProfile.PreferredName'))}
      {field('address_form', t('StudentProfile.AddressForm'))}
      {field('grade_level', t('StudentProfile.GradeLevel'))}
      {field('current_topic', t('StudentProfile.CurrentTopic'))}
      {field('progress_notes', t('StudentProfile.ProgressNotes'))}

      <div className="mb-16">
        <div className="mb-8 font-bold">{t('StudentProfile.Interests')}</div>
        <input
          className="text-ellipsis px-16 py-8 w-full bg-white hover:bg-white-hover rounded-8"
          type="text"
          value={(profile?.interests ?? []).join(', ')}
          onChange={(e) =>
            setProfile({
              interests: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </div>

      <div className="mb-16">
        <div className="mb-8 font-bold">{t('StudentProfile.Facts')}</div>
        <ul className="list-disc ml-16">
          {facts.map((f, i) => (
            <li key={i}>
              [{f.category}] {f.key}: {f.value}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
export default StudentProfile
```

- [ ] **Step 2: Register the tab in settings/index.tsx**

In `src/components/settings/index.tsx`:
1. Add the import: `import StudentProfile from './studentProfile'`.
2. Add `'studentProfile'` to the `TabKey` union type.
3. Add an icon mapping entry: `studentProfile: '/images/setting-icons/character-settings.svg',` (reuse an existing icon to avoid adding assets).
4. Add `studentProfile` to the tab list/menu array and to the switch/JSX that renders the active panel, following exactly how `speechInput` is registered (locate `speechInput` references and mirror each one).

- [ ] **Step 3: Add ja translation keys**

In `locales/ja/translation.json`, add a `StudentProfile` object (place alphabetically/near other panel keys):

```json
"StudentProfile": {
  "Title": "生徒プロフィール",
  "DisplayName": "名前",
  "PreferredName": "呼んでほしい名前",
  "AddressForm": "呼び方",
  "GradeLevel": "学年・レベル",
  "CurrentTopic": "今学んでいること",
  "ProgressNotes": "進度メモ",
  "Interests": "好きなこと（カンマ区切り）",
  "Facts": "記憶している情報"
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds; the new tab renders.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/studentProfile.tsx src/components/settings/index.tsx locales/ja/translation.json
git commit -m "feat(memory): add student profile settings panel"
```

---

## Task 12: Bootstrap memory on app mount

**Files:**
- Modify: `src/pages/index.tsx`

**Interfaces:**
- Consumes: `useMemoryStore.bootstrap` (Task 7).
- Produces: memory store is populated (studentId, profile, facts) shortly after the app mounts, so the first chat turn already has memory available.

- [ ] **Step 1: Add the bootstrap effect**

In `src/pages/index.tsx`, add the import:

```ts
import { useMemoryStore } from '@/features/memory/memoryStore'
```

Inside the top-level page component, add an effect that runs once on mount:

```tsx
  useEffect(() => {
    void useMemoryStore.getState().bootstrap()
  }, [])
```

(If `useEffect` is not already imported from React in this file, add it to the existing React import.)

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Manual smoke check**

With Supabase env set + schema applied: load the app, chat 6+ messages, reload, open the "生徒プロフィール / Hồ sơ học sinh" tab → profile fields populated; ask "cô nhớ con thích gì không?" → teacher recalls. Without env: app behaves exactly as before.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.tsx
git commit -m "feat(memory): bootstrap student memory on app mount"
```

---

## Task 13: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `src/__tests__/features/memory/*` tests.

- [ ] **Step 2: Lint, format, build**

Run: `npm run lint:fix && npm run format && npm run build`
Expected: no lint errors, formatting applied, production build succeeds.

- [ ] **Step 3: Commit any lint/format changes**

```bash
git add -A
git commit -m "chore(memory): lint, format, and build verification"
```

---

## Self-Review Notes

- **Spec coverage:** 3-layer memory → Tasks 4 & 8 (block + injection) and Task 10 (rolling summary via `memory_summary`); tables → Task 1; module files → Tasks 2-7, 10; integration points (handlers/home/index) → Tasks 8, 9, 12; settings UI + ja i18n → Task 11; env vars → Task 1; graceful fallback → Tasks 3, 6 (null-client no-ops) verified in Task 9/12 manual checks; testing → Tasks 2-7, 10 + Task 13.
- **Type consistency:** `StudentProfile`, `MemoryFact`, `ExtractionResult`, `emptyProfile` defined once (Task 2) and reused verbatim; `buildMemoryBlock(profile, facts)`, `mergeExtraction(current, extraction)`, `maybeExtract(recentMessages)`, repository signatures all consistent across consuming tasks.
- **Placeholder scan:** every code step contains full code; no TBD/TODO.
