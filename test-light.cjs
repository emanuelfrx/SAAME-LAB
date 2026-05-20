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
const issues = [];
files.forEach(file => {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
        // Find text that is light (white, slate-100, etc) without any dark:text modifier overriding it
        if (/(text-white|text-slate-[1234]00|text-gray-[1234]00)/.test(line)) {
            // we don't care if it's explicitly styling a dark dark background component that doesn't change
            // but if there is dark:bg- but NO dark:text, maybe it's bad.
            // Or if there is bg- light and the text is white, without dark:
            if (!/dark:text-/.test(line)) {
                issues.push(`${file}:${i + 1}: ${line.trim()}`);
            }
        }
    });
});
// Write to issue log
fs.writeFileSync('light-issues.txt', issues.join('\n'));
