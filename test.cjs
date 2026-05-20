const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
    const fileList = fs.readdirSync(dir);
    for (const file of fileList) {
        const name = `${dir}/${file}`;
        if (fs.statSync(name).isDirectory()) {
            if (!name.includes('node_modules')) {
                getFiles(name, files);
            }
        } else {
            if (name.endsWith('.tsx') || name.endsWith('.ts')) {
                files.push(name);
            }
        }
    }
    return files;
}

const files = getFiles('./components').concat(getFiles('.').filter(f => !f.startsWith('./components')));
files.forEach(file => {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
        if (/text-(slate|gray|neutral|zinc)-[6789]00/.test(line)) {
            if (!/dark:text-/.test(line)) {
                console.log(`${file}:${i + 1}: ${line.trim()}`);
            }
        }
        if (/text-(slate|gray|neutral|zinc)-[1234]00/.test(line) && !line.includes('dark:text-') && !line.includes('text-slate-')) {
            // maybe text-light over dark backgrounds
            // Actually, we'll just check for any text-[1234]00 without responsive text.
            if (!/dark:text-/.test(line)) {
                console.log(`[LIGHT_TEXT_WARNING] ${file}:${i + 1}: ${line.trim()}`);
            }
        }
    });
});
