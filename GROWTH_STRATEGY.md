# Discovery, community and brand intelligence

## Organic discovery

Category and brand archives have dedicated URLs, structured metadata, canonical URLs and indexation only when supported by a verified catalogue entry. Verified product metadata describes the archive item without offers or claims about purchasing. A missing query leads to a prefilled submission. The homepage shows reviewed archive records when available and a labelled editorial selection when coverage is thin. Demand and emerging campaign strips use genuine, non-demo supporter activity.

Published campaigns provide shareable URLs, generated REISSUE share cards and progress milestones computed from current supporters. Share cards use typography and campaign text, which avoids redistributing licensed product imagery in a different context. Public collections remain opt-in. Following is optional and delivers updates within the account inbox.

## Brand intelligence

Reports are scoped to current verified brand membership. Demo campaigns and hidden or rejected records are excluded. Unique supporters are deduplicated across campaigns for the brand total. Monthly and preference buckets are distinct-user counts and appear once at least five people share a group. Groups can overlap. The export contains aggregate campaign measurements and suppresses sensitive subgroups. A pilot workspace stores feasibility stage, private notes and contact preference for the verified brand and administrators. A preference records how an operator should contact a brand and does not send outreach automatically.

### Revival score, version 1

Scores are shown at five or more current supporters.

| Component | Maximum | Calculation |
| --- | ---: | --- |
| Unique campaign supporter count | 45 | Linear from zero to 50 supporters, capped at 45 |
| Recent change | 20 | Positive 30-day change divided by the greater of 10 and the prior 30-day count, capped at 20. Requires five recent supporters. |
| Stated intent | 15 | Fraction of likelihood responses at 4 or 5 of 5, with at least five responses |
| Price concentration | 10 | Share of priced responses in the largest 25-unit band, with at least five supporters in that band. Range midpoints are used. |
| Catalogue confidence | 10 | Added for a verified historical or brand-confirmed product |

Unqualified dimensions contribute zero. The scores use current support rows and rounded aggregate components, so withdrawals change the visible history of registrations. They are a prioritisation aid for an operator and do not predict manufacturing, conversion to a sale or revenue.

## Internal reporting definitions

- Registered members are verified, non-suspended member accounts.
- Active and returning metrics use opted-in, distinct UTC days observed on the account and search surfaces. The 30-day return metric requires activity on at least two days.
- Retention uses signup cohorts old enough to observe days 30–59 and participants seen in their first week. A cohort needs at least five eligible members.
- Inventory excludes demo and deleted records. Published campaign counts exclude moderation and archived campaigns. Non-binding high intent counts likelihood 4 or 5. Brand applications and verified brand identities are distinct from partnerships.
- Search success is queries with matches divided by consented searches. The observed search funnel uses one opaque search identifier valid for one hour. It connects the first eligible campaign page to a new support in that same journey. Untracked visits, direct shares and consent refusals are outside the funnel. Withdrawal does not erase a past observed conversion.
- Activity dates are account-scoped and included in account export and deletion. The maintenance cutoffs are 30 days for search events and 90 days for activity dates. Different databases isolate development and preview activity from production.
