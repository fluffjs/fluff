import type { CompactMarkerConfig } from './FluffBase.js';
import type { MarkerController } from './MarkerController.js';

export type MarkerConfigEntries = [number, CompactMarkerConfig][];

export interface MarkerManagerInterface
{
    initializeFromConfig: (entries: MarkerConfigEntries) => void;
    getController: (id: number, startMarker: Comment) => MarkerController | undefined;
    ensureController: (id: number, type: string, startMarker: Comment, endMarker: Comment | null) => MarkerController | undefined;
    cleanupController: (id: number, startMarker?: Comment) => void;
    cleanup: () => void;
}
