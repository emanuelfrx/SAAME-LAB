
import { FontState, MethodType, TracySettings, SousaSettings, OpenTypeFont, OpenTypeGlyph } from '../types';
// Importing directly from unpkg for browser environment compatibility in this setup
import opentype from 'https://unpkg.com/opentype.js@1.3.4/dist/opentype.module.js';

// --- DIACRITICS MAPPING ---
// Maps base characters to their accented variations.
// Used to propagate spacing rules from parent to children automatically.
const DIACRITICS_MAP: Record<string, string[]> = {
    'A': ['Á','À','Â','Ä','Ã','Å','Ā','Ă','Ą', 'Ǎ', 'Ǻ'],
    'B': ['Ḃ','Ḅ'],
    'C': ['Ç','Ć','Ĉ','Ċ','Č'],
    'D': ['Ď','Đ','Ḍ','Ḋ','Ḑ'],
    'E': ['É','È','Ê','Ë','Ē','Ĕ','Ė','Ę','Ě'],
    'F': ['Ḟ'],
    'G': ['Ĝ','Ğ','Ġ','Ģ','Ǧ'],
    'H': ['Ĥ','Ħ','Ḣ','Ḥ'],
    'I': ['Í','Ì','Î','Ï','Ĩ','Ī','Ĭ','Į','İ'],
    'J': ['Ĵ'],
    'K': ['Ķ','Ǩ','Ḱ','Ḳ'],
    'L': ['Ĺ','Ļ','Ľ','Ŀ','Ł','Ḷ','Ḹ'],
    'M': ['Ḿ','Ṁ','Ṃ'],
    'N': ['Ñ','Ń','Ņ','Ň','Ṅ','Ṇ'],
    'O': ['Ó','Ò','Ô','Ö','Õ','Ø','Ō','Ŏ','Ő','Ǒ','Ǿ'],
    'P': ['Ṕ','Ṗ'],
    'Q': [],
    'R': ['Ŕ','Ŗ','Ř','Ṙ','Ṛ'],
    'S': ['Ś','Ŝ','Ş','Š','Ș','Ṡ','Ṣ'],
    'T': ['Ţ','Ť','Ŧ','Ț','Ṫ','Ṭ'],
    'U': ['Ú','Ù','Û','Ü','Ũ','Ū','Ŭ','Ů','Ű','Ų','Ǔ','Ǖ','Ǘ','Ǚ','Ǜ'],
    'V': ['Ṽ','Ṿ'],
    'W': ['Ŵ','Ẁ','Ẃ','Ẅ'],
    'X': ['Ẋ','Ẍ'],
    'Y': ['Ý','Ŷ','Ÿ','Ȳ','Ẏ','Ỳ'],
    'Z': ['Ź','Ż','Ž','Ẓ'],
    
    'a': ['á','à','â','ä','ã','å','ā','ă','ą','ǎ','ǻ'],
    'b': ['ḃ','ḅ'],
    'c': ['ç','ć','ĉ','ċ','č'],
    'd': ['ď','đ','ḍ','ḋ','ḑ'],
    'e': ['é','è','ê','ë','ē','ĕ','ė','ę','ě'],
    'f': ['ḟ'],
    'g': ['ĝ','ğ','ġ','ģ','ǧ'],
    'h': ['ĥ','ħ','ḣ','ḥ'],
    'i': ['í','ì','î','ï','ĩ','ī','ĭ','į','ı'],
    'j': ['ĵ'],
    'k': ['ķ','ǩ','ḱ','ḳ'],
    'l': ['ĺ','ļ','ľ','ŀ','ł','ḷ','ḹ'],
    'm': ['ḿ','ṁ','ṃ'],
    'n': ['ñ','ń','ņ','ň','ṅ','ṇ'],
    'o': ['ó','ò','ô','ö','õ','ø','ō','ŏ','ő','ǒ','ǿ'],
    'p': ['ṕ','ṗ'],
    'q': [],
    'r': ['ŕ','ŗ','ř','ṙ','ṛ'],
    's': ['ś','ŝ','ş','š','ș','ṡ','ṣ'],
    't': ['ţ','ť','ŧ','ț','ṫ','ṭ'],
    'u': ['ú','ù','û','ü','ũ','ū','ŭ','ů','ű','ų','ǔ','ǖ','ǘ','ǚ','ǜ'],
    'v': ['ṽ','ṿ'],
    'w': ['ŵ','ẁ','ẃ','ẅ'],
    'x': ['ẋ','ẍ'],
    'y': ['ý','ÿ','ŷ','ȳ','ẏ','ỳ'],
    'z': ['ź','ż','ž','ẓ']
};

/**
 * CACHE SYSTEM FOR HEAVY METRIC CALCULATIONS
 * Persists results of counterform analysis to avoid re-calculating identical paths.
 */
export class MetricsCache {
    private static cache: Map<string, any> = new Map();

    static get(fontFamily: string, char: string, type: string) {
        return this.cache.get(`${fontFamily}_${char}_${type}`);
    }

    static set(fontFamily: string, char: string, type: string, value: any) {
        // Limit cache size to prevent memory leaks
        if (this.cache.size > 2000) this.cache.clear();
        this.cache.set(`${fontFamily}_${char}_${type}`, value);
    }
    
    static clear() {
        this.cache.clear();
    }
}


// Helper to manipulate font binary to avoid opentype.js parsing errors with complex tables
const stripLayoutTables = (buffer: ArrayBuffer): ArrayBuffer => {
    try {
        const data = new DataView(buffer);
        // Check for SFNT header (OTTO or true or 0x00010000)
        // We just read numTables at offset 4.
        const numTables = data.getUint16(4);
        
        // Clone buffer to avoid mutating original source if needed
        const newBuffer = buffer.slice(0); 
        const newData = new DataView(newBuffer);
        
        let offset = 12; // Start of Table Directory
        for (let i = 0; i < numTables; i++) {
            const t1 = newData.getUint8(offset);
            const t2 = newData.getUint8(offset + 1);
            const t3 = newData.getUint8(offset + 2);
            const t4 = newData.getUint8(offset + 3);
            
            const tag = String.fromCharCode(t1, t2, t3, t4);
            
            // If it's a layout table that might cause parsing errors or is not needed
            // "lookup type 6 format 2" errors usually come from GPOS/GSUB contexts
            if (['GPOS', 'GSUB', 'GDEF', 'JSTF', 'BASE', 'kern'].includes(tag)) {
                // Rename tag to 'void' so opentype.js skips its specific parsers
                // 'void' in ascii: 118, 111, 105, 100
                newData.setUint8(offset, 118); 
                newData.setUint8(offset + 1, 111);
                newData.setUint8(offset + 2, 105);
                newData.setUint8(offset + 3, 100);
            }
            offset += 16;
        }
        return newBuffer;
    } catch (e) {
        console.warn("Failed to strip layout tables, attempting to parse original buffer", e);
        return buffer;
    }
};

export const parseFont = async (buffer: ArrayBuffer): Promise<OpenTypeFont> => {
  const cleanBuffer = stripLayoutTables(buffer);
  return opentype.parse(cleanBuffer);
};

// Helper: Ensure every glyph has a name to prevent "Undefined CHARARRAY" error in opentype.js
// Enhanced to handle empty strings and sanitize CFF incompatible names
const ensureGlyphNames = (font: OpenTypeFont) => {
    if (!font.glyphs || font.glyphs.length === 0) return;
    
    const numGlyphs = font.glyphs.length;
    for (let i = 0; i < numGlyphs; i++) {
        const glyph = font.glyphs.get(i);
        
        // 1. Assign name if missing
        if (glyph.name === undefined || glyph.name === null || String(glyph.name).trim() === '') {
            if (glyph.unicode) {
                 glyph.name = 'uni' + glyph.unicode.toString(16).toUpperCase().padStart(4, '0');
            } else {
                 glyph.name = `gid${i}`;
            }
        }

        // 2. Sanitize Name for PostScript/CFF compliance
        // We replace any non-safe character with underscore.
        // Important: Glyph names cannot be empty.
        let safeName = String(glyph.name).replace(/[^a-zA-Z0-9._]/g, '_');
        if (safeName.length === 0) {
            safeName = `gid${i}`;
        }
        glyph.name = safeName;
    }
};

// -- NEW: Explicit Font Preparation for Export --
// Ensures the internal names table matches the requested family name.
// This is critical for browsers to treat the generated binary as a valid unique font family.
export const prepareFontForExport = (font: OpenTypeFont, familyName: string) => {
    // CRITICAL FIX: Wipe existing names completely to avoid corrupt encodings from original files.
    font.names = {};
    
    // Sanitize string to be safe for PostScript names
    const nameStr = familyName.replace(/[^a-zA-Z0-9- ]/g, ''); 
    const psName = nameStr.replace(/\s/g, ''); // PostScript names cannot have spaces

    // Set English names (Platform 1 and 3 usually generated by opentype.js defaults, but we set structure)
    font.names.fontFamily = { en: nameStr };
    font.names.fontSubfamily = { en: 'Regular' };
    font.names.fullName = { en: nameStr };
    font.names.postScriptName = { en: psName };
    
    // Ensure unique ID to avoid browser cache collision
    font.names.uniqueID = { en: `SAAME:${psName}:${Date.now()}` };
    font.names.version = { en: 'Version 1.0 SAAME' };
};

// Helper to silently convert font to buffer, suppressing opentype.js verbosity
const silentToArrayBuffer = (font: OpenTypeFont): ArrayBuffer => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    const suppress = [
        "Adding CMAP format 12",
        "No character map found",
        "Undefined CHARARRAY" // We suppress logging, but we fixed the root cause in prepareFontForExport/ensureGlyphNames
    ];

    try {
        console.log = (...args: any[]) => {
            const msg = args.join(' ');
            if (suppress.some(s => msg.includes(s))) return;
            originalLog.apply(console, args);
        };
        console.warn = (...args: any[]) => {
             const msg = args.join(' ');
             if (suppress.some(s => msg.includes(s))) return;
             originalWarn.apply(console, args);
        }
        console.error = (...args: any[]) => {
             const msg = args.join(' ');
             if (suppress.some(s => msg.includes(s))) return;
             originalError.apply(console, args);
        }

        return font.toArrayBuffer();
    } finally {
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
    }
};

export const createFontUrl = (font: OpenTypeFont, familyName: string): string => {
  // Used only for processed fonts where we MUST rebuild the binary
  try {
      // 1. Clean extra tables that might confuse the exporter
      if (font.tables.kern) delete font.tables.kern;
      if (font.tables.gpos) delete font.tables.gpos;
      if (font.tables.gsub) delete font.tables.gsub;
      // GDEF, JSTF, BASE often cause issues if not strictly synced
      if (font.tables.gdef) delete font.tables.gdef;

      // 2. Update internal names (CRITICAL FIX FOR "Undefined CHARARRAY" and browser cache)
      prepareFontForExport(font, familyName);
      
      // 3. Fix glyph names (Sanitization)
      ensureGlyphNames(font);

      // 4. FORCE POST TABLE VERSION 3.0
      // This tells consumers to ignore glyph names in the post table, strictly relying on indices.
      // This is the most robust way to avoid "Undefined CHARARRAY" or name parsing errors.
      if (!font.tables.post) font.tables.post = {};
      font.tables.post.version = 3;
      
      // Initialize required fields to defaults
      font.tables.post.italicAngle = font.tables.post.italicAngle || 0;
      font.tables.post.underlinePosition = font.tables.post.underlinePosition || -100;
      font.tables.post.underlineThickness = font.tables.post.underlineThickness || 50;
      font.tables.post.isFixedPitch = font.tables.post.isFixedPitch || 0;
      font.tables.post.minMemType42 = 0;
      font.tables.post.maxMemType42 = 0;
      font.tables.post.minMemType1 = 0;
      font.tables.post.maxMemType1 = 0;

      // 5. ENSURE OS/2 TABLE VALIDITY (Critical for Browser Rendering)
      if (!font.tables.os2) font.tables.os2 = {};
      if (font.tables.os2.version === undefined) font.tables.os2.version = 1; 
      font.tables.os2.usWeightClass = font.tables.os2.usWeightClass || 400;
      font.tables.os2.usWidthClass = font.tables.os2.usWidthClass || 5; // Medium
      if (!font.tables.os2.ulCodePageRange1) font.tables.os2.ulCodePageRange1 = 1; // Latin
      if (!font.tables.os2.ulCodePageRange2) font.tables.os2.ulCodePageRange2 = 0;

      // 6. SYNCHRONIZE VERTICAL METRICS (OS/2 & hhea)
      // This ensures the "Tracy" and "Sousa" fonts align vertically with "Original"
      if (!font.tables.hhea) font.tables.hhea = {};

      const ascender = font.ascender !== undefined ? font.ascender : 800;
      const descender = font.descender !== undefined ? font.descender : -200;
      
      font.tables.os2.sTypoAscender = ascender;
      font.tables.os2.sTypoDescender = descender;
      font.tables.os2.sTypoLineGap = 0;
      font.tables.os2.usWinAscent = ascender;
      font.tables.os2.usWinDescent = Math.abs(descender);
      
      font.tables.hhea.ascender = ascender;
      font.tables.hhea.descender = descender;
      font.tables.hhea.lineGap = 0;

      const buffer = silentToArrayBuffer(font);
      if (!buffer || buffer.byteLength === 0) {
          throw new Error("Generated font buffer is empty");
      }

      const blob = new Blob([buffer], { type: 'font/opentype' });
      return URL.createObjectURL(blob);
  } catch (e) {
      console.error("Error creating font URL", e);
      return "";
  }
};

export const createFontState = async (buffer: ArrayBuffer, type: MethodType): Promise<FontState> => {
  // 1. Sanitize for Parsing: Remove complex tables that crash opentype.js
  const cleanBuffer = stripLayoutTables(buffer);
  const font = opentype.parse(cleanBuffer);
  
  // Helper to measure visual extrema
  const measureMetric = (chars: string[], type: 'max' | 'min', fallback: number) => {
      let best = fallback;
      let found = false;
      
      chars.forEach(char => {
          const glyph = font.charToGlyph(char);
          if (glyph && glyph.path.commands.length > 0) {
              const box = glyph.getBoundingBox();
              if (type === 'max') {
                  if (!found || box.y2 > best) {
                      best = box.y2;
                      found = true;
                  }
              } else {
                   if (!found || box.y1 < best) {
                      best = box.y1;
                      found = true;
                  }
              }
          }
      });
      return Math.round(best);
  };

  const visAscender = measureMetric(['d', 'h', 'l', 'b', 'k', 'H'], 'max', font.ascender);
  const visDescender = measureMetric(['p', 'q', 'y', 'g'], 'min', font.descender);

  const glyphsList: string[] = [];
  for (let i = 0; i < font.glyphs.length; i++) {
    const g = font.glyphs.get(i);
    if (g.unicode && g.unicode > 32) { // Skip controls and space for the list
      try {
        glyphsList.push(String.fromCodePoint(g.unicode));
      } catch (e) {}
    }
  }

  const metrics = {
    ascender: visAscender,
    descender: visDescender,
    unitsPerEm: font.unitsPerEm,
    xHeight: 0,
    capHeight: 0,
    chars: glyphsList
  };

  // Estimate xHeight and capHeight
  const xGlyph = font.charToGlyph('x');
  const hGlyph = font.charToGlyph('H');
  
  if (xGlyph && xGlyph.unicode) {
    const box = xGlyph.getBoundingBox();
    metrics.xHeight = box.y2 - box.y1; 
  }
  if (hGlyph && hGlyph.unicode) {
    const box = hGlyph.getBoundingBox();
    metrics.capHeight = box.y2 - box.y1;
  }
  
  // 2. Generate Unique Family Name to prevent caching collisions
  const timestamp = Date.now();
  const baseName = type === MethodType.ORIGINAL ? 'Original' : type === MethodType.TRACY ? 'Tracy' : 'Sousa';
  const fullFontFamily = `${baseName}-${timestamp}`;

  // 3. Create URL
  let url = "";
  if (type === MethodType.ORIGINAL) {
      // For Original, we want exact fidelity, so we use the raw buffer.
      // We will trust the raw buffer but try to inject unique CSS class mapping.
      const blob = new Blob([buffer], { type: 'font/opentype' });
      url = URL.createObjectURL(blob);
  } else {
      // For processed fonts, we MUST rebuild the binary with the new name.
      url = createFontUrl(font, fullFontFamily);
  }

  return {
    type,
    fontObj: font,
    url,
    fullFontFamily,
    metrics
  };
};


export const downloadFont = (font: OpenTypeFont, suffix: string) => {
    // Before downloading, ensure the exported file has a clean name
    const timestamp = Date.now();
    const familyName = font.names.fontFamily?.en || 'SAAME_Font';
    // We update the internal name one last time for the file download
    const exportName = `${familyName} ${suffix}`;
    
    // Use createFontUrl logic to prepare/sanitize but manually handle blob
    // Note: We use the logic but manually handle the download link below
    try {
        // Reuse the logic from createFontUrl by extracting it here, or simpler:
        // Apply the same strict preparations
        if (font.tables.kern) delete font.tables.kern;
        if (font.tables.gpos) delete font.tables.gpos;
        if (font.tables.gsub) delete font.tables.gsub;

        prepareFontForExport(font, exportName);
        ensureGlyphNames(font);
        
        // Ensure POST table is clean for download too
        if (!font.tables.post) font.tables.post = {};
        font.tables.post.version = 3;

        // Ensure OS/2 validity for downloaded files too
        if (!font.tables.os2) font.tables.os2 = {};
        if (font.tables.os2.version === undefined) font.tables.os2.version = 1;
        font.tables.os2.usWeightClass = font.tables.os2.usWeightClass || 400;
        font.tables.os2.usWidthClass = font.tables.os2.usWidthClass || 5;

        // Ensure vertical metrics sync
        if (!font.tables.hhea) font.tables.hhea = {};
        const ascender = font.ascender || 800;
        const descender = font.descender || -200;
        font.tables.os2.sTypoAscender = ascender;
        font.tables.os2.sTypoDescender = descender;
        font.tables.os2.sTypoLineGap = 0;
        font.tables.os2.usWinAscent = ascender;
        font.tables.os2.usWinDescent = Math.abs(descender);
        font.tables.hhea.ascender = ascender;
        font.tables.hhea.descender = descender;
        font.tables.hhea.lineGap = 0;

        const buffer = silentToArrayBuffer(font);
        const blob = new Blob([buffer], { type: 'font/opentype' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = `${familyName}_${suffix}_${timestamp}.otf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error("Error downloading font", e);
        alert("Failed to generate font file for download.");
    }
};

export const calculateAverageSB = (font: OpenTypeFont): number => {
    let total = 0;
    let count = 0;
    const numGlyphs = font.glyphs.length;
    
    // Sample up to 1000 glyphs, focusing on basic Latin
    for (let i = 0; i < numGlyphs; i++) {
        const glyph = font.glyphs.get(i);
        // Only process glyphs with unicode in basic/extended Latin range
        if (glyph.unicode && glyph.unicode < 0x0500 && glyph.name !== 'space') {
            // Use pre-calculated metrics if possible, otherwise fall back to bounding box ONLY if necessary
            // In most opentype.js versions, leftSideBearing is pre-populated
            const lsb = glyph.leftSideBearing !== undefined ? glyph.leftSideBearing : (glyph.xMin || 0);
            const rsb = glyph.advanceWidth - (glyph.xMax || 0);
            
            total += (lsb + rsb);
            count++;
            
            // Limit search for performance on massive fonts
            if (count > 500) break;
        }
    }
    return count > 0 ? Math.round(total / (count * 2)) : 0;
}

export const getCharMetrics = (font: OpenTypeFont, char: string): { lsb: number, rsb: number } => {
    const glyph = font.charToGlyph(char);
    if (!glyph) return { lsb: 0, rsb: 0 };
    
    // Check if the glyph HAS a path to determine if it's empty
    if (glyph.path.commands.length === 0) {
        return { lsb: 0, rsb: glyph.advanceWidth };
    }

    const box = glyph.getBoundingBox();

    const lsb = box.x1;
    const rsb = glyph.advanceWidth - box.x2;
    return { lsb: Math.round(lsb), rsb: Math.round(rsb) };
};

// Helper to get glyph data for Visualization
export const getGlyphData = (font: OpenTypeFont, char: string) => {
    const glyph = font.charToGlyph(char);
    if (!glyph) return null;
    
    const box = glyph.getBoundingBox();
    
    // Handle empty glyphs
    if ((box.x1 === 0 && box.x2 === 0 && box.y1 === 0 && box.y2 === 0) || glyph.path.commands.length === 0) {
         return {
            xMin: 0,
            xMax: 0,
            yMin: font.descender,
            yMax: font.ascender,
            advanceWidth: glyph.advanceWidth,
            pathData: ''
        };
    }

    // Get path exactly as it exists in the font's coordinate system
    const units = font.unitsPerEm || 1000;
    const path = glyph.getPath(0, 0, units); 
    const pathData = path.toPathData(2);

    return {
        xMin: box.x1,
        xMax: box.x2,
        yMin: font.descender,
        yMax: font.ascender, // Use font metrics for vertical consistency
        glyphYMin: box.y1,
        glyphYMax: box.y2,
        advanceWidth: glyph.advanceWidth,
        pathData
    };
};

// --- NEW: Counter-form Analysis for Visualization ---
export const getCounterMetrics = (font: OpenTypeFont, char: string) => {
    const fontFamily = font.names.fontFamily?.en || 'Unknown';
    const cached = MetricsCache.get(fontFamily, char, 'counter_metrics');
    if (cached) return cached;

    const glyph = font.charToGlyph(char);
    if (!glyph) return null;
    
    const box = glyph.getBoundingBox();
    const width = box.x2 - box.x1;
    
    const weightClass = font.tables.os2?.usWeightClass || 400;
    const upm = font.unitsPerEm || 1000;
    const baseStemRatio = 0.12; 
    const weightFactor = (weightClass / 400); 
    const estimatedStem = (upm * baseStemRatio) * Math.pow(weightFactor, 0.7); 
    
    let counterWidth = width - (2 * estimatedStem);
    let counterX = box.x1 + estimatedStem;
    let archY = (char === char.toUpperCase()) ? (font.tables.os2?.sCapHeight || upm * 0.7) : (font.tables.os2?.sxHeight || upm * 0.5);
    
    // Slant compensation
    const italicAngle = font.tables.post?.italicAngle || 0;
    const slantFactor = Math.tan((-italicAngle * Math.PI) / 180); // Invert because opentype shear is often right-leaning
    
    // Analytical refinement for open characters based on actual path
    if (char === 'n' || char === 'H') {
        const commands = glyph.path.commands;
        const baselineX: number[] = [];
        commands.forEach(cmd => {
            // Find points near mid-height (to identify stems and avoid baseline/cap height serifs)
            const midY = (box.y1 + box.y2) / 2;
            const tolerance = (box.y2 - box.y1) * 0.25; // Increased tolerance to 25%
            
            // Adjust X by slant factor based on Y
            const x = (cmd as any).x !== undefined ? (cmd as any).x - ((cmd as any).y !== undefined ? ((cmd as any).y - (box.y1 + box.y2)/2) * slantFactor : 0) : undefined;
            
            if ((cmd as any).y !== undefined && Math.abs((cmd as any).y - midY) < tolerance && x !== undefined) {
                // Ensure we aren't just picking random points in the middle of a thick serifed stem
                // Just add unique X positions, and we sort/filter them later
                baselineX.push(x);
            }
        });
        
        // Remove duplicates and sort, then filter extreme values
        const uniqueX = Array.from(new Set(baselineX)).sort((a,b) => a - b);
        
        // Filter: Keep only points that are reasonably positioned
        // Assuming two stems: we should have at least 4 extreme points, or distinct edges
        if (uniqueX.length >= 2) {
             // Heuristic: If we have many points, we might have detailed shapes inside the stems.
             // We need the edges. For two stems, edges should be the min and max for inner/outer.
             // For simplicity, let's take the first and last as outer, and the pair closest to center for inner.
             const outerL = uniqueX[0];
             const outerR = uniqueX[uniqueX.length - 1];
             // Inner edges are the ones closest to the center
             const mid = (outerL + outerR) / 2;
             const innerL = uniqueX.filter(x => x < mid).slice(-1)[0] || (outerL + (outerR - outerL) / 3);
             const innerR = uniqueX.filter(x => x > mid)[0] || (outerR - (outerR - outerL) / 3);
             
             counterX = innerL;
             counterWidth = innerR - innerL;
             
             // Adjust counterX for slant
             counterX += (archY - (box.y1 + box.y2)/2) * slantFactor;
        }

        // Find the inner arch height for 'n'
        if (char === 'n') {
            let maxInnerY = 0;
            // The inner arch is the highest point between the inner stems that isn't the glyph top
            commands.forEach(cmd => {
                const x = (cmd as any).x !== undefined ? (cmd as any).x - ((cmd as any).y !== undefined ? ((cmd as any).y - (box.y1 + box.y2)/2) * slantFactor : 0) : undefined;
                if (x !== undefined && x > counterX + 2 && x < counterX + counterWidth - 2) {
                    if ((cmd as any).y !== undefined && (cmd as any).y > maxInnerY && (cmd as any).y < box.y2 - 10) {
                        maxInnerY = (cmd as any).y;
                    }
                }
            });
            if (maxInnerY > 0) archY = maxInnerY;
        }
    }

    const result = {
        counterWidth: Math.max(0, counterWidth),
        counterX,
        estimatedStem,
        archY,
        italicAngle // Pass this out
    };
    
    MetricsCache.set(fontFamily, char, 'counter_metrics', result);
    return result;
};

/**
 * Extracts the specific internal "hole" path of a character (e.g., inside 'O' or 'o')
 * to allow for high-fidelity counterform visualization.
 */
export const getCounterPathData = (font: OpenTypeFont, char: string): string | null => {
    const fontFamily = font.names.fontFamily?.en || 'Unknown';
    const cached = MetricsCache.get(fontFamily, char, 'counter_path');
    if (cached) return cached;

    const glyph = font.charToGlyph(char);
    if (!glyph || !glyph.path || glyph.path.commands.length === 0) return null;

    const commands = glyph.path.commands;
    const contours: any[][] = [];
    let currentContour: any[] = [];

    commands.forEach(cmd => {
        if (cmd.type === 'M' && currentContour.length > 0) {
            contours.push(currentContour);
            currentContour = [];
        }
        currentContour.push(cmd);
        if (cmd.type === 'Z') {
            contours.push(currentContour);
            currentContour = [];
        }
    });
    if (currentContour.length > 0) contours.push(currentContour);

    const validContours = contours.filter(c => c.length > 2);
    if (validContours.length <= 1) return null; // No internal holes

    // Heuristic: Sorting by bounding box area. The smallest valid contour is likely the counter.
    // For 'O', the second contour is the hole.
    const getArea = (contour: any[]) => {
        let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
        contour.forEach(cmd => {
            if (cmd.x !== undefined) {
                xMin = Math.min(xMin, cmd.x); xMax = Math.max(xMax, cmd.x);
                yMin = Math.min(yMin, cmd.y); yMax = Math.max(yMax, cmd.y);
            }
        });
        return (xMax - xMin) * (yMax - yMin);
    };

    validContours.sort((a, b) => getArea(a) - getArea(b));

    // Create a path from the smallest contour
    const p = new opentype.Path();
    p.commands = validContours[0];
    const pathData = p.toPathData(2);
    
    MetricsCache.set(fontFamily, char, 'counter_path', pathData);
    return pathData;
};

/**
 * Specifically constructs a 'didactic' counter path for open characters like H and n.
 */
export const getOpenCounterPath = (font: OpenTypeFont, char: string) => {
    const metrics = getCounterMetrics(font, char);
    if (!metrics) return null;

    const { counterWidth, counterX, archY } = metrics;
    const path = new opentype.Path();
    
    // Slant compensation
    const italicAngle = font.tables.post?.italicAngle || 0;
    const slantFactor = Math.tan((-italicAngle * Math.PI) / 180);
    const midY = archY / 2; // Approximate mid-point for skew

    const applySlant = (x: number, y: number) => ({
        x: x + (y - midY) * slantFactor,
        y
    });

    if (char === 'H') {
        const p1 = applySlant(counterX, 0);
        const p2 = applySlant(counterX, archY);
        const p3 = applySlant(counterX + counterWidth, archY);
        const p4 = applySlant(counterX + counterWidth, 0);
        
        path.moveTo(p1.x, p1.y);
        path.lineTo(p2.x, p2.y);
        path.lineTo(p3.x, p3.y);
        path.lineTo(p4.x, p4.y);
        path.close();
    } else if (char === 'n') {
        const r = counterWidth * 0.45;
        
        const p1 = applySlant(counterX, 0);
        const p2 = applySlant(counterX, archY - r);
        const pC = applySlant(counterX + r, archY);
        const p3 = applySlant(counterX + counterWidth - r, archY);
        const p4 = applySlant(counterX + counterWidth, archY - r);
        const p5 = applySlant(counterX + counterWidth, 0);
        
        path.moveTo(p1.x, p1.y);
        path.lineTo(p2.x, p2.y);
        path.quadraticCurveTo(applySlant(counterX, archY).x, applySlant(counterX, archY).y, pC.x, pC.y);
        path.lineTo(p3.x, p3.y);
        path.quadraticCurveTo(applySlant(counterX + counterWidth, archY).x, applySlant(counterX + counterWidth, archY).y, p4.x, p4.y);
        path.lineTo(p5.x, p5.y);
        path.close();
    }

    return path.toPathData(2);
};

/**
 * Advanced Auto Spacing Algorithm (Harmony & Legibility Focus)
 * Following Walter Tracy's Principle: Starting point is 50% of the internal counter.
 */
export const calculateHarmonicSpacing = (font: OpenTypeFont, char: string): number => {
    const glyph = font.charToGlyph(char);
    if (!glyph) return 40; 

    const box = glyph.getBoundingBox();
    const width = box.x2 - box.x1;
    
    const rounds = ['O', 'o', 'Q', 'C', 'G', 'e', 'c', '0'];
    const isRound = rounds.includes(char);

    // Use the unified counter metrics to ensure consistency with visualizer
    const metrics = getCounterMetrics(font, char);
    let internalCounter = metrics ? metrics.counterWidth : 0;
    
    // Fallback if counter couldn't be detected
    if (internalCounter <= 0) {
        const weightClass = font.tables.os2?.usWeightClass || 400;
        const upm = font.unitsPerEm || 1000;
        const baseStemRatio = 0.12; 
        const weightFactor = (weightClass / 400); 
        const estimatedStem = (upm * baseStemRatio) * Math.pow(weightFactor, 0.7); 
        internalCounter = width - (2 * estimatedStem);
    }
    
    // Safety check for narrow fonts or extreme weights
    if (internalCounter < width * 0.3) {
        internalCounter = width * 0.5;
    }

    // Walter Tracy's starting point: 50% (0.5) of internal counter
    // User requested "metade da contraforma" (50%) for all master characters
    let targetSB = internalCounter * 0.5;

    // Ensure it doesn't get too small or too large
    return Math.max(10, Math.round(targetSB));
};

/**
 * Returns the target percentage of the counter width based on character type
 */
export const getTargetSBPercentage = (char: string): number => {
    // User requested 50% for all master characters
    return 50;
};

export const calculateSousaDefaults = (font: OpenTypeFont) => {
    const n = calculateHarmonicSpacing(font, 'n');
    const o = calculateHarmonicSpacing(font, 'o');
    const H = calculateHarmonicSpacing(font, 'H');
    const O = calculateHarmonicSpacing(font, 'O');

    return {
        // n right side is slightly smaller than left side (Tracy's arch recommendation)
        n: { lsb: n, rsb: Math.round(n * 0.9) }, 
        o: { lsb: o, rsb: o }, 
        H: { lsb: H, rsb: H }, 
        O: { lsb: O, rsb: O }  
    };
};

export const cleanMetrics = (font: OpenTypeFont, onProgress?: (progress: number) => void): void => {
  const numGlyphs = font.glyphs.length;
  
  // OPTIMIZATION: Only clean Latin glyphs and relevant symbols to avoid O(N) lag on large fonts
  // For very large fonts (like CJK or Symbol fonts), iterating over 10k+ glyphs and 
  // measuring their bounding boxes is the primary cause of hanging.
  for (let i = 0; i < numGlyphs; i++) {
    // Relatar progresso a cada 100 iterações ou no final
    if (onProgress && (i % 100 === 0 || i === numGlyphs - 1)) {
        onProgress(Math.round((i / numGlyphs) * 100));
    }

    const glyph = font.glyphs.get(i);
    
    // Skip non-unicode glyphs if there are many (likely high-complexity symbols or CJK)
    // We prioritize the Latin-1 and Extended Latin ranges (up to 2000) for standard typography lab use.
    if (numGlyphs > 1000 && (!glyph.unicode || glyph.unicode > 2000)) continue;

    const isSpace =
      glyph.name === 'space' ||
      glyph.unicode === 32 ||
      glyph.name?.includes('space');

    // 1. Preserve Space
    if (isSpace) continue;
    
    // 2. Preserve Punctuation & Symbols (Standard Latin)
    if (glyph.unicode) {
        const char = String.fromCodePoint(glyph.unicode);
        if (/[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/.test(char)) continue;
    }

    if (glyph.unicode || glyph.name) {
       const bounds = glyph.getBoundingBox();
       
       if (isNaN(bounds.x1) || isNaN(bounds.x2)) continue;

       const width = bounds.x2 - bounds.x1;
       if (width >= 0) {
         const shiftX = -bounds.x1;
         if(shiftX !== 0 && !isNaN(shiftX)) {
            glyph.path.commands.forEach((cmd: any) => {
                if (cmd.x !== undefined) cmd.x += shiftX;
                if (cmd.x1 !== undefined) cmd.x1 += shiftX;
                if (cmd.x2 !== undefined) cmd.x2 += shiftX;
            });
            delete (glyph as any).xMin;
            delete (glyph as any).xMax;
            delete (glyph as any).yMin;
            delete (glyph as any).yMax;
         }
         glyph.advanceWidth = width;
         if(glyph.leftSideBearing !== undefined) glyph.leftSideBearing = 0;
       }
    }
  }
  if (font.tables.kern) delete font.tables.kern;
  if (font.tables.gpos) delete font.tables.gpos;
};

const setGlyphSB = (font: OpenTypeFont, glyphName: string, lsb: number | null, rsb: number | null) => {
    const glyph = font.charToGlyph(glyphName);
    if (!glyph || !glyph.path) return;
const isSpace =
  glyph.name === 'space' ||
  glyph.unicode === 32 ||
  glyph.name?.includes('space');

    // 🚨 BLOQUEIO ABSOLUTO DO ESPAÇO
    if (isSpace) return;

    let bounds = glyph.getBoundingBox();
    
    // SAFETY CHECK: Bounds can be NaN if path is empty/invalid
    if (isNaN(bounds.x1) || isNaN(bounds.x2)) return;

    if (lsb !== null) {
        const currentLsb = bounds.x1;
        const shift = lsb - currentLsb;
        if (Math.abs(shift) > 0.001 && !isNaN(shift)) {
            glyph.path.commands.forEach((cmd: any) => {
                if (cmd.x !== undefined) cmd.x += shift;
                if (cmd.x1 !== undefined) cmd.x1 += shift;
                if (cmd.x2 !== undefined) cmd.x2 += shift;
            });
            glyph.leftSideBearing = lsb; 
            
            // Invalidate cache
            delete (glyph as any).xMin;
            delete (glyph as any).xMax;
            delete (glyph as any).yMin;
            delete (glyph as any).yMax;
            
            bounds = glyph.getBoundingBox();
        }
    }

    if (rsb !== null && !isNaN(bounds.x2)) {
        glyph.advanceWidth = bounds.x2 + rsb;
    }
};

export const applyTracyMethod = (font: OpenTypeFont, settings: TracySettings): void => {
    const { H, O, n, o, overrides } = settings;

    const applyRule = (char: string, ruleLsb: number | null, ruleRsb: number | null) => {
        // Base Application
        setGlyphSB(font, char, ruleLsb, ruleRsb);

        // Propagate to Diacritics/Accents immediately
        // This ensures children (e.g., 'Á') inherit from parent ('A')
        const related = DIACRITICS_MAP[char];
        if (related && related.length > 0) {
            related.forEach(childChar => {
                setGlyphSB(font, childChar, ruleLsb, ruleRsb);
            });
        }
    };

    applyRule('H', H.lsb, H.rsb);
    applyRule('O', O.lsb, O.rsb);
    applyRule('n', n.lsb, n.rsb);
    applyRule('o', o.lsb, o.rsb);

    const valH = H.lsb;        
    const valO = O.lsb;        
    const valMoreH = Math.round(valH * 1.15); // Used for M, N, W (Wide)
    const valLessH = Math.round(valH * 0.85); // Used for Open/Curved based on H (B, E, F)
    const valMin = Math.max(5, Math.round(valH * 0.25)); // Minimum Space (*)
    const valVisual = Math.round((valH + valO) / 2);

    // --- UPPERCASE LOGIC (Tracy's Matrix) ---
    applyRule('A', valMin, valMin);        // Triangular: Min (*)
    applyRule('B', valH, valLessH);        // Stem + Curve
    applyRule('C', valO, valLessH);        // Curve + Open
    applyRule('D', valH, valO);            // Stem + Curve
    applyRule('E', valH, valLessH);        // Stem + Horizontal/Open
    applyRule('F', valH, valLessH);        // Stem + Horizontal/Open
    applyRule('G', valO, valLessH);        // Curve + Stem (Small)
    applyRule('H', valH, valH);            // Masters: Equal
    applyRule('I', valH, valH);            // Stem + Stem
    applyRule('J', valMin, valH);          // Min + Stem
    applyRule('K', valH, valMin);          // Stem + Diagonal
    applyRule('L', valH, valMin);          // Stem + Minimum
    applyRule('M', valMoreH, valMoreH);    // Extra space for heavy density
    applyRule('N', valH, valH);            // Vertical stems (standard)
    applyRule('O', valO, valO);            // Masters: Equal Rounds
    applyRule('P', valH, valO);            // Stem + Curve
    applyRule('Q', valO, valO);            // Round + Round (ignore tail)
    applyRule('R', valH, valMin);          // Stem + Diagonal
    applyRule('S', valVisual, valVisual);  // Complex curves
    applyRule('T', valMin, valMin);        // Horizontal: Min
    applyRule('U', valH, valH);            // Vertical stems
    applyRule('V', valMin, valMin);        // Diagonal: Min
    applyRule('W', valMin, valMin);        // Diagonal: Min
    applyRule('X', valMin, valMin);        // Diagonal: Min
    applyRule('Y', valMin, valMin);        // Diagonal: Min
    applyRule('Z', valLessH, valLessH);    // Open Horizontal

    // --- LOWERCASE LOGIC (Tracy's Matrix) ---
    const nStem = n.lsb;      
    const nArch = n.rsb;      
    const oRound = o.lsb;     
    const valLessN = Math.round(nStem * 0.85);
    const valLowMin = Math.max(5, Math.round(nStem * 0.25));
    const valLowVisual = Math.round((nStem + oRound) / 2);

    applyRule('a', oRound, nStem);         
    applyRule('b', nStem, oRound);        
    applyRule('c', oRound, valLessN);     
    applyRule('d', oRound, nStem);        
    applyRule('e', oRound, valLessN);     
    applyRule('f', valLowMin, valLowMin);     
    applyRule('g', oRound, nStem); 

    applyRule('h', nStem, nArch);      
    applyRule('i', nStem, nStem);      
    applyRule('j', nStem, nStem);         
    applyRule('k', nStem, valLowMin);     
    applyRule('l', nStem, nStem);      
    applyRule('m', nStem, nArch);         
    applyRule('n', nStem, nArch);         
    applyRule('o', oRound, oRound);       
    applyRule('p', nStem, oRound);     
    applyRule('q', oRound, nStem);        
    applyRule('r', nStem, valLowMin);     
    applyRule('s', valLowVisual, valLowVisual);   
    applyRule('t', nStem, valLowMin);     
    applyRule('u', nStem, nStem);         
    applyRule('v', valLowMin, valLowMin); 
    applyRule('w', valLowMin, valLowMin); 
    applyRule('x', valLowVisual, valLowVisual); 
    applyRule('y', valLowMin, valLowMin); 
    applyRule('z', valLowVisual, valLowVisual); 

    // Iterating over explicit OVERRIDES
    // These take precedence over standard rules AND the propagation above.
    // If a user manually tunes 'É', it will overwrite the value inherited from 'E'.
    Object.keys(overrides).forEach(char => {
         const { lsb, rsb } = overrides[char];
         setGlyphSB(font, char, lsb, rsb);
    });
};

export const TOPOLOGY: Record<string, { l: 'S'|'R'|'A'|'V', r: 'S'|'R'|'A'|'V' }> = {
    // Uppercase
    'A': { l: 'V', r: 'V' },
    'B': { l: 'S', r: 'R' },
    'C': { l: 'R', r: 'S' },
    'D': { l: 'S', r: 'R' },
    'E': { l: 'S', r: 'S' },
    'F': { l: 'S', r: 'S' },
    'G': { l: 'R', r: 'S' }, 
    'H': { l: 'S', r: 'S' },
    'I': { l: 'S', r: 'S' },
    'J': { l: 'V', r: 'S' }, 
    'K': { l: 'S', r: 'V' },
    'L': { l: 'S', r: 'V' },
    'M': { l: 'S', r: 'S' }, 
    'N': { l: 'S', r: 'S' }, 
    'O': { l: 'R', r: 'R' },
    'P': { l: 'S', r: 'R' },
    'Q': { l: 'R', r: 'R' },
    'R': { l: 'S', r: 'V' },
    'S': { l: 'V', r: 'V' },
    'T': { l: 'V', r: 'V' },
    'U': { l: 'S', r: 'S' }, 
    'V': { l: 'V', r: 'V' },
    'W': { l: 'V', r: 'V' },
    'X': { l: 'V', r: 'V' },
    'Y': { l: 'V', r: 'V' },
    'Z': { l: 'V', r: 'V' },
    // Lowercase
    'a': { l: 'R', r: 'S' }, 
    'b': { l: 'S', r: 'R' },
    'c': { l: 'R', r: 'R' },
    'd': { l: 'R', r: 'S' },
    'e': { l: 'R', r: 'R' },
    'f': { l: 'V', r: 'V' }, 
    'g': { l: 'R', r: 'S' },
    'h': { l: 'S', r: 'A' }, 
    'i': { l: 'S', r: 'S' },
    'j': { l: 'S', r: 'S' }, 
    'k': { l: 'S', r: 'V' },
    'l': { l: 'S', r: 'S' },
    'm': { l: 'S', r: 'A' },
    'n': { l: 'S', r: 'A' },
    'o': { l: 'R', r: 'R' },
    'p': { l: 'S', r: 'R' },
    'q': { l: 'R', r: 'S' },
    'r': { l: 'S', r: 'V' },
    's': { l: 'V', r: 'V' },
    't': { l: 'S', r: 'V' },
    'u': { l: 'S', r: 'S' }, 
    'v': { l: 'V', r: 'V' },
    'w': { l: 'V', r: 'V' },
    'x': { l: 'V', r: 'V' },
    'y': { l: 'V', r: 'V' },
    'z': { l: 'V', r: 'V' },
};

export const applySousaMethod = (font: OpenTypeFont, settings: SousaSettings): void => {
    const { n, o, H, O, overrides } = settings;

    // Helper to get value based on topology and case
    const getValue = (char: string, side: 'l'|'r', topoType: 'S'|'R'|'A'|'V'): number => {
        const isUpper = char === char.toUpperCase() && char !== char.toLowerCase();
        
        // Masters
        if (isUpper) {
            if (topoType === 'S') return H.lsb; 
            if (topoType === 'R') return O.lsb;
            if (topoType === 'V') return Math.round(H.lsb * 0.5); // Fallback for uppercase visual
        } else {
            if (topoType === 'S') return n.lsb; 
            if (topoType === 'A') return n.rsb; 
            if (topoType === 'R') return o.lsb; 
            if (topoType === 'V') return Math.round(n.lsb * 0.5); // Fallback for lowercase visual
        }
        return 20; // Safe fallback
    };

    // 1. Iterate over all characters in topology (A-Z, a-z) and apply rules
    Object.keys(TOPOLOGY).forEach(char => {
        const topo = TOPOLOGY[char];
        
        // Calculate based on Topology
        const lsb = getValue(char, 'l', topo.l);
        const rsb = getValue(char, 'r', topo.r);

        setGlyphSB(font, char, lsb, rsb);

        // PROPAGATE TO DIACRITICS
        const related = DIACRITICS_MAP[char];
        if (related && related.length > 0) {
            related.forEach(childChar => {
                setGlyphSB(font, childChar, lsb, rsb);
            });
        }
    });

    // 2. Iterate over explicit OVERRIDES 
    // This allows users to tune numbers, punctuation, OR specific accents (e.g. override 'É' specifically)
    Object.keys(overrides).forEach(char => {
         const { lsb, rsb } = overrides[char];
         setGlyphSB(font, char, lsb, rsb);
    });
    
    // 3. Ensure masters are explicitly precise BUT only if they haven't been manually overridden by the user.
    // If user overrides 'n', that override (applied in step 2) should stay.
    const setMasterSafe = (char: string, val: { lsb: number, rsb: number }) => {
        if (!overrides[char]) {
             setGlyphSB(font, char, val.lsb, val.rsb);
        }
    };

    setMasterSafe('n', n);
    setMasterSafe('o', o);
    setMasterSafe('H', H);
    setMasterSafe('O', O);
};

export const applyOriginalCustomMethod = (font: OpenTypeFont, settings: OriginalCustomSettings): void => {
    const { overrides } = settings;
    Object.keys(overrides).forEach(char => {
         const { lsb, rsb } = overrides[char];
         setGlyphSB(font, char, lsb, rsb);
    });
};

export const generateAdhesionText = (targetChar: string, contextGroup: string[]): string => {
    const isUpper = targetChar === targetChar.toUpperCase() && targetChar !== targetChar.toLowerCase();
    
    if (isUpper) {
        const ctx = (!contextGroup || contextGroup.length === 0) ? ['H', 'O'] : contextGroup;
        const r = () => ctx[Math.floor(Math.random() * ctx.length)];
        return `HH${targetChar}HH OO${targetChar}OO ${r()}${targetChar}${r()}`;
    } else {
        const ctx = (!contextGroup || contextGroup.length === 0) ? ['n', 'o'] : contextGroup;
        const r = () => ctx[Math.floor(Math.random() * ctx.length)];
        return `nn${targetChar}nn oo${targetChar}oo ${r()}${targetChar}${r()}`;
    }
};

export const generateFontFaceCSS = (fontState: FontState): string => {
    if (!fontState.url) return '';
    const { ascender, descender, unitsPerEm } = fontState.metrics;
    // Safety check for UPM
    const safeUPM = (unitsPerEm && unitsPerEm > 0) ? unitsPerEm : 1000;
    
    // Calculate overrides percentages
    // ascent-override: Height above baseline
    // descent-override: Height below baseline (must be positive magnitude)
    // line-gap-override: Force to 0 to remove variable leading
    const ascentPct = (ascender / safeUPM) * 100;
    const descentPct = (Math.abs(descender) / safeUPM) * 100;

    return `
@font-face {
    font-family: '${fontState.fullFontFamily}';
    src: url('${fontState.url}');
    font-display: block;
    ascent-override: ${ascentPct}%;
    descent-override: ${descentPct}%;
    line-gap-override: 0%;
}`;
};
