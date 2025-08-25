const Membership = require('../models/Membership');
const Service = require('../models/Service');
const User = require('../models/User');


const getAllMembershipTemplates = async (req, res) => {
  try {
    console.log('📋 Fetching membership templates...');
    
    const memberships = await Membership.find({ isTemplate: true })
      .sort({ createdAt: -1 });
    
    res.status(200).json({ 
      success: true, 
      results: memberships.length, 
      data: { memberships } 
    });
  } catch (err) {
    console.error('❌ Error fetching templates:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch membership templates', 
      error: err.message 
    });
  }
};

const getAllPurchasedMemberships = async (req, res) => {
  try {
    const memberships = await Membership.find({ isTemplate: false })
      .sort({ purchaseDate: -1 });
    
    res.status(200).json({ 
      success: true, 
      results: memberships.length, 
      data: { memberships } 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch purchased memberships', 
      error: err.message 
    });
  }
};


const createMembershipTemplate = async (req, res) => {
  try {
    console.log('🆕 Creating membership template:', req.body);
    
    const membershipData = {
      ...req.body,
      isTemplate: true,
      createdBy: req.user ? req.user._id : null,
      status: 'Draft'
    };

    const membership = await Membership.create(membershipData);
    
    res.status(201).json({ 
      success: true, 
      data: { membership } 
    });
  } catch (err) {
    console.error('❌ Error creating template:', err);
    res.status(400).json({ 
      success: false, 
      message: 'Failed to create membership template', 
      error: err.message 
    });
  }
};


const updateMembership = async (req, res) => {
  try {
    const membership = await Membership.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );

    if (!membership) {
      return res.status(404).json({ 
        success: false, 
        message: 'Membership not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      data: { membership } 
    });
  } catch (err) {
    res.status(400).json({ 
      success: false, 
      message: 'Failed to update membership', 
      error: err.message 
    });
  }
};


const deleteMembership = async (req, res) => {
  try {
    const membership = await Membership.findByIdAndDelete(req.params.id);
    if (!membership) {
      return res.status(404).json({ 
        success: false, 
        message: 'Membership not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Membership deleted successfully' 
    });
  } catch (err) {
    res.status(400).json({ 
      success: false, 
      message: 'Failed to delete membership', 
      error: err.message 
    });
  }
};


module.exports = {
  getAllMembershipTemplates,
  getAllPurchasedMemberships,
  createMembershipTemplate,
  updateMembership,
  deleteMembership
};
