# ADR 0002: Keep SQLite for the IROAS app through the pilot

Status: accepted (2026-10-30)

## Context
The IROAS app stores tenants, owners, local reservations/orders, mappings and
audit data in SQLite (WAL mode). The question was whether to move to PostgreSQL
now.

## Decision
Stay on SQLite until after the pilot (5 to 10 restaurants). All operational POS
data already lives in each customer's URY site, so the IROAS database stays small
and low-write.

## Revisit when
- more than one IROAS app server is needed, or
- tens of tenants write concurrently, or
- managed backups / point-in-time restore are required.

## Consequences
- Zero migration risk for the demo.
- The database file must never be committed (`.gitignore`) and needs its own backup.
