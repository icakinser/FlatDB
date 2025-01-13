const { FlatDB, Schema } = require('../src/flatdb');
const fs = require('fs').promises;
const path = require('path');
const assert = require('assert');

describe('Binary Storage Tests', () => {
    const dbPath = path.join(__dirname, 'test_binary.json');
    let db;

    beforeEach(async () => {
        // Clean up previous test files
        try {
            await fs.unlink(dbPath);
            await fs.rm(path.join(__dirname, 'images_binary'), { recursive: true, force: true });
        } catch (err) {
            // Ignore if files don't exist
        }
        db = new FlatDB(dbPath);
        await db.connect();
    });

    afterEach(async () => {
        // Clean up test files
        try {
            await fs.unlink(dbPath);
            await fs.rm(path.join(__dirname, 'images_binary'), { recursive: true, force: true });
        } catch (err) {
            // Ignore if files don't exist
        }
    });

    it('should store and retrieve binary data', async () => {
        // Create a schema with binary field
        const schema = new Schema({
            name: { type: 'string', required: true },
            data: { type: 'binary', maxSize: 1024 * 1024 } // 1MB max
        });

        const table = await db.table('images', schema);

        // Create test binary data
        const testData = Buffer.from('Hello, Binary World!');

        // Insert record with binary data
        const inserted = await table.insert({
            name: 'test.txt',
            data: testData
        });

        // Verify the record was inserted
        assert.ok(inserted._id);
        assert.strictEqual(inserted.name, 'test.txt');
        assert.ok(inserted.data.startsWith('binary:'));

        // Retrieve and verify the record
        const retrieved = await table.findById(inserted._id);
        assert.strictEqual(retrieved.name, 'test.txt');
        assert.ok(Buffer.isBuffer(retrieved.data));
        assert.strictEqual(retrieved.data.toString(), 'Hello, Binary World!');
    });

    it('should handle large binary files', async () => {
        const schema = new Schema({
            name: { type: 'string', required: true },
            data: { type: 'binary', maxSize: 5 * 1024 * 1024 } // 5MB max
        });

        const table = await db.table('images', schema);

        // Create a large binary buffer (1MB)
        const largeData = Buffer.alloc(1024 * 1024, 'x');

        // Insert large binary data
        const inserted = await table.insert({
            name: 'large.bin',
            data: largeData
        });

        // Retrieve and verify
        const retrieved = await table.findById(inserted._id);
        assert.strictEqual(retrieved.data.length, largeData.length);
        assert.strictEqual(retrieved.data.toString(), largeData.toString());
    });

    it('should enforce maxSize constraint', async () => {
        const schema = new Schema({
            name: { type: 'string', required: true },
            data: { type: 'binary', maxSize: 100 } // Only 100 bytes
        });

        const table = await db.table('images', schema);

        // Create data larger than maxSize
        const largeData = Buffer.alloc(200, 'x');

        // Attempt to insert should fail
        try {
            await table.insert({
                name: 'toobig.bin',
                data: largeData
            });
            assert.fail('Should have thrown an error');
        } catch (err) {
            assert.ok(err.message.includes('exceeds maximum size'));
        }
    });

    it('should deduplicate identical binary data', async () => {
        const schema = new Schema({
            name: { type: 'string', required: true },
            data: { type: 'binary' }
        });

        const table = await db.table('images', schema);
        const testData = Buffer.from('Duplicate content');

        // Insert same data twice
        const first = await table.insert({
            name: 'first.txt',
            data: testData
        });

        const second = await table.insert({
            name: 'second.txt',
            data: testData
        });

        // Verify both records have same binary hash
        assert.strictEqual(
            first.data.split(':')[1],
            second.data.split(':')[1]
        );

        // Verify both can be retrieved correctly
        const firstRetrieved = await table.findById(first._id);
        const secondRetrieved = await table.findById(second._id);

        assert.strictEqual(firstRetrieved.data.toString(), 'Duplicate content');
        assert.strictEqual(secondRetrieved.data.toString(), 'Duplicate content');
    });

    it('should respect global binary size limit', async () => {
        // Create database with 100 byte limit
        db = new FlatDB(dbPath, { maxBinarySize: 100 });
        await db.connect();

        const schema = new Schema({
            name: { type: 'string', required: true },
            data: { type: 'binary' } // No specific size limit, will use global limit
        });

        const table = await db.table('images', schema);

        // Try to insert data larger than global limit
        const largeData = Buffer.alloc(150, 'x');

        try {
            await table.insert({
                name: 'toobig.bin',
                data: largeData
            });
            assert.fail('Should have thrown an error');
        } catch (err) {
            assert.ok(err.message.includes('exceeds maximum size'));
        }

        // Insert data within global limit
        const smallData = Buffer.alloc(50, 'x');
        const inserted = await table.insert({
            name: 'small.bin',
            data: smallData
        });

        const retrieved = await table.findById(inserted._id);
        assert.strictEqual(retrieved.data.length, 50);
    });

    it('should allow field-specific limits to override global limit', async () => {
        // Create database with 100 byte global limit
        db = new FlatDB(dbPath, { maxBinarySize: 100 });
        await db.connect();

        const schema = new Schema({
            name: { type: 'string', required: true },
            data: { type: 'binary', maxSize: 200 } // Override global limit
        });

        const table = await db.table('images', schema);

        // Insert data larger than global limit but within field limit
        const mediumData = Buffer.alloc(150, 'x');
        const inserted = await table.insert({
            name: 'medium.bin',
            data: mediumData
        });

        const retrieved = await table.findById(inserted._id);
        assert.strictEqual(retrieved.data.length, 150);
    });

    it('should search binary data by metadata', async () => {
        db = new FlatDB(dbPath);
        await db.connect();

        const schema = new Schema({
            name: { type: 'string', required: true },
            data: { type: 'binary' }
        });

        const table = await db.table('images', schema);

        // Insert test records
        const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
        const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47]);

        await table.insert({
            name: 'test1.jpg',
            data: Buffer.concat([jpegHeader, Buffer.from('JPEG content')])
        });

        await table.insert({
            name: 'test2.png',
            data: Buffer.concat([pngHeader, Buffer.from('PNG content')])
        });

        // Search by MIME type
        const jpegResults = await table.searchBinary({ mimeType: 'image/jpeg' });
        assert.strictEqual(jpegResults.length, 1);
        assert.strictEqual(jpegResults[0].name, 'test1.jpg');

        // Search by size range
        const sizeResults = await table.searchBinary({ 
            minSize: 10,
            maxSize: 20
        });
        assert.strictEqual(sizeResults.length, 2);
    });

    it('should search binary data by content pattern', async () => {
        db = new FlatDB(dbPath);
        await db.connect();

        const schema = new Schema({
            name: { type: 'string', required: true },
            data: { type: 'binary' }
        });

        const table = await db.table('images', schema);

        // Insert test records
        await table.insert({
            name: 'doc1.txt',
            data: Buffer.from('Hello, World!')
        });

        await table.insert({
            name: 'doc2.txt',
            data: Buffer.from('Goodbye, World!')
        });

        // Search by text pattern
        const results = await table.searchBinary({ 
            pattern: 'World'
        });
        assert.strictEqual(results.length, 2);

        // Search by binary pattern
        const helloResults = await table.searchBinary({ 
            pattern: Buffer.from('Hello')
        });
        assert.strictEqual(helloResults.length, 1);
        assert.strictEqual(helloResults[0].name, 'doc1.txt');
    });

    it('should find similar binary files', async () => {
        db = new FlatDB(dbPath);
        await db.connect();

        const schema = new Schema({
            name: { type: 'string', required: true },
            data: { type: 'binary' }
        });

        const table = await db.table('images', schema);

        const baseContent = Buffer.from('Base content');
        const similarContent = Buffer.from('Base content!');
        const differentContent = Buffer.from('Different content');

        await table.insert({
            name: 'base.txt',
            data: baseContent
        });

        await table.insert({
            name: 'similar.txt',
            data: similarContent
        });

        await table.insert({
            name: 'different.txt',
            data: differentContent
        });

        // Find similar files with size tolerance
        const results = await table.findSimilarBinary('data', baseContent, {
            sizeTolerance: 1
        });

        assert.strictEqual(results.length, 2); // Should find base.txt and similar.txt
        assert.ok(results.some(r => r.name === 'base.txt'));
        assert.ok(results.some(r => r.name === 'similar.txt'));
    });
});
