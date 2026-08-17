# Phase A — Manual validation checklist

Use this checklist to validate lifecycle behavior, idempotency, auth, pagination, and **safe** DB consistency checks.

---

## DB consistency (recommended query)

Avoid joining `consent_versions` and `events` in one aggregate and then `count(*)` on both — that can multiply rows (`N × N`) and inflate counts.

Use subqueries per consent:

```sql
select
  c.external_user_id,
  c.purpose_code,
  c.current_status,
  c.current_version_no,
  (select count(*) from consent_versions cv where cv.consent_id = c.id) as versions,
  (select count(*) from events e where e.consent_id = c.id) as events
from consents c
order by c.external_user_id, c.purpose_code;
```

**Expected** for a healthy timeline:

- `current_version_no = versions`
- `versions = events`

---

## Why the join aggregate looked wrong

If you:

1. `from consents c`
2. `left join consent_versions cv …`
3. `left join events e …`
4. `group by … count(cv.*), count(e.*)`

you get a Cartesian-style expansion per consent, so counts are not trustworthy.

---

## Related

- Full runtime steps: [`quickstart.md`](quickstart.md)
- API shapes: [`phase-a-api-contracts.md`](phase-a-api-contracts.md)
