const { FlatDB, Schema } = require('../src/flatdb');

async function testTables() {
    console.log('Starting Table Tests...\n');
    
    // Initialize database
    const db = await new FlatDB('./data/table_test.json').connect();
    
    // Create schemas
    const userSchema = new Schema({
        username: { type: 'string', required: true, minLength: 3, maxLength: 20 },
        email: { type: 'string', required: true, pattern: '^[^@]+@[^@]+\\.[^@]+$' },
        age: { type: 'number', min: 0, max: 120 },
        role: { type: 'string', enum: ['user', 'admin', 'moderator'] }
    });

    const postSchema = new Schema({
        title: { type: 'string', required: true, minLength: 1, maxLength: 100 },
        content: { type: 'string', required: true },
        authorId: { type: 'string', required: true },
        tags: { type: 'object' } // Array is considered object in typeof
    });

    // Create tables
    const users = db.table('users', userSchema);
    const posts = db.table('posts', postSchema);

    console.log('1. Testing Schema Validation:');
    
    try {
        console.log('\nTrying to insert invalid user...');
        await users.insert({
            username: 'jo', // too short
            email: 'invalid-email', // invalid email
            age: 150, // too high
            role: 'superuser' // not in enum
        });
    } catch (error) {
        console.log('Validation errors (expected):', error.message);
    }

    console.log('\nInserting valid user...');
    const user = await users.insert({
        username: 'john_doe',
        email: 'john@example.com',
        age: 30,
        role: 'user'
    });
    console.log('Inserted user:', user);

    // Create an index on username
    console.log('\n2. Testing Indexes:');
    await users.createIndex('username');
    console.log('Created index on username');

    // Test indexed query
    console.log('\nQuerying by indexed field...');
    const foundUser = await users.findOne({ username: 'john_doe' });
    console.log('Found user by index:', foundUser);

    // Test foreign key relationship
    console.log('\n3. Testing Foreign Keys:');
    
    // Add foreign key constraint
    await posts.addForeignKey('authorId', 'users', '_id');
    console.log('Added foreign key constraint');

    // Insert post with valid foreign key
    console.log('\nInserting post with valid author...');
    const post = await posts.insert({
        title: 'My First Post',
        content: 'Hello, World!',
        authorId: user._id,
        tags: ['intro', 'hello']
    });
    console.log('Inserted post:', post);

    try {
        console.log('\nTrying to insert post with invalid author...');
        await posts.insert({
            title: 'Invalid Post',
            content: 'This should fail',
            authorId: 'non-existent-id',
            tags: ['test']
        });
    } catch (error) {
        console.log('Foreign key error (expected):', error.message);
    }

    // Test schema update validation
    console.log('\n4. Testing Update Validation:');
    try {
        console.log('\nTrying to update user with invalid data...');
        await users.update(
            { username: 'john_doe' },
            { age: -1 } // invalid age
        );
    } catch (error) {
        console.log('Update validation error (expected):', error.message);
    }

    // Clean up
    console.log('\n5. Cleanup:');
    const deletedPosts = await posts.delete({ authorId: user._id });
    const deletedUsers = await users.delete({ username: 'john_doe' });
    console.log(`Deleted ${deletedPosts} posts and ${deletedUsers} users`);
}

// Run the tests
testTables().catch(console.error);
