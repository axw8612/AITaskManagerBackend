import { db } from '../database/connection';
import { TestHelpers } from './utils/testHelpers';

describe('Database Connection', () => {
  afterAll(async () => {
    await db.destroy();
  });

  test('should connect to database', async () => {
    const result = await db.raw('SELECT 1 as result');
    expect(result.rows[0].result).toBe(1);
  });

  test('should clean database', async () => {
    await TestHelpers.cleanDatabase();
    const userCount = await db('users').count('* as count');
    expect(Number(userCount[0].count)).toBe(0);
  });
});
