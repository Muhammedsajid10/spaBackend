const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(protect);

// Admin: get all memberships
router.get('/admin/all', isAdmin, membershipController.getAllMemberships);

// Get memberships for a specific client
router.get('/client/:id', membershipController.getClientMemberships);

// Create a membership
router.post('/', isAdmin, membershipController.createMembership);

// Update a membership
router.patch('/:id', isAdmin, membershipController.updateMembership);

// Delete a membership
router.delete('/:id', isAdmin, membershipController.deleteMembership);

module.exports = router; 