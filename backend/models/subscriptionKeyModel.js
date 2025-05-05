const mongoose = require('mongoose');

const subscriptionKeySchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    key: {
      type: String,
      required: true,
      unique: true
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    lastUsed: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Índices para melhorar a performance de consultas
subscriptionKeySchema.index({ userId: 1 });
subscriptionKeySchema.index({ key: 1 });

const SubscriptionKey = mongoose.model('SubscriptionKey', subscriptionKeySchema);

module.exports = SubscriptionKey; 