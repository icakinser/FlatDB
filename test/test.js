const FlatDB = require('../src/flatdb');

async function test() {
    // Initialize database
    const db = await new FlatDB('./data/test.json').connect();
    const users = db.collection('users');
    
    // Bulk Insert
    console.log('Inserting multiple users...');
    const newUsers = await users.insertMany([
        { name: 'John Doe', email: 'john@example.com', age: 30 },
        { name: 'Jane Smith', email: 'jane@example.com', age: 25 },
        { name: 'Bob Wilson', email: 'bob@example.com', age: 35 }
    ]);
    console.log('Inserted users:', newUsers);
    
    // Advanced Query
    console.log('\nFinding users with age > 25...');
    const olderUsers = await users.find({ age: { $gt: 25 } });
    console.log('Older users:', olderUsers);
    
    // Distinct Values
    console.log('\nGetting distinct ages...');
    const distinctAges = await users.distinct('age');
    console.log('Distinct ages:', distinctAges);
    
    // Count
    console.log('\nCounting users over 30...');
    const count = await users.count({ age: { $gte: 30 } });
    console.log('Count:', count);
    
    // Aggregation
    console.log('\nAggregating users by age...');
    const ageGroups = await users.aggregate([
        { $match: { age: { $gt: 20 } } },
        { $sort: { age: 1 } },
        { $group: { _id: 'age' } }
    ]);
    console.log('Age groups:', ageGroups);
    
    // Update by ID
    const firstUser = newUsers[0];
    console.log('\nUpdating user by ID...');
    const updatedUser = await users.updateById(firstUser._id, { age: 31 });
    console.log('Updated user:', updatedUser);
    
    // Delete One
    console.log('\nDeleting one user...');
    const deleteCount = await users.deleteOne({ name: 'Jane Smith' });
    console.log('Deleted count:', deleteCount);
    
    // Final count
    const finalCount = await users.count();
    console.log('\nFinal user count:', finalCount);
}

test().catch(console.error);
