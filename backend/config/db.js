import mongoose from 'mongoose';

const REDACTED_URI_REGEX = /mongodb(\+srv)?:\/\/\S+/gi;

function sanitizeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  return message.replace(REDACTED_URI_REGEX, '[REDACTED_URI]');
}

/**
 * Establish the Mongoose connection to MongoDB Atlas using process.env.MONGODB_URI or process.env.MONGO_URI.
 * Throws a clear configuration error if neither is configured.
 */
export async function connectDB() {
  const mongoUri = (process.env.MONGODB_URI || process.env.MONGO_URI)?.trim();

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured. Set MONGODB_URI in backend/.env.');
  }

  try {
    const connection = await mongoose.connect(mongoUri);
    console.log('MongoDB: Connected');
    return connection;
  } catch (error) {
    console.error(`MongoDB connection error: ${sanitizeErrorMessage(error)}`);
    throw new Error('Failed to connect to MongoDB. Verify MONGODB_URI and network access.');
  }
}

/**
 * Return non-sensitive MongoDB connection status for health checks.
 */
export function getDatabaseStatus() {
  const isConfigured = Boolean((process.env.MONGODB_URI || process.env.MONGO_URI)?.trim());
  const readyState = mongoose.connection.readyState;

  if (!isConfigured) {
    return {
      configured: false,
      connected: false,
      database: 'not_configured',
      message: 'Database connection is awaiting MONGO_URI configuration',
    };
  }

  if (readyState === 1) {
    return {
      configured: true,
      connected: true,
      database: 'connected',
    };
  }

  if (readyState === 2) {
    return {
      configured: true,
      connected: false,
      database: 'connecting',
      message: 'Connecting to MongoDB',
    };
  }

  return {
    configured: true,
    connected: false,
    database: 'disconnected',
    message: 'MongoDB is disconnected',
  };
}

