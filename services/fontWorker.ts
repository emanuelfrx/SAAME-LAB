
import opentype from 'https://unpkg.com/opentype.js@1.3.4/dist/opentype.module.js';

// Re-implementing necessary logic inside worker to avoid complex imports
// during the transition, as workers have separate scopes.

const DIACRITICS_MAP = {
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
    'r': ['ŕ','ŗ','ř','ṙ','ṛ'],
    's': ['ś','ŝ','ş','š','ș','ṡ','ṣ'],
    't': ['ţ','ť','ŧ','ț','ṫ','ṭ'],
    'u': ['ú','ù','û','ü','ũ','ū','ŭ','ů','ű','ų','ǔ','ǖ','ǘ','ǚ','ǜ'],
    'v': ['ṽ','ṿ'],
    'w': ['ŵ','ẁ','ẃ','ẅ'],
    'x': ['ẋ','ẍ'],
    'y': ['ý','ÿ','ŷ','Ȳ','ẏ','ỳ'],
    'z': ['ź','ż','ž','ẓ']
};

const stripLayoutTables = (buffer) => {
    try {
        const data = new DataView(buffer);
        const numTables = data.getUint16(4);
        const newBuffer = buffer.slice(0); 
        const newData = new DataView(newBuffer);
        let offset = 12;
        for (let i = 0; i < numTables; i++) {
            const t1 = newData.getUint8(offset);
            const t2 = newData.getUint8(offset + 1);
            const t3 = newData.getUint8(offset + 2);
            const t4 = newData.getUint8(offset + 3);
            const tag = String.fromCharCode(t1, t2, t3, t4);
            if (['GPOS', 'GSUB', 'GDEF', 'JSTF', 'BASE', 'kern'].includes(tag)) {
                newData.setUint8(offset, 118); 
                newData.setUint8(offset + 1, 111);
                newData.setUint8(offset + 2, 105);
                newData.setUint8(offset + 3, 100);
            }
            offset += 16;
        }
        return newBuffer;
    } catch (e) {
        return buffer;
    }
};

const ensureGlyphNames = (font) => {
    if (!font.glyphs || font.glyphs.length === 0) return;
    const numGlyphs = font.glyphs.length;
    for (let i = 0; i < numGlyphs; i++) {
        const glyph = font.glyphs.get(i);
        if (glyph.name === undefined || glyph.name === null || String(glyph.name).trim() === '') {
            glyph.name = glyph.unicode ? 'uni' + glyph.unicode.toString(16).toUpperCase().padStart(4, '0') : `gid${i}`;
        }
        let safeName = String(glyph.name).replace(/[^a-zA-Z0-9._]/g, '_');
        if (safeName.length === 0) safeName = `gid${i}`;
        glyph.name = safeName;
    }
};

const prepareFontForExport = (font, familyName) => {
    font.names = {};
    const nameStr = familyName.replace(/[^a-zA-Z0-9- ]/g, ''); 
    const psName = nameStr.replace(/\s/g, '');
    font.names.fontFamily = { en: nameStr };
    font.names.fontSubfamily = { en: 'Regular' };
    font.names.fullName = { en: nameStr };
    font.names.postScriptName = { en: psName };
    font.names.uniqueID = { en: `SAAME:${psName}:${Date.now()}` };
    font.names.version = { en: 'Version 1.0 SAAME' };
};

const setGlyphSB = (font, glyphName, lsb, rsb) => {
    const glyph = font.charToGlyph(glyphName);
    if (!glyph || !glyph.path) return;
    const isSpace = glyph.name === 'space' || glyph.unicode === 32 || (glyph.name && glyph.name.includes('space'));
    if (isSpace) return;

    let bounds = glyph.getBoundingBox();
    if (isNaN(bounds.x1) || isNaN(bounds.x2)) return;

    if (lsb !== null) {
        const currentLsb = bounds.x1;
        const shift = lsb - currentLsb;
        if (Math.abs(shift) > 0.001 && !isNaN(shift)) {
            glyph.path.commands.forEach((cmd) => {
                if (cmd.x !== undefined) cmd.x += shift;
                if (cmd.x1 !== undefined) cmd.x1 += shift;
                if (cmd.x2 !== undefined) cmd.x2 += shift;
            });
            glyph.leftSideBearing = lsb; 
            delete glyph.xMin;
            delete glyph.xMax;
            delete glyph.yMin;
            delete glyph.yMax;
            bounds = glyph.getBoundingBox();
        }
    }
    if (rsb !== null && !isNaN(bounds.x2)) {
        glyph.advanceWidth = bounds.x2 + rsb;
    }
};

const cleanMetrics = (font, onProgress) => {
    // OPTIMIZATION: Only clean Latin glyphs and relevant symbols to avoid O(N) lag on large fonts
    const numGlyphs = font.glyphs.length;
    
    // We only iterate through all glyphs BUT we skip path manipulation if already clean
    // OR we only target glyphs with unicode < 2000 (standard Latin/Extended)
    for (let i = 0; i < numGlyphs; i++) {
        // Relatar progresso a cada 100 iterações ou no final
        if (onProgress && (i % 100 === 0 || i === numGlyphs - 1)) {
            onProgress(Math.round((i / numGlyphs) * 100));
        }

        const glyph = font.glyphs.get(i);
        
        // Skip non-unicode glyphs if there are too many (likely complex symbols/CJK)
        if (numGlyphs > 1000 && (!glyph.unicode || glyph.unicode > 2000)) continue;

        const isSpace = glyph.name === 'space' || glyph.unicode === 32 || (glyph.name && glyph.name.includes('space'));
        if (isSpace) continue;

        const bounds = glyph.getBoundingBox();
        if (isNaN(bounds.x1) || isNaN(bounds.x2)) continue;

        const width = bounds.x2 - bounds.x1;
        if (width >= 0) {
            const shiftX = -bounds.x1;
            if(shiftX !== 0 && !isNaN(shiftX)) {
                glyph.path.commands.forEach((cmd) => {
                    if (cmd.x !== undefined) cmd.x += shiftX;
                    if (cmd.x1 !== undefined) cmd.x1 += shiftX;
                    if (cmd.x2 !== undefined) cmd.x2 += shiftX;
                });
                delete glyph.xMin;
                delete glyph.xMax;
                delete glyph.yMin;
                delete glyph.yMax;
            }
            glyph.advanceWidth = width;
            if(glyph.leftSideBearing !== undefined) glyph.leftSideBearing = 0;
        }
    }
    if (font.tables.kern) delete font.tables.kern;
    if (font.tables.gpos) delete font.tables.gpos;
};

const applyTracyMethod = (font, settings) => {
    const { H, O, n, o, overrides } = settings;
    const applyRule = (char, ruleLsb, ruleRsb) => {
        setGlyphSB(font, char, ruleLsb, ruleRsb);
        const related = DIACRITICS_MAP[char];
        if (related) {
            related.forEach(childChar => {
                setGlyphSB(font, childChar, ruleLsb, ruleRsb);
            });
        }
    };

    // Standard Tracy Logic
    applyRule('H', H.lsb, H.rsb);
    applyRule('O', O.lsb, O.rsb);
    applyRule('n', n.lsb, n.rsb);
    applyRule('o', o.lsb, o.rsb);

    const vH = H.lsb; const vO = O.lsb; 
    const vLessH = Math.round(vH * 0.85);
    const vMin = Math.max(5, Math.round(vH * 0.25));
    const vVis = Math.round((vH + vO) / 2);

    // Simplified list for worker
    const rules = {
        'A':[vMin,vMin], 'B':[vH,vLessH], 'C':[vO,vLessH], 'D':[vH,vO], 'E':[vH,vLessH], 'F':[vH,vLessH],
        'G':[vO,vLessH], 'I':[vH,vH], 'J':[vMin,vH], 'K':[vH,vMin], 'L':[vH,vMin], 'M':[Math.round(vH*1.15),Math.round(vH*1.15)],
        'N':[vH,vH], 'P':[vH,vO], 'Q':[vO,vO], 'R':[vH,vMin], 'S':[vVis,vVis], 'T':[vMin,vMin], 'U':[vH,vH],
        'V':[vMin,vMin], 'W':[vMin,vMin], 'X':[vMin,vMin], 'Y':[vMin,vMin], 'Z':[vLessH,vLessH]
    };
    Object.keys(rules).forEach(k => applyRule(k, rules[k][0], rules[k][1]));

    const nS = n.lsb; const nA = n.rsb; const oR = o.lsb;
    const vLessN = Math.round(nS * 0.85);
    const vLMin = Math.max(5, Math.round(nS * 0.25));
    const vLVis = Math.round((nS + oR) / 2);

    const lowRules = {
        'a':[oR,nS], 'b':[nS,oR], 'c':[oR,vLessN], 'd':[oR,nS], 'e':[oR,vLessN], 'f':[vLMin,vLMin],
        'g':[oR,nS], 'h':[nS,nA], 'i':[nS,nS], 'j':[nS,nS], 'k':[nS,vLMin], 'l':[nS,nS], 'm':[nS,nA],
        'p':[nS,oR], 'q':[oR,nS], 'r':[nS,vLMin], 's':[vLVis,vLVis], 't':[nS,vLMin], 'u':[nS,nS],
        'v':[vLMin,vLMin], 'w':[vLMin,vLMin], 'x':[vLVis,vLVis], 'y':[vLMin,vLMin], 'z':[vLVis,vLVis]
    };
    Object.keys(lowRules).forEach(k => applyRule(k, lowRules[k][0], lowRules[k][1]));

    Object.keys(overrides).forEach(char => {
         const { lsb, rsb } = overrides[char];
         setGlyphSB(font, char, lsb, rsb);
    });
};

const applySousaMethod = (font, settings) => {
    // Simplified Sousa for worker
    const { n, o, H, O, overrides } = settings;
    const TOPOLOGY = {
        'A':{l:'V',r:'V'},'B':{l:'S',r:'R'},'C':{l:'R',r:'S'},'D':{l:'S',r:'R'},'E':{l:'S',r:'S'},'F':{l:'S',r:'S'},'G':{l:'R',r:'S'},'H':{l:'S',r:'S'},'I':{l:'S',r:'S'},'J':{l:'V',r:'S'},'K':{l:'S',r:'V'},'L':{l:'S',r:'V'},'M':{l:'S',r:'S'},'N':{l:'S',r:'S'},'O':{l:'R',r:'R'},'P':{l:'S',r:'R'},'Q':{l:'R',r:'R'},'R':{l:'S',r:'V'},'S':{l:'V',r:'V'},'T':{l:'V',r:'V'},'U':{l:'S',r:'S'},'V':{l:'V',r:'V'},'W':{l:'V',r:'V'},'X':{l:'V',r:'V'},'Y':{l:'V',r:'V'},'Z':{l:'V',r:'V'},
        'a':{l:'R',r:'S'},'b':{l:'S',r:'R'},'c':{l:'R',r:'R'},'d':{l:'R',r:'S'},'e':{l:'R',r:'R'},'f':{l:'V',r:'V'},'g':{l:'R',r:'S'},'h':{l:'S',r:'A'},'i':{l:'S',r:'S'},'j':{l:'S',r:'S'},'k':{l:'S',r:'V'},'l':{l:'S',r:'S'},'m':{l:'S',r:'A'},'n':{l:'S',r:'A'},'o':{l:'R',r:'R'},'p':{l:'S',r:'R'},'q':{l:'R',r:'S'},'r':{l:'S',r:'V'},'s':{l:'V',r:'V'},'t':{l:'S',r:'V'},'u':{l:'S',r:'S'},'v':{l:'V',r:'V'},'w':{l:'V',r:'V'},'x':{l:'V',r:'V'},'y':{l:'V',r:'V'},'z':{l:'V',r:'V'}
    };

    const getValue = (char, side, topoType) => {
        const isUpper = char === char.toUpperCase() && char !== char.toLowerCase();
        if (isUpper) {
            if (topoType === 'S') return H.lsb; 
            if (topoType === 'R') return O.lsb;
            return Math.round(H.lsb * 0.5);
        } else {
            if (topoType === 'S') return n.lsb; 
            if (topoType === 'A') return n.rsb; 
            if (topoType === 'R') return o.lsb; 
            return Math.round(n.lsb * 0.5);
        }
    };

    Object.keys(TOPOLOGY).forEach(char => {
        const topo = TOPOLOGY[char];
        const lsb = getValue(char, 'l', topo.l);
        const rsb = getValue(char, 'r', topo.r);
        setGlyphSB(font, char, lsb, rsb);
        const related = DIACRITICS_MAP[char];
        if (related) {
            related.forEach(childChar => {
                setGlyphSB(font, childChar, lsb, rsb);
            });
        }
    });

    Object.keys(overrides).forEach(char => {
         const { lsb, rsb } = overrides[char];
         setGlyphSB(font, char, lsb, rsb);
    });
};


const getCounterMetrics = (font, char) => {
    const glyph = font.charToGlyph(char);
    if (!glyph) return null;
    
    const box = glyph.getBoundingBox();
    const width = box.x2 - box.x1;
    const upm = font.unitsPerEm || 1000;
    
    // Fallback: Use weight-based estimation first
    const weightClass = (font.tables.os2 ? font.tables.os2.usWeightClass : 400) || 400;
    const baseStemRatio = 0.12; 
    const weightFactor = (weightClass / 400); 
    const estimatedStem = (upm * baseStemRatio) * Math.pow(weightFactor, 0.7); 
    
    let counterWidth = width - (2 * estimatedStem);
    let counterX = box.x1 + estimatedStem;
    let archY = (char === char.toUpperCase()) ? ((font.tables.os2 && font.tables.os2.sCapHeight) || upm * 0.7) : ((font.tables.os2 && font.tables.os2.sxHeight) || upm * 0.5);
    
    // Slant compensation
    const italicAngle = (font.tables.post && font.tables.post.italicAngle) || 0;
    const slantFactor = Math.tan((-italicAngle * Math.PI) / 180); 
    
    // Analytical refinement for open characters based on actual path
    if (char === 'n' || char === 'H') {
        const commands = glyph.path.commands;
        const baselineX = [];
        commands.forEach(cmd => {
            const midY = (box.y1 + box.y2) / 2;
            const tolerance = (box.y2 - box.y1) * 0.25;
            const x = cmd.x !== undefined ? cmd.x - (cmd.y !== undefined ? (cmd.y - (box.y1 + box.y2)/2) * slantFactor : 0) : undefined;
            if (cmd.y !== undefined && Math.abs(cmd.y - midY) < tolerance && x !== undefined) {
                baselineX.push(x);
            }
        });
        
        const uniqueX = Array.from(new Set(baselineX)).sort((a,b) => a - b);
        if (uniqueX.length >= 2) {
             const outerL = uniqueX[0];
             const outerR = uniqueX[uniqueX.length - 1];
             const mid = (outerL + outerR) / 2;
             const innerL = uniqueX.filter(x => x < mid).slice(-1)[0] || (outerL + (outerR - outerL) / 3);
             const innerR = uniqueX.filter(x => x > mid)[0] || (outerR - (outerR - outerL) / 3);
             counterX = innerL;
             counterWidth = innerR - innerL;
             counterX += (archY - (box.y1 + box.y2)/2) * slantFactor;
        }

        if (char === 'n') {
            let maxInnerY = 0;
            commands.forEach(cmd => {
                const x = cmd.x !== undefined ? cmd.x - (cmd.y !== undefined ? (cmd.y - (box.y1 + box.y2)/2) * slantFactor : 0) : undefined;
                if (x !== undefined && x > counterX + 2 && x < counterX + counterWidth - 2) {
                    if (cmd.y !== undefined && cmd.y > maxInnerY && cmd.y < box.y2 - 10) {
                        maxInnerY = cmd.y;
                    }
                }
            });
            if (maxInnerY > 0) archY = maxInnerY;
        }
    }

    return { counterX, counterWidth, archY };
};

let cachedBaseFont = null;
let cachedCleanBuffer = null;

self.onmessage = async (e) => {
    const { action, buffer, tracySettings, sousaSettings, familyNamePrefix, context, method, settings } = e.data;
    
    try {
        if (action === 'PROCESS_ALL' || action === 'INITIAL_PARSE') {
             const isImport = context === 'IMPORT';
             if (buffer) {
                 cachedCleanBuffer = stripLayoutTables(buffer);
                 cachedBaseFont = opentype.parse(cachedCleanBuffer);
             }
             
             if (action === 'INITIAL_PARSE') {
                 self.postMessage({ action: 'INITIAL_SUCCESS' });
                 return;
             }

             const baseFont = cachedBaseFont;
             const cleanBuffer = cachedCleanBuffer;

             // 2. Metrics Measurement
             self.postMessage({ action: 'PROGRESS', progress: 15, status: isImport ? 'Calculando proporções iniciais...' : 'Avaliando métricas base...' });
             const measureMetric = (f, chars, type, fallback) => {
                let best = fallback;
                let found = false;
                chars.forEach(char => {
                    const glyph = f.charToGlyph(char);
                    if (glyph && glyph.path.commands.length > 0) {
                        const box = glyph.getBoundingBox();
                        if (type === 'max') {
                            if (!found || box.y2 > best) { best = box.y2; found = true; }
                        } else {
                            if (!found || box.y1 < best) { best = box.y1; found = true; }
                        }
                    }
                });
                return Math.round(best);
             };

             const visAscender = measureMetric(baseFont, ['d', 'h', 'l', 'b', 'k', 'H'], 'max', baseFont.ascender);
             const visDescender = measureMetric(baseFont, ['p', 'q', 'y', 'g'], 'min', baseFont.descender);
            
            const glyphsList = [];
            for (let i = 0; i < baseFont.glyphs.length; i++) {
                const g = baseFont.glyphs.get(i);
                if (g.unicode && g.unicode > 32) {
                    try { glyphsList.push(String.fromCodePoint(g.unicode)); } catch(e) {}
                }
            }

            const metrics = {
                ascender: visAscender,
                descender: visDescender,
                unitsPerEm: baseFont.unitsPerEm,
                xHeight: 0,
                capHeight: 0,
                chars: glyphsList
            };
             const xGlyph = baseFont.charToGlyph('x');
             const hGlyph = baseFont.charToGlyph('H');
             if (xGlyph && xGlyph.unicode) {
                 const box = xGlyph.getBoundingBox();
                 metrics.xHeight = box.y2 - box.y1; 
             }
             if (hGlyph && hGlyph.unicode) {
                 const box = hGlyph.getBoundingBox();
                 metrics.capHeight = box.y2 - box.y1;
             }

             // 3. Process Method Variants
             // We need fresh parses for each to avoid mutating original for buffer generation
             self.postMessage({ action: 'PROGRESS', progress: 20, status: isImport ? 'Configurando ambiente de análise...' : 'Preparando instâncias...' });
             const tFont = opentype.parse(cleanBuffer);
             const sFont = opentype.parse(cleanBuffer);

             self.postMessage({ action: 'PROGRESS', progress: 30, status: isImport ? 'Limpando kerning nativo...' : 'Limpando métricas originais (Tracy)...' });
             cleanMetrics(tFont, (p) => {
                 self.postMessage({ action: 'PROGRESS', progress: 30 + (p * 0.20), status: isImport ? 'Limpando kerning nativo...' : 'Limpando métricas originais (Tracy)...' });
             });
             self.postMessage({ action: 'PROGRESS', progress: 50, status: isImport ? 'Normalizando larguras...' : 'Limpando métricas originais (Sousa)...' });
             cleanMetrics(sFont, (p) => {
                 self.postMessage({ action: 'PROGRESS', progress: 50 + (p * 0.15), status: isImport ? 'Normalizando larguras...' : 'Limpando métricas originais (Sousa)...' });
             });

             self.postMessage({ action: 'PROGRESS', progress: 65, status: isImport ? 'Preparando método Tracy...' : 'Aplicando método Tracy...' });
             applyTracyMethod(tFont, tracySettings);
             self.postMessage({ action: 'PROGRESS', progress: 75, status: isImport ? 'Preparando método Sousa...' : 'Aplicando método Sousa...' });
             applySousaMethod(sFont, sousaSettings);

             self.postMessage({ action: 'PROGRESS', progress: 80, status: isImport ? 'Processando contraformas...' : 'Analisando contraformas...' });
             const counterMap = {};
             const stdChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split('');
             stdChars.forEach(c => {
                 counterMap[c] = getCounterMetrics(baseFont, c);
             });

const updateHheaTable = (font) => {
    if (!font.tables.hhea) return;
    
    let minLSB = 32767;
    let minRSB = 32767;
    let maxExtent = -32768;
    let maxAdvance = 0;
    
    for (let i = 0; i < font.glyphs.length; i++) {
        const glyph = font.glyphs.get(i);
        const lsb = glyph.leftSideBearing || 0;
        const advance = glyph.advanceWidth || 0;
        const box = glyph.getBoundingBox();
        const rsb = advance - (box.x2 || 0);
        const extent = box.x2 || 0;
        
        if (lsb < minLSB) minLSB = lsb;
        if (rsb < minRSB) minRSB = rsb;
        if (extent > maxExtent) maxExtent = extent;
        if (advance > maxAdvance) maxAdvance = advance;
    }
    
    font.tables.hhea.minLeftSideBearing = minLSB;
    font.tables.hhea.minRightSideBearing = minRSB;
    font.tables.hhea.xMaxExtent = maxExtent;
    font.tables.hhea.advanceWidthMax = maxAdvance;
};

const prepareAndBuffer = (f, name) => {
    if (f.tables.kern) delete f.tables.kern;
    if (f.tables.gpos) delete f.tables.gpos;
    prepareFontForExport(f, name);
    ensureGlyphNames(f);
    
    // Crucial: Update hhea and hmtx-related values
    updateHheaTable(f);
    
    if (!f.tables.post) f.tables.post = {};
    f.tables.post.version = 3;
    return f.toArrayBuffer();
};

             const tName = `Tracy-${Date.now()}`;
             const sName = `Sousa-${Date.now()}`;

             self.postMessage({ action: 'PROGRESS', progress: 85, status: isImport ? 'Construindo fontes em memória...' : 'Gerando binário (Tracy)...' });
             const tBuffer = prepareAndBuffer(tFont, tName);
             self.postMessage({ action: 'PROGRESS', progress: 95, status: isImport ? 'Carregando interface...' : 'Gerando binário (Sousa)...' });
             const sBuffer = prepareAndBuffer(sFont, sName);

             self.postMessage({ action: 'PROGRESS', progress: 100, status: isImport ? 'Importação Concluída!' : 'Finalizando...' });
             self.postMessage({
                 action: 'PROCESS_SUCCESS',
                 metrics: { ...metrics, counterMap },
                 tracy: { buffer: tBuffer, family: tName },
                 sousa: { buffer: sBuffer, family: sName }
             }, [tBuffer, sBuffer]);
        } else if (action === 'APPLY_METHOD') {
            if (!cachedCleanBuffer) {
                throw new Error("No font buffer cached in worker");
            }
            
            const tempFont = opentype.parse(cachedCleanBuffer);
            if (method === 'TRACY') {
                cleanMetrics(tempFont);
                applyTracyMethod(tempFont, settings);
            } else if (method === 'SOUSA') {
                cleanMetrics(tempFont);
                applySousaMethod(tempFont, settings);
            } else if (method === 'ORIGINAL_CUSTOM') {
                // For Original Custom, we don't clean so we preserve original SB
                Object.keys(settings.overrides).forEach(char => {
                    const { lsb, rsb } = settings.overrides[char];
                    setGlyphSB(tempFont, char, lsb, rsb);
                });
            }
            
            const familyName = `${method}-Live-${Date.now()}`;
            if (tempFont.tables.kern) delete tempFont.tables.kern;
            if (tempFont.tables.gpos) delete tempFont.tables.gpos;
            prepareFontForExport(tempFont, familyName);
            ensureGlyphNames(tempFont);
            if (!tempFont.tables.post) tempFont.tables.post = {};
            tempFont.tables.post.version = 3;
            
            const buffer = tempFont.toArrayBuffer();
            self.postMessage({
                action: 'APPLY_METHOD_SUCCESS',
                buffer,
                familyName,
                method
            }, [buffer]);
        }
    } catch (error) {
        self.postMessage({ action: 'ERROR', error: error.message });
    }
};
