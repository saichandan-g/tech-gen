// lib/rds.ts (or similar)
import { Pool } from 'pg';
import fs from 'fs'; // Import fs for reading CA certificate if needed

// Environment variables required:
// DB_HOST=your-rds-endpoint.amazonaws.com
// DB_PORT=5432
// DB_USER=your-db-username
// DB_PASSWORD=your-db-password
// DB_NAME=your-db-name

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false, // Adjust for production with a CA certificate
    // For production, you should provide a CA certificate:
    // ca: fs.readFileSync('/path/to/your/rds-ca-bundle.pem').toString(),
  },
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Consider more robust error handling than exiting the process in a production environment
});

/**
 * Executes a SQL query against the database.
 * @param text The SQL query string.
 * @param params Optional array of parameters for the query.
 * @returns An object containing `rows` (array of results) and `error` (if any).
 */
export const query = async (text: string, params?: any[]) => {
  try {
    const result = await pool.query(text, params);
    return { rows: result.rows, error: null };
  } catch (error: any) {
    console.error('Database query error:', error);
    return { rows: [], error: { message: error.message, code: error.code } };
  }
};

/**
 * Provides a client from the connection pool for transactions.
 * Remember to release the client after use: `client.release()`.\n * @returns A Promise that resolves to a pg.PoolClient.
 */
export const getClient = () => pool.connect();

/**
 * Resets the sequence for the 'technical_questions' table to the maximum existing ID.
 * This should be run if you encounter 'duplicate key value violates unique constraint' errors.
 */
export const resetTechnicalQuestionsSequence = async () => {
  try {
    // Get the maximum ID from the technical_questions table
    const maxIdResult = await pool.query('SELECT MAX(id) FROM technical_questions');
    const maxId = maxIdResult.rows[0].max || 0; // Default to 0 if table is empty

    // Dynamically get the sequence name for the 'id' column of 'technical_questions' table
    const sequenceNameResult = await pool.query(
      `SELECT pg_get_serial_sequence('technical_questions', 'id') AS sequence_name;`
    );
    const sequenceName = sequenceNameResult.rows[0].sequence_name;

    if (!sequenceName) {
      throw new Error('Could not determine sequence name for technical_questions.id');
    }

    // Set the sequence to the maxId, with 'true' to make the NEXT value maxId + 1
    await pool.query(`SELECT setval('${sequenceName}', ${maxId}, true)`);
    console.log(`${sequenceName} reset to ${maxId + 1} (next value)`);
    return { success: true, message: `Sequence reset to ${maxId + 1} (next value)` };
  } catch (error: any) {
    console.error('Error resetting technical_questions sequence:', error);
    return { success: false, error: { message: error.message, code: error.code } };
  }
};
