# FlatDB

A powerful and lightweight flat database library for JavaScript that stores data in JSON format. Perfect for small to medium-sized projects, prototypes, and applications requiring a simple yet feature-rich database solution.

## Features

- **Tables with Schema Validation**: Define table schemas with field types, required fields, and constraints
- **Indexing**: Create indexes on fields for faster query performance
- **Foreign Key Constraints**: Maintain data integrity with foreign key relationships
- **Bulk Operations**: Efficient batch inserts, updates, and deletes
- **Advanced Querying**: Complex queries with multiple conditions and operators
- **Aggregation Pipeline**: MongoDB-like aggregation operations
- **Asynchronous API**: Full async/await support
- **No External Dependencies**: Pure JavaScript implementation
- **Persistent JSON Storage**: Durable storage with automatic saving
- **Performance Logging**: Built-in performance monitoring and statistics

## Installation

Simply copy the `flatdb.js` file into your project.

## Basic Usage

```javascript
const FlatDB = require('./flatdb');

// Initialize database
const db = await new FlatDB('./data/mydb.json').connect();

// Create a table with schema
const userSchema = {
    name: { type: 'string', required: true },
    email: { type: 'string', required: true },
    age: { type: 'number', min: 0 },
    createdAt: { type: 'date', default: () => new Date() }
};

const users = await db.createTable('users', userSchema);

// Basic CRUD operations
const user = await users.insert({
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
});

const allUsers = await users.find();
const johnDoe = await users.findOne({ name: 'John Doe' });
const updated = await users.update({ name: 'John Doe' }, { age: 31 });
const deleted = await users.delete({ name: 'John Doe' });
```

## Advanced Features

### Schema Validation

```javascript
const productSchema = {
    name: { type: 'string', required: true },
    price: { type: 'number', min: 0, required: true },
    category: { type: 'string', enum: ['electronics', 'books', 'clothing'] },
    inStock: { type: 'boolean', default: true },
    tags: { type: 'array', items: { type: 'string' } }
};

const products = await db.createTable('products', productSchema);
```

### Indexing

```javascript
// Create indexes for faster queries
await products.createIndex('category');
await products.createIndex('price');

// Queries will now use indexes when possible
const electronics = await products.find({ category: 'electronics' });
const expensiveItems = await products.find({ price: { $gt: 1000 } });
```

### Foreign Key Constraints

```javascript
const orderSchema = {
    userId: { 
        type: 'string', 
        required: true,
        references: { table: 'users', field: '_id' }
    },
    productId: {
        type: 'string',
        required: true,
        references: { table: 'products', field: '_id' }
    },
    quantity: { type: 'number', min: 1 },
    status: { type: 'string', enum: ['pending', 'shipped', 'delivered'] }
};

const orders = await db.createTable('orders', orderSchema);
```

### Bulk Operations

```javascript
// Bulk insert
const newProducts = [
    { name: 'Laptop', price: 999.99, category: 'electronics' },
    { name: 'Smartphone', price: 699.99, category: 'electronics' },
    { name: 'Headphones', price: 199.99, category: 'electronics' }
];
await products.insertMany(newProducts);

// Bulk update
await products.update(
    { category: 'electronics' },
    { inStock: false }
);

// Bulk delete
await products.delete({ price: { $lt: 100 } });
```

### Complex Queries

```javascript
// Multiple conditions
const results = await products.find({
    category: 'electronics',
    price: { $gte: 500, $lte: 1000 },
    inStock: true,
    tags: { $contains: 'wireless' }
});

// Regular expressions
const searchResults = await products.find({
    name: { $regex: /phone/i }
});
```

### Aggregation Pipeline

```javascript
const stats = await products.aggregate([
    { $match: { category: 'electronics' } },
    { $group: {
        _id: 'category',
        avgPrice: { $avg: 'price' },
        totalProducts: { $count: true },
        minPrice: { $min: 'price' },
        maxPrice: { $max: 'price' }
    }},
    { $sort: { avgPrice: -1 } },
    { $limit: 10 }
]);
```

### Performance Monitoring

```javascript
// Get database statistics
const stats = await db.getStats();
console.log(stats);
// {
//     recordsPerTable: { users: 1000, products: 500, orders: 2000 },
//     totalRecords: 3500,
//     fileSize: '2.5 MB',
//     indexes: { users: ['email'], products: ['category', 'price'] }
// }

// Monitor query performance
const startTime = Date.now();
const results = await products.find({ category: 'electronics' });
console.log(`Query took ${Date.now() - startTime}ms`);
```

## API Reference

### FlatDB Class
- `constructor(dbPath)`: Creates a new database instance
- `connect()`: Connects to the database file
- `createTable(name, schema)`: Creates a new table with the specified schema
- `getTable(name)`: Gets an existing table
- `dropTable(name)`: Deletes a table
- `getStats()`: Returns database statistics

### Table Class
- `insert(document)`: Inserts a single document
- `insertMany(documents)`: Inserts multiple documents
- `find(query)`: Finds all documents matching the query
- `findOne(query)`: Finds first document matching the query
- `update(query, update)`: Updates documents matching the query
- `updateOne(query, update)`: Updates first document matching the query
- `delete(query)`: Deletes documents matching the query
- `deleteOne(query)`: Deletes first document matching the query
- `aggregate(pipeline)`: Performs aggregation operations
- `count(query)`: Returns count of documents matching the query
- `createIndex(field)`: Creates an index on the specified field

## Performance

Based on performance tests with 25 tables and 10,000 records:

- Table Creation: ~0.12ms
- Bulk Insert (400 records): ~50ms (0.125ms per record)
- Index Creation: ~1.6s for all tables
- Simple Queries: ~4ms
- Complex Queries: ~2.6ms
- Single Updates: ~70ms
- Bulk Updates: ~1.5s
- Aggregations: ~3ms

## Testing

Run the test suite:

```bash
node test/test.js           # Basic functionality tests
node test/large_scale_test.js  # Performance tests
```

## Limitations

- Not suitable for very large datasets (>100,000 records)
- No support for transactions
- Limited query optimization for complex joins
- Single-file storage may become a bottleneck for concurrent access

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License
