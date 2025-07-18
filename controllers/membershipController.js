const Membership = require('../models/Membership');
const User = require('../models/User');

// Get all memberships (admin)
exports.getAllMemberships = async (req, res) => {
  try {
    const memberships = await Membership.find().populate('client', 'firstName lastName email');
    res.status(200).json({ success: true, results: memberships.length, data: { memberships } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch memberships', error: err.message });
  }
};

// Get memberships for a specific client
exports.getClientMemberships = async (req, res) => {
  try {
    const memberships = await Membership.find({ client: req.params.id }).populate('client', 'firstName lastName email');
    res.status(200).json({ success: true, results: memberships.length, data: { memberships } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch client memberships', error: err.message });
  }
};

// Create a membership
exports.createMembership = async (req, res) => {
  try {
    const membership = await Membership.create(req.body);
    res.status(201).json({ success: true, data: { membership } });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Failed to create membership', error: err.message });
  }
};

// Update a membership
exports.updateMembership = async (req, res) => {
  try {
    const membership = await Membership.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found' });
    res.status(200).json({ success: true, data: { membership } });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Failed to update membership', error: err.message });
  }
};

// Delete a membership
exports.deleteMembership = async (req, res) => {
  try {
    const membership = await Membership.findByIdAndDelete(req.params.id);
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found' });
    res.status(200).json({ success: true, message: 'Membership deleted' });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Failed to delete membership', error: err.message });
  }
}; 