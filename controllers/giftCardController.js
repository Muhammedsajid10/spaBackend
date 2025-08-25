const GiftCard = require('../models/GiftCard');
const User = require('../models/User');

const getAllGiftCardTemplates = async (req, res) => {
  try {
    const giftCards = await GiftCard.find({ isTemplate: true })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      results: giftCards.length,
      data: { giftCards }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gift card templates',
      error: err.message
    });
  }
};

const getAllPurchasedGiftCards = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    let filter = { isTemplate: false };
    
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.$gte = new Date(startDate);
      if (endDate) filter.purchaseDate.$lte = new Date(endDate);
    }

    const giftCards = await GiftCard.find(filter)
      .populate('purchasedBy', 'firstName lastName email')
      .populate('usageHistory.usedBy', 'firstName lastName')
      .sort({ purchaseDate: -1 });
    
    res.status(200).json({
      success: true,
      results: giftCards.length,
      data: { giftCards }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchased gift cards',
      error: err.message
    });
  }
};

const createGiftCardTemplate = async (req, res) => {
  try {
    const giftCardData = {
      ...req.body,
      isTemplate: true,
      createdBy: req.user._id
    };

    if (!giftCardData.expiryDate) {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      giftCardData.expiryDate = expiryDate;
    }

    const giftCard = await GiftCard.create(giftCardData);
    
    const populatedGiftCard = await GiftCard.findById(giftCard._id)
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      data: { giftCard: populatedGiftCard }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: 'Failed to create gift card template',
      error: err.message
    });
  }
};

const purchaseGiftCard = async (req, res) => {
  try {
    const {
      templateId,
      purchasedBy,
      recipientName,
      recipientEmail,
      recipientPhone,
      personalMessage,
      customValue,
      customPrice,
      expiryMonths = 12
    } = req.body;

    let giftCardData;

    if (templateId) {
      const template = await GiftCard.findById(templateId);
      if (!template || !template.isTemplate) {
        return res.status(404).json({
          success: false,
          message: 'Gift card template not found'
        });
      }

      giftCardData = {
        name: template.name,
        description: template.description,
        value: customValue || template.value,
        price: customPrice || template.price,
        currency: template.currency
      };
    } else {
      giftCardData = {
        name: req.body.name || 'Custom Gift Card',
        description: req.body.description || 'Custom gift card',
        value: req.body.value,
        price: req.body.price,
        currency: req.body.currency || 'USD'
      };
    }

    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

    const purchasedGiftCard = await GiftCard.create({
      ...giftCardData,
      purchasedBy,
      recipientName,
      recipientEmail,
      recipientPhone,
      personalMessage,
      expiryDate,
      isTemplate: false,
      purchaseDate: new Date(),
      createdBy: req.user._id
    });

    const populatedGiftCard = await GiftCard.findById(purchasedGiftCard._id)
      .populate('purchasedBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      data: { giftCard: populatedGiftCard }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: 'Failed to purchase gift card',
      error: err.message
    });
  }
};

const validateGiftCard = async (req, res) => {
  try {
    const { code } = req.params;
    
    const giftCard = await GiftCard.findByCode(code);
    
    if (!giftCard) {
      return res.status(404).json({
        success: false,
        message: 'Gift card not found'
      });
    }

    const validation = giftCard.validateForUse();

    res.status(200).json({
      success: true,
      data: {
        giftCard: {
          _id: giftCard._id,
          name: giftCard.name,
          code: giftCard.code,
          value: giftCard.value,
          remainingValue: giftCard.remainingValue,
          status: giftCard.status,
          expiryDate: giftCard.expiryDate,
          isExpired: giftCard.isExpired
        },
        validation
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error validating gift card',
      error: err.message
    });
  }
};

const useGiftCard = async (req, res) => {
  try {
    const { code } = req.params;
    const { amount, bookingId, notes } = req.body;

    const giftCard = await GiftCard.findByCode(code);
    
    if (!giftCard) {
      return res.status(404).json({
        success: false,
        message: 'Gift card not found'
      });
    }

    await giftCard.useGiftCard(amount, req.user._id, bookingId, notes);

    const updatedGiftCard = await GiftCard.findById(giftCard._id)
      .populate('usageHistory.usedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Gift card used successfully',
      data: {
        giftCard: updatedGiftCard,
        amountUsed: amount,
        remainingValue: updatedGiftCard.remainingValue
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to use gift card',
      error: err.message
    });
  }
};

const getGiftCardByCode = async (req, res) => {
  try {
    const { code } = req.params;
    
    const giftCard = await GiftCard.findByCode(code)
      .populate('purchasedBy', 'firstName lastName email')
      .populate('usageHistory.usedBy', 'firstName lastName')
      .populate('usageHistory.bookingId');

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        message: 'Gift card not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { giftCard }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching gift card',
      error: err.message
    });
  }
};

const updateGiftCard = async (req, res) => {
  try {
    const giftCard = await GiftCard.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        message: 'Gift card not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { giftCard }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: 'Failed to update gift card',
      error: err.message
    });
  }
};

const deleteGiftCard = async (req, res) => {
  try {
    const giftCard = await GiftCard.findByIdAndDelete(req.params.id);
    
    if (!giftCard) {
      return res.status(404).json({
        success: false,
        message: 'Gift card not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Gift card deleted successfully'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: 'Failed to delete gift card',
      error: err.message
    });
  }
};

const cancelGiftCard = async (req, res) => {
  try {
    const { reason } = req.body;
    
    const giftCard = await GiftCard.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'Cancelled',
        notes: reason ? `Cancelled: ${reason}` : 'Cancelled by admin'
      },
      { new: true }
    );

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        message: 'Gift card not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Gift card cancelled successfully',
      data: { giftCard }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: 'Failed to cancel gift card',
      error: err.message
    });
  }
};

const getGiftCardStats = async (req, res) => {
  try {
    const stats = await GiftCard.aggregate([
      {
        $facet: {
          templates: [
            { $match: { isTemplate: true } },
            { $count: "count" }
          ],
          purchased: [
            { $match: { isTemplate: false } },
            { $count: "count" }
          ],
          active: [
            { $match: { isTemplate: false, status: 'Active' } },
            { $count: "count" }
          ],
          used: [
            { $match: { isTemplate: false, status: 'Used' } },
            { $count: "count" }
          ],
          expired: [
            { $match: { isTemplate: false, status: 'Expired' } },
            { $count: "count" }
          ],
          totalSales: [
            { $match: { isTemplate: false } },
            { $group: { _id: null, total: { $sum: '$purchasePrice' } } }
          ],
          totalValue: [
            { $match: { isTemplate: false } },
            { $group: { _id: null, total: { $sum: '$value' } } }
          ],
          remainingValue: [
            { $match: { isTemplate: false, status: { $in: ['Active', 'Partially Used'] } } },
            { $group: { _id: null, total: { $sum: '$remainingValue' } } }
          ]
        }
      }
    ]);

    const result = {
      templates: stats[0].templates[0]?.count || 0,
      purchased: stats[0].purchased[0]?.count || 0,
      active: stats[0].active[0]?.count || 0,
      used: stats[0].used[0]?.count || 0,
      expired: stats[0].expired[0]?.count || 0,
      totalSales: stats[0].totalSales[0]?.total || 0,
      totalValue: stats[0].totalValue[0]?.total || 0,
      remainingValue: stats[0].remainingValue[0]?.total || 0
    };

    res.status(200).json({
      success: true,
      data: { stats: result }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gift card statistics',
      error: err.message
    });
  }
};

module.exports = {
  getAllGiftCardTemplates,
  getAllPurchasedGiftCards,
  createGiftCardTemplate,
  purchaseGiftCard,
  validateGiftCard,
  useGiftCard,
  getGiftCardByCode,
  updateGiftCard,
  deleteGiftCard,
  cancelGiftCard,
  getGiftCardStats
};
