import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'whitelabel'
    },
    companyName: {
      type: String,
      default: 'Charusat Tech Corp',
      trim: true
    },
    logoUrl: {
      type: String,
      default: ''
    },
    brandColor: {
      type: String,
      default: '#3b82f6'
    },
    reportTitle: {
      type: String,
      default: 'Executive Task & Performance Report',
      trim: true
    },
    footerText: {
      type: String,
      default: 'Confidential - For Internal Business Use Only',
      trim: true
    },
    contactEmail: {
      type: String,
      default: '24aiml024@charusat.edu.in',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

settingsSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
