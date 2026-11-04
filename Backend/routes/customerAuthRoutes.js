// Adapted from LPG-Mobile's customer auth routes for LPG-App's string IDs/schema.
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { nextEntityId } = require('../utils/entityIds');

const accountQuery = `SELECT a.CustomerID, a.Email, a.PasswordHash, c.CustomerName,
  c.ContactNo, c.Address, c.CustomerType, c.Status FROM CustomerAuth a
  JOIN Customer c ON c.CustomerID=a.CustomerID`;
const profile = account => ({ customerId: account.CustomerID, fullName: account.CustomerName,
  email: account.Email, contactNo: account.ContactNo, address: account.Address, customerType: account.CustomerType });
const session = account => ({ token: jwt.sign({ sub: account.CustomerID, type: 'customer', email: account.Email },
  process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }), customer: profile(account) });

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password)
    throw new ApiError(400, 'Email and password are required.');
  const [rows] = await pool.query(`${accountQuery} WHERE a.Email=:email`, { email: email.trim().toLowerCase() });
  const account = rows[0];
  if (!account || !(await bcrypt.compare(password, account.PasswordHash))) throw new ApiError(401, 'Invalid email or password.');
  if (account.Status !== 'Active') throw new ApiError(403, 'This customer account is inactive.');
  res.json(session(account));
}));

router.post('/register', asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword, contactNo, address } = req.body;
  if ([firstName, lastName, email, password, confirmPassword, contactNo, address].some(value => typeof value !== 'string' || !value.trim()))
    throw new ApiError(400, 'All customer account fields are required.');
  if (firstName.trim().length > 75 || lastName.trim().length > 74 || address.trim().length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254 ||
      !/^\+?[0-9 ()-]{7,30}$/.test(contactNo.trim())) throw new ApiError(400, 'Please enter valid customer details.');
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72 || password !== confirmPassword)
    throw new ApiError(400, 'Passwords must match and contain 8–72 bytes.');
  const hash = await bcrypt.hash(password, 12);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const customerId = await nextEntityId(conn, 'Customer');
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const normalizedEmail = email.trim().toLowerCase();
    await conn.query(`INSERT INTO Customer (CustomerID, FirstName, LastName, CustomerName, CustomerType, ContactNo, Address, Status)
      VALUES (:id,:firstName,:lastName,:fullName,'Residential',:phone,:address,'Active')`,
    { id: customerId, firstName: firstName.trim(), lastName: lastName.trim(), fullName, phone: contactNo.trim(), address: address.trim() });
    await conn.query('INSERT INTO CustomerAuth (CustomerID,Email,PasswordHash) VALUES (:id,:email,:hash)',
      { id: customerId, email: normalizedEmail, hash });
    const result = session({ CustomerID: customerId, CustomerName: fullName, Email: normalizedEmail,
      ContactNo: contactNo.trim(), Address: address.trim(), CustomerType: 'Residential' });
    await conn.commit();
    res.status(201).json(result);
  } catch (error) {
    await conn.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'A customer account already uses this email.');
    throw error;
  } finally { conn.release(); }
}));

router.get('/me', asyncHandler(async (req, res) => {
  const header = req.headers.authorization || '';
  let payload;
  try {
    if (!header.startsWith('Bearer ')) throw new Error('missing token');
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (payload.type !== 'customer' || typeof payload.sub !== 'string') throw new Error('wrong account type');
  } catch { throw new ApiError(401, 'Please sign in to your customer account.'); }
  const [rows] = await pool.query(`${accountQuery} WHERE a.CustomerID=:id`, { id: payload.sub });
  if (!rows[0] || rows[0].Status !== 'Active') throw new ApiError(401, 'Customer account is inactive or unavailable.');
  res.json(profile(rows[0]));
}));
module.exports = router;
