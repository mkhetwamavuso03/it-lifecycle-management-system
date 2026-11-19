import 'dotenv/config';
import mongoose from 'mongoose';
import { seedDatabase } from './seed';

seedDatabase()
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
