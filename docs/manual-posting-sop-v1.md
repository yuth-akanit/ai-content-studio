# Manual Posting SOP + Posted Proof Checklist v1

## Purpose

This SOP defines the safe manual publishing workflow for AI Content Studio short-video export packages.

AI Content Studio is used only to generate preview/export/manual publish packages. The actual post must be published manually by an owner or operator inside the social platform UI.

## Safety Boundary

AI Content Studio must remain preview/export only for this workflow.

Do not use this SOP to enable or perform any automated publishing.

Required safety state:

- `real_posting_enabled=false`
- `line_broadcast_enabled=false`
- `schedule_enabled=false`
- `all_publish_flags_false=true`
- `external_api_calls_performed=false`
- `mark_posted_performed=false`, unless separately approved after posted proof exists
- `production_actions_performed=false`, except for owner/operator manual posting outside the app

Forbidden actions:

- Do not call Facebook publish APIs.
- Do not call Instagram publish APIs.
- Do not call TikTok publish APIs.
- Do not call YouTube publish APIs.
- Do not send LINE messages or broadcasts.
- Do not enable a scheduler.
- Do not mutate production DB state without separate explicit approval.
- Do not mark content as posted until posted proof has been captured and a separate approval allows the state update.

## Manual Posting Procedure

### 1. Open the short-video distribution page

Open:

```text
/short-video-distribution
```

Select the package intended for manual posting.

Confirm the package is complete:

- Platform target is clear.
- Caption is present.
- Hashtags are present if needed.
- Media file or media reference is present.
- Manual posting notes are present.
- No automated publishing flag is enabled.

### 2. Export or copy the manual publish package

Use only the generated manual package content:

- Platform
- Package ID
- Caption/title
- Hashtags
- Recommended posting time
- Media filename or media URL
- Manual posting notes

Do not edit the package into an automation instruction.

### 3. Publish manually in the platform UI

The owner/operator must log in to the target platform directly and post manually.

Manual posting steps:

1. Open the target platform UI.
2. Select the correct account/page/channel.
3. Upload or select the intended media.
4. Paste the caption/title/hashtags from the package.
5. Review the platform preview.
6. Confirm the target account/page/channel again.
7. Click publish manually.

### 4. Capture posted proof immediately

After the platform reports the post is live, capture posted proof before doing any backend state update.

Required posted proof:

- Platform
- Package ID
- Posted timestamp
- Posted by
- Public URL or platform post ID
- Screenshot of the published post
- Caption checksum or short caption excerpt
- Media filename/reference used
- Confirmation that the post was manually published by owner/operator

### 5. Record proof in the approved location

Store posted proof in the approved operating record, issue, ticket, or audit log for the campaign.

Do not store secrets, access tokens, cookies, session IDs, or private customer data in the proof record.

## Posted Proof Checklist

```text
[ ] platform:
[ ] package_id:
[ ] posted_at:
[ ] posted_by:
[ ] public_url_or_post_id:
[ ] screenshot_saved:
[ ] caption_checked:
[ ] caption_checksum_or_excerpt:
[ ] media_filename_or_reference:
[ ] media_checked:
[ ] target_account_page_channel_checked:
[ ] manually_posted_by_owner_or_operator:
[ ] all_publish_flags_false_before_manual_post:
[ ] external_api_calls_performed=false:
[ ] mark_posted_performed=false unless separately approved:
[ ] no_scheduler_enabled:
[ ] no_line_send:
[ ] notes:
```

## Safe Confirmation Wording

Use this wording when reporting a completed manual post:

```text
This content was manually posted by an owner/operator.
AI Content Studio generated a preview/export package only.
No platform publish API was called by AI Content Studio.
No scheduler or auto-post workflow was enabled.
No LINE message or broadcast was sent.
Posted proof was captured before any posted-state update.
```

## Conditions Required Before Any Posted-State Update

A posted-state update, if supported by the system, requires separate approval after posted proof exists.

Before any `mark_posted` or equivalent state update, confirm:

- Posted proof exists.
- Public URL or platform post ID exists.
- The platform and package ID match.
- The post was manually published exactly once.
- No automated publish API was used.
- The requested state update is explicitly approved.

## Failure Handling

If manual posting fails:

- Do not mark the package as posted.
- Record the platform error in sanitized form.
- Do not retry with automation unless separately approved.
- Keep all publish flags false.

If the wrong account/page/channel was selected:

- Stop.
- Capture what happened.
- Escalate to owner.
- Do not make backend state changes until owner decides the correction path.

If duplicate posting occurs:

- Capture both post URLs/IDs.
- Escalate to owner.
- Do not delete, hide, or edit posts unless separately approved.
- Do not mark success until the owner confirms the final canonical post.

## Audit Summary Template

```text
manual_posting_audit_v1=true
package_id=
platform=
posted_at=
posted_by=
public_url_or_post_id=
screenshot_reference=
manual_posted=true
ai_content_studio_preview_export_only=true
external_api_calls_performed=false
scheduler_enabled=false
line_send_performed=false
mark_posted_performed=false
notes=
```
