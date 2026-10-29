# Institution identity workflow without public student/teacher signup

## Policy and existing workflow

Public account registration remains restricted to Shop Owners. The existing guest college-print flow lets a person choose Student or Teacher only as a requested category, select an eligible institution, capture/upload an ID card image, and submit it for review. A shop operator can view the private evidence in the authorized review screen and enter the ID number. The server stores a keyed hash of that identifier to prevent repeat approvals and enforce usage accounting; the evidence itself is not exposed through a public URL. Approval, role/category, institution, participating shop, global policy, printer capability, usage reservation, and daily/monthly limits are validated server-side. Selecting a category alone does not grant eligibility.

The current low-friction flow is guest-based and does not create student/teacher accounts. It relies on a shop operator comparing the card to the person presenting it. A browser camera capture is not liveness detection or cryptographic proof of identity. Review access must remain restricted to the shop and authorized administrators; revoked/expired approval blocks future free orders. Free orders have zero payable amount and do not create gateway transactions.

## New cohorts

There is no institution SSO, roster import, signed invitation, or controlled account issuance integration in this codebase. Do not create student/teacher public signups or infer eligibility from a client role. For the current release, continue the existing per-person ID evidence review. If a college needs cohort onboarding, implement it only after the institution can authorize a named coordinator and provide a verifiable roster or identity assertion. The minimal secure future option is an institution-managed allowlist/import plus an authenticated opaque invitation bound to a specific institution identity, expiring and single-use; the institution, not a shop owner or applicant, must authorize the identity mapping. This feature is not implemented here.

## Privacy and operational controls

- Restrict evidence access and keep files in private storage; do not send ID images in email or logs.
- Collect the minimum required identifier, store only its HMAC/hash with a protected key where supported, and define short evidence retention/deletion periods.
- Audit submit, review, approval, rejection, and revocation decisions with reviewer and timestamp.
- Treat shop review as operational verification, not authoritative institutional validation.
- Usage is charged against globally keyed guest identity hash rather than a user-selected account, with concurrent reservation checks.
- No requirement for email OTP is introduced; institution approval or ID evidence review is the verification mechanism.

Production deployment must verify the stable `COLLEGE_ID_HASH_SECRET`, migration state, private file permissions, and reviewer authorization before enabling the policy.
