# Architecture rules
- Resolve booking-email unit areas through the shared email area helper, preferring explicit total area over floor area, so current and older clients produce consistent emails.
- Encode non-ASCII email HTML as numeric entities before queueing to protect Arabic copy from downstream charset conversion; keep plain text as Unicode.