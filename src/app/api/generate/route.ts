import { NextRequest, NextResponse } from 'next/server';
import { generateAndSaveContent } from '@/lib/services/generation';
import { getDefaultProfile } from '@/lib/repositories/profiles';
import { PLATFORMS } from '@/types/database';
import { ZodError } from 'zod';
import crypto from 'crypto';

function classifyError(error: unknown): { code: string; status: number; message: string } {
  const message = error instanceof Error ? error.message : String(error);

  // 1. Platform Not Supported check
  if (error instanceof ZodError) {
    const isPlatformError = error.issues.some(issue =>
      issue.path.includes('platform') &&
      ((issue.code as string) === 'invalid_enum_value' || issue.code === 'custom')
    );
    if (isPlatformError) {
      return {
        code: 'PLATFORM_NOT_SUPPORTED',
        status: 400,
        message: 'The requested platform is not supported by the system.',
      };
    }
    return {
      code: 'VALIDATION_ERROR',
      status: 400,
      message: `Validation failed: ${error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
    };
  }

  // 2. AI Quota Exceeded check
  if (
    message.includes('429') ||
    message.toLowerCase().includes('quota') ||
    message.toLowerCase().includes('limit') ||
    message.toLowerCase().includes('budget') ||
    message.toLowerCase().includes('billing') ||
    message.toLowerCase().includes('rate limit')
  ) {
    return {
      code: 'AI_QUOTA_EXCEEDED',
      status: 429,
      message: 'AI generation quota exceeded or service budget limit reached.',
    };
  }

  // 3. Output Parse Error check
  if (
    message.includes('Failed to parse AI response') ||
    message.includes('JSON.parse') ||
    message.includes('No content in AI response')
  ) {
    return {
      code: 'OUTPUT_PARSE_ERROR',
      status: 502,
      message: `Failed to parse structured response from AI provider. Error: ${message}`,
    };
  }

  // 4. AI Provider Error check
  if (
    message.includes('AI provider error') ||
    message.includes('fetch failed') ||
    message.includes('NetworkError') ||
    message.includes('timeout')
  ) {
    return {
      code: 'AI_PROVIDER_ERROR',
      status: 502,
      message: `AI provider encountered an error: ${message}`,
    };
  }

  // 5. Database Error check
  if (
    message.includes('Failed to fetch') ||
    message.includes('Failed to create') ||
    message.toLowerCase().includes('database') ||
    message.toLowerCase().includes('postgres') ||
    message.toLowerCase().includes('supabase') ||
    message.includes('PGRST')
  ) {
    return {
      code: 'DATABASE_ERROR',
      status: 500,
      message: `Database error occurred during operation: ${message}`,
    };
  }

  // Fallback
  return {
    code: 'INTERNAL_ERROR',
    status: 500,
    message: message || 'An unexpected error occurred.',
  };
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  let selectedPlatform: string = 'unknown';

  try {
    let body: any;
    try {
      body = await request.json();
    } catch (e) {
      const errorMsg = 'Invalid JSON payload in request body';
      console.error(JSON.stringify({
        requestId,
        platform: selectedPlatform,
        code: 'VALIDATION_ERROR',
        message: errorMsg
      }));
      return NextResponse.json(
        { error: errorMsg, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (!body) {
      const errorMsg = 'Request body is empty';
      console.error(JSON.stringify({
        requestId,
        platform: selectedPlatform,
        code: 'VALIDATION_ERROR',
        message: errorMsg
      }));
      return NextResponse.json(
        { error: errorMsg, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    let businessProfileId = body.business_profile_id;
    let projectId = body.project_id;
    let inputPayload = body.input;

    // Normalizing flat payload to structured format if needed
    if (!inputPayload && (body.platform || body.platforms)) {
      let platform = body.platform;
      if (!platform && body.platforms) {
        if (Array.isArray(body.platforms) && body.platforms.length > 0) {
          platform = body.platforms[0];
        } else if (typeof body.platforms === 'string') {
          platform = body.platforms;
        }
      }

      inputPayload = {
        platform,
        content_type: body.content_type || body.contentType || 'promotion_post',
        topic: body.businessDetails || body.topic || '',
        keyword: body.keywords || body.keyword || '',
        tone: body.tone || 'professional',
        language: body.language || 'th',
        post_length: body.post_length || body.postLength || 'medium',
      };
    }

    // Set selectedPlatform for logging
    if (inputPayload?.platform) {
      selectedPlatform = String(inputPayload.platform);
    }

    // Validate platform explicitly first
    if (!inputPayload?.platform) {
      const errorMsg = 'platform is required';
      console.error(JSON.stringify({
        requestId,
        platform: selectedPlatform,
        code: 'VALIDATION_ERROR',
        message: errorMsg
      }));
      return NextResponse.json(
        { error: errorMsg, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (!PLATFORMS.includes(inputPayload.platform)) {
      const errorMsg = `Platform "${inputPayload.platform}" is not supported.`;
      console.error(JSON.stringify({
        requestId,
        platform: selectedPlatform,
        code: 'PLATFORM_NOT_SUPPORTED',
        message: errorMsg
      }));
      return NextResponse.json(
        { error: errorMsg, code: 'PLATFORM_NOT_SUPPORTED' },
        { status: 400 }
      );
    }

    // Load default business profile if not specified
    if (!businessProfileId) {
      try {
        const defaultProfile = await getDefaultProfile();
        if (defaultProfile) {
          businessProfileId = defaultProfile.id;
        } else {
          const errorMsg = 'No default business profile found in database.';
          console.error(JSON.stringify({
            requestId,
            platform: selectedPlatform,
            code: 'DATABASE_ERROR',
            message: errorMsg
          }));
          return NextResponse.json(
            { error: errorMsg, code: 'DATABASE_ERROR' },
            { status: 500 }
          );
        }
      } catch (dbErr) {
        const errorMsg = dbErr instanceof Error ? dbErr.message : 'Database error fetching default profile';
        console.error(JSON.stringify({
          requestId,
          platform: selectedPlatform,
          code: 'DATABASE_ERROR',
          message: errorMsg
        }));
        return NextResponse.json(
          { error: errorMsg, code: 'DATABASE_ERROR' },
          { status: 500 }
        );
      }
    }

    const result = await generateAndSaveContent({
      business_profile_id: businessProfileId,
      project_id: projectId,
      input: inputPayload,
    });

    // Safe successful logging
    console.log(JSON.stringify({
      requestId,
      platform: selectedPlatform,
      status: 'success'
    }));

    return NextResponse.json(result);

  } catch (error) {
    const errorDetail = classifyError(error);

    // Sanitize message: do not log tokens or secrets
    const sanitizedMsg = errorDetail.message
      .replace(/Bearer\s+[a-zA-Z0-9_\-.]+/g, 'Bearer [REDACTED]')
      .replace(/sk-[a-zA-Z0-9]{32,}/g, 'sk-[REDACTED]');

    console.error(JSON.stringify({
      requestId,
      platform: selectedPlatform,
      code: errorDetail.code,
      message: sanitizedMsg
    }));

    return NextResponse.json(
      { error: errorDetail.message, code: errorDetail.code },
      { status: errorDetail.status }
    );
  }
}

