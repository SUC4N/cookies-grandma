const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'cookiesgrandma_secret';

function requireAuth(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided.' });
  try {
    req.admin = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    const msg = e.name === 'TokenExpiredError' ? 'Token expired.' : 'Invalid token.';
    res.status(401).json({ success: false, message: msg });
  }
}

module.exports = { requireAuth };
