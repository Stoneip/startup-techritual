#!/usr/bin/env node
/**
 * scripts/fetch-snapshot.js — refreshes public/data/snapshot.json from
 * Firestore. Used by the GitHub Actions weekly cron.
 *
 * The Astro build itself ALSO calls fetchPublishedSubmissions() which fetches
 * live Firestore at build time, but the snapshot serves as a fallback when
 * Firestore is unreachable during a build, AND ensures the source repo
 * always has a recent JSON copy for review.
 */

import { fetchPublishedSubmissions } from '../src/lib/firestore.js';

(async () => {
  try {
    const items = await fetchPublishedSubmissions();
    console.log(`Snapshot refreshed: ${items.length} published submissions.`);
    process.exit(0);
  } catch (e) {
    console.error('Snapshot refresh failed:', e);
    process.exit(1);
  }
})();
