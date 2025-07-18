const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
  name: { type: String, required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['One-time', 'Recurring'], default: 'One-time' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['Active', 'Used', 'Expired'], default: 'Active' },
  totalCharged: { type: Number, required: true },
}, {
  timestamps: true
});

module.exports = mongoose.model('Membership', membershipSchema); 