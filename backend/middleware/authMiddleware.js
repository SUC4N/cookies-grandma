/**
 * Cookies Grandma — JWT Auth Middleware
 */
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'cookiesgrandma_secret';

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  try {
    req.admin = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    return res.status(403).json({ success: false, message: 'Invalid token.' });
  }
}

module.exports = { requireAuth };
