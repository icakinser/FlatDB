const { FlatDB, Schema } = require('../src/flatdb');
const fs = require('fs').promises;
const path = require('path');

const DB_PATH = './data/large_scale_test.json';
const LOG_PATH = './data/performance_log.json';

// Configuration for the large scale test
const CONFIG = {
    NUM_TABLES: 50,
    USERS_COUNT: 10000,
    PRODUCTS_COUNT: 15000,
    RECORDS_PER_TABLE: 5000, // This will result in ~250,000 total records
    BATCH_SIZE: 1000
};

// Test logger to save performance metrics
class TestLogger {
    constructor() {
        this.logs = [];
    }

    log(operation, metrics) {
        this.logs.push({
            operation,
            metrics,
            timestamp: new Date().toISOString()
        });
    }

    async save() {
        await fs.writeFile(LOG_PATH, JSON.stringify(this.logs, null, 2));
    }
}

// Utility function to measure execution time
async function measureTime(operation, fn) {
    const startTime = process.hrtime.bigint();
    const result = await fn();
    const endTime = process.hrtime.bigint();
    const timeMs = Number(endTime - startTime) / 1_000_000;
    return { timeMs, result };
}

// Generate random test data
function generateTestData(count, type = 'generic') {
    const data = [];
    for (let i = 0; i < count; i++) {
        if (type === 'user') {
            data.push({
                name: `User ${i}`,
                email: `user${i}@example.com`,
                age: Math.floor(Math.random() * 50) + 18,
                active: Math.random() > 0.2
            });
        } else if (type === 'product') {
            data.push({
                name: `Product ${i}`,
                price: Math.random() * 1000,
                category: ['electronics', 'books', 'clothing'][Math.floor(Math.random() * 3)],
                inStock: Math.random() > 0.3,
                rating: Math.floor(Math.random() * 5) + 1
            });
        } else {
            data.push({
                field1: `Value ${i}`,
                field2: Math.random() * 100,
                field3: Math.random() > 0.5,
                field4: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
                field5: ['tag1', 'tag2', 'tag3'][Math.floor(Math.random() * 3)]
            });
        }
    }
    return data;
}

// Main test function
async function runLargeScaleTest() {
    console.log('Starting Large Scale Performance Test...\n');
    const logger = new TestLogger();

    // Initialize database
    const db = await new FlatDB(DB_PATH).connect();

    // 1. Create tables with schemas
    console.log('1. Table Creation and Schema Setup:');
    const { timeMs: createTableTime } = await measureTime('Creating tables', async () => {
        const userSchema = new Schema({
            name: { type: 'string', required: true },
            email: { type: 'string', required: true },
            age: { type: 'number' },
            active: { type: 'boolean' }
        });

        const productSchema = new Schema({
            name: { type: 'string', required: true },
            price: { type: 'number', required: true },
            category: { type: 'string' },
            inStock: { type: 'boolean' },
            rating: { type: 'number' }
        });

        const genericSchema = new Schema({
            field1: { type: 'string' },
            field2: { type: 'number' },
            field3: { type: 'boolean' },
            field4: { type: 'date' },
            field5: { type: 'string' }
        });

        await db.table('users', userSchema);
        await db.table('products', productSchema);

        for (let i = 0; i < CONFIG.NUM_TABLES - 2; i++) {
            await db.table(`table${i}`, genericSchema);
        }
    });

    console.log(`Creating ${CONFIG.NUM_TABLES} tables: ${createTableTime.toFixed(2)}ms`);
    console.log('Table creation completed');
    logger.log('table_creation', { timeMs: createTableTime });

    // 2. Bulk data insertion
    console.log('\n2. Bulk Data Insertion:');
    
    // Insert users
    const { timeMs: userInsertTime } = await measureTime('Inserting users', async () => {
        const users = generateTestData(CONFIG.USERS_COUNT, 'user');
        for (let i = 0; i < users.length; i += CONFIG.BATCH_SIZE) {
            const batch = users.slice(i, i + CONFIG.BATCH_SIZE);
            await db.table('users').insertMany(batch);
        }
    });

    console.log(`Inserting ${CONFIG.USERS_COUNT} users: ${userInsertTime.toFixed(2)}ms`);
    console.log('User insertion completed');
    logger.log('user_insertion', {
        timeMs: userInsertTime,
        recordCount: CONFIG.USERS_COUNT,
        averageTimePerRecord: userInsertTime / CONFIG.USERS_COUNT
    });

    // Insert products
    const { timeMs: productInsertTime } = await measureTime('Inserting products', async () => {
        const products = generateTestData(CONFIG.PRODUCTS_COUNT, 'product');
        for (let i = 0; i < products.length; i += CONFIG.BATCH_SIZE) {
            const batch = products.slice(i, i + CONFIG.BATCH_SIZE);
            await db.table('products').insertMany(batch);
        }
    });

    console.log(`Inserting ${CONFIG.PRODUCTS_COUNT} products: ${productInsertTime.toFixed(2)}ms`);
    console.log('Product insertion completed');
    logger.log('product_insertion', {
        timeMs: productInsertTime,
        recordCount: CONFIG.PRODUCTS_COUNT,
        averageTimePerRecord: productInsertTime / CONFIG.PRODUCTS_COUNT
    });

    // Insert generic records
    const { timeMs: genericInsertTime } = await measureTime('Inserting generic records', async () => {
        for (let i = 0; i < CONFIG.NUM_TABLES - 2; i++) {
            const records = generateTestData(CONFIG.RECORDS_PER_TABLE);
            for (let j = 0; j < records.length; j += CONFIG.BATCH_SIZE) {
                const batch = records.slice(j, j + CONFIG.BATCH_SIZE);
                await db.table(`table${i}`).insertMany(batch);
            }
        }
    });

    const totalGenericRecords = (CONFIG.NUM_TABLES - 2) * CONFIG.RECORDS_PER_TABLE;
    console.log(`Inserting ${totalGenericRecords} records across ${CONFIG.NUM_TABLES - 2} tables: ${genericInsertTime.toFixed(2)}ms`);
    console.log('Bulk insertion completed');
    logger.log('bulk_insertion', { timeMs: genericInsertTime });

    // 3. Create indexes
    console.log('\n3. Index Creation:');
    const { timeMs: indexTime } = await measureTime('Creating indexes', async () => {
        await db.table('users').createIndex('email');
        await db.table('users').createIndex('age');
        await db.table('products').createIndex('category');
        await db.table('products').createIndex('price');
        
        for (let i = 0; i < CONFIG.NUM_TABLES - 2; i++) {
            await db.table(`table${i}`).createIndex('field2');
            await db.table(`table${i}`).createIndex('field5');
        }
    });

    console.log(`Creating indexes on all tables: ${indexTime.toFixed(2)}ms`);
    console.log('Index creation completed');
    logger.log('index_creation', { timeMs: indexTime });

    // 4. Query Performance
    console.log('\n4. Query Performance:');
    const { timeMs: queryTime, result: queryResults } = await measureTime('Simple queries', async () => {
        const results = [];
        for (const tableName of Object.keys(db.data.tables)) {
            const count = await db.table(tableName).count({ field2: { $gt: 50 } });
            results.push({ table: tableName, count });
        }
        return results;
    });

    console.log(`Simple queries across all tables: ${queryTime.toFixed(2)}ms`);
    console.log('Simple queries completed');
    logger.log('simple_queries', { timeMs: queryTime, resultsPerTable: queryResults });

    // Complex queries
    const { timeMs: complexQueryTime, result: complexResults } = await measureTime('Complex queries', async () => {
        const usersFound = await db.table('users').count({
            age: { $gte: 25, $lte: 35 },
            active: true
        });

        const productsFound = await db.table('products').count({
            price: { $lt: 500 },
            category: 'electronics',
            inStock: true
        });

        return { usersFound, productsFound };
    });

    console.log(`Complex queries with multiple conditions: ${complexQueryTime.toFixed(2)}ms`);
    console.log('Complex queries completed');
    logger.log('complex_queries', { timeMs: complexQueryTime, results: complexResults });

    // 5. Update Operations
    console.log('\n5. Update Operations:');
    const { timeMs: singleUpdateTime } = await measureTime('Single updates', async () => {
        for (const tableName of Object.keys(db.data.tables)) {
            await db.table(tableName).updateOne(
                { field2: { $gt: 90 } },
                { field3: false }
            );
        }
    });

    console.log(`Single record updates across tables: ${singleUpdateTime.toFixed(2)}ms`);
    console.log('Single updates completed');
    logger.log('single_updates', { timeMs: singleUpdateTime });

    const { timeMs: bulkUpdateTime } = await measureTime('Bulk updates', async () => {
        for (const tableName of Object.keys(db.data.tables)) {
            await db.table(tableName).update(
                { field2: { $lt: 10 } },
                { field3: true }
            );
        }
    });

    console.log(`Bulk updates across tables: ${bulkUpdateTime.toFixed(2)}ms`);
    console.log('Bulk updates completed');
    logger.log('bulk_updates', { timeMs: bulkUpdateTime });

    // 6. Aggregation Operations
    console.log('\n6. Aggregation Operations:');
    const { timeMs: aggregateTime, result: aggregateResults } = await measureTime('Complex aggregations', async () => {
        const userGroups = await db.table('users').aggregate([
            { $match: { active: true } },
            { $group: { _id: 'age', count: { $sum: 1 } } }
        ]);

        const topProducts = await db.table('products').aggregate([
            { $match: { price: { $gt: 100 } } },
            { $sort: { rating: -1 } },
            { $limit: 100 }
        ]);

        return {
            userGroups: userGroups.length,
            topProducts: topProducts.length
        };
    });

    console.log(`Complex aggregations: ${aggregateTime.toFixed(2)}ms`);
    console.log('Aggregations completed');
    logger.log('aggregations', { timeMs: aggregateTime, results: aggregateResults });

    // 7. Delete Operations
    console.log('\n7. Delete Operations:');
    const { timeMs: singleDeleteTime } = await measureTime('Single deletes', async () => {
        for (const tableName of Object.keys(db.data.tables)) {
            await db.table(tableName).deleteOne({ field2: { $gt: 95 } });
        }
    });

    console.log(`Single record deletions: ${singleDeleteTime.toFixed(2)}ms`);
    console.log('Single deletes completed');
    logger.log('single_deletes', { timeMs: singleDeleteTime });

    const { timeMs: bulkDeleteTime } = await measureTime('Bulk deletes', async () => {
        for (const tableName of Object.keys(db.data.tables)) {
            await db.table(tableName).delete({ field2: { $lt: 5 } });
        }
    });

    console.log(`Bulk deletions: ${bulkDeleteTime.toFixed(2)}ms`);
    console.log('Bulk deletes completed');
    logger.log('bulk_deletes', { timeMs: bulkDeleteTime });

    // 8. Database Statistics
    console.log('\n8. Database Statistics:');
    const { timeMs: statsTime, result: stats } = await measureTime('Gathering statistics', async () => {
        const recordsPerTable = {};
        let totalRecords = 0;
        
        for (const tableName of Object.keys(db.data.tables)) {
            const count = await db.table(tableName).count();
            recordsPerTable[tableName] = count;
            totalRecords += count;
        }

        const fileStats = await fs.stat(DB_PATH);
        const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);

        return {
            recordsPerTable,
            totalRecords,
            fileSize: fileStats.size,
            fileSizeMB
        };
    });

    console.log(`Gathering statistics: ${statsTime.toFixed(2)}ms`);
    console.log('Statistics gathered');
    logger.log('statistics', { timeMs: statsTime, stats });

    // Save all logs
    await logger.save();
    console.log('\nTest completed. Full results have been saved to ./data/performance_log.json\n');
}

// Run the test
runLargeScaleTest().catch(console.error);
