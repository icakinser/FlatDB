const fs = require('fs').promises;
const path = require('path');

class Schema {
    constructor(definition) {
        this.definition = definition;
    }

    validate(data) {
        const errors = [];
        Object.entries(this.definition).forEach(([field, rules]) => {
            // Required field check
            if (rules.required && (data[field] === undefined || data[field] === null)) {
                errors.push(`Field '${field}' is required`);
                return;
            }

            // Skip validation if field is not present and not required
            if (data[field] === undefined || data[field] === null) {
                return;
            }

            // Type check
            if (rules.type && typeof data[field] !== rules.type) {
                errors.push(`Field '${field}' must be of type ${rules.type}`);
            }

            // Min/Max for numbers
            if (rules.type === 'number') {
                if (rules.min !== undefined && data[field] < rules.min) {
                    errors.push(`Field '${field}' must be >= ${rules.min}`);
                }
                if (rules.max !== undefined && data[field] > rules.max) {
                    errors.push(`Field '${field}' must be <= ${rules.max}`);
                }
            }

            // Min/Max length for strings
            if (rules.type === 'string') {
                if (rules.minLength !== undefined && data[field].length < rules.minLength) {
                    errors.push(`Field '${field}' must have length >= ${rules.minLength}`);
                }
                if (rules.maxLength !== undefined && data[field].length > rules.maxLength) {
                    errors.push(`Field '${field}' must have length <= ${rules.maxLength}`);
                }
            }

            // Pattern match for strings
            if (rules.type === 'string' && rules.pattern) {
                const regex = new RegExp(rules.pattern);
                if (!regex.test(data[field])) {
                    errors.push(`Field '${field}' must match pattern ${rules.pattern}`);
                }
            }

            // Enum check
            if (rules.enum && !rules.enum.includes(data[field])) {
                errors.push(`Field '${field}' must be one of: ${rules.enum.join(', ')}`);
            }
        });

        return errors;
    }
}

class Table {
    constructor(name, db, schema = null) {
        this.name = name;
        this.db = db;
        this.schema = schema instanceof Schema ? schema : null;
        this._ensureTableExists();
    }

    _ensureTableExists() {
        if (!this.db.data.tables) {
            this.db.data.tables = {};
        }
        if (!this.db.data.tables[this.name]) {
            this.db.data.tables[this.name] = {
                records: [],
                indexes: {},
                foreignKeys: {}
            };
        }
    }

    _validateData(data) {
        if (!this.schema) return [];
        return this.schema.validate(data);
    }

    async createIndex(field) {
        const table = this.db.data.tables[this.name];
        table.indexes[field] = {};
        table.records.forEach((record, idx) => {
            const value = record[field];
            if (!table.indexes[field][value]) {
                table.indexes[field][value] = [];
            }
            table.indexes[field][value].push(idx);
        });
        await this.db.save();
    }

    async addForeignKey(field, referenceTable, referenceField = '_id') {
        const table = this.db.data.tables[this.name];
        table.foreignKeys[field] = { table: referenceTable, field: referenceField };
        await this.db.save();
    }

    async insert(data) {
        const errors = this._validateData(data);
        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }

        // Check foreign key constraints
        const table = this.db.data.tables[this.name];
        for (const [field, reference] of Object.entries(table.foreignKeys)) {
            if (data[field]) {
                const refTable = this.db.table(reference.table);
                const exists = await refTable.findOne({ [reference.field]: data[field] });
                if (!exists) {
                    throw new Error(`Foreign key constraint failed: ${field} references ${reference.table}.${reference.field}`);
                }
            }
        }

        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const record = { _id: id, ...data, createdAt: new Date().toISOString() };
        
        table.records.push(record);
        
        // Update indexes
        Object.keys(table.indexes).forEach(field => {
            const value = record[field];
            if (!table.indexes[field][value]) {
                table.indexes[field][value] = [];
            }
            table.indexes[field][value].push(table.records.length - 1);
        });

        await this.db.save();
        return record;
    }

    async insertMany(documents) {
        const table = this.db.data.tables[this.name];
        const records = [];

        // Validate all documents first
        for (const data of documents) {
            const errors = this._validateData(data);
            if (errors.length > 0) {
                throw new Error(`Validation failed for document: ${errors.join(', ')}`);
            }
        }

        // Check all foreign key constraints
        for (const data of documents) {
            for (const [field, reference] of Object.entries(table.foreignKeys)) {
                if (data[field]) {
                    const refTable = this.db.table(reference.table);
                    const exists = await refTable.findOne({ [reference.field]: data[field] });
                    if (!exists) {
                        throw new Error(`Foreign key constraint failed: ${field} references ${reference.table}.${reference.field}`);
                    }
                }
            }
        }

        // Insert all documents
        for (const data of documents) {
            const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
            const record = { _id: id, ...data, createdAt: new Date().toISOString() };
            table.records.push(record);
            records.push(record);

            // Update indexes
            Object.keys(table.indexes).forEach(field => {
                const value = record[field];
                if (!table.indexes[field][value]) {
                    table.indexes[field][value] = [];
                }
                table.indexes[field][value].push(table.records.length - 1);
            });
        }

        await this.db.save();
        return records;
    }

    async find(query = {}) {
        const table = this.db.data.tables[this.name];
        
        // Check if we can use an index
        const indexedField = Object.keys(query).find(field => table.indexes[field]);
        if (indexedField && typeof query[indexedField] !== 'object') {
            const indexes = table.indexes[indexedField][query[indexedField]] || [];
            const records = indexes.map(idx => table.records[idx]);
            return records.filter(record => this._matchesQuery(record, query));
        }

        return table.records.filter(record => this._matchesQuery(record, query));
    }

    async findOne(query = {}) {
        const results = await this.find(query);
        return results[0] || null;
    }

    async update(query, update) {
        const table = this.db.data.tables[this.name];
        const records = await this.find(query);
        
        records.forEach(record => {
            const updatedData = { ...record, ...update, updatedAt: new Date().toISOString() };
            const errors = this._validateData(updatedData);
            if (errors.length > 0) {
                throw new Error(`Validation failed: ${errors.join(', ')}`);
            }
            
            Object.assign(record, update, {
                updatedAt: new Date().toISOString()
            });
        });

        await this.db.save();
        return records;
    }

    async updateOne(query, update) {
        const table = this.db.data.tables[this.name];
        const record = await this.findOne(query);
        
        if (record) {
            const updatedData = { ...record, ...update, updatedAt: new Date().toISOString() };
            const errors = this._validateData(updatedData);
            if (errors.length > 0) {
                throw new Error(`Validation failed: ${errors.join(', ')}`);
            }
            
            Object.assign(record, update, {
                updatedAt: new Date().toISOString()
            });
            
            await this.db.save();
        }
        
        return record;
    }

    async delete(query) {
        const table = this.db.data.tables[this.name];
        const initialLength = table.records.length;
        table.records = table.records.filter(record => !this._matchesQuery(record, query));
        
        // Rebuild indexes
        Object.keys(table.indexes).forEach(field => {
            table.indexes[field] = {};
            table.records.forEach((record, idx) => {
                const value = record[field];
                if (!table.indexes[field][value]) {
                    table.indexes[field][value] = [];
                }
                table.indexes[field][value].push(idx);
            });
        });

        await this.db.save();
        return initialLength - table.records.length;
    }

    async deleteOne(query) {
        const record = await this.findOne(query);
        if (record) {
            await this.delete({ _id: record._id });
            return 1;
        }
        return 0;
    }

    async count(query = {}) {
        const table = this.db.data.tables[this.name];
        if (Object.keys(query).length === 0) {
            return table.records.length;
        }
        const records = await this.find(query);
        return records.length;
    }

    async aggregate(pipeline) {
        const table = this.db.data.tables[this.name];
        let result = [...table.records];

        for (const stage of pipeline) {
            if (stage.$match) {
                result = result.filter(doc => this._matchesQuery(doc, stage.$match));
            }
            if (stage.$sort) {
                const sortField = Object.keys(stage.$sort)[0];
                const sortOrder = stage.$sort[sortField];
                result.sort((a, b) => {
                    if (a[sortField] < b[sortField]) return -1 * sortOrder;
                    if (a[sortField] > b[sortField]) return 1 * sortOrder;
                    return 0;
                });
            }
            if (stage.$limit) {
                result = result.slice(0, stage.$limit);
            }
            if (stage.$skip) {
                result = result.slice(stage.$skip);
            }
            if (stage.$group) {
                const groups = {};
                const id = stage.$group._id;
                result.forEach(doc => {
                    const groupKey = typeof id === 'function' ? id(doc) : doc[id];
                    if (!groups[groupKey]) {
                        groups[groupKey] = {
                            _id: groupKey,
                            count: 0,
                            docs: []
                        };
                    }
                    groups[groupKey].count++;
                    groups[groupKey].docs.push(doc);
                });
                result = Object.values(groups);
            }
        }
        return result;
    }

    _matchesQuery(record, query) {
        return Object.entries(query).every(([key, value]) => {
            if (value && typeof value === 'object') {
                return Object.entries(value).every(([op, val]) => {
                    switch (op) {
                        case '$gt': return record[key] > val;
                        case '$gte': return record[key] >= val;
                        case '$lt': return record[key] < val;
                        case '$lte': return record[key] <= val;
                        case '$ne': return record[key] !== val;
                        case '$in': return Array.isArray(val) && val.includes(record[key]);
                        case '$nin': return Array.isArray(val) && !val.includes(record[key]);
                        case '$exists': return (key in record) === val;
                        case '$regex': return new RegExp(val).test(record[key]);
                        default: return false;
                    }
                });
            }
            return record[key] === value;
        });
    }
}

class FlatDB {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.data = null;
    }

    async connect() {
        try {
            await fs.access(this.dbPath);
            const content = await fs.readFile(this.dbPath, 'utf-8');
            this.data = JSON.parse(content);
        } catch (error) {
            this.data = { tables: {} };
            await this.save();
        }
        return this;
    }

    async save() {
        const dir = path.dirname(this.dbPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(this.dbPath, JSON.stringify(this.data, null, 2));
    }

    table(name, schema = null) {
        return new Table(name, this, schema);
    }
}

module.exports = { FlatDB, Schema };
