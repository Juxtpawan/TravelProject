# React Frontend Structure — Travel Planning App (Wanderlog/TripAdvisor style)

Stack: React + JavaScript, backend on Node/Cloudflare Workers, D1, R2, Gemini, Google Maps.

This uses a **feature-based structure** — code is grouped by *domain* (trips, places, reviews) rather than by *type* (all components in one folder, all hooks in another). This is the standard pattern in mid-to-large React codebases because it keeps everything related to one concern in one place, so you're not hunting across five folders to work on "reviews."

---

## Full folder tree

```
src/
├── app/
├── features/
│   ├── trips/
│   ├── itinerary/
│   ├── places/
│   ├── reviews/
│   ├── ai/
│   ├── maps/
│   ├── uploads/
│   ├── auth/
│   └── users/
├── shared/
├── layouts/
├── pages/
├── lib/
├── styles/
├── assets/
└── config/
```

Below is what goes in each, and **why**.

---

## `app/` — app bootstrapping

The "wiring" of your app. Nothing feature-specific lives here.

```
app/
├── App.jsx          # root component, mounts router
├── routes.jsx        # all route definitions in one place
└── providers.jsx      # wraps QueryClientProvider, AuthProvider, ThemeProvider etc.
```

**Why separate `routes.jsx` and `providers.jsx` from `App.jsx`?**
As the app grows, `App.jsx` would otherwise become a huge nested mess of providers and routes. Splitting them means you can find "what routes exist" or "what global context wraps the app" instantly, without scrolling through JSX.

---

## `features/` — the core of your app (most of your code lives here)

Each subfolder is a **self-contained domain**. If you deleted the `reviews/` folder, the reviews feature would be gone, with minimal leftover mess elsewhere.

### Standard shape of every feature folder:

```
features/trips/
├── api/            # data fetching — talks to your backend
├── components/     # UI pieces used ONLY within this feature
├── hooks/          # feature-specific logic (non-data hooks)
├── utils.js        # helper functions specific to this feature
└── index.js        # the "public exports" — what other features/pages can import
```

**`api/`** — this is where you call your backend (via React Query or plain fetch). Example: `useTrips.js` fetches the list of trips, `useCreateTrip.js` posts a new one. Keeping this separate from components means your UI doesn't care *how* data is fetched, just that it gets data.

**`components/`** — anything only `trips` needs, like `TripCard.jsx` or `CreateTripModal.jsx`. If a component starts being used by *another* feature too, that's your signal to move it to `shared/components/`.

**`hooks/`** — logic that isn't data-fetching, e.g. `useTripDragDrop.js` for reordering days in an itinerary.

**`index.js`** — a "barrel file" that re-exports the public pieces:
```js
export { default as TripCard } from './components/TripCard';
export { useTrips } from './api/useTrips';
```
This lets other files import cleanly:
```js
import { TripCard, useTrips } from '@/features/trips';
```
instead of digging through `../../../features/trips/components/TripCard`.

### Your specific features:

| Folder | What it holds |
|---|---|
| `trips/` | Trip list, trip creation, trip cards, trip settings |
| `itinerary/` | Day-by-day planning inside a trip — drag/drop activities, timeline view |
| `places/` | Searching places, place detail cards, place photos |
| `reviews/` | Writing/viewing reviews, star ratings |
| `ai/` | Gemini-powered features — "generate itinerary," "suggest activities," AI chat panel |
| `maps/` | Google Maps wrapper components — map view, markers, autocomplete, route lines |
| `uploads/` | Image upload flow to R2 (presigned URL request + upload progress UI) |
| `auth/` | Login, signup, password reset forms |
| `users/` | Profile pages, followers, account settings |

**Why is `maps/` its own feature instead of living inside `trips/`?**
Because `trips`, `itinerary`, and `places` will *all* need to show a map. If map logic were buried inside `trips/`, you'd end up duplicating it or awkwardly importing across features. Treating Maps as its own feature (with a clean API like `<MapView markers={...} />`) means any feature can drop it in.

---

## `shared/` — genuinely reusable code (used by 2+ features)

```
shared/
├── components/     # Button, Modal, Input, Avatar, Skeleton, Spinner
├── hooks/          # useDebounce, useLocalStorage, useMediaQuery
├── utils/          # formatDate, formatCurrency, truncateText
└── constants/       # e.g. TRIP_STATUS options, MAX_UPLOAD_SIZE
```

**Rule of thumb:** if you're not sure whether something belongs in `shared/` or a `feature/`, **keep it in the feature folder first**. It's trivial to move something *up* to shared later when a second feature needs it. It's much messier to untangle something from `shared/` once multiple features depend on it and it turns out it wasn't actually generic.

---

## `layouts/` — page shells

```
layouts/
├── MainLayout.jsx       # navbar + footer wrapper for most pages
├── AuthLayout.jsx        # centered card layout for login/signup
└── DashboardLayout.jsx    # sidebar layout for the trip planning workspace
```

These wrap `pages/` with consistent chrome (nav, sidebar, footer) so you're not repeating that markup on every page.

---

## `pages/` — route-level components (kept thin)

```
pages/
├── HomePage.jsx
├── ExplorePage.jsx         # browse/search places
├── TripDetailsPage.jsx      # the main trip planning screen
└── ProfilePage.jsx
```

**Important principle:** pages should mostly just *compose* feature components — they shouldn't contain business logic themselves.

Example of a "thin" page:
```jsx
// pages/TripDetailsPage.jsx
function TripDetailsPage() {
  const { tripId } = useParams();
  const { data: trip } = useTrip(tripId);       // from features/trips
  return (
    <DashboardLayout>
      <ItineraryTimeline trip={trip} />          {/* from features/itinerary */}
      <MapView markers={trip.places} />           {/* from features/maps */}
    </DashboardLayout>
  );
}
```
All the real logic lives in the features being composed here, not in the page itself. This keeps pages easy to read and features independently testable.

---

## `lib/` — third-party service configuration

```
lib/
├── apiClient.js       # axios/fetch instance pointed at your backend
├── queryClient.js      # React Query client config (cache times, retries)
└── googleMapsLoader.js  # loads the Google Maps JS SDK once, app-wide
```

**Why separate from `features/maps/`?** `lib/` holds *raw SDK setup* — the low-level "load the script, configure the client" work. `features/maps/` holds the *React components* built on top of that SDK (MapView, markers, etc). Keeping the raw client separate means if you ever swap Google Maps for Mapbox, you change one file in `lib/`, not every component.

---

## `styles/`, `assets/`, `config/`

```
styles/
├── globals.css        # resets, base typography
└── theme.js           # design tokens — colors, spacing, if not using Tailwind

assets/
├── images/
└── icons/

config/
└── env.js             # reads import.meta.env values (API URL, Maps key, etc.) in one place
```

**Why `config/env.js` instead of using `import.meta.env.X` everywhere?**
If you read env vars directly all over the codebase, renaming a variable means hunting through every file. Centralizing it means one file to update, and you get a clear list of every env var your app actually uses:
```js
// config/env.js
export const ENV = {
  API_URL: import.meta.env.VITE_API_URL,
  GOOGLE_MAPS_KEY: import.meta.env.VITE_GOOGLE_MAPS_KEY,
};
```

---

## Naming & organization conventions worth adopting early

1. **File naming**: `.jsx` for anything returning JSX, plain `.js` for hooks/utils/services.
2. **Path aliases** — set up `@/features`, `@/shared`, `@/lib` in `vite.config.js` so imports never look like `../../../../shared/components/Button`.
3. **Co-locate tests and styles** with their component:
   ```
   TripCard.jsx
   TripCard.test.jsx
   TripCard.module.css
   ```
   rather than a separate mirrored `__tests__/` tree — keeps related files next to each other.
4. **JSDoc for shape documentation** (since you're in JS, not TS) — helps editor autocomplete and documents data shapes without full TypeScript:
   ```js
   /**
    * @typedef {Object} Trip
    * @property {string} id
    * @property {string} title
    * @property {string} startDate
    * @property {string} endDate
    */
   ```

---

## Quick decision guide when adding a new file

| Question | Answer |
|---|---|
| Is it a component only `trips` uses? | `features/trips/components/` |
| Is it a component 2+ features use? | `shared/components/` |
| Does it fetch/mutate data from your API? | `features/<domain>/api/` |
| Is it a full page tied to a route? | `pages/` |
| Does it configure a 3rd-party SDK (Maps, Gemini client, axios)? | `lib/` |
| Is it a reusable non-data hook (debounce, media query)? | `shared/hooks/` |
| Is it feature-specific logic (drag-drop, form state)? | `features/<domain>/hooks/` |







server/
├── src/
│   ├── index.js
│   ├── routes/
│   │   ├── trips.routes.js
│   │   ├── places.routes.js
│   │   ├── reviews.routes.js
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── ai.routes.js
│   │   └── uploads.routes.js
│   │
│   ├── controllers/
│   │   ├── trips.controller.js
│   │   ├── places.controller.js
│   │   ├── reviews.controller.js
│   │   ├── ai.controller.js
│   │   └── uploads.controller.js
│   │
│   ├── services/
│   │   ├── trips.service.js
│   │   ├── places.service.js
│   │   ├── gemini.service.js
│   │   │   └── prompts/             # separate prompt templates as they grow
│   │   │       ├── generateItinerary.prompt.js
│   │   │       └── summarizeReviews.prompt.js
│   │   ├── r2.service.js
│   │   ├── googleMaps.service.js
│   │   └── auth.service.js
│   │
│   ├── db/
│   │   ├── client.js
│   │   ├── schema.js                # Drizzle schema (still plain JS, no types needed)
│   │   ├── migrations/
│   │   │   ├── 0001_init.sql
│   │   │   └── 0002_add_reviews.sql
│   │   └── queries/
│   │       ├── trips.queries.js
│   │       ├── places.queries.js
│   │       └── users.queries.js
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   ├── rateLimit.middleware.js
│   │   └── validate.middleware.js
│   │
│   ├── schemas/                     # zod validation — works great in plain JS too
│   │   ├── trip.schema.js
│   │   ├── review.schema.js
│   │   └── place.schema.js
│   │
│   ├── utils/
│   │   ├── logger.js
│   │   ├── errors.js
│   │   └── pagination.js
│   │
│   └── config/
│       └── constants.js
│
├── wrangler.toml
├── drizzle.config.js
└── package.json






The mapping
Frontend feature	                                     Backend route	                                       Backend service
features/trips/api/	                  routes/trips.routes.js → controllers/trips.controller.js	        services/trips.service.js
features/places/api/	                          places.routes.js	places.service.js                     + googleMaps.service.js
features/reviews/api/                           	reviews.routes.js	                                       (uses db/queries/)
features/ai/api/	                                  ai.routes.js	                                      gemini.service.js + prompts/
features/uploads/api/	                            uploads.routes.js	                                            r2.service.js
features/auth/api/	                               auth.routes.js	                                            auth.service.js
features/users/api/	                               users.routes.js	                                 (uses db/queries/users.queries.js)