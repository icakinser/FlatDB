# FlatDB

A powerful and lightweight flat database library for JavaScript that stores data in JSON format with advanced binary storage capabilities. Perfect for small to medium-sized projects, prototypes, and applications requiring a simple yet feature-rich database solution.

## Features

- **Tables with Schema Validation**: Define table schemas with field types, required fields, and constraints
- **Advanced Binary Storage**: Store, search, and manage binary data with powerful querying capabilities
- **Indexing**: Create indexes on fields for faster query performance
- **Foreign Key Constraints**: Maintain data integrity with foreign key relationships
- **Bulk Operations**: Efficient batch inserts, updates, and deletes
- **Advanced Querying**: Complex queries with multiple conditions and operators
- **Aggregation Pipeline**: MongoDB-like aggregation operations
- **Asynchronous API**: Full async/await support
- **No External Dependencies**: Pure JavaScript implementation
- **Persistent Storage**: Durable storage with automatic saving
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

### Binary Data Storage

FlatDB provides a comprehensive binary data storage system with advanced search and management capabilities.

### Configuration

When creating a new database instance, you can configure global binary storage options:

```javascript
const db = new FlatDB('mydb.json', {
  maxBinarySize: 5 * 1024 * 1024 // 5MB global limit for binary fields
});
```

Available options:
- `maxBinarySize`: Maximum size in bytes for binary fields (default: 10MB)

### Basic Usage

```javascript
// Define a schema with binary fields
const schema = new Schema({
  name: { type: 'string', required: true },
  thumbnail: { type: 'binary' },                    // Uses global size limit
  image: { type: 'binary', maxSize: 10 * 1024 * 1024 } // Field-specific limit
});

// Create a table
const images = await db.table('images', schema);

// Store binary data
const imageBuffer = await fs.readFile('image.jpg');
await images.insert({
  name: 'profile.jpg',
  image: imageBuffer
});

// Retrieve binary data
const record = await images.findById(1);
await fs.writeFile('retrieved.jpg', record.image);
```

### Binary Search Features

FlatDB offers multiple ways to search and find binary data:

#### 1. Metadata Search

```javascript
// Search by MIME type
const jpegImages = await table.searchBinary({
  mimeType: 'image/jpeg'
});

// Search by size range
const mediumImages = await table.searchBinary({
  minSize: 100 * 1024,    // Min 100KB
  maxSize: 1024 * 1024    // Max 1MB
});

// Combine multiple criteria
const largeJpegs = await table.searchBinary({
  mimeType: 'image/jpeg',
  minSize: 1024 * 1024    // Min 1MB
});
```

#### 2. Content Search

```javascript
// Search text content
const documents = await table.searchBinary({
  pattern: 'confidential'  // Find files containing this text
});

// Search binary patterns
const pngImages = await table.searchBinary({
  pattern: Buffer.from([0x89, 0x50, 0x4E, 0x47])  // PNG header
});

// Search with size constraints
const smallTextFiles = await table.searchBinary({
  pattern: 'Hello',
  maxSize: 1024  // Max 1KB
});
```

#### 3. Similarity Search

```javascript
// Find similar images
const sourceImage = await fs.readFile('source.jpg');
const similar = await table.findSimilarBinary('image', sourceImage, {
  sizeTolerance: 1024  // Allow 1KB difference
});

// Find exact duplicates
const duplicates = await table.findSimilarBinary('document', sourceBuffer, {
  sizeTolerance: 0  // Exact size match
});
```

### Advanced Features

#### Automatic MIME Type Detection

FlatDB automatically detects and stores MIME types for common file formats:
- JPEG images (`image/jpeg`)
- PNG images (`image/png`)
- GIF images (`image/gif`)
- PDF documents (`application/pdf`)
- Other binary data (`application/octet-stream`)

```javascript
// Get files by MIME type
const images = await table.searchBinary({
  mimeType: 'image/jpeg'
});

console.log(`Found ${images.length} JPEG images`);
```

#### Deduplication

Binary data is automatically deduplicated using content hashing:

```javascript
// Store the same image twice
await images.insert({ name: 'photo1.jpg', image: imageBuffer });
await images.insert({ name: 'photo2.jpg', image: imageBuffer });

// Only one copy is stored on disk, saving space
```

#### Binary Data Management

```javascript
// Get binary metadata
const record = await images.findById(1);
const metadata = record.image_metadata;
console.log(`Size: ${metadata.size} bytes`);
console.log(`Type: ${metadata.mimeType}`);
console.log(`Hash: ${metadata.hash}`);

// Clean up unused binary data
await db.cleanupBinaryStorage();  // Removes orphaned binary files
```

### Best Practices

1. **Size Limits**:
   - Set appropriate global size limits when creating the database
   - Override limits for specific fields when needed
   - Consider your application's memory constraints

2. **Search Optimization**:
   - Use metadata search when possible (faster than content search)
   - Combine search criteria to narrow results
   - Use appropriate size tolerances for similarity search

3. **Error Handling**:
   - Always handle potential errors when dealing with binary data
   - Check file sizes before insertion
   - Verify MIME types if format is important

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

## Limitations

- Not suitable for very large datasets (>100,000 records)
- No support for transactions
- Limited query optimization for complex joins
- Single-file storage may become a bottleneck for concurrent access

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License
