import type { MarkerConfig } from '../interfaces/MarkerConfig.js';
import type { CompactMarkerConfig } from './FluffBase.js';

export type MarkerConfigEntries = [number, MarkerConfig | CompactMarkerConfig][];

export interface MarkerManagerInterface
{
    initializeFromConfig: (entries: MarkerConfigEntries) => void;

    cleanup: () => void;
}
