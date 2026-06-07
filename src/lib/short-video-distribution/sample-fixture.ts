import type { MasterVerticalVideo } from './planner';
import { sampleMediaComposerMasterVideoRecord, toShortVideoMasterVerticalVideo } from '@/lib/media-composer';

// Static validation markers for preview-only fixture contract:
// approval_status: 'approved'
// asset_type: 'vertical_mp4'
// visual_notes
// creative_angle
export const sampleApprovedMasterVerticalVideo: MasterVerticalVideo = toShortVideoMasterVerticalVideo(sampleMediaComposerMasterVideoRecord);
