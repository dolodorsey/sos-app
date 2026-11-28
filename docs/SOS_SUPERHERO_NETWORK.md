# THE SIGNAL — S.O.S. Superhero Network

Source: *SOS Full Support Program Master Manual* v3.0 and the *Superhero Network V2* package (Nov 28, 2026).
This replaces the static staging candidate in pull request 157.

## Where it lives

| Who | Page | What they do |
| --- | --- | --- |
| Members | `/network` | Sign in with their S.O.S. account, join with an invite code, pick missions, send proof, log introductions, see points and rank |
| Operators | `/ops/network` | Approvals waiting on Dolo, summary, review queue, introductions by stage, Founding 100 roster (four waves of 25), sides of town, members, point corrections |

Database: `public.sos_network_*` tables in the S.O.S. Supabase project. All tables are private; every read and write goes through the `sos_network_*` (member) and `sos_ops_network_*` (operator) functions.

## Rules the code enforces

- Invite-only until Dolo opens it (`sos_system_config.network_program.enrollment`).
- Points are proposed until Dolo approves them (`points_status`). Points are recognition, not money.
- No kit, coupon or service credit is issued by the code (`rewards_status = not_approved`).
- No invitation or message is sent by the system (`outbound = off`). The team sends invites by hand.
- The database sets points from the mission catalog. Nobody can approve their own submission, correct their own points or move their own introduction.
- Each mission counts once per member during the pilot.
- Points live in an append-only ledger; corrections are new lines with a reason.
- Introductions need the person's okay. The same person introduced by two members is held as a duplicate.
- Introductions are not sales or approved providers. Each stage is moved by an operator only when it really happens.
- Test accounts are marked and left out of member counts.
- QA-005 and QA-008 (service simulation, secret shopper) can only be assigned by the QA lead.

## Switches

```sql
-- open enrollment to anyone signed in (after Dolo says so)
update public.sos_system_config set config_value = config_value || '{"enrollment":"open"}' where config_key='network_program';
-- after Dolo approves the 55 point values
update public.sos_system_config set config_value = config_value || '{"points_status":"approved"}' where config_key='network_program';
-- stop new joins without touching anything else
update public.sos_system_config set config_value = config_value || '{"enrollment":"closed"}' where config_key='network_program';
```

Turning the network off never touches rescues, payments or Hero payouts.

## Not built yet (next passes)

Content vault, kit claims screen, QA scorecard screen, captain views, recurring mission instances, matching customer introductions to real sign-ups and first paid rescues, and a private evidence upload (today proof is a link plus a description).
