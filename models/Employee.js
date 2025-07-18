const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Employee must be linked to a user account']
  },
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    trim: true
  },
  position: {
    type: String,
    required: [true, 'Employee position is required'],
    enum: [
      'massage-therapist',
      'esthetician',
      'nail-technician',
      'hair-stylist',
      'wellness-coach',
      'receptionist',
      'manager',
      'supervisor'
    ]
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: [
      'spa-services',
      'wellness',
      'beauty',
      'administration',
      'customer-service'
    ]
  },
  hireDate: {
    type: Date,
    required: [true, 'Hire date is required']
  },
  salary: {
    type: Number,
    required: [true, 'Salary is required'],
    min: [0, 'Salary cannot be negative']
  },
  commissionRate: {
    type: Number,
    default: 0,
    min: [0, 'Commission rate cannot be negative'],
    max: [100, 'Commission rate cannot exceed 100%']
  },
  workSchedule: {
    monday: {
      isWorking: { type: Boolean, default: false },
      startTime: String, // Format: "09:00"
      endTime: String,   // Format: "17:00"
      breakStart: String,
      breakEnd: String
    },
    tuesday: {
      isWorking: { type: Boolean, default: false },
      startTime: String,
      endTime: String,
      breakStart: String,
      breakEnd: String
    },
    wednesday: {
      isWorking: { type: Boolean, default: false },
      startTime: String,
      endTime: String,
      breakStart: String,
      breakEnd: String
    },
    thursday: {
      isWorking: { type: Boolean, default: false },
      startTime: String,
      endTime: String,
      breakStart: String,
      breakEnd: String
    },
    friday: {
      isWorking: { type: Boolean, default: false },
      startTime: String,
      endTime: String,
      breakStart: String,
      breakEnd: String
    },
    saturday: {
      isWorking: { type: Boolean, default: false },
      startTime: String,
      endTime: String,
      breakStart: String,
      breakEnd: String
    },
    sunday: {
      isWorking: { type: Boolean, default: false },
      startTime: String,
      endTime: String,
      breakStart: String,
      breakEnd: String
    }
  },
  specializations: [{
    type: String,
    enum: [
      'deep-tissue-massage',
      'swedish-massage',
      'hot-stone-massage',
      'aromatherapy',
      'facial-treatments',
      'anti-aging-treatments',
      'acne-treatments',
      'manicure',
      'pedicure',
      'gel-nails',
      'hair-removal',
      'body-wraps',
      'wellness-coaching'
    ]
  }],
  certifications: [{
    name: { type: String, required: true },
    issuingOrganization: String,
    issueDate: Date,
    expiryDate: Date,
    certificateNumber: String,
    isActive: { type: Boolean, default: true }
  }],
  skills: [{
    name: String,
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
    yearsOfExperience: Number
  }],
  languages: [{
    language: String,
    proficiency: { type: String, enum: ['basic', 'intermediate', 'fluent', 'native'] }
  }],
  availability: {
    isAvailable: { type: Boolean, default: true },
    unavailableDates: [{
      startDate: Date,
      endDate: Date,
      reason: String,
      type: { type: String, enum: ['vacation', 'sick-leave', 'training', 'personal', 'other'] }
    }]
  },
  performance: {
    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 }
    },
    totalBookings: { type: Number, default: 0 },
    completedBookings: { type: Number, default: 0 },
    cancelledBookings: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    lastPerformanceReview: Date
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
    email: String
  },
  bankDetails: {
    accountNumber: String,
    routingNumber: String,
    bankName: String,
    accountHolderName: String
  },
  documents: [{
    type: { type: String, enum: ['contract', 'id-copy', 'certificate', 'tax-form', 'other'] },
    name: String,
    url: String,
    uploadDate: { type: Date, default: Date.now }
  }],
  notes: [{
    content: String,
    createdBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    isPrivate: { type: Boolean, default: false }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  terminationDate: Date,
  terminationReason: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for years of service
employeeSchema.virtual('yearsOfService').get(function() {
  const endDate = this.terminationDate || new Date();
  const years = (endDate - this.hireDate) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.floor(years * 10) / 10; // Round to 1 decimal place
});

// Virtual for completion rate
employeeSchema.virtual('completionRate').get(function() {
  if (this.performance.totalBookings === 0) return 0;
  return Math.round((this.performance.completedBookings / this.performance.totalBookings) * 100);
});

// Indexes for better query performance
employeeSchema.index({ employeeId: 1 });
employeeSchema.index({ position: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ isActive: 1 });
employeeSchema.index({ 'availability.isAvailable': 1 });
employeeSchema.index({ specializations: 1 });

// Populate user data when querying
employeeSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'user',
    select: 'firstName lastName email phone profileImage'
  });
  next();
});

module.exports = mongoose.model('Employee', employeeSchema);

