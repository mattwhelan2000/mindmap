import * as fs from 'fs';
import * as crypto from 'crypto';

const text = fs.readFileSync('test.json', 'utf8');
const data = JSON.parse(text);

const parseGenericNode = (node: any): any => {
    let nodeText = node.name || node.text || node.title || 'Untitled';
    if (node.description) nodeText += `\n\n${node.description}`;
    if (node.theme) nodeText += `\n\nTheme: ${node.theme}`;
    if (node.script) nodeText += `\n\nScript: ${node.script}`;
    if (node.synopsis && typeof node.synopsis === 'object') {
        nodeText += `\n\nSynopsis:`;
        for (const [key, value] of Object.entries(node.synopsis)) {
            nodeText += `\n• ${key}: ${value}`;
        }
    }
    return {
        id: crypto.randomUUID(),
        text: nodeText,
        children: Array.isArray(node.children) ? node.children.map(parseGenericNode) : []
    };
};

if (data.name || data.text || data.title) {
    const rootNode = parseGenericNode(data);
    console.log("Successfully parsed root:", rootNode.text);
    console.log("Has children:", rootNode.children.length);
} else {
    console.log("Data did not match expected generic structure.");
}
