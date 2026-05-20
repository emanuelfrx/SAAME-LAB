const fs = require('fs');
const glob = require('glob');

const files = glob.sync('components/**/*.tsx').concat(glob.sync('*.tsx'));
files.forEach(file => {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
        if (/text-(slate|gray|neutral|zinc)-[6789]00/.test(line)) {
            if (!/dark:text-/.test(line)) {
                console.log(`${file}:${i + 1}: ${line.trim()}`);
            }
        }
    });
});
