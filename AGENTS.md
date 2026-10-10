# Architecture rules
- Resolve booking-email unit areas through the shared email area helper, preferring explicit total area over floor area, so current and older clients produce consistent emails.
- Encode non-ASCII email HTML as numeric entities in the shared send helper before sending, to protect Arabic copy from downstream charset conversion; keep plain text as Unicode.
- Send each app email from its own feature function that derives the recipient from trusted data, because the browser must never choose recipients or templates.
- Use React Email's synchronous render for HTML and plain text because the pinned async renderer decodes UTF-8 chunks without streaming and corrupts Arabic characters at chunk boundaries.