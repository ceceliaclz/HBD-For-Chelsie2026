# Couple Travel Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a installable PWA where a couple shares one travel book: dark world map, visited countries tinted, cities lit with star markers (swappable packs), rabbit/dog/together colors, search + long-press add, invite-code sync via Supabase.

**Architecture:** Vite + React + TypeScript PWA owns UI and MapLibre rendering. Domain logic (visitor upgrade, stats, invite code format) lives in pure modules with Vitest. IndexedDB is source of truth offline; Supabase tables `couple_books` / `members` / `places` sync when online. Device identity is a local UUID, not a login account.

**Tech Stack:** Vite 6, React 19, TypeScript, Vitest, MapLibre GL, idb-keyval (or idb), Supabase JS, vite-plugin-pwa, React Router.

## Global Constraints

- Product decisions are locked in `docs/superpowers/specs/2026-08-09-couple-travel-map-design.md` — do not re-litigate scope.
- Colors: rabbit `#F5A0BF`, dog `#8CC8FF`, together `#FFD278`; map background `#121826`.
- Marker packs: `stars` (default) | `stamps` | `animals`.
- Roles: `rabbit` | `dog`; visitor: `rabbit` | `dog` | `together`.
- Invite code: 6 chars, uppercase A–Z and 2–9 (exclude ambiguous `0O1I`).
- No formal auth in v1; max 2 members per book.
- Amounts/currency N/A. Always respond to user in 中文 when chatting; code/comments in English.
- Every task ends with green tests (or a manual check listed in the task) and a commit.

## File Structure

```
package.json
vite.config.ts
vitest.config.ts
index.html
public/
  favicon.svg
  geo/countries-110m.json          # simplified Natural Earth (add in Task 5)
  data/cities-seed.json            # ~200 major cities for search (Task 7)
src/
  main.tsx
  App.tsx
  styles/global.css
  domain/
    types.ts
    inviteCode.ts
    visitorUpgrade.ts
    stats.ts
    markerPacks.ts
  storage/
    localDb.ts
    keys.ts
  sync/
    supabaseClient.ts
    syncEngine.ts
    schema.sql                     # reference SQL for Supabase dashboard
  geo/
    countryLookup.ts
    citySearch.ts
    reverseApprox.ts
  state/
    bookStore.ts                   # React context + hooks
  components/
    MapView.tsx
    BottomCard.tsx
    AddPlaceSheet.tsx
    SettingsSheet.tsx
    Onboarding.tsx
    RolePicker.tsx
  pages/
    HomePage.tsx
    JoinPage.tsx
  lib/
    id.ts
    time.ts
tests/
  domain/inviteCode.test.ts
  domain/visitorUpgrade.test.ts
  domain/stats.test.ts
  geo/citySearch.test.ts
  sync/syncEngine.test.ts
```

---

### Task 1: Scaffold Vite React TS + Vitest + base styles

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/global.css`, `src/vite-env.d.ts`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: none
- Produces: runnable `npm run dev`, `npm test`

- [ ] **Step 1: Create Vite React-TS app in repo root**

```bash
cd /Users/yanmutong/Desktop/couple-travel-map
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

If create-vite refuses non-empty dir, init files manually with the same template layout; keep existing `docs/` and `.gitignore`.

- [ ] **Step 2: Configure Vitest**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
})
```

Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: Write smoke test**

```ts
// tests/smoke.test.ts
import { describe, it, expect } from 'vitest'

describe('scaffold', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 4: Global dark theme CSS**

```css
/* src/styles/global.css */
:root {
  --bg: #121826;
  --card: rgba(28, 36, 54, 0.92);
  --text: #f5f7fb;
  --muted: rgba(245, 247, 251, 0.65);
  --rabbit: #f5a0bf;
  --dog: #8cc8ff;
  --together: #ffd278;
  --radius: 16px;
  font-family: "Segoe UI", "PingFang SC", sans-serif;
}
html, body, #root { height: 100%; margin: 0; background: var(--bg); color: var(--text); }
* { box-sizing: border-box; }
```

Wire in `main.tsx`. Replace default App with a placeholder heading `我们的地图`.

- [ ] **Step 5: Run tests**

Run: `npm test`  
Expected: PASS smoke test

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts vitest.config.ts tsconfig*.json index.html src tests
git commit -m "chore: scaffold Vite React PWA project with Vitest"
```

---

### Task 2: Domain types + invite code + visitor upgrade + stats

**Files:**
- Create: `src/domain/types.ts`, `src/domain/inviteCode.ts`, `src/domain/visitorUpgrade.ts`, `src/domain/stats.ts`, `src/domain/markerPacks.ts`, `src/lib/id.ts`, `src/lib/time.ts`
- Test: `tests/domain/inviteCode.test.ts`, `tests/domain/visitorUpgrade.test.ts`, `tests/domain/stats.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `type Role = 'rabbit' | 'dog'`
  - `type Visitor = 'rabbit' | 'dog' | 'together'`
  - `type MarkerPack = 'stars' | 'stamps' | 'animals'`
  - `interface CoupleBook { id: string; inviteCode: string; markerPack: MarkerPack; createdAt: string }`
  - `interface Member { id: string; bookId: string; role: Role; deviceToken: string; joinedAt: string }`
  - `interface Place { id: string; bookId: string; placeType: 'country' | 'city'; name: string; countryCode: string; lat: number; lng: number; visitor: Visitor; visitedOn?: string; updatedAt: string }`
  - `generateInviteCode(): string`
  - `isValidInviteCode(code: string): boolean`
  - `normalizeInviteCode(raw: string): string`
  - `mergeVisitor(existing: Visitor | null, incoming: Visitor): Visitor`
  - `computeStats(places: Place[]): { countryCount: number; cityCount: number; togetherCount: number }`
  - `markerGlyph(pack: MarkerPack, visitor: Visitor): string`

- [ ] **Step 1: Write failing invite code tests**

```ts
// tests/domain/inviteCode.test.ts
import { describe, it, expect } from 'vitest'
import { generateInviteCode, isValidInviteCode, normalizeInviteCode } from '../../src/domain/inviteCode'

describe('inviteCode', () => {
  it('generates 6-char codes without ambiguous chars', () => {
    const code = generateInviteCode()
    expect(code).toMatch(/^[A-Z2-9]{6}$/)
    expect(code).not.toMatch(/[0O1I]/)
  })

  it('normalizes and validates', () => {
    expect(normalizeInviteCode(' love7k ')).toBe('LOVE7K')
    expect(isValidInviteCode('LOVE7K')).toBe(true)
    expect(isValidInviteCode('LOVE0O')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/domain/inviteCode.test.ts`  
Expected: FAIL module not found

- [ ] **Step 3: Implement invite code**

```ts
// src/domain/inviteCode.ts
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateInviteCode(): string {
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  for (let i = 0; i < 6; i++) out += ALPHABET[bytes[i]! % ALPHABET.length]
  return out
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidInviteCode(code: string): boolean {
  const c = normalizeInviteCode(code)
  return /^[A-Z2-9]{6}$/.test(c) && !/[0O1I]/.test(c)
}
```

Note: `LOVE7K` uses L,O,V,E,7,K — `O` is ambiguous and `isValidInviteCode('LOVE7K')` would be false with strict alphabet. **Fix the test** to use a valid example like `TRAVEL` or `MAP7YK`, and keep generator alphabet without `0O1I`.

- [ ] **Step 4: Visitor upgrade tests + impl**

```ts
// tests/domain/visitorUpgrade.test.ts
import { describe, it, expect } from 'vitest'
import { mergeVisitor } from '../../src/domain/visitorUpgrade'

describe('mergeVisitor', () => {
  it('keeps first visitor when same', () => {
    expect(mergeVisitor('rabbit', 'rabbit')).toBe('rabbit')
  })
  it('upgrades rabbit+dog to together', () => {
    expect(mergeVisitor('rabbit', 'dog')).toBe('together')
    expect(mergeVisitor('dog', 'rabbit')).toBe('together')
  })
  it('together stays together', () => {
    expect(mergeVisitor('together', 'rabbit')).toBe('together')
  })
  it('null existing uses incoming', () => {
    expect(mergeVisitor(null, 'dog')).toBe('dog')
  })
})
```

```ts
// src/domain/visitorUpgrade.ts
import type { Visitor } from './types'

export function mergeVisitor(existing: Visitor | null, incoming: Visitor): Visitor {
  if (!existing) return incoming
  if (existing === 'together' || incoming === 'together') return 'together'
  if (existing === incoming) return existing
  return 'together'
}
```

- [ ] **Step 5: Stats tests + impl**

```ts
// tests/domain/stats.test.ts
import { describe, it, expect } from 'vitest'
import { computeStats } from '../../src/domain/stats'
import type { Place } from '../../src/domain/types'

const base = {
  bookId: 'b1',
  lat: 0,
  lng: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('computeStats', () => {
  it('counts unique countries, cities, together', () => {
    const places: Place[] = [
      { ...base, id: '1', placeType: 'city', name: 'Tokyo', countryCode: 'JP', visitor: 'together' },
      { ...base, id: '2', placeType: 'city', name: 'Osaka', countryCode: 'JP', visitor: 'rabbit' },
      { ...base, id: '3', placeType: 'country', name: 'France', countryCode: 'FR', visitor: 'dog' },
    ]
    expect(computeStats(places)).toEqual({
      countryCount: 2,
      cityCount: 2,
      togetherCount: 1,
    })
  })
})
```

```ts
// src/domain/stats.ts
import type { Place } from './types'

export function computeStats(places: Place[]) {
  const countries = new Set(places.map((p) => p.countryCode))
  return {
    countryCount: countries.size,
    cityCount: places.filter((p) => p.placeType === 'city').length,
    togetherCount: places.filter((p) => p.visitor === 'together').length,
  }
}
```

- [ ] **Step 6: types + markerPacks + id helpers**

Implement `types.ts`, `markerPacks.ts` (`markerGlyph` returns emoji per pack/visitor), `lib/id.ts` (`crypto.randomUUID()`), `lib/time.ts` (`nowIso()`).

- [ ] **Step 7: Run all domain tests**

Run: `npm test`  
Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add src/domain src/lib tests/domain
git commit -m "feat: add domain types, invite code, visitor merge, stats"
```

---

### Task 3: Local persistence (IndexedDB)

**Files:**
- Create: `src/storage/keys.ts`, `src/storage/localDb.ts`
- Test: `tests/storage/localDb.test.ts`

**Interfaces:**
- Consumes: domain types
- Produces:
  - `getDeviceToken(): Promise<string>`
  - `saveBook(book: CoupleBook): Promise<void>`
  - `loadBook(): Promise<CoupleBook | null>`
  - `saveMember(member: Member): Promise<void>`
  - `loadMember(): Promise<Member | null>`
  - `upsertPlace(place: Place): Promise<Place>` // merges visitor via mergeVisitor when same city/country key
  - `listPlaces(): Promise<Place[]>`
  - `replaceAllPlaces(places: Place[]): Promise<void>`
  - `clearAll(): Promise<void>`
  - Place identity key for merge: `${placeType}:${countryCode}:${name}`

- [ ] **Step 1: Install idb**

```bash
npm install idb
```

- [ ] **Step 2: Write failing upsert merge test** (use fake-indexeddb)

```bash
npm install -D fake-indexeddb
```

```ts
// tests/storage/localDb.test.ts
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { clearAll, upsertPlace, listPlaces, saveBook } from '../../src/storage/localDb'

beforeEach(async () => {
  await clearAll()
  await saveBook({
    id: 'book1',
    inviteCode: 'MAP7YK',
    markerPack: 'stars',
    createdAt: '2026-01-01T00:00:00.000Z',
  })
})

describe('upsertPlace', () => {
  it('upgrades visitor when same place re-added by other role', async () => {
    await upsertPlace({
      id: 'p1',
      bookId: 'book1',
      placeType: 'city',
      name: 'Tokyo',
      countryCode: 'JP',
      lat: 35.6,
      lng: 139.7,
      visitor: 'rabbit',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const merged = await upsertPlace({
      id: 'p2',
      bookId: 'book1',
      placeType: 'city',
      name: 'Tokyo',
      countryCode: 'JP',
      lat: 35.6,
      lng: 139.7,
      visitor: 'dog',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(merged.visitor).toBe('together')
    const all = await listPlaces()
    expect(all).toHaveLength(1)
    expect(all[0]!.visitor).toBe('together')
  })
})
```

- [ ] **Step 3: Implement localDb with idb schema `couple-travel` v1 stores: meta, places**

Use meta keys: `deviceToken`, `book`, `member`. On upsert, find existing by place key; if found, set `visitor = mergeVisitor(existing.visitor, incoming.visitor)`, keep existing `id`, bump `updatedAt`.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/storage/localDb.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage tests/storage package.json package-lock.json
git commit -m "feat: IndexedDB local book and place upsert with visitor merge"
```

---

### Task 4: Supabase schema + client stubs + sync engine unit tests

**Files:**
- Create: `src/sync/schema.sql`, `src/sync/supabaseClient.ts`, `src/sync/syncEngine.ts`, `.env.example`
- Test: `tests/sync/syncEngine.test.ts`
- Modify: `.gitignore` (ensure `.env` ignored — already present)

**Interfaces:**
- Consumes: localDb, types
- Produces:
  - `createBookRemote(input: { book: CoupleBook; member: Member }): Promise<void>`
  - `joinBookRemote(input: { inviteCode: string; member: Member }): Promise<{ book: CoupleBook; members: Member[] }>`
  - `pushDirtyPlaces(bookId: string, places: Place[]): Promise<void>`
  - `pullPlaces(bookId: string): Promise<Place[]>`
  - `syncNow(): Promise<'ok' | 'offline' | 'no-book'>` — push then pull, `replaceAllPlaces` with merged by `updatedAt`

- [ ] **Step 1: Write schema.sql for dashboard**

```sql
-- src/sync/schema.sql
create table if not exists couple_books (
  id uuid primary key,
  invite_code text unique not null check (char_length(invite_code) = 6),
  marker_pack text not null default 'stars',
  created_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key,
  book_id uuid not null references couple_books(id) on delete cascade,
  role text not null check (role in ('rabbit','dog')),
  device_token text not null,
  joined_at timestamptz not null default now(),
  unique (book_id, role),
  unique (book_id, device_token)
);

create table if not exists places (
  id uuid primary key,
  book_id uuid not null references couple_books(id) on delete cascade,
  place_type text not null check (place_type in ('country','city')),
  name text not null,
  country_code text not null,
  lat double precision not null,
  lng double precision not null,
  visitor text not null check (visitor in ('rabbit','dog','together')),
  visited_on date null,
  updated_at timestamptz not null,
  unique (book_id, place_type, country_code, name)
);

alter table couple_books enable row level security;
alter table members enable row level security;
alter table places enable row level security;

-- v1: allow anon key full access via permissive policies (invite secrecy is the gate).
create policy "anon_all_books" on couple_books for all using (true) with check (true);
create policy "anon_all_members" on members for all using (true) with check (true);
create policy "anon_all_places" on places for all using (true) with check (true);
```

Document in plan note: run this once in Supabase SQL editor; put URL + anon key in `.env`.

- [ ] **Step 2: Install supabase-js**

```bash
npm install @supabase/supabase-js
```

`.env.example`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

- [ ] **Step 3: syncEngine merge test with mocked remote**

```ts
// tests/sync/syncEngine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Place } from '../../src/domain/types'

const local = vi.hoisted(() => ({
  listPlaces: vi.fn(),
  replaceAllPlaces: vi.fn(),
  loadBook: vi.fn(),
}))

vi.mock('../../src/storage/localDb', () => local)

import { mergePlacesByUpdatedAt } from '../../src/sync/syncEngine'

describe('mergePlacesByUpdatedAt', () => {
  it('prefers newer updatedAt', () => {
    const a: Place = {
      id: '1', bookId: 'b', placeType: 'city', name: 'Tokyo', countryCode: 'JP',
      lat: 1, lng: 2, visitor: 'rabbit', updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const b = { ...a, visitor: 'together' as const, updatedAt: '2026-01-03T00:00:00.000Z' }
    const merged = mergePlacesByUpdatedAt([a], [b])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.visitor).toBe('together')
  })
})
```

Export pure `mergePlacesByUpdatedAt(localPlaces, remotePlaces): Place[]` keyed by `${placeType}:${countryCode}:${name}`.

- [ ] **Step 4: Implement supabaseClient + syncEngine**

`getSupabase()` returns client or `null` if env missing. `syncNow` returns `'offline'` when `!navigator.onLine`, `'no-book'` when no local book, else push/pull.

Join must reject third member: if both roles taken, throw `BookFullError`. If requested role taken, throw `RoleTakenError`.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/sync/syncEngine.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/sync tests/sync .env.example package.json package-lock.json
git commit -m "feat: Supabase schema reference and sync merge engine"
```

---

### Task 5: MapLibre dark map + country tint layer

**Files:**
- Create: `public/geo/countries-110m.json`, `src/geo/countryLookup.ts`, `src/components/MapView.tsx`
- Modify: `src/pages/HomePage.tsx`, `package.json`
- Test: `tests/geo/countryLookup.test.ts`

**Interfaces:**
- Consumes: `Place[]`, filter visitor, marker pack
- Produces: `<MapView places={...} filter={...} markerPack={...} onLongPress={fn} />`
  - `onLongPress: (lngLat: { lng: number; lat: number }) => void`
  - Countries with any matching place get fill color by dominant visitor (together > rabbit/dog mix → together tint; else role color at ~0.35 opacity)

- [ ] **Step 1: Install maplibre**

```bash
npm install maplibre-gl
```

Download or vendor a simplified countries GeoJSON into `public/geo/countries-110m.json` with properties `ISO_A2` or `iso_a2`. Document source (Natural Earth 110m) in a one-line comment at top of `countryLookup.ts`.

- [ ] **Step 2: countryLookup helpers**

```ts
export function visitedCountryCodes(places: Place[], filter: Visitor | 'all'): Set<string>
export function countryFillExpression(codesByVisitor: Map<string, Visitor>): maplibregl.ExpressionSpecification
```

Test: filtering `together` only includes together places' countries.

- [ ] **Step 3: MapView component**

- Style: dark basemap — use MapLibre demo dark style or `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json` if acceptable; fallback solid `#121826` + country borders only if tile access blocked.
- Add GeoJSON source `countries`, fill layer, line layer.
- On `places` change, set feature-state or filter fill-color match expression.
- Listen `contextmenu` + touch long-press (~500ms) → `onLongPress`.

- [ ] **Step 4: Manual check**

Run: `npm run dev`  
Expected: dark globe/map renders; no crash without places.

- [ ] **Step 5: Commit**

```bash
git add public/geo src/geo src/components/MapView.tsx src/pages/HomePage.tsx package.json package-lock.json tests/geo
git commit -m "feat: MapLibre dark map with visited country tint"
```

---

### Task 6: City markers + marker packs + bottom card + filters

**Files:**
- Create: `src/components/BottomCard.tsx`, `src/components/CityMarkers.tsx` (or logic inside MapView)
- Modify: `src/domain/markerPacks.ts`, `src/components/MapView.tsx`, `src/pages/HomePage.tsx`
- Test: extend `tests/domain/stats.test.ts` if needed; `tests/domain/markerPacks.test.ts`

**Interfaces:**
- Consumes: `computeStats`, `markerGlyph`
- Produces: bottom card showing country/city/together counts; chips `全部|兔子|小狗|一起`

- [ ] **Step 1: markerPacks test**

```ts
import { markerGlyph } from '../../src/domain/markerPacks'
expect(markerGlyph('stars', 'together')).toBe('💖')
expect(markerGlyph('stars', 'rabbit')).toMatch(/⭐|🌟/)
expect(markerGlyph('animals', 'dog')).toBe('🐕')
```

- [ ] **Step 2: Render city places as MapLibre symbol layer or HTML markers**

For v1 HTML markers are fine: one marker per filtered city place; CSS `filter: drop-shadow` using role color; together uses gold glow.

- [ ] **Step 3: BottomCard UI**

Fixed bottom sheet over map; chips update filter state in `HomePage`.

- [ ] **Step 4: Manual check** — seed 2–3 places in localDb via temporary console helpers or a stub button (remove before Task 7 if ugly; or leave behind `#debug` only in DEV).

- [ ] **Step 5: Commit**

```bash
git add src/components src/domain/markerPacks.ts tests/domain/markerPacks.test.ts src/pages/HomePage.tsx
git commit -m "feat: city markers, packs, bottom stats and filters"
```

---

### Task 7: Search add place flow

**Files:**
- Create: `public/data/cities-seed.json`, `src/geo/citySearch.ts`, `src/components/AddPlaceSheet.tsx`
- Modify: `src/pages/HomePage.tsx`, `src/state/bookStore.ts` (create if not yet)
- Test: `tests/geo/citySearch.test.ts`

**Interfaces:**
- Consumes: `upsertPlace`, `syncNow`
- Produces: `searchCities(query: string, limit = 8): CityHit[]` where `CityHit = { name: string; countryCode: string; countryName: string; lat: number; lng: number }`
- `AddPlaceSheet` props: `{ open: boolean; onClose(): void; defaultVisitor: Visitor; onSubmit(hit, visitor, visitedOn?: string): Promise<void> }`

- [ ] **Step 1: Seed file** — include at least Tokyo, Osaka, Paris, London, New York, Bali/Denpasar, Seoul, Bangkok, Singapore, Sydney (more OK).

- [ ] **Step 2: citySearch tests**

```ts
expect(searchCities('tok').some((h) => h.name === 'Tokyo')).toBe(true)
expect(searchCities('').length).toBe(0)
```

- [ ] **Step 3: AddPlaceSheet UI**

Search input, result list, visitor chips (rabbit/dog/together), optional date input, primary button `点亮`.

Also allow searching countries by name from a small country name map derived from GeoJSON properties.

- [ ] **Step 4: Wire + button on HomePage** → opens sheet; onSubmit upserts city (and ensures country tint via city countryCode), then `syncNow()` best-effort, plays CSS sparkle on marker if easy.

- [ ] **Step 5: Run tests + manual add Tokyo as together**

- [ ] **Step 6: Commit**

```bash
git add public/data src/geo/citySearch.ts src/components/AddPlaceSheet.tsx src/pages/HomePage.tsx src/state tests/geo/citySearch.test.ts
git commit -m "feat: search-based add place sheet"
```

---

### Task 8: Long-press map add

**Files:**
- Create: `src/geo/reverseApprox.ts`
- Modify: `src/components/MapView.tsx`, `src/components/AddPlaceSheet.tsx`, `src/pages/HomePage.tsx`
- Test: `tests/geo/reverseApprox.test.ts`

**Interfaces:**
- Consumes: country GeoJSON point-in-polygon or nearest country centroid fallback
- Produces: `approxPlaceFromLngLat({lng,lat}): { countryCode: string; countryName: string; nearestCity?: CityHit }`
- Long-press opens `AddPlaceSheet` prefilled with nearest city if < 80km else country-only placeType `country`

- [ ] **Step 1: Implement distance (haversine) + nearest city**

```ts
export function haversineKm(a: LatLng, b: LatLng): number
export function nearestCity(lngLat: LatLng, cities: CityHit[], maxKm = 80): CityHit | null
```

- [ ] **Step 2: Wire MapView onLongPress → HomePage opens sheet with prefills**

- [ ] **Step 3: Manual check on desktop (right-click) and touch if available**

- [ ] **Step 4: Commit**

```bash
git add src/geo/reverseApprox.ts tests/geo/reverseApprox.test.ts src/components src/pages
git commit -m "feat: long-press map to add nearby city or country"
```

---

### Task 9: Onboarding — create book / join by invite / role picker

**Files:**
- Create: `src/components/Onboarding.tsx`, `src/components/RolePicker.tsx`, `src/components/SettingsSheet.tsx`, `src/pages/JoinPage.tsx`
- Modify: `src/App.tsx` (router), `src/state/bookStore.ts`
- Test: optional component test skipped if heavy; rely on domain + manual

**Interfaces:**
- Routes: `/` home (requires book+member), `/join/:code?` join flow
- `createCoupleBook(role: Role)` → local save + `createBookRemote`
- `joinCoupleBook(code: string, role: Role)` → remote join + local save + pull places
- Settings: show invite code, copy, share URL `${origin}/join/${code}`, marker pack select → update book local+remote

- [ ] **Step 1: Install router**

```bash
npm install react-router-dom
```

- [ ] **Step 2: Onboarding empty state**

If no local book: cards「创建我们的地图」/「加入对方」.

- [ ] **Step 3: RolePicker** — two large choices 兔子 / 线条小狗 with colors.

- [ ] **Step 4: JoinPage reads param, validates code, role pick, handles RoleTakenError / BookFullError with Chinese toasts.

- [ ] **Step 5: SettingsSheet from top bar — pack switch + invite.

- [ ] **Step 6: Manual two-browser profile test with real Supabase (or document mock mode: if no env, multi-device sync disabled but local works; join shows「未配置云同步」).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/Onboarding.tsx src/components/RolePicker.tsx src/components/SettingsSheet.tsx src/pages/JoinPage.tsx src/state package.json package-lock.json
git commit -m "feat: create/join couple book with invite code and settings"
```

---

### Task 10: Sync lifecycle + online/offline UX

**Files:**
- Modify: `src/sync/syncEngine.ts`, `src/state/bookStore.ts`, `src/pages/HomePage.tsx`
- Test: extend `tests/sync/syncEngine.test.ts` for offline branch

**Interfaces:**
- Call `syncNow` on: app focus, after upsert, interval 30s when visible
- Show small status: `已同步` / `离线 · 本地已保存` / `同步失败`

- [ ] **Step 1: Unit test syncNow offline returns `'offline'`** with `navigator.onLine` mocked false

- [ ] **Step 2: Wire listeners in bookStore provider**

- [ ] **Step 3: Manual: toggle offline in DevTools, add place, go online, confirm remote row

- [ ] **Step 4: Commit**

```bash
git add src/sync src/state src/pages tests/sync
git commit -m "feat: background sync and offline status UX"
```

---

### Task 11: PWA installability

**Files:**
- Modify: `vite.config.ts`, `index.html`, `package.json`
- Create: `public/pwa-192.png`, `public/pwa-512.png` (simple dark icon with star)

**Interfaces:**
- `vite-plugin-pwa` with manifest name `我们的地图`, theme_color `#121826`, display `standalone`

- [ ] **Step 1: Install plugin**

```bash
npm install -D vite-plugin-pwa
```

- [ ] **Step 2: Configure manifest + workbox glob for js/css/html/geo/data**

Do not precache all map tiles.

- [ ] **Step 3: Build + preview**

Run: `npm run build && npm run preview`  
Expected: install prompt eligible (Chrome); app loads offline for shell.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts index.html public/pwa-*.png package.json package-lock.json
git commit -m "feat: enable PWA manifest and service worker"
```

---

### Task 12: Polish copy, empty states, README, deploy checklist

**Files:**
- Create: `README.md`
- Modify: UI copy strings for errors; remove DEV seed buttons

**Interfaces:** none new

- [ ] **Step 1: README** — setup Supabase (run schema.sql), env vars, `npm run dev`, how to install PWA on iOS/Android, how couple invite works

- [ ] **Step 2: Final manual QA checklist from spec §10** (tick in PR description or commit message body)

- [ ] **Step 3: Commit**

```bash
git add README.md src
git commit -m "docs: README and final UX copy for couple travel map v1"
```

---

## Self-Review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| PWA dark fullscreen map + bottom card | 5, 6, 11 |
| Country tint + city markers | 5, 6 |
| Marker packs stars/stamps/animals | 2, 6, 9 |
| Rabbit/dog/together colors | 2, 6 |
| Places + optional date | 3, 7 |
| Search + long-press add | 7, 8 |
| Filters | 6 |
| Invite code + share link sync | 2, 4, 9, 10 |
| Offline local + sync | 3, 10 |
| No formal auth / no daily itinerary / no photos | respected (out of scope) |

Placeholder scan: none intentional. Types aligned on `Visitor` / `Role` / `MarkerPack` / `Place` across tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-09-couple-travel-map.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration  
2. **Inline Execution** — execute tasks in this session with executing-plans and checkpoints  

Which approach?
