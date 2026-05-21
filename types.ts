

// Using 'any' for opentype object to avoid complex type definition file requirements in this environment
// In a real project, we would install @types/opentype.js
export type OpenTypeFont = any; 
export type OpenTypeGlyph = any;

export type DeltaMap = Record<string, { lsb?: number; rsb?: number; advanceWidth?: number }>;

export enum AppStep {
  UPLOAD = 'UPLOAD',
  PREPARATION = 'PREPARATION',
  PROCESSING = 'PROCESSING',
  ANALYSIS = 'ANALYSIS'
}

export enum MethodType {
  ORIGINAL = 'ORIGINAL',
  ORIGINAL_CUSTOM = 'ORIGINAL_CUSTOM',
  TRACY = 'TRACY',
  SOUSA = 'SOUSA'
}

export interface OriginalCustomSettings {
  overrides: Record<string, { lsb: number; rsb: number }>;
}

export const DEFAULT_ORIGINAL_CUSTOM_SETTINGS: OriginalCustomSettings = {
  overrides: {}
};

export interface FontState {
  type: MethodType;
  fontObj: OpenTypeFont | null;
  url: string | null; // Blob URL for CSS
  fullFontFamily: string; // Dynamic family name (e.g., 'Tracy-123456') to force browser refresh
  metrics: {
    ascender: number;
    descender: number;
    xHeight: number;
    capHeight: number;
    unitsPerEm: number;
  };
}

export interface TracySettings {
  // Master Glyphs Sidebearings (SB)
  H: { lsb: number; rsb: number };
  O: { lsb: number; rsb: number };
  n: { lsb: number; rsb: number };
  o: { lsb: number; rsb: number };
  // Specific Overrides for derived letters
  overrides: Record<string, { lsb: number | null; rsb: number | null }>;
}

export const DEFAULT_TRACY_SETTINGS: TracySettings = {
  H: { lsb: 50, rsb: 50 },
  O: { lsb: 40, rsb: 40 },
  n: { lsb: 35, rsb: 30 },
  o: { lsb: 30, rsb: 30 },
  overrides: {}
};

export interface SousaGroups {
  // Lowercase
  group1: string[]; // b d h i l m n o p q u
  group2: string[]; // a c e f j k r t
  group3: string[]; // g s v w x y z
  
  // Uppercase
  upperGroup1: string[]; // B D E F H I N O Q
  upperGroup2: string[]; // C G J K L P R
  upperGroup3: string[]; // A M S T U V W X Y Z
}

export interface SousaSettings {
  // Masters
  n: { lsb: number; rsb: number };
  o: { lsb: number; rsb: number };
  H: { lsb: number; rsb: number };
  O: { lsb: number; rsb: number };
  // Specific Overrides (for Groups 2 and 3)
  overrides: Record<string, { lsb: number; rsb: number }>;
  groups: SousaGroups;
}

export const DEFAULT_SOUSA_SETTINGS: SousaSettings = {
  n: { lsb: 30, rsb: 25 },
  o: { lsb: 25, rsb: 25 },
  H: { lsb: 45, rsb: 45 },
  O: { lsb: 35, rsb: 35 },
  overrides: {},
  groups: {
    // Lowercase
    group1: ['b', 'd', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 'q', 'u'],
    group2: ['a', 'c', 'e', 'f', 'j', 'k', 'r', 't'],
    group3: ['g', 's', 'v', 'w', 'x', 'y', 'z'],
    
    // Uppercase
    upperGroup1: ['B', 'D', 'E', 'F', 'H', 'I', 'N', 'O', 'Q'],
    upperGroup2: ['C', 'G', 'J', 'K', 'L', 'P', 'R'],
    upperGroup3: ['A', 'M', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
  }
};