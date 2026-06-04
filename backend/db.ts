import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the .env file in the root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: DATABASE_URL is not set in environment variables or .env file!');
  process.exit(1);
}

export const pool = new pg.Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Neon serverless database connection
  }
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};
