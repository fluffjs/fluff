import type { CompactMarkerConfig } from './FluffBase.js';

export type MarkerConfigEntries = [number, CompactMarkerConfig][];

export interface MarkerManagerInterface
{
    initializeFromConfig: (entries: MarkerConfigEntries) => void;

    cleanup: () => void;
}
