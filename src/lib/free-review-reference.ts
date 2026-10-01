// Owner-reviewed provider IDs or dashboard labels. Exact matching against the
// expiring durable review remains mandatory; a label alone never proves Free.
export const FREE_REVIEW_REFERENCE = /^[A-Za-z0-9_-][A-Za-z0-9 _.-]{1,118}[A-Za-z0-9_-]$/;
