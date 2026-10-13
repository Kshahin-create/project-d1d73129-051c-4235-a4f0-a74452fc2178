# Architecture rules
- Resolve booking-email unit areas through the shared email area helper, preferring explicit total area over floor area, so current and older clients produce consistent emails.
- Encode non-ASCII email HTML as numeric entities in the shared send helper before sending, to protect Arabic copy from downstream charset conversion; keep plain text as Unicode.
- Send each app email from its own feature function that derives the recipient from trusted data, because the browser must never choose recipients or templates.
- Use React Email's synchronous render for HTML and plain text because the pinned async renderer decodes UTF-8 chunks without streaming and corrupts Arabic characters at chunk boundaries.
- Keep management-dashboard reads and pure aggregates in dashboard-specific modules, with independent query failure states and shared unit scopes; this isolates reporting from booking operations and prevents cross-page regressions.
- Dashboard detail views are read-only and reuse existing plan coordinates without extending them; this preserves records and avoids unverified spatial claims.
- Dashboard exports use the shared local Excel helper with a separate scope sheet and unpaginated filtered rows; availability gates prevent incomplete reports.