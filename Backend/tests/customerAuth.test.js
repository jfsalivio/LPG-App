const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const router = require('../routes/customerAuthRoutes');
const { authenticate } = require('../middleware/auth');

const account = { CustomerID: 'CUST-002', Email: 'customer@example.test', PasswordHash: 'hash',
  CustomerName: 'Test Customer', Status: 'Active', ContactNo: '09123456789', Address: 'Example Street', CustomerType: 'Residential' };
function invoke(method, path, body = {}, headers = {}) {
  const handler = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack[0].handle;
  return new Promise((resolve, reject) => {
    let status = 200;
    handler({ body, headers }, { status(value) { status = value; return this; }, json(data) { resolve({ status, data }); } }, reject);
  });
}

test('customer login normalizes email, verifies password, and returns only customer identity', async t => {
  t.mock.method(pool, 'query', async (_sql, params) => { assert.equal(params.email, account.Email); return [[account]]; });
  t.mock.method(bcrypt, 'compare', async (password, hash) => password === 'correct' && hash === 'hash');
  t.mock.method(jwt, 'sign', payload => { assert.equal(payload.type, 'customer'); assert.equal(payload.sub, account.CustomerID); assert.equal(payload.userId, undefined); return 'customer-token'; });
  const result = await invoke('post', '/login', { email: ' CUSTOMER@example.test ', password: 'correct' });
  assert.equal(result.data.token, 'customer-token');
  assert.equal(result.data.customer.customerId, account.CustomerID);
  assert.equal(result.data.customer.PasswordHash, undefined);
  await assert.rejects(invoke('post', '/login', { email: account.Email, password: 'wrong' }), error => error.statusCode === 401);
});

test('inactive customer accounts cannot sign in or restore sessions', async t => {
  t.mock.method(pool, 'query', async () => [[{ ...account, Status: 'Inactive' }]]);
  t.mock.method(bcrypt, 'compare', async () => true);
  t.mock.method(jwt, 'verify', () => ({ type: 'customer', sub: account.CustomerID }));
  await assert.rejects(invoke('post', '/login', { email: account.Email, password: 'correct' }), error => error.statusCode === 403);
  await assert.rejects(invoke('get', '/me', {}, { authorization: 'Bearer test' }), error => error.statusCode === 401);
});

test('customer and staff tokens cannot cross account boundaries', async t => {
  t.mock.method(pool, 'query', async () => assert.fail('No account lookup should occur for the wrong token type'));
  const verify = t.mock.method(jwt, 'verify', () => ({ userId: 'U-001' }));
  await assert.rejects(invoke('get', '/me', {}, { authorization: 'Bearer staff' }), error => error.statusCode === 401);
  verify.mock.mockImplementation(() => ({ type: 'customer', sub: account.CustomerID }));
  const error = await new Promise(resolve => authenticate({ headers: { authorization: 'Bearer customer' } }, {}, resolve));
  assert.equal(error.statusCode, 403);
});

const registration = { firstName: 'Test', lastName: 'Customer', email: account.Email,
  password: 'Customer123!', confirmPassword: 'Customer123!', contactNo: account.ContactNo, address: account.Address };

test('registration validates fields before touching the database', async t => {
  t.mock.method(pool, 'getConnection', async () => assert.fail('Invalid registrations must not open a connection'));
  for (const body of [{}, { ...registration, confirmPassword: 'mismatch' }, { ...registration, email: 'invalid' }, { ...registration, password: 'a'.repeat(73), confirmPassword: 'a'.repeat(73) }])
    await assert.rejects(invoke('post', '/register', body), error => error.statusCode === 400);
});

test('registration persists a hashed password atomically and duplicate email rolls back the customer', async t => {
  let duplicate = false, commits = 0, rollbacks = 0, releases = 0;
  const connection = {
    beginTransaction: async () => {}, commit: async () => { commits++; }, rollback: async () => { rollbacks++; }, release: () => { releases++; },
    query: async (sql, params) => {
      if (sql.includes('EntityIdSequence')) return [{ insertId: 2 }];
      if (sql.includes('INSERT INTO CustomerAuth')) {
        assert.equal(params.hash, 'hashed-customer-password'); assert.equal(params.id, 'CUST-002');
        if (duplicate) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
      }
      return [{ affectedRows: 1 }];
    },
  };
  t.mock.method(pool, 'getConnection', async () => connection);
  t.mock.method(bcrypt, 'hash', async () => 'hashed-customer-password');
  t.mock.method(jwt, 'sign', () => 'customer-token');
  const result = await invoke('post', '/register', registration);
  assert.equal(result.status, 201); assert.equal(commits, 1); assert.equal(releases, 1);
  duplicate = true;
  await assert.rejects(invoke('post', '/register', registration), error => error.statusCode === 409);
  assert.equal(commits, 1); assert.equal(rollbacks, 1); assert.equal(releases, 2);
});
