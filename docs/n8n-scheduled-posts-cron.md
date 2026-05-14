# n8n Scheduled Posts Cron

This workflow publishes due rows from `public.scheduled_posts` every minute.
Queue RPCs are server-only and are called through trusted Next.js API routes
using `INTERNAL_API_SECRET`.

## Environment

Set this in n8n and in the Studio deployment:

```bash
INTERNAL_API_SECRET=change-this-long-random-secret
```

Use the same value in every HTTP Request node:

```http
x-api-key: {{$env.INTERNAL_API_SECRET}}
```

## Workflow Nodes

### Node 1: Schedule Trigger

- Mode: Every minute
- Interval: `1 minute`

### Node 2: HTTP Request - Claim Due Posts

- Method: `POST`
- URL: `https://studio.paaair.online/api/scheduled-posts/claim`
- Headers:

```http
x-api-key: {{$env.INTERNAL_API_SECRET}}
Content-Type: application/json
```

- Body:

```json
{
  "limit": 5,
  "worker_id": "n8n-cron"
}
```

- Expected response:

```json
{
  "ok": true,
  "items": [
    {
      "scheduled_post_id": "uuid",
      "content_id": "uuid",
      "social_page_id": "uuid",
      "scheduled_at": "2026-05-15T10:00:00.000Z",
      "retry_count": 0,
      "max_retries": 3,
      "metadata": {
        "publish_payload": {
          "message": "approved post text",
          "image_urls": [],
          "video_url": null,
          "page_ids": ["uuid"],
          "social_page_id": "uuid",
          "created_from": "schedule_ui",
          "snapshot_version": 1
        }
      },
      "publish_payload": {
        "message": "approved post text",
        "image_urls": [],
        "video_url": null,
        "page_ids": ["uuid"],
        "social_page_id": "uuid",
        "created_from": "schedule_ui",
        "snapshot_version": 1
      }
    }
  ]
}
```

### Node 3: IF - Has Claimed Items

- Condition: `{{$json.items.length > 0}}`
- True path continues.
- False path ends.

### Node 4: Split In Batches / Loop Over Items

Loop over `{{$json.items}}`.

Keep each item as the execution context. Do not let later HTTP Request nodes
replace the original claim item without preserving these fields:

- `scheduled_post_id`
- `content_id`
- `social_page_id`
- `publish_payload`

### Node 5: Set - Build Auto Post Request

Create a clean request body for `/api/auto-post` and explicitly preserve
`scheduled_post_id`.

```json
{
  "scheduled_post_id": "{{$json.scheduled_post_id}}",
  "content_id": "{{$json.content_id}}",
  "page_ids": ["{{$json.social_page_id}}"],
  "message": "{{$json.publish_payload.message}}",
  "image_urls": "{{$json.publish_payload.image_urls || []}}",
  "video_url": "{{$json.publish_payload.video_url || null}}"
}
```

### Node 6: HTTP Request - Auto Post

- Method: `POST`
- URL: `https://studio.paaair.online/api/auto-post`
- Continue On Fail: `true`
- Headers:

```http
Content-Type: application/json
```

- Body: use the Set node output from Node 5.

Expected success response includes `scheduled_post_id` and post log mapping:

```json
{
  "ok": true,
  "scheduled_post_id": "uuid",
  "post_log_id": "uuid",
  "post_log_ids": ["uuid"],
  "results": [
    {
      "social_page_id": "uuid",
      "post_log_id": "uuid",
      "status": "posted",
      "platform": "facebook"
    }
  ]
}
```

### Node 7A: IF - Auto Post Succeeded

Treat the auto-post as successful only when:

```text
{{$json.ok === true}}
```

Never mark posted when the auto-post node failed or returned `ok: false`.

### Node 8A: HTTP Request - Mark Posted

- Method: `POST`
- URL: `https://studio.paaair.online/api/scheduled-posts/{{$json.scheduled_post_id}}/mark-posted`
- Headers:

```http
x-api-key: {{$env.INTERNAL_API_SECRET}}
Content-Type: application/json
```

- Body:

```json
{
  "post_log_id": "{{$json.post_log_id || null}}"
}
```

If your n8n HTTP node replaces input data, use a Merge node before this step:

- Input 1: original claim item
- Input 2: auto-post response
- Merge by position

The merged item must still contain `scheduled_post_id`.

### Node 8B: HTTP Request - Mark Failed

- Method: `POST`
- URL: `https://studio.paaair.online/api/scheduled-posts/{{$json.scheduled_post_id}}/mark-failed`
- Headers:

```http
x-api-key: {{$env.INTERNAL_API_SECRET}}
Content-Type: application/json
```

- Body:

```json
{
  "error_message": "{{$json.error || $json.message || $json.error_message || 'auto-post failed'}}"
}
```

If the auto-post response no longer includes `scheduled_post_id`, merge the
original claim item back in before calling this node.

## Operational Notes

- Start with a small claim limit: `3-5`.
- Use `Continue On Fail` only on the auto-post node.
- Retry is handled by `mark_scheduled_post_failed` in the database, not by the
  n8n loop.
- `claim_due_scheduled_posts` returns `metadata.publish_payload` so n8n does not
  need to re-fetch `generated_contents`.
- Do not add TikTok, YouTube Shorts, token refresh, or OAuth logic in this
  workflow.

## Verification Checklist

- Migration applies cleanly.
- Can create a scheduled post via API.
- Past-due post can be claimed.
- Claimed post changes to `processing`.
- Claim response includes `publish_payload`.
- Successful auto-post changes status to `posted`.
- Failed auto-post increments `retry_count` and returns to `pending`.
- After `max_retries`, status becomes `failed`.
- Stale `processing` post resets to `pending` only when `retry_count < max_retries`.
- UI can schedule, reschedule, and cancel.
- Existing immediate auto-post still works.
