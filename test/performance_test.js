const FlatDB = require('../src/flatdb');

// Utility function to measure execution time
async function measureTime(name, fn) {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const timeMs = Number(end - start) / 1_000_000; // Convert to milliseconds
    console.log(`${name}: ${timeMs.toFixed(2)}ms`);
    return result;
}

// Generate test data
function generateUsers(count) {
    return Array.from({ length: count }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: 20 + (i % 50), // ages from 20 to 69
        isActive: i % 2 === 0,
        tags: [`tag${i % 5}`, `tag${i % 3}`],
        score: Math.floor(Math.random() * 100)
    }));
}

async function runPerformanceTests() {
    console.log('Starting Performance Tests...\n');
    
    // Initialize database
    const db = await new FlatDB('./data/performance_test.json').connect();
    const users = db.collection('users');
    
    // Test data
    const sampleUsers = generateUsers(1000);
    
    // Test Suite
    console.log('1. Write Operations:');
    
    // Single Insert
    await measureTime('Single Insert', async () => {
        return await users.insert(sampleUsers[0]);
    });
    
    // Bulk Insert
    await measureTime('Bulk Insert (1000 documents)', async () => {
        return await users.insertMany(sampleUsers);
    });
    
    // Single Update
    await measureTime('Single Update', async () => {
        return await users.updateOne(
            { name: 'User 0' },
            { score: 100 }
        );
    });
    
    // Bulk Update
    await measureTime('Bulk Update (age > 50)', async () => {
        return await users.update(
            { age: { $gt: 50 } },
            { isActive: false }
        );
    });
    
    console.log('\n2. Read Operations:');
    
    // Simple Find
    await measureTime('Simple Find (exact match)', async () => {
        return await users.find({ age: 25 });
    });
    
    // Complex Query
    await measureTime('Complex Query (multiple conditions)', async () => {
        return await users.find({
            age: { $gt: 30, $lt: 40 },
            isActive: true,
            tags: { $in: ['tag1'] }
        });
    });
    
    // Count
    await measureTime('Count Documents', async () => {
        return await users.count({ age: { $gt: 30 } });
    });
    
    // Distinct
    await measureTime('Distinct Values', async () => {
        return await users.distinct('tags');
    });
    
    console.log('\n3. Aggregation Operations:');
    
    // Simple Aggregation
    await measureTime('Simple Aggregation (match + sort)', async () => {
        return await users.aggregate([
            { $match: { age: { $gt: 30 } } },
            { $sort: { score: -1 } }
        ]);
    });
    
    // Complex Aggregation
    await measureTime('Complex Aggregation (match + sort + group)', async () => {
        return await users.aggregate([
            { $match: { isActive: true } },
            { $sort: { age: 1 } },
            { $group: { _id: 'age' } }
        ]);
    });
    
    console.log('\n4. Delete Operations:');
    
    // Single Delete
    await measureTime('Single Delete', async () => {
        return await users.deleteOne({ name: 'User 1' });
    });
    
    // Bulk Delete
    await measureTime('Bulk Delete (score < 50)', async () => {
        return await users.delete({ score: { $lt: 50 } });
    });
    
    console.log('\n5. Special Operations:');
    
    // Find by ID
    const firstUser = await users.findOne({});
    await measureTime('Find by ID', async () => {
        return await users.findById(firstUser._id);
    });
    
    // Update by ID
    await measureTime('Update by ID', async () => {
        return await users.updateById(firstUser._id, { score: 1000 });
    });
    
    // Regular Expression Query
    await measureTime('Regex Query', async () => {
        return await users.find({
            email: { $regex: '^user[0-9]@' }
        });
    });
    
    console.log('\n6. File Operations:');
    
    // Save to Disk
    await measureTime('Save to Disk', async () => {
        return await db.save();
    });
    
    // Load from Disk
    await measureTime('Load from Disk', async () => {
        return await new FlatDB('./data/performance_test.json').connect();
    });
    
    // Final Statistics
    const finalCount = await users.count();
    console.log(`\nFinal collection size: ${finalCount} documents`);
}

// Run the tests
runPerformanceTests().catch(console.error);
