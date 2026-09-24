-- Migration: 0005_sync_jobs.sql
-- Purpose: Track monthly Wikivoyage snapshot sync progress.
--          This lets the cron job resume from where it left off if it crashes.

CREATE TABLE IF NOT EXISTS sync_jobs (
    id          TEXT PRIMARY KEY,
    job_type    TEXT NOT NULL DEFAULT 'wikivoyage_snapshot', -- for future extensibility
    status      TEXT NOT NULL DEFAULT 'pending',             -- pending | running | done | failed
    snapshot_id TEXT,                                        -- e.g. 'enwikivoyage_namespace_0'
    total_chunks INTEGER DEFAULT 0,
    chunks_done  INTEGER DEFAULT 0,
    articles_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at   DATETIME,
    finished_at  DATETIME,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index to quickly find the latest job
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status, created_at);
