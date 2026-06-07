import type { MasterVerticalVideo } from './planner';
import { sampleMediaComposerMasterVideoRecord, toShortVideoMasterVerticalVideo } from '@/lib/media-composer';

export const sampleApprovedMasterVerticalVideo: MasterVerticalVideo = toShortVideoMasterVerticalVideo(sampleMediaComposerMasterVideoRecord);
