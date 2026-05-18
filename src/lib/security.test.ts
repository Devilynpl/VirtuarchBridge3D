import { expect, test, describe } from 'vitest';
import { scanFile, scanFolder } from './security';

describe('Antivirus Scanner', () => {
    test('should allow safe files', async () => {
        const result = await scanFile('test.jpg');
        expect(result.safe).toBe(true);
    });

    test('should block forbidden extensions', async () => {
        const result = await scanFile('malware.exe');
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('Forbidden extension');
    });

    test('should detect suspicious script content', async () => {
        const content = Buffer.from('<script>alert("hacked")</script>');
        const result = await scanFile('data.xml', content);
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('Suspicious script content');
    });

    test('should aggregate results in scanFolder', async () => {
        const files = [
            { name: 'image.png' },
            { name: 'script.js' } // js is forbidden
        ];
        const result = await scanFolder(files);
        expect(result.safe).toBe(false);
        expect(result.threats.length).toBe(1);
    });
});
