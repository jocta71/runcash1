const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const SecurityUtils = require('../utils/SecurityUtils');

// ... existing code ... 