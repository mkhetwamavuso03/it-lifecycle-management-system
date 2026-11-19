import mongoose, { Schema, InferSchemaType } from 'mongoose';

const immutable = { immutable: true };

const userSchema = new Schema({
  employeeId: { type: String, required: true, unique: true, trim: true },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['IT_ADMIN','ASSET_MANAGER','EMPLOYEE'], default: 'EMPLOYEE' },
  department: { type: String, required: true, index: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, collection: 'users' });

const sequenceSchema = new Schema({
  _id: { type: String, required: true },
  value: { type: Number, required: true, default: 0 }
}, { versionKey: false, collection: 'sequences' });

const deviceSchema = new Schema({
  assetTag: { type: String, required: true, unique: true, uppercase: true, trim: true },
  serialNumber: { type: String, required: true, unique: true, trim: true },
  macAddress: { type: String, unique: true, sparse: true, validate: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/ },
  category: { type: String, enum: ['LAPTOP','WORKSTATION','MOBILE','SERVER','NETWORK_GEAR','PERIPHERAL'], required: true },
  manufacturer: { type: String, required: true, trim: true },
  modelName: { type: String, required: true, trim: true },
  specs: { cpu: String, ramGb: Number, storageGb: Number, osVersion: String },
  status: { type: String, enum: ['PROCURED','PROVISIONED','MAINTENANCE','DECOMMISSIONED'], default: 'PROCURED' },
  location: { office: String, floor: String, deskOrRack: String },
  financials: { purchaseDate: Date, purchaseCost: Number, vendor: String, warrantyExpiryDate: Date },
  currentAssignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  decommissionDetails: { decommissionedAt: Date, reason: String, certificateOfDestructionUrl: String }
}, { timestamps: true, collection: 'devices' });
deviceSchema.index({ status: 1, category: 1 });
deviceSchema.index({ 'financials.warrantyExpiryDate': 1 });
deviceSchema.index({ currentAssignee: 1 });
deviceSchema.index({ assetTag: 'text', serialNumber: 'text', modelName: 'text' });

const assignmentSchema = new Schema({
  device: { type: Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignedAt: { type: Date, default: Date.now, required: true },
  returnedAt: { type: Date, default: null },
  conditionOnIssue: { type: String, enum: ['NEW','GOOD','FAIR','DAMAGED'], required: true },
  conditionOnReturn: { type: String, enum: ['GOOD','FAIR','DAMAGED','LOST',null], default: null },
  acknowledgmentSigned: { type: Boolean, default: false },
  notes: String
}, { timestamps: true, collection: 'assignments' });
assignmentSchema.index({ device: 1, returnedAt: 1 });
assignmentSchema.index({ assignedTo: 1, returnedAt: 1 });

const maintenanceSchema = new Schema({
  ticketNumber: { type: String, required: true, unique: true },
  device: { type: Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
  reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTechnician: { type: Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['PREVENTIVE','HARDWARE_REPAIR','OS_REIMAGE','WARRANTY_CLAIM','SECURITY_PATCH'], required: true },
  status: { type: String, enum: ['OPEN','IN_PROGRESS','AWAITING_PARTS','COMPLETED','CANCELLED'], default: 'OPEN' },
  description: { type: String, required: true },
  resolutionNotes: String,
  cost: { type: Number, default: 0 },
  scheduledDate: { type: Date, required: true, index: true },
  completedDate: Date
}, { timestamps: true, collection: 'maintenancelogs' });
maintenanceSchema.index({ status: 1, scheduledDate: 1 });
maintenanceSchema.index({ device: 1, createdAt: -1 });

const auditSchema = new Schema({
  entityType: { type: String, enum: ['DEVICE','ASSIGNMENT','MAINTENANCE','USER'], required: true },
  entityId: { type: Schema.Types.ObjectId, required: true, index: true },
  action: { type: String, required: true },
  performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  previousState: Schema.Types.Mixed,
  newState: Schema.Types.Mixed,
  ipAddress: String,
  timestamp: { type: Date, default: Date.now, ...immutable }
}, { timestamps: false, collection: 'auditlogs' });
for (const method of ['updateOne','findOneAndUpdate','deleteOne','findOneAndDelete','replaceOne'] as const) {
  auditSchema.pre(method, function () { throw new Error('AuditLog records are immutable'); });
}

export const User = mongoose.model('User', userSchema);
export const Sequence = mongoose.model('Sequence', sequenceSchema);
export const Device = mongoose.model('Device', deviceSchema);
export const Assignment = mongoose.model('Assignment', assignmentSchema);
export const MaintenanceLog = mongoose.model('MaintenanceLog', maintenanceSchema);
export const AuditLog = mongoose.model('AuditLog', auditSchema);
