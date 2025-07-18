const paymentService = require('../services/paymentService');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');

// Helper function to handle async errors
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Create payment intent
const createPayment = catchAsync(async (req, res, next) => {
  const { bookingId, amount, currency, paymentMethod, gateway } = req.body;
  const userId = req.user._id;

  // Validate required fields
  if (!bookingId || !amount || !currency || !paymentMethod || !gateway) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: bookingId, amount, currency, paymentMethod, gateway'
    });
  }

  // Validate amount
  if (amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Amount must be greater than 0'
    });
  }

  // Validate currency
  const validCurrencies = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR'];
  if (!validCurrencies.includes(currency.toUpperCase())) {
    return res.status(400).json({
      success: false,
      message: `Invalid currency. Supported currencies: ${validCurrencies.join(', ')}`
    });
  }

  // Validate payment method
  const validPaymentMethods = ['card', 'bank_transfer', 'digital_wallet', 'cash'];
  if (!validPaymentMethods.includes(paymentMethod)) {
    return res.status(400).json({
      success: false,
      message: `Invalid payment method. Supported methods: ${validPaymentMethods.join(', ')}`
    });
  }

  // Validate gateway
  const validGateways = ['network_international'];
  if (!validGateways.includes(gateway)) {
    return res.status(400).json({
      success: false,
      message: `Invalid payment gateway. Supported gateways: ${validGateways.join(', ')}`
    });
  }

  // Check if booking exists and belongs to user
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  if (booking.user.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only create payments for your own bookings'
    });
  }

  // Check if payment already exists for this booking
  const existingPayment = await Payment.findOne({ booking: bookingId });
  if (existingPayment) {
    return res.status(400).json({
      success: false,
      message: 'Payment already exists for this booking',
      paymentId: existingPayment._id
    });
  }

  // Create payment
  const result = await paymentService.createPayment(
    bookingId,
    userId,
    amount,
    currency,
    paymentMethod,
    gateway
  );

  res.status(201).json({
    success: true,
    message: 'Payment intent created successfully',
    data: result
  });
});

// Confirm payment
const confirmPayment = catchAsync(async (req, res, next) => {
  const { paymentId, gateway } = req.body;
  const userId = req.user._id;

  if (!paymentId || !gateway) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: paymentId, gateway'
    });
  }

  // Check if payment exists and belongs to user
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  if (payment.user.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only confirm your own payments'
    });
  }

  // Confirm payment
  const result = await paymentService.confirmPayment(paymentId, gateway);

  res.status(200).json({
    success: true,
    message: 'Payment confirmed successfully',
    data: result
  });
});

// Get payment status
const getPaymentStatus = catchAsync(async (req, res, next) => {
  const { paymentId } = req.params;
  const userId = req.user._id;

  // Check if payment exists and belongs to user
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  if (payment.user.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only check your own payments'
    });
  }

  // Get payment status
  const result = await paymentService.getPaymentStatus(paymentId);

  res.status(200).json({
    success: true,
    data: result
  });
});

// Refund payment
const refundPayment = catchAsync(async (req, res, next) => {
  const { paymentId } = req.params;
  const { amount, reason } = req.body;
  const userId = req.user._id;

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: 'Refund reason is required'
    });
  }

  // Check if payment exists and belongs to user
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  if (payment.user.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only refund your own payments'
    });
  }

  if (payment.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Only completed payments can be refunded'
    });
  }

  // Refund payment
  const result = await paymentService.refundPayment(paymentId, amount, reason);

  res.status(200).json({
    success: true,
    message: 'Payment refunded successfully',
    data: result
  });
});

// Get payment history
const getPaymentHistory = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { limit = 10, page = 1 } = req.query;

  const result = await paymentService.getPaymentHistory(userId, parseInt(limit));

  res.status(200).json({
    success: true,
    data: result
  });
});

// Get payment by ID
const getPaymentById = catchAsync(async (req, res, next) => {
  const { paymentId } = req.params;
  const userId = req.user._id;

  const payment = await Payment.findById(paymentId)
    .populate('booking', 'services date time status')
    .populate('user', 'firstName lastName email');

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  if (payment.user._id.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only view your own payments'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      id: payment._id,
      amount: payment.amount / 100,
      currency: payment.currency,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      paymentGateway: payment.paymentGateway,
      createdAt: payment.createdAt,
      booking: payment.booking,
      user: payment.user
    }
  });
});

// Get available payment gateways
const getAvailableGateways = catchAsync(async (req, res, next) => {
  const gateways = [];
  
  if (process.env.NETWORK_INTERNATIONAL_MERCHANT_ID) {
    gateways.push({
      name: 'network_international',
      displayName: 'Network International',
      description: 'Credit/Debit Cards, Digital Wallets, Bank Transfer',
      supportedCurrencies: ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR'],
      supportedMethods: ['card', 'digital_wallet', 'bank_transfer'],
      region: 'UAE & Middle East',
      logo: 'https://www.network.ae/wp-content/uploads/2021/03/network-international-logo.png'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      gateways,
      defaultCurrency: 'AED',
      supportedCurrencies: ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR']
    }
  });
});

// Network International webhook handler
const handleNetworkInternationalWebhook = catchAsync(async (req, res, next) => {
  try {
    console.log('Network International Webhook received:', req.body);
    
    const result = await paymentService.processNetworkInternationalWebhook(req.body);
    
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Network International Webhook error:', error);
    res.status(400).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message
    });
  }
});

// Payment success callback
const paymentSuccess = catchAsync(async (req, res, next) => {
  const { paymentId, orderId, transactionId, status } = req.query;

  if (!paymentId) {
    return res.status(400).json({
      success: false,
      message: 'Payment ID is required'
    });
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  // Update payment status if provided
  if (status && orderId && transactionId) {
    payment.status = status === 'SUCCESS' ? 'completed' : 'failed';
    payment.gatewayTransactionId = transactionId;
    payment.gatewayOrderId = orderId;
    await payment.save();

    // Update booking status if payment successful
    if (payment.status === 'completed') {
      await Booking.findByIdAndUpdate(payment.booking, {
        status: 'confirmed',
        paymentStatus: 'paid'
      });
    }
  }

  res.status(200).json({
    success: true,
    message: 'Payment processed successfully',
    data: {
      paymentId: payment._id,
      status: payment.status,
      amount: payment.amount / 100,
      currency: payment.currency
    }
  });
});

// Payment cancel callback
const paymentCancel = catchAsync(async (req, res, next) => {
  const { paymentId } = req.query;

  if (!paymentId) {
    return res.status(400).json({
      success: false,
      message: 'Payment ID is required'
    });
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  // Update payment status to cancelled
  payment.status = 'cancelled';
  await payment.save();

  res.status(200).json({
    success: true,
    message: 'Payment cancelled',
    data: {
      paymentId: payment._id,
      status: payment.status
    }
  });
});

// Cash Movement Summary for a given date
const getCashMovementSummary = async (req, res) => {
  let { date } = req.query; // Expecting YYYY-MM-DD
  
  // If no date provided, use today's date
  if (!date) {
    date = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  }
  
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Date must be in YYYY-MM-DD format' 
    });
  }
  
  const start = new Date(date + 'T00:00:00.000Z');
  const end = new Date(date + 'T23:59:59.999Z');

  try {
    // Aggregate payments by paymentMethod and status
    const payments = await Payment.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { paymentMethod: "$paymentMethod", status: "$status" },
          total: { $sum: "$amount" }
        }
      }
    ]);

    // Format the result
    const summary = {};
    payments.forEach(item => {
      const method = item._id.paymentMethod;
      const status = item._id.status;
      if (!summary[method]) summary[method] = { paymentsCollected: 0, refundsPaid: 0 };
      if (status === "completed") summary[method].paymentsCollected += item.total / 100;
      if (status === "refunded") summary[method].refundsPaid += item.total / 100;
    });

    res.json({ success: true, data: summary, date: date });
  } catch (err) {
    console.error('Cash movement summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch cash movement summary', error: err.message });
  }
};

// Get all payments (admin only)
const getAllPayments = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const payments = await Payment.find()
    .populate('user', 'firstName lastName email')
    .populate({
      path: 'booking',
      select: 'bookingNumber appointmentDate status',
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  const total = await Payment.countDocuments();
  res.status(200).json({
    success: true,
    results: payments.length,
    total,
    data: { payments }
  });
});

module.exports = {
  createPayment,
  confirmPayment,
  getPaymentStatus,
  refundPayment,
  getPaymentHistory,
  getPaymentById,
  getAvailableGateways,
  handleNetworkInternationalWebhook,
  paymentSuccess,
  paymentCancel,
  getCashMovementSummary,
  getAllPayments // <-- export new function
}; 