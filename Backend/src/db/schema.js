import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';


/**
 * users — one row per PERSON, regardless of how they log in.
 * No password lives here on purpose (see auth_credentials below).
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // crypto.randomUUID()
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
});

/**
 * auth_credentials — one row per LOGIN METHOD a user has connected.
 *
 * This is the key design choice for "organized for the future": a user who
 * signs up with email/password today can link Google (or Apple later) to
 * the SAME account without duplicating their profile, and you can support
 * "sign in with either" without restructuring anything.
 *
 *   provider: 'email' | 'google' | 'apple'
 *   providerUserId: the provider's own user id (Google/Apple's `sub` claim).
 *                    null for 'email'.
 *   passwordHash: only set when provider === 'email'.
 */
export const authCredentials = sqliteTable(
  'auth_credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id'),
    passwordHash: text('password_hash'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    // Stops the same Google/Apple account from being linked to two different users
    providerUserUnique: uniqueIndex('provider_user_unique').on(table.provider, table.providerUserId),
    // Stops a user from linking the same provider twice
    userProviderUnique: uniqueIndex('user_provider_unique').on(table.userId, table.provider),
  })
);

/**
 * sessions — one row per active login (per device/browser). Storing a HASH
 * of the refresh token (never the raw token) means a leaked DB row still
 * can't be used to log in as the user. Lets you revoke one device without
 * logging the user out everywhere ("log out of all other sessions" later).
 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    userAgent: text('user_agent'),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
  })
);

// ─── Travel Data Tables ───────────────────────────────────────────────────────

/**
 * destinations — top-level travel destinations (e.g., Manali, Goa)
 * Populated from Wikivoyage via the Wikimedia Enterprise API.
 */
export const destinations = sqliteTable('destinations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  country: text('country'),
  state: text('state'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  description: text('description'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * places — individual POIs within a destination (cafes, temples, hotels, etc.)
 * Deduplicated across multiple source APIs.
 */
export const places = sqliteTable('places', {
  id: text('id').primaryKey(),
  destinationId: text('destination_id')
    .notNull()
    .references(() => destinations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'attraction' | 'cafe' | 'hotel'
  latitude: real('latitude'),
  longitude: real('longitude'),
  googlePlaceId: text('google_place_id').unique(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  destinationIdx: index('places_destination_idx').on(table.destinationId),
}));

/**
 * place_sources — provenance engine.
 * Lets the UI show "Found in 3 sources (Google, Wikivoyage, Tourism Board)".
 */
export const placeSources = sqliteTable('place_sources', {
  id: text('id').primaryKey(),
  placeId: text('place_id')
    .notNull()
    .references(() => places.id, { onDelete: 'cascade' }),
  sourceName: text('source_name').notNull(), // 'Wikivoyage' | 'Google Places'
  sourceUrl: text('source_url'),
  license: text('license'), // 'CC BY-SA 4.0'
  rawDataJson: text('raw_data_json'),
  lastCheckedAt: text('last_checked_at').notNull(),
}, (table) => ({
  placeSourceIdx: index('place_sources_place_idx').on(table.placeId),
}));