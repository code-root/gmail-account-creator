#!/usr/bin/env node
/**
 * CLI entry when installed via npm (global or npx).
 * Direct use: npm start / node src/index.js
 */
import app from '../src/index.js';

app.main().catch((error) => {
    console.error(error);
    process.exit(1);
});
