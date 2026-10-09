-- Migration: 0013_users_username.sql
-- Purpose: Add unique travel-themed username column to users table

ALTER TABLE users ADD COLUMN username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username);
